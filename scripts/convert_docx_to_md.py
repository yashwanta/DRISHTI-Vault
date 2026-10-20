#!/usr/bin/env python3
"""Convert .docx files to Markdown using python-docx.

The converter walks a directory tree and writes a matching .md file next to
each Word document. It preserves common Word structure:
headings, bold/italic text, hyperlinks, bulleted and numbered lists, tables,
inline images, block quotes, and code-styled paragraphs.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import zipfile
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterator, List, Tuple

from docx import Document
from docx.document import Document as DocxDocument
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph


def local_name(tag: str) -> str:
    """Return an XML element local name without the namespace URI."""
    return tag.rsplit("}", 1)[-1]


def local_attr(element: Any, name: str) -> str | None:
    """Return an XML attribute value by local name."""
    for key, value in element.attrib.items():
        if local_name(key) == name:
            return value
    return None


def iter_block_items(parent: Any) -> Iterator[Paragraph | Table]:
    """Yield paragraphs and tables in document order."""
    if isinstance(parent, DocxDocument):
        parent_elm = parent.element.body
    elif hasattr(parent, "_tc"):
        parent_elm = parent._tc
    else:
        parent_elm = parent._element

    for child in parent_elm.iterchildren():
        if child.tag == qn("w:p"):
            yield Paragraph(child, parent)
        elif child.tag == qn("w:tbl"):
            yield Table(child, parent)


def parse_numbering(docx_path: Path) -> Dict[str, str]:
    """Map Word numbering IDs to their base format, such as bullet or decimal."""
    formats: Dict[str, str] = {}
    try:
        with zipfile.ZipFile(docx_path) as archive:
            if "word/numbering.xml" not in archive.namelist():
                return formats
            numbering_xml = archive.read("word/numbering.xml")
    except (OSError, zipfile.BadZipFile, KeyError):
        return formats

    try:
        import xml.etree.ElementTree as ET

        root = ET.fromstring(numbering_xml)
    except ET.ParseError:
        return formats

    abstracts: Dict[str, Dict[str, str]] = {}
    for abstract in root:
        if local_name(abstract.tag) != "abstractNum":
            continue
        abstract_id = local_attr(abstract, "abstractNumId")
        if abstract_id is None:
            continue
        levels: Dict[str, str] = {}
        for level in abstract:
            if local_name(level.tag) != "lvl":
                continue
            ilvl = local_attr(level, "ilvl") or "0"
            fmt = "decimal"
            for child in level:
                if local_name(child.tag) == "numFmt":
                    fmt = local_attr(child, "val") or fmt
                    break
            levels[ilvl] = fmt
        abstracts[abstract_id] = levels

    for num in root:
        if local_name(num.tag) != "num":
            continue
        num_id = local_attr(num, "numId")
        if num_id is None:
            continue
        abstract_id = None
        for child in num:
            if local_name(child.tag) == "abstractNumId":
                abstract_id = local_attr(child, "val")
                break
        if abstract_id and abstract_id in abstracts:
            formats[num_id] = abstracts[abstract_id].get("0", "decimal")
    return formats


def run_text(element: Any) -> str:
    """Extract text from a run, preserving tabs and line breaks."""
    chunks: List[str] = []
    for child in element.iter():
        name = local_name(child.tag)
        if name == "t":
            chunks.append(child.text or "")
        elif name == "tab":
            chunks.append("\t")
        elif name in ("br", "cr"):
            chunks.append("\n")
    return "".join(chunks)


def has_run_property(element: Any, *names: str) -> bool:
    """Return whether a run property is explicitly enabled."""
    rpr = element.find(qn("w:rPr"))
    if rpr is None:
        return False
    for child in rpr:
        if local_name(child.tag) not in names:
            continue
        value = local_attr(child, "val")
        if value not in ("0", "false"):
            return True
    return False


def apply_inline_format(text: str, bold: bool, italic: bool) -> str:
    """Apply lightweight Markdown inline formatting."""
    if bold and italic:
        return f"***{text}***"
    if bold:
        return f"**{text}**"
    if italic:
        return f"_{text}_"
    return text


TAG_RULES: List[Tuple[str, Tuple[str, ...]]] = [
    (
        "security",
        (
            "security",
            "hardening",
            "risk",
            "assessment",
            "cve",
            "vulnerability",
            "firewall",
            "cyber",
        ),
    ),
    ("noc", ("noc", "network", "federation", "multi-plant", "multi_plant")),
    ("server", ("server", "proxmox", "vm", "virtualization", "host", "linux", "windows")),
    ("project", ("project", "plan", "roadmap", "build")),
    ("podman", ("podman", "container", "docker")),
    (
        "siteops",
        (
            "site",
            "plant",
            "line-side",
            "line_side",
            "work-instruction",
            "work_instruction",
        ),
    ),
    (
        "documentation",
        ("doc", "report", "notes", "reference", "guide", "instruction"),
    ),
]


def safe_obsidian_name(value: str) -> str:
    """Return a filename or wikilink stem safe for Obsidian and Windows."""
    cleaned = re.sub(r'[\\/:*?"<>|#^\[\]]+', "_", value)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or "Untitled"


def human_title(stem: str) -> str:
    """Turn a filename stem into a readable title while preserving acronyms."""
    spaced = re.sub(r"[_-]+", " ", stem)
    words = [word for word in re.split(r"\s+", spaced) if word]
    return " ".join(word if word.isupper() else word.capitalize() for word in words)


def inferred_tags(docx_path: Path) -> List[str]:
    """Infer Obsidian tags from the document path and filename."""
    haystack = f"{docx_path.name} {str(docx_path.parent)}".lower()
    haystack = haystack.replace("_", "-")
    tags = ["docx"]
    for tag, needles in TAG_RULES:
        if any(needle in haystack for needle in needles):
            tags.append(tag)
    return list(dict.fromkeys(tags))


def yaml_scalar(value: str) -> str:
    """Quote a string for YAML using JSON string escaping."""
    return json.dumps(value, ensure_ascii=False)


def frontmatter(title: str, source: str, tags: List[str], docx_path: Path) -> str:
    """Build Obsidian-compatible YAML frontmatter."""
    created = ""
    try:
        created = datetime.fromtimestamp(docx_path.stat().st_mtime).date().isoformat()
    except OSError:
        created = datetime.now().date().isoformat()

    lines = [
        "---",
        f"title: {yaml_scalar(title)}",
        f"source: {yaml_scalar(source)}",
        f"created: {created}",
        "tags:",
    ]
    for tag in tags:
        lines.append(f"  - {yaml_scalar(tag)}")
    lines.append("---")
    return "\n".join(lines)


def wikilink(stem: str, title: str) -> str:
    """Create an Obsidian wikilink with a readable alias."""
    if stem == title:
        return f"[[{stem}]]"
    return f"[[{stem}|{title}]]"


def related_documents_section(peers: List[Dict[str, Any]]) -> str:
    """Build a Related Documents section that links this note into the graph."""
    if not peers:
        return ""
    ordered = sorted(peers, key=lambda item: item["title"].lower())
    lines = ["## Related Documents", ""]
    lines.extend(
        f"- {wikilink(item['stem'], item['title'])}"
        for item in ordered
    )
    return "\n".join(lines)


def relationship_target(doc: DocxDocument, rid: str) -> str | None:
    """Resolve a relationship ID to a URL or package target path."""
    relationship = doc.part.rels.get(rid)
    if relationship is None:
        return None
    return relationship.target_ref


def render_children(element: Any, doc: DocxDocument) -> str:
    """Render the direct paragraph children, including hyperlinks."""
    output: List[str] = []
    for child in element:
        name = local_name(child.tag)
        if name == "r":
            text = run_text(child)
            bold = has_run_property(child, "b", "bCs")
            italic = has_run_property(child, "i", "iCs")
            output.append(apply_inline_format(text, bold, italic))
        elif name == "hyperlink":
            rid = local_attr(child, "id")
            target = relationship_target(doc, rid) if rid else None
            text = run_text(child)
            output.append(f"[{text}]({target})" if target else text)
        elif name == "ins":
            output.append(render_children(child, doc))
        elif name == "del":
            continue
        elif name == "tab":
            output.append("\t")
        elif name in ("br", "cr"):
            output.append("\n")
        elif name == "instrText":
            output.append(child.text or "")
    return "".join(output)


def image_target(blip: Any, doc: DocxDocument) -> str | None:
    """Resolve a blip element to its media package path."""
    rid = local_attr(blip, "embed") or local_attr(blip, "link")
    if not rid:
        return None
    target = relationship_target(doc, rid)
    if not target:
        return None
    if target.startswith("/word/"):
        target = target[len("/word/") :]
    elif target.startswith("word/"):
        target = target[len("word/") :]
    if not target.startswith("media/"):
        return None
    return target


def extract_images(paragraph: Paragraph, ctx: Dict[str, Any]) -> List[str]:
    """Extract paragraph images and return relative Markdown image links."""
    doc = ctx["doc"]
    docx_path = ctx["docx_path"]
    assets_dir = ctx["assets_dir"]
    saved = ctx["saved_images"]
    links: List[str] = []

    for blip in paragraph._p.findall(".//" + qn("a:blip")):
        target = image_target(blip, doc)
        if target is None:
            continue
        if target in saved:
            links.append(f"![image]({saved[target]})")
            continue

        try:
            with zipfile.ZipFile(docx_path) as archive:
                image_bytes = archive.read(f"word/{target}")
        except (OSError, zipfile.BadZipFile, KeyError):
            continue

        assets_dir.mkdir(parents=True, exist_ok=True)
        extension = Path(target).suffix.lstrip(".") or "png"
        ctx["image_counter"] += 1
        filename = f"image-{ctx['image_counter']}.{extension}"
        (assets_dir / filename).write_bytes(image_bytes)
        relative_path = f"{assets_dir.name}/{filename}"
        saved[target] = relative_path
        links.append(f"![image]({relative_path})")
    return links


def paragraph_numbering(paragraph: Paragraph) -> Tuple[str | None, int]:
    """Return (numbering_id, list_level) for a paragraph."""
    ppr = paragraph._p.find(qn("w:pPr"))
    if ppr is None:
        return None, 0
    numpr = ppr.find(qn("w:numPr"))
    if numpr is None:
        return None, 0
    num_id = None
    ilvl = 0
    for child in numpr:
        name = local_name(child.tag)
        if name == "numId":
            num_id = local_attr(child, "val")
        elif name == "ilvl":
            try:
                ilvl = int(local_attr(child, "val") or "0")
            except ValueError:
                ilvl = 0
    return num_id, ilvl


def style_looks_like_list(paragraph: Paragraph) -> bool:
    """Detect ListParagraph styles without explicit numbering properties."""
    style_name = (paragraph.style.name if paragraph.style else "").lower()
    return "list" in style_name or "bullet" in style_name or "numbered" in style_name


def paragraph_to_markdown(
    paragraph: Paragraph,
    ctx: Dict[str, Any],
    *,
    for_table: bool = False,
) -> str:
    """Convert one paragraph to Markdown."""
    text = render_children(paragraph._p, ctx["doc"]).strip()
    images = [] if for_table else extract_images(paragraph, ctx)

    if text and images:
        text = f"{text}\n\n" + "\n\n".join(images)
    elif images:
        text = "\n\n".join(images)

    if not text.strip():
        return ""

    if for_table:
        return text.replace("\n", " ").strip()

    style_name = (paragraph.style.name if paragraph.style else "").lower()
    normalized = re.sub(r"\s+", "", style_name)

    if normalized == "title":
        return f"# {text}"
    if normalized == "subtitle":
        return f"## {text}"

    heading_match = re.search(r"heading\s*(\d+)", normalized)
    if heading_match:
        level = min(max(int(heading_match.group(1)), 1), 6)
        return f"{'#' * level} {text}"

    if "code" in normalized or normalized in ("htmlpreformatted", "sourcecode"):
        return f"```\n{text}\n```"

    if "quote" in normalized or "blocktext" in normalized:
        return "\n".join(f"> {line}" for line in text.splitlines())

    num_id, ilvl = paragraph_numbering(paragraph)
    is_list = num_id is not None or style_looks_like_list(paragraph)
    if is_list:
        indent = "  " * ilvl
        ordered = bool(
            num_id
            and ctx["numbering_formats"].get(num_id, "decimal").lower() != "bullet"
        )
        if ordered:
            counter_key = num_id or "ordered"
            counters = ctx["counters"][counter_key]
            if ilvl == 0:
                for level in list(counters):
                    if level > 0:
                        del counters[level]
            counters[ilvl] += 1
            prefix = f"{counters[ilvl]}. "
        else:
            prefix = "- "
        return f"{indent}{prefix}{text}"

    return text.replace("\n", "  \n")


def table_to_markdown(table: Table, ctx: Dict[str, Any]) -> str:
    """Convert a Word table to a GitHub Flavored Markdown table."""
    rows: List[List[str]] = []
    for row in table.rows:
        cells: List[str] = []
        for cell in row.cells:
            parts = [
                paragraph_to_markdown(paragraph, ctx, for_table=True)
                for paragraph in cell.paragraphs
            ]
            parts = [part for part in parts if part.strip()]
            cell_text = "<br>".join(parts)
            cell_text = cell_text.replace("|", "\\|").replace("\n", " ")
            cells.append(cell_text)
        rows.append(cells)

    if not rows:
        return ""

    columns = max(len(row) for row in rows)
    for row in rows:
        while len(row) < columns:
            row.append("")

    lines = [
        "| " + " | ".join(rows[0]) + " |",
        "| " + " | ".join(["---"] * columns) + " |",
    ]
    lines.extend("| " + " | ".join(row) + " |" for row in rows[1:])
    return "\n".join(lines)


def build_metadata(files: List[Path], roots: List[str]) -> List[Dict[str, Any]]:
    """Create conversion metadata for every .docx file."""
    resolved_roots = [Path(root).expanduser().resolve() for root in roots]
    records: List[Dict[str, Any]] = []
    for docx_path in files:
        relative = None
        for root in resolved_roots:
            try:
                relative = docx_path.resolve().relative_to(root)
                break
            except ValueError:
                continue
        if relative is None:
            relative = Path(docx_path.name)

        records.append(
            {
                "docx_path": docx_path,
                "stem": safe_obsidian_name(docx_path.stem),
                "title": human_title(docx_path.stem),
                "tags": inferred_tags(docx_path),
                "relative_path": relative,
                "output_path": docx_path.with_suffix(".md"),
                "assets_dir": docx_path.with_suffix("").with_name(
                    f"{docx_path.stem}-assets"
                ),
                "markdown": "",
            }
        )
    return records


def convert_docx(meta: Dict[str, Any], peers: List[Dict[str, Any]]) -> Dict[str, Any] | None:
    """Convert one .docx file and add Obsidian frontmatter and links."""
    docx_path = meta["docx_path"]
    try:
        doc = Document(str(docx_path))
    except Exception as exc:
        print(f"[SKIP] {docx_path}: {exc}", file=sys.stderr)
        return None

    ctx: Dict[str, Any] = {
        "doc": doc,
        "docx_path": docx_path,
        "assets_dir": meta["assets_dir"],
        "saved_images": {},
        "image_counter": 0,
        "numbering_formats": parse_numbering(docx_path),
        "counters": defaultdict(lambda: defaultdict(int)),
    }

    blocks: List[str] = []
    for block in iter_block_items(doc):
        if isinstance(block, Paragraph):
            markdown = paragraph_to_markdown(block, ctx)
            if markdown:
                blocks.append(markdown)
        elif isinstance(block, Table):
            markdown = table_to_markdown(block, ctx)
            if markdown:
                blocks.append(markdown)

    body = "\n\n".join(blocks).strip()
    body = re.sub(r"\n{3,}", "\n\n", body)
    if not body:
        print(f"[SKIP] {docx_path}: no readable text or images found", file=sys.stderr)
        return None

    related = related_documents_section(
        [peer for peer in peers if peer["stem"] != meta["stem"]]
    )
    if related:
        body = f"{body}\n\n{related}"

    markdown = "\n\n".join(
        [
            frontmatter(
                meta["title"],
                docx_path.name,
                meta["tags"],
                docx_path,
            ),
            body.strip(),
        ]
    )
    meta["markdown"] = markdown + "\n"
    meta["output_path"].write_text(meta["markdown"], encoding="utf-8")
    return meta


def write_obsidian_copy(meta: Dict[str, Any], vault_root: Path) -> Path:
    """Copy one converted note into an Obsidian vault and preserve assets."""
    relative = meta["relative_path"]
    directories = [safe_obsidian_name(part) for part in relative.parts[:-1]]
    filename_stem = safe_obsidian_name(Path(relative.parts[-1]).stem)
    destination = (
        vault_root
        / "600-Converted"
        / Path(*directories)
        / f"{filename_stem}.md"
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(meta["markdown"], encoding="utf-8")

    assets_dir = meta["assets_dir"]
    if assets_dir.exists():
        target_assets = destination.parent / assets_dir.name
        if target_assets.resolve() != assets_dir.resolve():
            target_assets.mkdir(parents=True, exist_ok=True)
            for asset in assets_dir.iterdir():
                if asset.is_file() and asset.name.startswith("image-"):
                    shutil.copy2(asset, target_assets / asset.name)
    return destination


def write_obsidian_index(records: List[Dict[str, Any]], vault_root: Path) -> Path:
    """Write an Obsidian index note that links every converted document."""
    destination = vault_root / "600-Converted" / "_Converted-Documents-Index.md"
    destination.parent.mkdir(parents=True, exist_ok=True)
    ordered = sorted(records, key=lambda item: item["title"].lower())
    links = [
        f"- {wikilink(item['stem'], item['title'])}"
        for item in ordered
    ]
    markdown = "\n\n".join(
        [
            frontmatter(
                "Converted Documents",
                "docx-converter",
                ["docx", "index"],
                destination,
            ),
            "# Converted Documents\n\n## Document Graph",
            "\n".join(links),
        ]
    )
    destination.write_text(markdown + "\n", encoding="utf-8")
    return destination


def find_docx_files(root: Path, *, include_backups: bool) -> List[Path]:
    """Find .docx files, optionally excluding _backups directories."""
    if root.is_file():
        if root.suffix.lower() != ".docx" or root.name.startswith("~$"):
            return []
        return [root]
    files: List[Path] = []
    for path in root.rglob("*.docx"):
        if path.name.startswith("~$"):
            continue
        if not include_backups and any(part == "_backups" for part in path.parts):
            continue
        files.append(path)
    return sorted(files)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "roots",
        nargs="*",
        default=[str(Path.cwd())],
        help="Directories to scan for .docx files (defaults to current directory).",
    )
    parser.add_argument(
        "--include-backups",
        action="store_true",
        help="Also convert .docx files found under _backups directories.",
    )
    parser.add_argument(
        "--obsidian-output",
        help="Optional Obsidian vault root to receive converted notes and an index.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    files: List[Path] = []
    roots: List[Path] = []
    for raw_root in args.roots:
        root = Path(raw_root).expanduser().resolve()
        if not root.exists():
            print(f"[ERROR] Path does not exist: {root}", file=sys.stderr)
            return 2
        roots.append(root)
        files.extend(find_docx_files(root, include_backups=args.include_backups))

    # Preserve scan order while removing duplicates, including Windows junctions
    # that point at the same underlying file.
    unique: Dict[Path, None] = {}
    for path in files:
        unique[path.resolve()] = None
    files = list(unique)

    records = build_metadata(files, [str(root) for root in roots])
    converted: List[Dict[str, Any]] = []
    failed = 0
    for meta in records:
        result = convert_docx(meta, records)
        if result:
            converted.append(result)
            print(f"[OK] {result['output_path']}")
        else:
            failed += 1

    obsidian_root: Path | None = None
    if args.obsidian_output:
        obsidian_root = Path(args.obsidian_output).expanduser().resolve()
        obsidian_root.mkdir(parents=True, exist_ok=True)
        for meta in converted:
            destination = write_obsidian_copy(meta, obsidian_root)
            print(f"[OBSIDIAN] {destination}")
        if converted:
            index_path = write_obsidian_index(converted, obsidian_root)
            print(f"[INDEX] {index_path}")

    print(
        f"\nConverted {len(converted)} file(s), skipped/failed {failed}.",
        file=sys.stderr,
    )
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
