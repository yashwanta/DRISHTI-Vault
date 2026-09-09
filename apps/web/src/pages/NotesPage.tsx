import React from "react";
import JSZip from "jszip";
import * as Prism from "prismjs";
import { basicSetup, EditorView } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState as CodeMirrorState, type Range } from "@codemirror/state";
import { Decoration, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";
import { tags as highlightTags } from "@lezer/highlight";
import "../prism-languages";
import { api } from "../api";
import { DropZone } from "../components/DropZone";
import { Empty, useToast } from "../components/ui";
import type { Note, NoteInput } from "../types";

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = [
  { key: "", label: "Default" },
  { key: "yellow", label: "Yellow" },
  { key: "green", label: "Green" },
  { key: "blue", label: "Blue" },
  { key: "pink", label: "Pink" },
  { key: "purple", label: "Purple" },
  { key: "gray", label: "Gray" },
] as const;

const SORT_OPTIONS = [
  { key: "modified_desc", label: "Modified (newest)" },
  { key: "modified_asc", label: "Modified (oldest)" },
  { key: "created_desc", label: "Created (newest)" },
  { key: "title_asc", label: "Title A–Z" },
  { key: "title_desc", label: "Title Z–A" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];

const TEMPLATES: { name: string; emoji: string; body: string }[] = [
  {
    name: "Daily Note",
    emoji: "📅",
    body: `# {{date}}

## Focus for Today
> What is the ONE most important thing to accomplish today?

- [ ]

## Morning Check
- [ ] Review open incidents
- [ ] Check ticket queue
- [ ] Check server/network alerts
- [ ] Review pending change requests

## Tasks
- [ ]
- [ ]
- [ ]

## Meetings
| Time | Meeting | Notes |
|------|---------|-------|
|      |         |       |

## Incidents / Issues
_Any production issues, alerts, or urgent items today_

## Security Alerts
_CVEs, SOC alerts, or suspicious activity_
- None 🟢

## Open Tickets
Open: _  |  Closed today: _  |  End of day: _

## Notes & Observations

## Wins 🎯

## Tomorrow's Prep
- [ ]
`,
  },
  {
    name: "Incident Report",
    emoji: "🔴",
    body: `# Incident: [Title]

> **Status:** 🔴 Open | **Severity:** P2 — Major | **Ticket:** #

---

## Timeline
| Time | Event |
|------|-------|
| HH:MM | Incident detected |
|       | Resolved |

## Affected Systems
-

## Impact
- **Users affected:**
- **Services down:**
- **Estimated business impact:**

## Root Cause
### Initial hypothesis

### Confirmed cause

## Investigation Steps
1.
2.
3.

## Resolution
### Steps taken

### Workaround (if any)

## Communication Log
| Time | Person | Method | Response |
|------|--------|--------|----------|
|      |        |        |          |

## Post-Incident Review
**Scheduled for:**

### What went well
### What to improve

### Action items
| Action | Owner | Due |
|--------|-------|-----|
|        | Yash  |     |
`,
  },
  {
    name: "Meeting Note",
    emoji: "🤝",
    body: `# Meeting: [Title]

**Date:** {{date}} | **Location:** | **Facilitator:**
**Attendees:**

---

## Agenda
1.
2.
3.

## Discussion & Notes

### Topic 1

### Topic 2

## Decisions Made
-

## Action Items
| # | Action | Owner | Due | Done |
|---|--------|-------|-----|------|
| 1 |        | Yash  |     | [ ]  |

## Follow-up Notes
`,
  },
  {
    name: "Project",
    emoji: "📁",
    body: `# Project: [Title]

> **Status:** 🟡 Planning | **Priority:** Medium | **Due:**

---

## Overview
_What is this project and why?_

## Goals / Success Criteria
- [ ]
- [ ]

## Scope
### In scope
-

### Out of scope
-

## Stakeholders
| Name | Role | Contact |
|------|------|---------|
| Yash | IT Manager / Owner | |

## Milestones
| Milestone | Target | Status |
|-----------|--------|--------|
|           |        | ⬜     |

## Tasks
- [ ]
- [ ]

## Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
|      | Low       | Medium |            |

## Notes & Decisions

## References
-
`,
  },
  {
    name: "Security Review",
    emoji: "🔒",
    body: `# Security Review: [Title]

> **Date:** {{date}} | **Scope:** | **Risk Level:** 🟡 Medium

---

## Review Checklist

### Access & Authentication
- [ ] MFA enabled
- [ ] Least-privilege applied
- [ ] Service accounts reviewed
- [ ] Default credentials changed
- [ ] Password policy meets standard

### Network & Perimeter
- [ ] Firewall rules reviewed
- [ ] Unnecessary ports closed
- [ ] Network segmentation in place (VLANs)
- [ ] VPN / remote access secured

### Data Protection
- [ ] Data classified
- [ ] Encryption at rest: Yes / No / N/A
- [ ] Encryption in transit (TLS 1.2+): Yes / No / N/A
- [ ] Backup encrypted and tested

### Logging & Monitoring
- [ ] Audit logging enabled
- [ ] Logs centralized / SIEM ingesting
- [ ] Alerts configured
- [ ] Log retention meets policy (90 days+)

### Patch & Vulnerability
- [ ] OS patched (within 30 days)
- [ ] Application patched
- [ ] Vulnerability scan run
- [ ] Known CVEs reviewed

## Findings

### Critical 🔴
| # | Finding | System | Remediation | Owner | Due |
|---|---------|--------|-------------|-------|-----|

### High 🟠
| # | Finding | System | Remediation | Owner | Due |
|---|---------|--------|-------------|-------|-----|

### Medium 🟡
| # | Finding | System | Remediation | Owner | Due |
|---|---------|--------|-------------|-------|-----|

## Risk Summary
- **Open Critical:** 0 | **Open High:** 0 | **Open Medium:** 0
- **Overall Risk:** 🟡 Medium

## Recommendations
1.
2.

## Sign-off
- **Reviewed by:** Yash — {{date}}
- **Next review due:**
`,
  },
  {
    name: "Runbook",
    emoji: "📖",
    body: `# Runbook: [Procedure Name]

> **System:** | **Owner:** Yash | **Last reviewed:** {{date}}
> **Est. time:** ___ minutes

---

## Purpose
_When and why to run this procedure_

## Prerequisites
- [ ]
- [ ]

## Steps

### Step 1: [Action]
\`\`\`bash
# command here
\`\`\`

### Step 2: [Action]

### Step 3: [Action]

## Verification
_How to confirm success_

## Rollback
_Steps to undo if something goes wrong_

## Notes & Gotchas
-
`,
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type EditorMode = "edit" | "preview" | "split";
type ReaderMode = "source" | "preview" | "split";
type ViewMode = "grid" | "list";

type EditorState =
  | { kind: "none" }
  | { kind: "new"; title?: string; templateBody?: string }
  | { kind: "edit"; note: Note };

interface Heading { level: number; text: string; line: number; }

interface TagNode { name: string; fullPath: string; count: number; children: Map<string, TagNode>; }

interface GNode {
  id: number; title: string;
  x: number; y: number; vx: number; vy: number;
  r: number;
  kind: "note" | "tag";
  color: string;
  tag?: string;
}
interface GEdge { s: number; t: number; }

interface NoteActions {
  onEdit: (note: Note) => void;
  onPin: (note: Note) => void;
  onStar: (note: Note) => void;
  onDelete: (note: Note) => void;
  onWikiLink: (title: string) => void;
  starredIds: Set<number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function noteColorClass(color: string): string {
  return COLORS.some((c) => c.key === color) && color ? `note-color-${color}` : "note-color-default";
}

function wikiTargets(markdown: string): string[] {
  return Array.from(markdown.matchAll(/\[\[([^\]\n|]+)(?:\|[^\]\n]+)?\]\]/g))
    .map((m) => m[1].trim())
    .filter(Boolean);
}

function plainExcerpt(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " code ")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, t, a) => a || t)
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function applyTemplateVars(body: string): string {
  return body.replace(/\{\{date\}\}/g, todayStr());
}

// ─── Obsidian / ZIP Utilities ────────────────────────────────────────────────

/** CRC-32 table for ZIP archives */
/** Safe filename: strip characters Obsidian/Windows dislikes */
function safeName(title: string): string {
  return (title || "note").replace(/[/\\:*?"<>|#]/g, "_").trim() || "note";
}

/**
 * Generate Obsidian-compatible Markdown with YAML frontmatter.
 * If the note body already starts with ---, we leave it untouched.
 */
function obsidianMarkdown(note: Note): string {
  // Don't double-wrap notes that already have frontmatter
  if (note.body.trimStart().startsWith("---")) return note.body;
  const tagLines = `tags: [${note.tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(", ")}]`;
  const fm = [
    "---",
    `title: "${note.title.replace(/"/g, '\\"')}"`,
    tagLines,
    `created: ${note.created_at}`,
    `modified: ${note.updated_at}`,
    "---",
    "",
  ].join("\n");
  return fm + note.body;
}

/** Download a single note as an Obsidian-compatible .md file */
function exportNote(note: Note): void {
  const content = obsidianMarkdown(note);
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName(note.title)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download a string as a .md file directly (for post-import download) */
function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export every note as an Obsidian vault ZIP */
async function exportVaultAsZip(notes: Note[]): Promise<void> {
  const zip = new JSZip();
  const vault = zip.folder("DRISHTI-Vault");
  if (!vault) throw new Error("Could not create vault folder.");

  notes.forEach((note) => {
    vault.file(`${safeName(note.title)}.md`, obsidianMarkdown(note));
  });
  vault.file(".obsidian/app.json", JSON.stringify({
    legacyEditor: false,
    livePreview: true,
  }, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "DRISHTI-Vault.zip";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Scan note body for inline #hashtag patterns (skips headings and code blocks).
 * Returns normalised tag strings without the leading #.
 */
function detectBodyTags(body: string): string[] {
  const found = new Set<string>();
  let inCode = false;
  for (const line of body.split("\n")) {
    if (line.startsWith("```")) { inCode = !inCode; continue; }
    if (inCode) continue;
    if (/^#{1,6}\s/.test(line)) continue;  // skip headings
    const stripped = line.replace(/`[^`]*`/g, "");  // remove inline code
    for (const m of stripped.matchAll(/(?<![#\w])#([a-zA-Z][a-zA-Z0-9_/-]{0,39})/g)) {
      found.add(m[1].toLowerCase());
    }
  }
  return Array.from(found);
}

function parseOutline(body: string): Heading[] {
  return body.split("\n")
    .map((line, index) => {
      const m = line.match(/^(#{1,6})\s+(.+)$/);
      return m ? { level: m[1].length, text: m[2], line: index } : null;
    })
    .filter(Boolean) as Heading[];
}

function buildTagTree(notes: Note[]): TagNode {
  const root: TagNode = { name: "", fullPath: "", count: 0, children: new Map() };
  for (const note of notes) {
    for (const tag of note.tags) {
      const parts = tag.split("/");
      let node = root;
      let path = "";
      for (const part of parts) {
        path = path ? `${path}/${part}` : part;
        if (!node.children.has(part)) {
          node.children.set(part, { name: part, fullPath: path, count: 0, children: new Map() });
        }
        const child = node.children.get(part)!;
        child.count++;
        node = child;
      }
    }
  }
  return root;
}

function sortNotes(notes: Note[], key: SortKey): Note[] {
  const arr = [...notes];
  if (key === "modified_desc") return arr.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  if (key === "modified_asc") return arr.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  if (key === "created_desc") return arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (key === "title_asc") return arr.sort((a, b) => a.title.localeCompare(b.title));
  if (key === "title_desc") return arr.sort((a, b) => b.title.localeCompare(a.title));
  return arr;
}

// ─── Link Analysis ────────────────────────────────────────────────────────────

type NoteHealthStatus = "healthy" | "broken" | "orphan" | "gap-source";

interface NoteHealth {
  status: NoteHealthStatus;
  brokenTargets: string[];   // [[links]] this note makes that resolve to nothing
  referencedBy: number[];    // IDs of notes that link to this note
  isOrphan: boolean;         // no incoming links AND no outgoing links
}

interface LinkAnalysis {
  health: Map<number, NoteHealth>;
  knowledgeGaps: string[];   // targets referenced by 2+ notes but no note exists
  brokenLinks: Array<{ noteId: number; noteTitle: string; target: string }>;
}

function analyzeLinks(notes: Note[]): LinkAnalysis {
  const titleToId = new Map<string, number>();
  for (const n of notes) titleToId.set(n.title.trim().toLowerCase(), n.id);

  const health = new Map<number, NoteHealth>();
  for (const n of notes) {
    health.set(n.id, { status: "healthy", brokenTargets: [], referencedBy: [], isOrphan: false });
  }

  const gapCount = new Map<string, number>();   // lowercase target → count
  const brokenLinks: LinkAnalysis["brokenLinks"] = [];

  for (const n of notes) {
    const targets = wikiTargets(n.body);
    const h = health.get(n.id)!;
    for (const t of targets) {
      const key = t.trim().toLowerCase();
      const targetId = titleToId.get(key);
      if (targetId !== undefined) {
        health.get(targetId)!.referencedBy.push(n.id);
      } else {
        h.brokenTargets.push(t);
        brokenLinks.push({ noteId: n.id, noteTitle: n.title, target: t });
        gapCount.set(key, (gapCount.get(key) ?? 0) + 1);
      }
    }
  }

  // Mark statuses
  for (const n of notes) {
    const h = health.get(n.id)!;
    const hasOut = wikiTargets(n.body).length > 0;
    const hasIn = h.referencedBy.length > 0;
    if (h.brokenTargets.length > 0) h.status = "broken";
    else if (!hasOut && !hasIn) { h.status = "orphan"; h.isOrphan = true; }
    else h.status = "healthy";
  }

  // Knowledge gaps: targets referenced 2+ times but no note exists
  const knowledgeGaps = Array.from(gapCount.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  return { health, knowledgeGaps, brokenLinks };
}

// ─── Folder Tree ──────────────────────────────────────────────────────────────
// Build folder tree from tag "/" hierarchy – same as buildTagTree but used for
// the folder sidebar panel.

interface FolderNode {
  name: string;
  fullPath: string;
  noteIds: number[];
  children: Map<string, FolderNode>;
}

function buildFolderTree(notes: Note[]): FolderNode {
  const root: FolderNode = { name: "", fullPath: "", noteIds: [], children: new Map() };
  for (const note of notes) {
    for (const tag of note.tags) {
      const parts = tag.split("/");
      let node = root;
      let path = "";
      for (const part of parts) {
        path = path ? `${path}/${part}` : part;
        if (!node.children.has(part)) {
          node.children.set(part, { name: part, fullPath: path, noteIds: [], children: new Map() });
        }
        const child = node.children.get(part)!;
        if (!child.noteIds.includes(note.id)) child.noteIds.push(note.id);
        node = child;
      }
    }
    // Notes with no tags go into root
    if (note.tags.length === 0) root.noteIds.push(note.id);
  }
  return root;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function NotesPage() {
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [query, setQuery] = React.useState("");
  const [selectedTag, setSelectedTag] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("modified_desc");
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const [showSidebar, setShowSidebar] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [editor, setEditor] = React.useState<EditorState>({ kind: "none" });
  const [uploading, setUploading] = React.useState(false);
  const [uploadName, setUploadName] = React.useState("");
  const [importProgress, setImportProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [showGraph, setShowGraph] = React.useState(false);
  const [showImport, setShowImport] = React.useState(false);
  const [starredIds, setStarredIds] = React.useState<Set<number>>(new Set());
  const [lastImported, setLastImported] = React.useState<Note | null>(null);
  const [lastImportWasConverted, setLastImportWasConverted] = React.useState(false);
  const [dupCheck, setDupCheck] = React.useState<{
    allFiles: File[];
    duplicates: Array<{ file: File; existing: Note }>;
    fresh: File[];
  } | null>(null);
  const [showDocBrowser, setShowDocBrowser] = React.useState(true);
  const [docBrowserNote, setDocBrowserNote] = React.useState<Note | null>(null);
  const { show, node: toastNode } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await api.listNotes();
      setNotes(result.items);
    } catch (err) {
      const msg = `Failed to load notes: ${errorMessage(err)}`;
      setLoadError(msg);
      show(msg);
    } finally {
      setLoading(false);
    }
  }, [show]);

  React.useEffect(() => { void load(); }, [load]);

  const allTags = React.useMemo(
    () => Array.from(new Set(notes.flatMap((n) => n.tags))).sort((a, b) => a.localeCompare(b)),
    [notes]
  );

  const tagTree = React.useMemo(() => buildTagTree(notes), [notes]);
  const folderTree = React.useMemo(() => buildFolderTree(notes), [notes]);
  const linkAnalysis = React.useMemo(() => analyzeLinks(notes), [notes]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return notes.filter((note) => {
      let matchesTag: boolean;
      if (!selectedTag) matchesTag = true;
      else if (selectedTag === "__untagged__") matchesTag = note.tags.length === 0;
      else matchesTag = note.tags.some((t) => t === selectedTag || t.startsWith(selectedTag + "/"));
      const haystack = `${note.title}\n${note.body}\n${note.tags.join(" ")}`.toLowerCase();
      return matchesTag && (!needle || haystack.includes(needle));
    });
  }, [notes, query, selectedTag]);

  const sorted = React.useMemo(() => sortNotes(filtered, sortKey), [filtered, sortKey]);
  const pinned = sorted.filter((n) => n.pinned);
  const starred = sorted.filter((n) => !n.pinned && starredIds.has(n.id));
  const others = sorted.filter((n) => !n.pinned && !starredIds.has(n.id));

  const refresh = React.useCallback(async (): Promise<Note[]> => {
    const result = await api.listNotes();
    setNotes(result.items);
    return result.items;
  }, []);

  const saveNote = async (data: NoteInput): Promise<boolean> => {
    try {
      if (editor.kind === "new") {
        await api.createNote({ ...data, pinned: false });
        show("Note created");
      } else if (editor.kind === "edit") {
        await api.updateNote(editor.note.id, data);
        show("Note saved");
      }
      await refresh();
      setEditor({ kind: "none" });
      return true;
    } catch (err) {
      show(`Save failed: ${errorMessage(err)}`);
      return false;
    }
  };

  const togglePin = async (note: Note) => {
    try { await api.toggleNotePin(note.id); await refresh(); }
    catch (err) { show(errorMessage(err)); }
  };

  const toggleStar = (note: Note) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      next.has(note.id) ? next.delete(note.id) : next.add(note.id);
      return next;
    });
  };

  const removeNote = async (note: Note) => {
    if (!window.confirm(`Delete "${note.title || "Untitled"}"? This cannot be undone.`)) return;
    try { await api.deleteNote(note.id); show("Note deleted"); await refresh(); }
    catch (err) { show(`Delete failed: ${errorMessage(err)}`); }
  };

  const openWikiNote = React.useCallback((title: string) => {
    const match = notes.find((n) => n.title.trim().toLowerCase() === title.trim().toLowerCase());
    setEditor(match ? { kind: "edit", note: match } : { kind: "new", title });
  }, [notes]);

  const openToday = React.useCallback(() => {
    const today = todayStr();
    const existing = notes.find((n) => n.title === today);
    if (existing) setEditor({ kind: "edit", note: existing });
    else setEditor({ kind: "new", title: today, templateBody: applyTemplateVars(TEMPLATES[0].body) });
  }, [notes]);

  /** Strip extension to get the likely note title from a filename. */
  const fileTitle = (file: File) =>
    file.name.replace(/\.(md|markdown|docx)$/i, "").trim();

  /** Pre-scan all picked files, warn about duplicates before importing. */
  const handlePickedFiles = (files: File[]) => {
    const titleMap = new Map(notes.map((n) => [n.title.trim().toLowerCase(), n]));
    const duplicates: Array<{ file: File; existing: Note }> = [];
    const fresh: File[] = [];
    for (const f of files) {
      const key = fileTitle(f).toLowerCase();
      const existing = titleMap.get(key);
      if (existing) duplicates.push({ file: f, existing });
      else fresh.push(f);
    }
    if (duplicates.length > 0) {
      setDupCheck({ allFiles: files, duplicates, fresh });
    } else {
      void importFiles(files);
    }
  };

  const importFiles = async (files: File[], replaceExisting: Note[] = []) => {
    if (!files.length) return;
    setUploading(true);
    setImportProgress({ done: 0, total: files.length });
    setLastImported(null);
    setLastImportWasConverted(false);
    let lastNote: Note | undefined;
    let lastConvertedNote: Note | undefined;
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadName(file.name);
      setImportProgress({ done: i, total: files.length });
      try {
        const titleToReplace = fileTitle(file).trim().toLowerCase();
        const replaced = replaceExisting.find(
          (existing) => existing.title.trim().toLowerCase() === titleToReplace
        );
        if (replaced) await api.deleteNote(replaced.id);

        const converted = /\.docx$/i.test(file.name);
        const imported = await api.importNote(file);
        const updated = await refresh();
        const note = updated.find((n) => n.id === imported.id);
        if (note) {
          lastNote = note;
          if (converted) lastConvertedNote = note;
        }
      } catch (err) {
        failed++;
        show(`Failed: ${file.name} — ${errorMessage(err)}`);
      }
    }
    const bannerNote = lastConvertedNote ?? lastNote ?? null;
    setLastImported(bannerNote);
    setLastImportWasConverted(Boolean(lastConvertedNote));
    setImportProgress(null);
    setUploading(false);
    setUploadName("");
    if (files.length === 1) {
      if (failed === 0 && lastNote) {
        show(lastConvertedNote
          ? `Converted "${lastConvertedNote.title}" to Markdown — click ⬇ to download the .md`
          : `Imported "${lastNote.title}" as Markdown — click ⬇ to download the .md`);
        setDocBrowserNote(lastNote);
        setShowDocBrowser(true);
        setShowGraph(false);
      }
    } else {
      const ok = files.length - failed;
      show(failed === 0
        ? `Imported ${ok} Markdown document${ok !== 1 ? "s" : ""}${lastConvertedNote ? " (DOCX converted to Markdown)" : ""}`
        : `Imported ${ok}, failed ${failed}`);
      if (lastNote) {
        setDocBrowserNote(lastNote);
        setShowDocBrowser(true);
        setShowGraph(false);
      }
    }
  };

  const sharedActions: Omit<NoteActions, "notes"> = {
    onEdit: (note) => setEditor({ kind: "edit", note }),
    onPin: togglePin,
    onStar: toggleStar,
    onDelete: removeNote,
    onWikiLink: openWikiNote,
    starredIds,
  };

  const openReaderNote = React.useCallback((title: string) => {
    const match = notes.find((n) => n.title.trim().toLowerCase() === title.trim().toLowerCase());
    if (match) setDocBrowserNote(match);
  }, [notes]);

  const exportCurrentNote = React.useCallback(() => {
    if (!docBrowserNote) {
      show("Open a note first.");
      return;
    }
    exportNote(docBrowserNote);
  }, [docBrowserNote, show]);

  const exportVault = React.useCallback(() => {
    if (notes.length === 0) {
      show("No notes to export.");
      return;
    }
    void exportVaultAsZip(notes).catch((err) => show(`Export failed: ${errorMessage(err)}`));
  }, [notes, show]);

  return (
    <div className="notes-page">
      {/* ── Header ── */}
      <header className="notes-page-header">
        <div>
          <h1 className="h1">Notes</h1>
          <p className="subtle notes-security-line">
            🔒 {notes.length} encrypted note{notes.length === 1 ? "" : "s"} · search stays in this browser session
          </p>
        </div>
        <div className="btn-row">
          <button className="btn btn-sm" onClick={() => setShowSidebar((v) => !v)} title="Toggle sidebar">☰</button>
          <button className="btn btn-sm" onClick={openToday} title="Open or create today's daily note">📅 Today</button>
          <button className="btn btn-sm" onClick={() => setShowImport((v) => !v)}>
            {showImport ? "▲ Import" : "⬆ Import"}
          </button>
          <button
            className="btn btn-sm"
            onClick={() => {
              setShowDocBrowser(true);
              setShowGraph(true);
            }}
            title="Obsidian Graph View"
          >
            ◉ Graph
          </button>
          {notes.length > 0 && (
            <button
              className="btn btn-sm"
              onClick={exportVault}
              title="Export all notes as Obsidian vault ZIP"
            >
              ⋮ Export Vault
            </button>
          )}
          <button className="btn btn-sm" onClick={() => setShowDocBrowser((v) => !v)} title="Document browser">
            {showDocBrowser ? "✕ Docs" : "📄 Docs"}
          </button>
          <button className="btn btn-primary" onClick={() => setEditor({ kind: "new" })}>+ New note</button>
        </div>
      </header>

      {/* ── Post-import MD download banner ── */}
      {lastImported && (
        <div className="import-download-banner">
          <span>✅ <strong>{lastImported.title}</strong> {lastImportWasConverted ? "converted to Markdown" : "imported as Markdown"}</span>
          <button
            className="btn btn-sm"
            onClick={() => downloadMarkdown(obsidianMarkdown(lastImported), `${safeName(lastImported.title)}.md`)}
          >⬇ Download .md</button>
          <button
            className="btn btn-sm"
            onClick={() => {
              setDocBrowserNote(lastImported);
              setShowDocBrowser(true);
              setShowGraph(false);
            }}
          >Open note</button>
          <button className="btn btn-sm" onClick={() => setLastImported(null)} title="Dismiss">✕</button>
        </div>
      )}

      {/* ── Import panel (collapsible) ── */}
      {showImport && (
        <section className="notes-import-panel" aria-label="Import notes">
          <div className="notes-import-copy">
            <strong>Import documents</strong>
            <span className="subtle">
              Markdown is imported as-is. DOCX is converted to Markdown and can be downloaded as .md.
            </span>
          </div>
          <DropZone
            accept=".md,.markdown,.docx"
            multiple
            busy={uploading}
            selected={
              importProgress
                ? `Importing ${importProgress.done + 1} / ${importProgress.total}: ${uploadName}`
                : uploadName
            }
            hint="Markdown (.md) or Word (.docx -> .md) · up to 8 MB each · legacy .doc not supported"
            onPickMultiple={handlePickedFiles}
          />
        </section>
      )}

      {/* ── Main layout ── */}
      {showDocBrowser ? (
        <DocBrowserLayout
          notes={sorted}
          linkHealth={linkAnalysis.health}
          selectedNote={docBrowserNote}
          onSelect={setDocBrowserNote}
          onBack={() => setDocBrowserNote(null)}
          onEdit={(note) => setEditor({ kind: "edit", note })}
          onWikiLink={openReaderNote}
          graphOpen={showGraph}
          onGraphOpen={() => setShowGraph(true)}
          onGraphClose={() => setShowGraph(false)}
          onGraphOpenNote={(note) => {
            setShowGraph(false);
            setDocBrowserNote(note);
          }}
          onToggleImport={() => setShowImport((v) => !v)}
          onExportNote={exportCurrentNote}
          onExportVault={exportVault}
        />
      ) : (
        <div className={showSidebar ? "notes-layout" : "notes-layout notes-layout-nosidebar"}>
          {showSidebar && (
            <TagSidebar
              tagTree={tagTree}
              allTags={allTags}
              selectedTag={selectedTag}
              onSelectTag={setSelectedTag}
              starredNotes={notes.filter((n) => starredIds.has(n.id))}
              onOpenNote={(note) => setEditor({ kind: "edit", note })}
              folderTree={folderTree}
              linkAnalysis={linkAnalysis}
              notes={notes}
              onFilterNote={(noteId) => {
                const n = notes.find((x) => x.id === noteId);
                if (n) setEditor({ kind: "edit", note: n });
              }}
            />
          )}

          {/* Content */}
          <div className="notes-content">
            {/* Controls */}
            <div className="notes-controls">
              <input
                className="input notes-search"
                aria-label="Search notes"
                placeholder="🔍 Search titles, content, and tags…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select className="input notes-tag-filter" value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
                <option value="">All tags</option>
                {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
              </select>
              <select className="input" style={{ width: 170, flexShrink: 0 }} value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
                {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                <button className={`btn btn-sm ${viewMode === "grid" ? "btn-primary" : ""}`} onClick={() => setViewMode("grid")} title="Card grid">⊞</button>
                <button className={`btn btn-sm ${viewMode === "list" ? "btn-primary" : ""}`} onClick={() => setViewMode("list")} title="Compact list">≡</button>
              </div>
            </div>

            {/* Notes */}
            {loading ? (
              <div className="subtle">Loading…</div>
            ) : loadError ? (
              <div className="banner">{loadError} <button className="btn btn-sm" onClick={() => void load()}>Retry</button></div>
            ) : notes.length === 0 ? (
              <Empty>Create a note or import a Markdown/DOCX document to begin.</Empty>
            ) : filtered.length === 0 ? (
              <Empty>No notes match the current search and tag filter.</Empty>
            ) : (
              <div className="notes-sections">
                {pinned.length > 0 && (
                  <section>
                    <h2 className="notes-section-title">📌 Pinned</h2>
                    {viewMode === "grid" ? <NoteGrid notes={pinned} {...sharedActions} linkHealth={linkAnalysis.health} /> : <NoteList notes={pinned} {...sharedActions} linkHealth={linkAnalysis.health} />}
                  </section>
                )}
                {starred.length > 0 && (
                  <section>
                    <h2 className="notes-section-title">⭐ Starred</h2>
                    {viewMode === "grid" ? <NoteGrid notes={starred} {...sharedActions} linkHealth={linkAnalysis.health} /> : <NoteList notes={starred} {...sharedActions} linkHealth={linkAnalysis.health} />}
                  </section>
                )}
                {others.length > 0 && (
                  <section>
                    {(pinned.length > 0 || starred.length > 0) && <h2 className="notes-section-title">All notes</h2>}
                    {viewMode === "grid" ? <NoteGrid notes={others} {...sharedActions} linkHealth={linkAnalysis.health} /> : <NoteList notes={others} {...sharedActions} linkHealth={linkAnalysis.health} />}
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Editor ── */}
      {editor.kind !== "none" && (
        <NoteEditor
          key={editor.kind === "edit" ? `edit-${editor.note.id}` : `new-${editor.title ?? "blank"}`}
          initial={
            editor.kind === "edit"
              ? editor.note
              : { title: editor.title ?? "", body: editor.templateBody ?? "", tags: [], color: "" }
          }
          backlinks={
            editor.kind === "edit"
              ? notes.filter((n) => n.id !== editor.note.id && wikiTargets(n.body).some((t) => t.toLowerCase() === editor.note.title.trim().toLowerCase()))
              : []
          }
          allTags={allTags}
          onExport={editor.kind === "edit" ? () => exportNote(editor.note) : undefined}
          onCancel={() => setEditor({ kind: "none" })}
          onSave={saveNote}
          onWikiLink={openWikiNote}
        />
      )}
      {/* ── Duplicate import warning ── */}
      {dupCheck && (
        <DuplicateWarningModal
          duplicates={dupCheck.duplicates}
          freshCount={dupCheck.fresh.length}
          onSkip={() => {
            setDupCheck(null);
            if (dupCheck.fresh.length > 0) void importFiles(dupCheck.fresh);
            else show("Nothing to import — all files already exist as notes.");
          }}
          onImportAll={() => {
            setDupCheck(null);
            void importFiles(dupCheck.allFiles, dupCheck.duplicates.map((d) => d.existing));
          }}
          onCancel={() => setDupCheck(null)}
        />
      )}

      {toastNode}
    </div>
  );
}

// ─── Duplicate Warning Modal ──────────────────────────────────────────────────

function DuplicateWarningModal({
  duplicates,
  freshCount,
  onSkip,
  onImportAll,
  onCancel,
}: {
  duplicates: Array<{ file: File; existing: Note }>;
  freshCount: number;
  onSkip: () => void;
  onImportAll: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal dup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          ⚠️ {duplicates.length} file{duplicates.length !== 1 ? "s" : ""} already exist in your Notes
        </div>
        <p className="subtle" style={{ marginBottom: 10 }}>
          All {duplicates.length + freshCount} file{duplicates.length + freshCount !== 1 ? "s" : ""} were scanned.
          The following already have a matching note by title:
        </p>
        <div className="dup-list">
          {duplicates.map(({ file, existing }) => (
            <div key={file.name} className="dup-row">
              <div className="dup-filename">📄 {file.name}</div>
              <div className="dup-match subtle">↔ matches note: <em>{existing.title}</em></div>
              <div className="dup-date subtle">
                Incoming file modified {formatDateTime(file.lastModified)} · current note modified {formatDate(existing.updated_at)}
              </div>
            </div>
          ))}
        </div>
        <div className="modal-actions" style={{ marginTop: 14 }}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={onSkip}>
            Skip duplicates{freshCount > 0 ? ` · import ${freshCount} new` : ""}
          </button>
          <button className="btn btn-primary" onClick={onImportAll}>
            Import all (replace existing)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Note Grid ────────────────────────────────────────────────────────────────

function HealthDot({ health }: { health: NoteHealth | undefined }) {
  if (!health) return null;
  const cfg: Record<NoteHealthStatus, { color: string; title: string }> = {
    healthy:     { color: "#3fb950", title: "Well-linked" },
    broken:      { color: "#f85149", title: `Broken link${health.brokenTargets.length > 1 ? "s" : ""}: ${health.brokenTargets.join(", ")}` },
    orphan:      { color: "#8b949e", title: "Orphan — no links in or out" },
    "gap-source":{ color: "#d29922", title: "References a knowledge gap" },
  };
  const { color, title } = cfg[health.status];
  return (
    <span
      title={title}
      style={{
        display: "inline-block", width: 8, height: 8, borderRadius: "50%",
        background: color, flexShrink: 0, marginLeft: 4, cursor: "help",
      }}
    />
  );
}

function NoteGrid({ notes, onEdit, onPin, onStar, onDelete, onWikiLink, starredIds, linkHealth }: NoteActions & { notes: Note[]; linkHealth: Map<number, NoteHealth> }) {
  return (
    <div className="note-card-grid">
      {notes.map((note) => {
        const h = linkHealth.get(note.id);
        const borderAccent = h?.status === "broken" ? "var(--danger)" : h?.status === "orphan" ? "var(--border)" : h?.status === "healthy" ? "#3fb95033" : undefined;
        return (
        <article key={note.id} className={`note-card ${noteColorClass(note.color)}`} style={borderAccent ? { borderColor: borderAccent } : undefined}>
          <div className="note-card-header">
            <button className="note-title-button" onClick={() => onEdit(note)}>{note.title || "Untitled"}</button>
            <HealthDot health={h} />
            <button
              className={`note-star-button ${starredIds.has(note.id) ? "is-starred" : ""}`}
              onClick={() => onStar(note)}
              title={starredIds.has(note.id) ? "Unstar" : "Star"}
            >⭐</button>
            <button
              className={`note-pin-button ${note.pinned ? "is-pinned" : ""}`}
              onClick={() => void onPin(note)}
              title={note.pinned ? "Unpin" : "Pin"}
            >📌</button>
          </div>
          <div className="note-card-preview">
            {note.body ? <MarkdownPreview markdown={note.body} onWikiLink={onWikiLink} compact /> : <span className="subtle">Empty note</span>}
          </div>
          {note.tags.length > 0 && (
            <div className="note-tags">{note.tags.map((t) => <span key={t} className="pill">#{t}</span>)}</div>
          )}
          <div className="note-card-footer">
            <span className="subtle">{formatDate(note.updated_at)}</span>
            <div className="note-card-actions">
              <button className="btn btn-sm" onClick={() => onEdit(note)}>Open</button>
              <button className="btn btn-sm" onClick={() => void onDelete(note)}>Delete</button>
            </div>
          </div>
        </article>
        );
      })}
    </div>
  );
}

// ─── Note List ────────────────────────────────────────────────────────────────

function NoteList({ notes, onEdit, onPin, onStar, onDelete, starredIds, linkHealth }: NoteActions & { notes: Note[]; linkHealth: Map<number, NoteHealth> }) {
  return (
    <div className="note-list">
      {notes.map((note) => {
        const h = linkHealth.get(note.id);
        return (
          <div key={note.id} className="note-list-row" style={h?.status === "broken" ? { borderLeft: "3px solid var(--danger)" } : h?.status === "orphan" ? { borderLeft: "3px solid var(--border)" } : { borderLeft: "3px solid transparent" }}>
            <div className="note-list-title">
              {note.pinned && <span title="Pinned">📌</span>}
              {starredIds.has(note.id) && <span title="Starred">⭐</span>}
              <button onClick={() => onEdit(note)}>{note.title || "Untitled"}</button>
              <HealthDot health={h} />
              {note.tags.slice(0, 4).map((t) => <span key={t} className="pill" style={{ fontSize: 10 }}>#{t}</span>)}
            </div>
            <span className="subtle note-list-date">{formatDate(note.updated_at)}</span>
            <div className="note-list-actions">
              <button className="btn btn-sm" onClick={() => onStar(note)} title={starredIds.has(note.id) ? "Unstar" : "Star"}>⭐</button>
              <button className="btn btn-sm" onClick={() => void onPin(note)} title={note.pinned ? "Unpin" : "Pin"}>📌</button>
              <button className="btn btn-sm" onClick={() => onEdit(note)}>Open</button>
              <button className="btn btn-sm" onClick={() => void onDelete(note)}>Delete</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function TagSidebar({
  tagTree, allTags, selectedTag, onSelectTag,
  starredNotes, onOpenNote,
  folderTree, linkAnalysis, notes, onFilterNote,
}: {
  tagTree: TagNode;
  allTags: string[];
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  starredNotes: Note[];
  onOpenNote: (note: Note) => void;
  folderTree: FolderNode;
  linkAnalysis: LinkAnalysis;
  notes: Note[];
  onFilterNote: (noteId: number) => void;
}) {
  const [foldersOpen, setFoldersOpen] = React.useState(true);
  const [starsOpen, setStarsOpen] = React.useState(true);
  const [issuesOpen, setIssuesOpen] = React.useState(true);

  const totalIssues = linkAnalysis.brokenLinks.length + linkAnalysis.knowledgeGaps.length;

  return (
    <div className="notes-sidebar">
      {/* ── Folder / Tag Tree ── */}
      <div className="notes-sidebar-section">
        <button className="notes-sidebar-header" onClick={() => setFoldersOpen((v) => !v)}>
          <span>📁 Folders</span>
          <span className="sidebar-chevron">{foldersOpen ? "▾" : "▸"}</span>
        </button>
        {foldersOpen && (
          <div className="notes-sidebar-body">
            <button className={`tag-tree-item ${!selectedTag ? "is-active" : ""}`} onClick={() => onSelectTag("")}>
              <span>All notes</span>
              <span className="sidebar-count">{notes.length}</span>
            </button>
            {Array.from(folderTree.children.values()).map((node) => (
              <FolderTreeNode key={node.fullPath} node={node} selectedTag={selectedTag} onSelect={onSelectTag} depth={0} />
            ))}
            {/* Untagged notes */}
            {folderTree.noteIds.length > 0 && (
              <button className={`tag-tree-item ${selectedTag === "__untagged__" ? "is-active" : ""}`} onClick={() => onSelectTag("__untagged__")}>
                <span className="subtle" style={{ fontStyle: "italic" }}>Untagged</span>
                <span className="sidebar-count">{folderTree.noteIds.length}</span>
              </button>
            )}
            {allTags.length === 0 && <span className="outline-empty">No tags/folders yet</span>}
          </div>
        )}
      </div>

      {/* ── Starred ── */}
      {starredNotes.length > 0 && (
        <div className="notes-sidebar-section">
          <button className="notes-sidebar-header" onClick={() => setStarsOpen((v) => !v)}>
            <span>⭐ Starred</span>
            <span className="sidebar-chevron">{starsOpen ? "▾" : "▸"}</span>
          </button>
          {starsOpen && (
            <div className="notes-sidebar-body">
              {starredNotes.map((note) => (
                <button key={note.id} className="tag-tree-item" onClick={() => onOpenNote(note)}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note.title || "Untitled"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Knowledge Health Issues ── */}
      <div className="notes-sidebar-section">
        <button className="notes-sidebar-header" onClick={() => setIssuesOpen((v) => !v)}>
          <span>{totalIssues > 0 ? "⚠️" : "✅"} Issues</span>
          {totalIssues > 0 && <span className="sidebar-badge-red">{totalIssues}</span>}
          <span className="sidebar-chevron">{issuesOpen ? "▾" : "▸"}</span>
        </button>
        {issuesOpen && (
          <div className="notes-sidebar-body">
            {totalIssues === 0 ? (
              <span className="outline-empty" style={{ color: "#3fb950" }}>No issues — all links healthy ✓</span>
            ) : (
              <>
                {/* Broken links */}
                {linkAnalysis.brokenLinks.length > 0 && (
                  <div className="issues-group">
                    <div className="issues-group-label issues-label-broken">
                      🔴 Broken links ({linkAnalysis.brokenLinks.length})
                    </div>
                    {linkAnalysis.brokenLinks.slice(0, 12).map((bl, i) => (
                      <button key={i} className="issue-row issue-row-broken" onClick={() => onFilterNote(bl.noteId)} title={`"${bl.noteTitle}" links to [[${bl.target}]] which doesn't exist`}>
                        <span className="issue-row-note">{bl.noteTitle}</span>
                        <span className="issue-row-target">→ [[{bl.target}]]</span>
                      </button>
                    ))}
                    {linkAnalysis.brokenLinks.length > 12 && (
                      <span className="outline-empty">+{linkAnalysis.brokenLinks.length - 12} more</span>
                    )}
                  </div>
                )}

                {/* Knowledge gaps */}
                {linkAnalysis.knowledgeGaps.length > 0 && (
                  <div className="issues-group">
                    <div className="issues-group-label issues-label-gap">
                      🟡 Knowledge gaps ({linkAnalysis.knowledgeGaps.length})
                    </div>
                    {linkAnalysis.knowledgeGaps.slice(0, 8).map((gap, i) => (
                      <div key={i} className="issue-row issue-row-gap" title={`"${gap}" is referenced by multiple notes but no note exists for it`}>
                        <span>[[{gap}]]</span>
                        <span className="subtle" style={{ fontSize: 10 }}>missing note</span>
                      </div>
                    ))}
                    {linkAnalysis.knowledgeGaps.length > 8 && (
                      <span className="outline-empty">+{linkAnalysis.knowledgeGaps.length - 8} more</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FolderTreeNode({ node, selectedTag, onSelect, depth }: {
  node: FolderNode; selectedTag: string; onSelect: (t: string) => void; depth: number;
}) {
  const [open, setOpen] = React.useState(true);
  const hasChildren = node.children.size > 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center" }}>
        {hasChildren && (
          <button
            style={{ padding: "0 3px", background: "transparent", border: 0, color: "var(--muted)", fontSize: 10, cursor: "pointer", flexShrink: 0 }}
            onClick={() => setOpen((v) => !v)}
          >{open ? "▾" : "▸"}</button>
        )}
        <button
          className={`tag-tree-item ${selectedTag === node.fullPath ? "is-active" : ""}`}
          style={{ paddingLeft: hasChildren ? 2 : 8 + depth * 8 }}
          onClick={() => onSelect(node.fullPath)}
        >
          <span>{hasChildren ? "📂" : "📄"} {node.name}</span>
          <span className="sidebar-count">{node.noteIds.length}</span>
        </button>
      </div>
      {open && hasChildren && (
        <div style={{ paddingLeft: 10 }}>
          {Array.from(node.children.values()).map((child) => (
            <FolderTreeNode key={child.fullPath} node={child} selectedTag={selectedTag} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function TagTreeNode({ node, selectedTag, onSelect, depth }: {
  node: TagNode; selectedTag: string; onSelect: (t: string) => void; depth: number;
}) {
  const [open, setOpen] = React.useState(true);
  const hasChildren = node.children.size > 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center" }}>
        {hasChildren && (
          <button
            style={{ padding: "0 3px", background: "transparent", border: 0, color: "var(--muted)", fontSize: 10, cursor: "pointer", flexShrink: 0 }}
            onClick={() => setOpen((v) => !v)}
          >{open ? "▾" : "▸"}</button>
        )}
        <button
          className={`tag-tree-item ${selectedTag === node.fullPath ? "is-active" : ""}`}
          style={{ paddingLeft: hasChildren ? 2 : 8 + depth * 8 }}
          onClick={() => onSelect(node.fullPath)}
        >
          <span>#{node.name}</span>
          <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 10 }}>{node.count}</span>
        </button>
      </div>
      {open && hasChildren && (
        <div style={{ paddingLeft: 10 }}>
          {Array.from(node.children.values()).map((child) => (
            <TagTreeNode key={child.fullPath} node={child} selectedTag={selectedTag} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Document Browser ─────────────────────────────────────────────────────────

const TAG_COLORS_LIST = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#ef4444", "#14b8a6", "#f97316", "#84cc16",
];

const DOC_LANG_THEMES: Record<string, { bg: string; color: string; label: string }> = {
  bash:       { bg: "#0d1f0d", color: "#3fb950", label: "Bash" },
  sh:         { bg: "#0d1f0d", color: "#3fb950", label: "Shell" },
  shell:      { bg: "#0d1f0d", color: "#3fb950", label: "Shell" },
  zsh:        { bg: "#0d1f0d", color: "#3fb950", label: "Zsh" },
  powershell: { bg: "#0a1520", color: "#79c0ff", label: "PowerShell" },
  ps1:        { bg: "#0a1520", color: "#79c0ff", label: "PowerShell" },
  python:     { bg: "#1a1500", color: "#e3b341", label: "Python" },
  py:         { bg: "#1a1500", color: "#e3b341", label: "Python" },
  javascript: { bg: "#180f00", color: "#ffa657", label: "JavaScript" },
  js:         { bg: "#180f00", color: "#ffa657", label: "JavaScript" },
  typescript: { bg: "#100a1a", color: "#a371f7", label: "TypeScript" },
  ts:         { bg: "#100a1a", color: "#a371f7", label: "TypeScript" },
  sql:        { bg: "#12001a", color: "#d2a8ff", label: "SQL" },
  go:         { bg: "#001520", color: "#56d364", label: "Go" },
  rust:       { bg: "#1a0a00", color: "#ff7b72", label: "Rust" },
  yaml:       { bg: "#0a1a15", color: "#39c5cf", label: "YAML" },
  yml:        { bg: "#0a1a15", color: "#39c5cf", label: "YAML" },
  json:       { bg: "#0a0f1a", color: "#79c0ff", label: "JSON" },
  dockerfile: { bg: "#0a1520", color: "#79c0ff", label: "Dockerfile" },
  tsx:        { bg: "#100a1a", color: "#a371f7", label: "TSX" },
  jsx:        { bg: "#180f00", color: "#ffa657", label: "JSX" },
};

const PRISM_ALIASES: Record<string, string> = {
  py: "python",
  js: "javascript",
  ts: "typescript",
  tsx: "tsx",
  jsx: "jsx",
  yml: "yaml",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  ps1: "powershell",
  dockerfile: "docker",
  html: "markup",
  xml: "markup",
  svg: "markup",
  md: "markdown",
  rb: "ruby",
  kt: "kotlin",
  kts: "kotlin",
  cs: "csharp",
  fs: "fsharp",
  hbs: "handlebars",
  plain: "plain",
  text: "plain",
  txt: "plain",
};

function prismLanguage(lang: string): string {
  const raw = lang.trim().toLowerCase();
  const candidate = PRISM_ALIASES[raw] ?? raw;
  if (Prism.languages[candidate]) return candidate;
  if (Prism.languages[raw]) return raw;
  return "";
}

function safeTokenClass(value: string): string {
  return value.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_-]/g, "");
}

function tokenClassName(token: Prism.Token): string {
  const aliases = Array.isArray(token.alias) ? token.alias : token.alias ? [token.alias] : [];
  return ["token", token.type, ...aliases]
    .filter(Boolean)
    .map((value) => `token-${safeTokenClass(value)}`)
    .join(" ");
}

function renderPrismStream(stream: Prism.TokenStream, keyPrefix: string): React.ReactNode {
  if (typeof stream === "string") return stream;
  if (Array.isArray(stream)) {
    return stream.map((token, index) => (
      <React.Fragment key={`${keyPrefix}-${index}`}>
        {renderPrismStream(token, `${keyPrefix}-${index}`)}
      </React.Fragment>
    ));
  }
  return (
    <span key={keyPrefix} className={tokenClassName(stream)}>
      {renderPrismStream(stream.content, `${keyPrefix}-inner`)}
    </span>
  );
}

function RichCodeBlock({ lang, code }: { lang: string; code: string }) {
  const alias = prismLanguage(lang);
  const grammar = alias && Prism.languages[alias] ? Prism.languages[alias] : undefined;
  const stream: Prism.TokenStream = grammar ? Prism.tokenize(code, grammar) : code;
  const label = DOC_LANG_THEMES[lang.toLowerCase()]?.label ?? (lang || "Code");
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-label">{label}</span>
      </div>
      <pre className="code-block-pre">
        <code className={alias ? `language-${alias}` : undefined}>
          {renderPrismStream(stream, "prism")}
        </code>
      </pre>
    </div>
  );
}

function renderRichInline(text: string, onWikiLink?: (title: string) => void): React.ReactNode[] {
  const pattern = /(\[\[[^\]\n]+\]\]|\[[^\]\n]+\]\([^)\s]+\)|`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|(?<![\w#])#[A-Za-z][A-Za-z0-9_/-]*)/g;
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) out.push(text.slice(cursor, index));
    const token = match[0];
    if (token.startsWith("[[")) {
      const [target, alias] = token.slice(2, -2).split("|").map((part) => part.trim());
      out.push(
        <button key={index} className="wiki-link" onClick={() => onWikiLink?.(target)}>
          {alias || target}
        </button>
      );
    } else if (token.startsWith("[") && token.endsWith(")")) {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        out.push(<a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]} ↗</a>);
      } else {
        out.push(token);
      }
    } else if (token.startsWith("`")) {
      out.push(<code key={index} className="reader-inline-code">{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      out.push(<strong key={index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      out.push(<em key={index}>{token.slice(1, -1)}</em>);
    } else {
      out.push(<span key={index} className="reader-tag-chip">#{token.slice(1)}</span>);
    }
    cursor = index + token.length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function RichMarkdownView({ markdown, onWikiLink }: { markdown: string; onWikiLink?: (t: string) => void }) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let inCode = false;
  let codeLang = "";
  let codeLines: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = (key: string) => {
    if (!tableRows.length) { inTable = false; return; }
    const [headers, ...body] = tableRows;
    blocks.push(
      <table key={key} style={{ width: "100%", borderCollapse: "collapse", margin: "14px 0", fontSize: 14 }}>
        <thead><tr>{(headers ?? []).map((h, ci) => <th key={ci} style={{ padding: "8px 12px", borderBottom: "2px solid var(--border)", textAlign: "left", color: "var(--muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em" }}>{renderRichInline(h.trim(), onWikiLink)}</th>)}</tr></thead>
        <tbody>{body.map((row, ri) => (
          <tr key={ri} style={{ borderBottom: "1px solid var(--border)" }}>
            {row.map((cell, ci) => <td key={ci} style={{ padding: "7px 12px" }}>{renderRichInline(cell.trim(), onWikiLink)}</td>)}
          </tr>
        ))}</tbody>
      </table>
    );
    tableRows = []; inTable = false;
  };

  lines.forEach((line, idx) => {
    const fenceM = line.trim().match(/^```(\w*)$/);
    if (fenceM) {
      if (inTable) flushTable(`t${idx}`);
      if (inCode) {
        blocks.push(<RichCodeBlock key={`c${idx}`} lang={codeLang} code={codeLines.join("\n")} />);
        codeLines = []; inCode = false; codeLang = "";
      } else { inCode = true; codeLang = fenceM[1] ?? ""; }
      return;
    }
    if (inCode) { codeLines.push(line); return; }

    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed.slice(1, -1).split("|");
      if (!cells.every((c) => /^[\s\-:]+$/.test(c))) { inTable = true; tableRows.push(cells); }
      return;
    }
    if (inTable) flushTable(`t${idx}`);

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const task = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/);
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);

    const HColors = ["", "#79c0ff", "#56d364", "#ffa657", "#e3b341", "#d2a8ff", "#a5d6ff"];
    const richInline = (s: string) => renderRichInline(s, onWikiLink);

    if (heading) {
      const lvl = heading[1].length;
      const sizes = ["", "1.9em", "1.5em", "1.25em", "1.1em", "1em", ".9em"];
      blocks.push(<div key={idx} style={{ fontSize: sizes[lvl] ?? "1em", fontWeight: 700, color: HColors[lvl] ?? "var(--text)", marginTop: lvl <= 2 ? 28 : 18, marginBottom: 8, borderBottom: lvl <= 2 ? "1px solid var(--border)" : undefined, paddingBottom: lvl <= 2 ? 6 : undefined }}>{richInline(heading[2])}</div>);
    } else if (task) {
      blocks.push(<div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "3px 0 3px 8px" }}><input type="checkbox" checked={task[1].toLowerCase() === "x"} readOnly style={{ marginTop: 3, accentColor: "var(--accent)", flexShrink: 0 }} /><span style={task[1].toLowerCase() === "x" ? { textDecoration: "line-through", color: "var(--muted)" } : undefined}>{richInline(task[2])}</span></div>);
    } else if (bullet) {
      blocks.push(<div key={idx} style={{ display: "flex", gap: 8, margin: "2px 0 2px 16px" }}><span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}>▸</span><span>{richInline(bullet[1])}</span></div>);
    } else if (ordered) {
      blocks.push(<div key={idx} style={{ display: "flex", gap: 8, margin: "2px 0 2px 16px" }}><span style={{ color: "var(--muted)", flexShrink: 0, minWidth: 20 }}>{ordered[1]}.</span><span>{richInline(ordered[2])}</span></div>);
    } else if (/^>\s?/.test(line)) {
      blocks.push(<div key={idx} style={{ borderLeft: "3px solid var(--accent)", paddingLeft: 14, margin: "6px 0", color: "var(--muted)", fontStyle: "italic" }}>{richInline(line.replace(/^>\s?/, ""))}</div>);
    } else if (/^\s*(---|___|\*\*\*)\s*$/.test(line)) {
      blocks.push(<hr key={idx} style={{ border: 0, borderTop: "1px solid var(--border)", margin: "20px 0" }} />);
    } else if (trimmed) {
      blocks.push(<p key={idx} style={{ margin: "6px 0", lineHeight: 1.7 }}>{richInline(line)}</p>);
    }
  });
  if (inCode && codeLines.length) blocks.push(<RichCodeBlock key="cf" lang={codeLang} code={codeLines.join("\n")} />);
  if (inTable) flushTable("tf");

  return <div style={{ fontSize: 14.5, color: "var(--text)" }}>{blocks}</div>;
}

function DocumentReader({
  note,
  onEdit,
  onWikiLink,
  onBack,
  onExport,
}: {
  note: Note;
  onEdit: (n: Note) => void;
  onWikiLink: (t: string) => void;
  onBack: () => void;
  onExport: () => void;
}) {
  const [mode, setMode] = React.useState<ReaderMode>("source");
  const [cursor, setCursor] = React.useState<SourceCursor>({ line: 1, column: 1 });
  const sourceFilename = `${safeName(note.title || "Untitled")}.md`;
  const primaryFolder = note.tags[0];
  const lineCount = React.useMemo(() => note.body.split("\n").length, [note.body]);
  const wordCount = React.useMemo(
    () => note.body.trim() ? note.body.trim().split(/\s+/).length : 0,
    [note.body]
  );

  React.useEffect(() => {
    setCursor({ line: 1, column: 1 });
  }, [note.id]);

  return (
    <div className="document-reader">
      <div className="document-reader-header">
        <button className="document-reader-icon-btn" onClick={onBack} title="Back">
          ←
        </button>
        <div className="document-reader-title-wrap">
          <h1 className="document-reader-title">{note.title || "Untitled"}</h1>
          <div className="document-reader-meta">{formatDate(note.updated_at)}</div>
        </div>
        <div className="document-reader-mode-toggle" role="tablist" aria-label="Document view">
          {(["source", "preview", "split"] as ReaderMode[]).map((viewMode) => (
            <button
              key={viewMode}
              className={`document-reader-mode-btn ${mode === viewMode ? "is-active" : ""}`}
              onClick={() => setMode(viewMode)}
              role="tab"
              aria-selected={mode === viewMode}
            >
              {viewMode === "source" ? "Source" : viewMode === "preview" ? "Preview" : "Split"}
            </button>
          ))}
        </div>
        <button className="document-reader-icon-btn" onClick={() => onEdit(note)} title="Edit note">
          ✎
        </button>
        <button className="document-reader-icon-btn" onClick={onExport} title="Download Markdown">
          ↓
        </button>
      </div>
      {note.tags.length > 0 && (
        <div className="document-reader-tags">
          {note.tags.map((tag) => (
            <span key={tag} className="document-reader-tag">#{tag}</span>
          ))}
        </div>
      )}

      {mode !== "preview" && (
        <div className="note-source-chrome document-reader-source-chrome" aria-label="Open Markdown file">
          <div className="note-source-tab" title={sourceFilename}>
            <span className="note-source-file-icon">↓</span>
            <span>{sourceFilename}</span>
          </div>
          <div className="note-source-breadcrumb" aria-label="Note location">
            <span>Vault</span><span>›</span>
            {primaryFolder && <><span>{primaryFolder}</span><span>›</span></>}
            <strong>{sourceFilename}</strong>
          </div>
        </div>
      )}

      <div className={`document-reader-workspace reader-mode-${mode}`}>
        {mode !== "preview" && (
          <div className="document-reader-source-pane">
            <MarkdownSourceEditor
              key={note.id}
              value={note.body}
              onChange={() => {}}
              onViewReady={() => {}}
              onCursorChange={setCursor}
              readOnly
            />
          </div>
        )}
        {mode !== "source" && (
          <div className="document-reader-body document-reader-preview-pane">
            <RichMarkdownView markdown={note.body} onWikiLink={onWikiLink} />
          </div>
        )}
      </div>

      <div className="note-editor-statusbar document-reader-statusbar">
        <span>{mode === "preview" ? "Preview" : `Ln ${cursor.line}, Col ${cursor.column}`}</span>
        <span className="spacer" />
        <span>{lineCount} lines</span>
        <span>{wordCount} words</span>
        <span>{mode === "preview" ? "Rendered Markdown" : "Markdown"}</span>
        <span>UTF-8</span>
      </div>
    </div>
  );
}

function DocBrowserLayout({
  notes,
  linkHealth,
  selectedNote,
  onSelect,
  onBack,
  onEdit,
  onWikiLink,
  graphOpen,
  onGraphOpen,
  onGraphClose,
  onGraphOpenNote,
  onToggleImport,
  onExportNote,
  onExportVault,
}: {
  notes: Note[];
  linkHealth: Map<number, NoteHealth>;
  selectedNote: Note | null;
  onSelect: (note: Note) => void;
  onBack: () => void;
  onEdit: (note: Note) => void;
  onWikiLink?: (title: string) => void;
  graphOpen: boolean;
  onGraphOpen: () => void;
  onGraphClose: () => void;
  onGraphOpenNote: (note: Note) => void;
  onToggleImport: () => void;
  onExportNote: () => void;
  onExportVault: () => void;
}) {
  const [search, setSearch] = React.useState("");
  const [notesOpen, setNotesOpen] = React.useState(true);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const filtered = search.trim()
    ? notes.filter((n) => `${n.title} ${n.tags.join(" ")} ${n.body}`.toLowerCase().includes(search.toLowerCase()))
    : notes;

  const active = selectedNote;

  return (
    <div className="doc-browser-layout">
      <div className="doc-browser-list">
        <div className="doc-browser-toolbar">
          <button className="doc-browser-toolbar-btn" onClick={onToggleImport} title="Import notes">
            ↑
          </button>
          <button className="doc-browser-toolbar-btn" onClick={onGraphOpen} title="Obsidian Graph View">
            ◉
          </button>
          <div className="doc-browser-menu-wrap">
            <button className="doc-browser-toolbar-btn" onClick={() => setMenuOpen((v) => !v)} title="Export options">
              ⋮
            </button>
            {menuOpen && (
              <div className="doc-browser-menu">
                <button
                  className="doc-browser-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onExportNote();
                  }}
                >
                  Export current note as .md
                </button>
                <button
                  className="doc-browser-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onExportVault();
                  }}
                >
                  Export Vault as ZIP
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="doc-browser-search">
          <input
            className="input"
            placeholder="Filter notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="doc-browser-parent" onClick={() => setNotesOpen((v) => !v)}>
          <span className="doc-browser-parent-icon">{notesOpen ? "▾" : "▸"}</span>
          <span>Notes</span>
        </button>
        <div className="doc-browser-items">
          {notesOpen && (
            <>
              {notes.length === 0 && <span className="outline-empty">No notes loaded yet.</span>}
              {notes.length > 0 && filtered.map((note) => {
                const h = linkHealth.get(note.id);
                const dotColor = h?.status === "broken" ? "#f85149" : h?.status === "orphan" ? "#8b949e" : "#3fb950";
                return (
                  <button
                    key={note.id}
                    className={`doc-list-item ${active?.id === note.id ? "is-active" : ""}`}
                    onClick={() => onSelect(note)}
                  >
                    <span className="doc-list-note-icon">📄</span>
                    <span className="doc-list-copy">
                      <span className="doc-list-title">{note.title || "Untitled"}</span>
                      {note.tags.length > 0 && (
                        <span className="doc-list-tags">{note.tags.slice(0, 2).map((t) => `#${t}`).join(" ")}</span>
                      )}
                    </span>
                    <span
                      className="doc-list-health"
                      style={{ background: dotColor }}
                      title={h ? "Link health" : "No link data"}
                    />
                  </button>
                );
              })}
              {notes.length > 0 && filtered.length === 0 && <span className="outline-empty">No notes match.</span>}
            </>
          )}
        </div>
        <div className="doc-browser-count">
          {notes.length === 0
            ? "0 notes"
            : `${filtered.length} of ${notes.length} note${notes.length === 1 ? "" : "s"}`}
        </div>
      </div>
      <div className="doc-browser-content">
        {graphOpen ? (
          <ObsidianGraphView
            notes={notes}
            onOpen={onGraphOpenNote}
            onClose={onGraphClose}
          />
        ) : active ? (
          <DocumentReader
            note={active}
            onEdit={onEdit}
            onWikiLink={onWikiLink ?? (() => {})}
            onBack={onBack}
            onExport={onExportNote}
          />
        ) : (
          <div className="doc-browser-placeholder">
            <span className="doc-browser-placeholder-icon">📄</span>
            <span>Select a note to read</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Graph View ───────────────────────────────────────────────────────────────

type NoteRelationshipKind = "wiki" | "tag" | "topic";

interface NoteRelationship {
  sourceId: number;
  targetId: number;
  kind: NoteRelationshipKind;
  label: string;
  score: number;
}

interface GraphPoint {
  x: number;
  y: number;
}

interface GraphDragState {
  key: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  startClientX: number;
  startClientY: number;
  moved: boolean;
}

let obsidianGraphPositionMemory: Record<string, GraphPoint> = {};

const GENERIC_RELATION_TAGS = new Set(["docx", "markdown", "import", "imported", "note", "notes"]);
const TOPIC_STOP_WORDS = new Set([
  "about", "after", "again", "against", "also", "before", "being", "between", "both",
  "click", "create", "created", "date", "document", "email", "from", "guide", "have", "into", "more", "notes",
  "only", "overview", "purpose", "requirements", "scope", "should", "step", "summary",
  "that", "their", "there", "these", "this", "through", "using", "when", "where", "which",
  "will", "with", "work", "instruction", "your", "version", "select", "open", "enter", "following",
]);

const TOPIC_ALIASES: Record<string, string> = {
  addresses: "address",
  backups: "backup",
  configurations: "config",
  configuration: "config",
  configure: "config",
  configuring: "config",
  deployments: "deploy",
  deployment: "deploy",
  deployed: "deploy",
  deploying: "deploy",
  guidance: "guide",
  guidelines: "guide",
  guideline: "guide",
  installations: "install",
  installation: "install",
  installed: "install",
  installing: "install",
  networking: "network",
  migrations: "migration",
  servers: "server",
  templates: "template",
  virtualisation: "virtualization",
};

interface NoteTopicProfile {
  weights: Map<string, number>;
  titleTokens: Set<string>;
}

function normalizedTitle(title: string): string {
  return title.toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizedTopicWord(word: string): string {
  const lower = word.toLowerCase();
  const aliased = TOPIC_ALIASES[lower];
  if (aliased) return aliased;
  if (lower.length > 5 && lower.endsWith("ies")) return `${lower.slice(0, -3)}y`;
  if (lower.length > 5 && lower.endsWith("s") && !lower.endsWith("ss")) return lower.slice(0, -1);
  return lower;
}

function topicTokenList(source: string): string[] {
  source = source.toLowerCase().replace(/[_-]+/g, " ");
  const words = source.match(/[a-z][a-z0-9]{2,}/g) ?? [];
  return words
    .map(normalizedTopicWord)
    .filter((word) => !TOPIC_STOP_WORDS.has(word) && !/^\d+$/.test(word));
}

function topicTokens(source: string): Set<string> {
  return new Set(topicTokenList(source));
}

function noteTopicProfile(note: Note): NoteTopicProfile {
  const titleTokens = topicTokens(note.title);
  const headingTokens = topicTokens(parseOutline(note.body).map((heading) => heading.text).join(" "));
  const readableBody = note.body
    .replace(/^---[\s\S]*?---\s*/m, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[`*_>#|\[\](){}]/g, " ");
  const bodyCounts = new Map<string, number>();
  topicTokenList(readableBody).forEach((token) => {
    bodyCounts.set(token, Math.min((bodyCounts.get(token) ?? 0) + 1, 4));
  });

  const weights = new Map<string, number>();
  bodyCounts.forEach((count, token) => weights.set(token, count));
  headingTokens.forEach((token) => weights.set(token, (weights.get(token) ?? 0) + 4));
  titleTokens.forEach((token) => weights.set(token, (weights.get(token) ?? 0) + 7));
  return { weights, titleTokens };
}

function buildNoteRelationships(notes: Note[]): NoteRelationship[] {
  const relationships = new Map<string, NoteRelationship>();
  const rank: Record<NoteRelationshipKind, number> = { topic: 1, tag: 2, wiki: 3 };
  const titleToNote = new Map(notes.map((note) => [normalizedTitle(note.title), note]));
  const tagFrequency = new Map<string, number>();
  const topicProfiles = new Map(notes.map((note) => [note.id, noteTopicProfile(note)]));
  const documentFrequency = new Map<string, number>();
  const titleTokenFrequency = new Map<string, number>();

  notes.forEach((note) => {
    new Set(note.tags.map((tag) => tag.toLowerCase())).forEach((tag) => {
      tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1);
    });
    topicProfiles.get(note.id)?.weights.forEach((_weight, token) => {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    });
    topicProfiles.get(note.id)?.titleTokens.forEach((token) => {
      titleTokenFrequency.set(token, (titleTokenFrequency.get(token) ?? 0) + 1);
    });
  });

  const weightedProfiles = new Map<number, Map<string, number>>();
  topicProfiles.forEach((profile, noteId) => {
    const ranked = Array.from(profile.weights.entries())
      .map(([token, weight]) => {
        const idf = Math.log((notes.length + 1) / ((documentFrequency.get(token) ?? 0) + 1)) + 1;
        return [token, weight * idf] as const;
      })
      .sort((left, right) => right[1] - left[1])
      .slice(0, 32);
    weightedProfiles.set(noteId, new Map(ranked));
  });

  const addRelationship = (relationship: NoteRelationship) => {
    const low = Math.min(relationship.sourceId, relationship.targetId);
    const high = Math.max(relationship.sourceId, relationship.targetId);
    const key = `${low}:${high}`;
    const existing = relationships.get(key);
    if (!existing || rank[relationship.kind] > rank[existing.kind]) relationships.set(key, relationship);
  };

  // Explicit [[Note title]] links are the strongest relationship.
  notes.forEach((note) => {
    wikiTargets(note.body).forEach((target) => {
      const linked = titleToNote.get(normalizedTitle(target));
      if (linked && linked.id !== note.id) {
        addRelationship({
          sourceId: note.id,
          targetId: linked.id,
          kind: "wiki",
          label: `[[${target}]]`,
          score: 1,
        });
      }
    });
  });

  const topicCandidates: NoteRelationship[] = [];
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const left = notes[i];
      const right = notes[j];
      const leftTags = new Set(left.tags.map((tag) => tag.toLowerCase()));
      const meaningfulSharedTags = right.tags
        .map((tag) => tag.toLowerCase())
        .filter((tag) => {
          const tooCommon = notes.length > 5 && (tagFrequency.get(tag) ?? 0) / notes.length > 0.4;
          return leftTags.has(tag) && !GENERIC_RELATION_TAGS.has(tag) && !tooCommon;
        });

      if (meaningfulSharedTags.length > 0) {
        addRelationship({
          sourceId: left.id,
          targetId: right.id,
          kind: "tag",
          label: meaningfulSharedTags.map((tag) => `#${tag}`).join(", "),
          score: 1,
        });
        continue;
      }

      const leftTitle = normalizedTitle(left.title);
      const rightTitle = normalizedTitle(right.title);
      if (leftTitle && leftTitle === rightTitle) {
        topicCandidates.push({
          sourceId: left.id,
          targetId: right.id,
          kind: "topic",
          label: "same title",
          score: 1,
        });
        continue;
      }

      const leftProfile = weightedProfiles.get(left.id) ?? new Map<string, number>();
      const rightProfile = weightedProfiles.get(right.id) ?? new Map<string, number>();
      const shared = Array.from(leftProfile.keys())
        .filter((token) => rightProfile.has(token))
        .sort((a, b) =>
          Math.min(rightProfile.get(b) ?? 0, leftProfile.get(b) ?? 0) -
          Math.min(rightProfile.get(a) ?? 0, leftProfile.get(a) ?? 0)
        );
      const sharedWeight = shared.reduce(
        (sum, token) => sum + Math.min(leftProfile.get(token) ?? 0, rightProfile.get(token) ?? 0),
        0
      );
      const leftWeight = Array.from(leftProfile.values()).reduce((sum, weight) => sum + weight, 0);
      const rightWeight = Array.from(rightProfile.values()).reduce((sum, weight) => sum + weight, 0);
      const coverage = sharedWeight / Math.max(Math.min(leftWeight, rightWeight), 1);
      const leftTitleTokens = topicProfiles.get(left.id)?.titleTokens ?? new Set<string>();
      const rightTitleTokens = topicProfiles.get(right.id)?.titleTokens ?? new Set<string>();
      const distinctiveTitleTopics = shared.filter((token) =>
        token.length >= 5 &&
        leftTitleTokens.has(token) &&
        rightTitleTokens.has(token) &&
        (titleTokenFrequency.get(token) ?? notes.length) <= Math.max(3, Math.ceil(notes.length * 0.25))
      );
      const rareSharedTopics = shared.filter((token) =>
        token.length >= 5 &&
        (documentFrequency.get(token) ?? notes.length) <= Math.max(3, Math.ceil(notes.length * 0.3))
      );
      const titleAnchoredTopics = shared.filter((token) =>
        leftTitleTokens.has(token) || rightTitleTokens.has(token)
      );
      const score = coverage + Math.min(shared.length, 4) * 0.025 +
        distinctiveTitleTopics.length * 0.12 + Math.min(titleAnchoredTopics.length, 2) * 0.06;
      if (
        (shared.length >= 2 && coverage >= 0.12) ||
        (rareSharedTopics.length >= 2 && coverage >= 0.08) ||
        titleAnchoredTopics.length >= 2 ||
        distinctiveTitleTopics.length > 0
      ) {
        topicCandidates.push({
          sourceId: left.id,
          targetId: right.id,
          kind: "topic",
          label: shared.slice(0, 5).join(", "),
          score: Math.max(score, distinctiveTitleTopics.length > 0 ? 0.55 : 0),
        });
      }
    }
  }

  // Give every note its strongest credible content match first, then add a small
  // number of the strongest remaining connections without creating noisy hubs.
  const topicDegree = new Map<number, number>();
  const selectedTopics = new Set<string>();
  const selectTopic = (relationship: NoteRelationship) => {
    const key = `${Math.min(relationship.sourceId, relationship.targetId)}:${Math.max(relationship.sourceId, relationship.targetId)}`;
    if (relationships.has(key) || selectedTopics.has(key)) return false;
    addRelationship(relationship);
    selectedTopics.add(key);
    topicDegree.set(relationship.sourceId, (topicDegree.get(relationship.sourceId) ?? 0) + 1);
    topicDegree.set(relationship.targetId, (topicDegree.get(relationship.targetId) ?? 0) + 1);
    return true;
  };

  topicCandidates.sort((a, b) => b.score - a.score);
  notes.forEach((note) => {
    if ((topicDegree.get(note.id) ?? 0) > 0) return;
    const best = topicCandidates.find((candidate) =>
      (candidate.sourceId === note.id || candidate.targetId === note.id) &&
      (topicDegree.get(candidate.sourceId === note.id ? candidate.targetId : candidate.sourceId) ?? 0) < 4
    );
    if (best) selectTopic(best);
  });

  topicCandidates.forEach((relationship) => {
    if ((topicDegree.get(relationship.sourceId) ?? 0) >= 3) return;
    if ((topicDegree.get(relationship.targetId) ?? 0) >= 3) return;
    selectTopic(relationship);
  });

  return Array.from(relationships.values());
}

function ObsidianGraphView({
  notes,
  onOpen,
  onClose,
}: {
  notes: Note[];
  onOpen: (note: Note) => void;
  onClose: () => void;
}) {
  const graphRootRef = React.useRef<HTMLDivElement>(null);
  const graphViewportRef = React.useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [customPositions, setCustomPositions] = React.useState<Record<string, GraphPoint>>(
    () => ({ ...obsidianGraphPositionMemory })
  );
  const [draggingKey, setDraggingKey] = React.useState<string | null>(null);
  const [graphSize, setGraphSize] = React.useState({ width: 800, height: 600 });
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const dragRef = React.useRef<GraphDragState | null>(null);
  const suppressClickRef = React.useRef(false);

  const relationships = React.useMemo(() => buildNoteRelationships(notes), [notes]);

  React.useEffect(() => {
    obsidianGraphPositionMemory = customPositions;
  }, [customPositions]);

  React.useEffect(() => {
    const viewport = graphViewportRef.current;
    if (!viewport) return;
    const updateSize = () => {
      const rect = viewport.getBoundingClientRect();
      const width = Math.max(Math.round(rect.width), 480);
      const height = Math.max(Math.round(rect.height), 360);
      setGraphSize((current) =>
        current.width === width && current.height === height ? current : { width, height }
      );
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === graphRootRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const tags = React.useMemo(
    () => Array.from(new Set(notes.flatMap((note) => note.tags))),
    [notes]
  );

  const tagColor = React.useMemo(() => {
    const map = new Map<string, string>();
    tags.forEach((tag, index) => map.set(tag, TAG_COLORS_LIST[index % TAG_COLORS_LIST.length]));
    return map;
  }, [tags]);

  const noteColor = React.useMemo(() => {
    const parent = new Map(notes.map((note) => [note.id, note.id]));
    const find = (id: number): number => {
      const next = parent.get(id) ?? id;
      if (next === id) return id;
      const root = find(next);
      parent.set(id, root);
      return root;
    };
    relationships.forEach((relationship) => {
      const sourceRoot = find(relationship.sourceId);
      const targetRoot = find(relationship.targetId);
      if (sourceRoot !== targetRoot) parent.set(targetRoot, sourceRoot);
    });

    const rootColor = new Map<number, string>();
    const map = new Map<number, string>();
    notes.forEach((note) => {
      const root = find(note.id);
      if (!rootColor.has(root)) {
        rootColor.set(root, TAG_COLORS_LIST[rootColor.size % TAG_COLORS_LIST.length]);
      }
      map.set(note.id, rootColor.get(root) ?? "#8b949e");
    });
    return map;
  }, [notes, relationships]);

  const graphScale = Math.max(
    1.35,
    Math.min(2.2, Math.min(graphSize.width, graphSize.height) / 500)
  );
  const lineScale = Math.max(1.1, Math.min(1.65, graphScale * 0.85));

  const tagPosition = (index: number) => {
    const tag = tags[index];
    const custom = tag ? customPositions[`tag-${tag}`] : undefined;
    if (custom) return custom;
    const count = Math.max(tags.length, 1);
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const ringRadius = Math.min(graphSize.width, graphSize.height) * 0.3;
    return {
      x: graphSize.width / 2 + Math.cos(angle) * ringRadius,
      y: graphSize.height / 2 + Math.sin(angle) * ringRadius,
    };
  };

  const notePosition = (note: Note, index: number) => {
    const custom = customPositions[`note-${note.id}`];
    if (custom) return custom;
    const primary = note.tags[0];
    const primaryIndex = primary ? tags.indexOf(primary) : -1;
    if (primaryIndex >= 0) {
      const group = notes.filter((candidate) => candidate.tags[0] === primary);
      const localIndex = Math.max(group.findIndex((candidate) => candidate.id === note.id), 0);
      const hub = tagPosition(primaryIndex);
      if (group.length <= 1) return { x: hub.x + 62 * graphScale, y: hub.y };
      const angle = (localIndex / group.length) * Math.PI * 2 - Math.PI / 2 + 0.28;
      const localRadius = Math.max(
        86 * graphScale,
        (group.length * 24 * graphScale) / (Math.PI * 2)
      );
      return {
        x: hub.x + Math.cos(angle) * localRadius,
        y: hub.y + Math.sin(angle) * localRadius,
      };
    }
    const untagged = notes.filter((candidate) => candidate.tags.length === 0);
    const localIndex = Math.max(untagged.findIndex((candidate) => candidate.id === note.id), 0);
    const angle = (localIndex / Math.max(untagged.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const ringRadius = Math.min(graphSize.width, graphSize.height) * 0.4;
    return {
      x: graphSize.width / 2 + Math.cos(angle) * ringRadius,
      y: graphSize.height / 2 + Math.sin(angle) * ringRadius,
    };
  };

  const graphPoint = (svg: SVGSVGElement, clientX: number, clientY: number): GraphPoint => {
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    return {
      x: ((clientX - rect.left) / Math.max(rect.width, 1)) * viewBox.width,
      y: ((clientY - rect.top) / Math.max(rect.height, 1)) * viewBox.height,
    };
  };

  const startDrag = (
    event: React.PointerEvent<SVGElement>,
    key: string,
    position: GraphPoint
  ) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    event.preventDefault();
    event.stopPropagation();
    const point = graphPoint(svg, event.clientX, event.clientY);
    dragRef.current = {
      key,
      pointerId: event.pointerId,
      offsetX: point.x - position.x,
      offsetY: point.y - position.y,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
    };
    svg.setPointerCapture(event.pointerId);
    setDraggingKey(key);
    setHovered(key);
  };

  const moveDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = graphPoint(event.currentTarget, event.clientX, event.clientY);
    if (Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY) > 3) {
      drag.moved = true;
    }
    setCustomPositions((current) => ({
      ...current,
      [drag.key]: {
        x: Math.max(22, Math.min(graphSize.width - 22, point.x - drag.offsetX)),
        y: Math.max(22, Math.min(graphSize.height - 22, point.y - drag.offsetY)),
      },
    }));
  };

  const finishDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClickRef.current = drag.moved && drag.key.startsWith("note-");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDraggingKey(null);
  };

  const openNote = (note: Note) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onOpen(note);
  };

  const toggleFullscreen = async () => {
    const root = graphRootRef.current;
    if (!root) return;
    if (document.fullscreenElement === root) {
      await document.exitFullscreen();
    } else {
      await root.requestFullscreen();
    }
  };

  return (
    <div className="obsidian-graph" ref={graphRootRef}>
      <div className="obsidian-graph-header">
        <span className="obsidian-graph-title">
          <span className="obsidian-graph-title-icon">◉</span>
          Obsidian Graph View
        </span>
        <div className="obsidian-graph-actions">
          <span className="obsidian-graph-drag-hint">Drag any node to rearrange</span>
          <button
            className="btn btn-sm"
            disabled={Object.keys(customPositions).length === 0}
            onClick={() => setCustomPositions({})}
            title="Restore the automatic layout"
          >
            ↻ Reset layout
          </button>
          <button className="btn btn-sm" onClick={() => void toggleFullscreen()}>
            {isFullscreen ? "↙ Exit full screen" : "⛶ Full screen"}
          </button>
          <button className="document-reader-icon-btn" onClick={onClose} title="Close graph view">
            ✕
          </button>
        </div>
      </div>
      <div className="obsidian-graph-legend">
        {tags.map((tag) => (
          <span className="obsidian-graph-legend-item" key={tag}>
            <span
              className="obsidian-graph-legend-swatch obsidian-graph-legend-tag"
              style={{ background: tagColor.get(tag) }}
            />
            #{tag}
          </span>
        ))}
        <span className="obsidian-graph-legend-item">
          <span className="obsidian-graph-legend-line legend-line-wiki" /> wiki link
        </span>
        <span className="obsidian-graph-legend-item">
          <span className="obsidian-graph-legend-line legend-line-tag" /> shared tag
        </span>
        <span className="obsidian-graph-legend-item">
          <span className="obsidian-graph-legend-line legend-line-topic" /> similar content
        </span>
        <span className="obsidian-graph-legend-key">
          <span className="obsidian-graph-legend-swatch obsidian-graph-legend-note" />
          related note cluster (circle)
          <span className="obsidian-graph-legend-swatch obsidian-graph-legend-tag" />
          tag hub (square)
        </span>
      </div>
      <div className="obsidian-graph-scroll" ref={graphViewportRef}>
        <svg
          className="obsidian-graph-svg"
          viewBox={`0 0 ${graphSize.width} ${graphSize.height}`}
          width="100%"
          height="100%"
          role="img"
          aria-label="Obsidian note graph"
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          <defs>
            {tags.map((tag, index) => (
              <marker
                key={tag}
                id={`obsidian-graph-arrow-${index}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth={7 * lineScale}
                markerHeight={7 * lineScale}
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={tagColor.get(tag)} />
              </marker>
            ))}
            <marker
              id="obsidian-note-link-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth={7 * lineScale}
              markerHeight={7 * lineScale}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#d2a8ff" />
            </marker>
          </defs>

          {notes.flatMap((note) =>
            note.tags.map((tag) => {
              const noteNode = notePosition(note, note.id);
              const tagNode = tagPosition(tags.indexOf(tag));
              return (
                <line
                  key={`${note.id}-${tag}`}
                  x1={noteNode.x}
                  y1={noteNode.y}
                  x2={tagNode.x}
                  y2={tagNode.y}
                  stroke={tagColor.get(tag)}
                  strokeOpacity={hovered === `note-${note.id}` ? 0.9 : 0.48}
                  strokeWidth={(hovered === `note-${note.id}` ? 2 : 1) * lineScale}
                  markerEnd={`url(#obsidian-graph-arrow-${tags.indexOf(tag)})`}
                />
              );
            })
          )}

          {relationships.map((relationship) => {
            const source = notes.find((note) => note.id === relationship.sourceId);
            const target = notes.find((note) => note.id === relationship.targetId);
            if (!source || !target) return null;
            const sourcePosition = notePosition(source, notes.indexOf(source));
            const targetPosition = notePosition(target, notes.indexOf(target));
            const active = hovered === `note-${source.id}` || hovered === `note-${target.id}`;
            const stroke = relationship.kind === "wiki"
              ? "#d2a8ff"
              : relationship.kind === "tag"
                ? "#3fb950"
                : "#58a6ff";
            const label = relationship.kind === "wiki"
              ? `Wiki link: ${source.title} ↔ ${target.title} (${relationship.label})`
              : relationship.kind === "tag"
                ? `Shared tag: ${source.title} ↔ ${target.title} (${relationship.label})`
                : `Similar content: ${source.title} ↔ ${target.title} (${relationship.label})`;
            return (
              <line
                key={`relationship-${relationship.sourceId}-${relationship.targetId}`}
                className={`obsidian-note-relationship relationship-${relationship.kind}`}
                x1={sourcePosition.x}
                y1={sourcePosition.y}
                x2={targetPosition.x}
                y2={targetPosition.y}
                stroke={stroke}
                strokeOpacity={active ? 0.95 : relationship.kind === "topic" ? 0.34 : 0.62}
                strokeWidth={(active ? 2.6 : relationship.kind === "wiki" ? 1.8 : 1.4) * lineScale}
                strokeDasharray={relationship.kind === "topic" ? `${5 * lineScale} ${5 * lineScale}` : undefined}
                markerEnd={relationship.kind === "wiki" ? "url(#obsidian-note-link-arrow)" : undefined}
              >
                <title>{label}</title>
              </line>
            );
          })}

          {tags.map((tag, index) => {
            const pos = tagPosition(index);
            const r = 18 * graphScale;
            const hoveredTag = hovered === `tag-${tag}`;
            const size = r * 2 + (hoveredTag ? 6 * graphScale : 0);
            return (
              <rect
                key={`tag-${tag}`}
                className="obsidian-graph-tag-node"
                x={pos.x - size / 2}
                y={pos.y - size / 2}
                width={size}
                height={size}
                rx={4 * graphScale}
                fill={tagColor.get(tag)}
                opacity={hoveredTag ? 1 : 0.72}
                onPointerDown={(event) => startDrag(event, `tag-${tag}`, pos)}
                onMouseEnter={() => setHovered(`tag-${tag}`)}
                onMouseLeave={() => { if (!dragRef.current) setHovered(null); }}
              >
                <title>#{tag}</title>
              </rect>
            );
          })}

          {notes.map((note, index) => {
            const pos = notePosition(note, index);
            const hoveredNote = hovered === `note-${note.id}`;
            const r = (10 + (hoveredNote ? 3 : 0)) * graphScale;
            return (
              <g
                key={`note-${note.id}`}
                className={`obsidian-graph-note-node${draggingKey === `note-${note.id}` ? " is-dragging" : ""}`}
                onClick={() => openNote(note)}
                onPointerDown={(event) => startDrag(event, `note-${note.id}`, pos)}
                onMouseEnter={() => setHovered(`note-${note.id}`)}
                onMouseLeave={() => { if (!dragRef.current) setHovered(null); }}
              >
                <circle
                  className="obsidian-graph-note-heartbeat"
                  cx={pos.x}
                  cy={pos.y}
                  r={r}
                  color={noteColor.get(note.id) ?? "#8b949e"}
                  fill={noteColor.get(note.id) ?? "#8b949e"}
                  opacity={hoveredNote ? 1 : 0.88}
                  stroke={noteColor.get(note.id) ?? "#8b949e"}
                  strokeWidth={(hoveredNote ? 2.5 : 1.5) * lineScale}
                  style={{ animationDelay: `${-(index % 8) * 0.34}s` }}
                />
                <title>{note.title || "Untitled"}</title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function GraphView({ notes, onOpen, onClose }: { notes: Note[]; onOpen: (note: Note) => void; onClose: () => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [showTags, setShowTags] = React.useState(true);
  const [showOrphans, setShowOrphans] = React.useState(true);

  const graphNotes = React.useMemo(() => {
    if (showOrphans) return notes;
    return notes.filter((note) => note.tags.length > 0 || wikiTargets(note.body).length > 0);
  }, [notes, showOrphans]);

  // Build unique tags and assign colors
  const allUniqueTags = React.useMemo(() => {
    const s = new Set<string>();
    graphNotes.forEach((n) => n.tags.forEach((t) => s.add(t.split("/")[0]))); // top-level tag only
    return Array.from(s);
  }, [graphNotes]);

  const tagColorMap = React.useMemo(() => {
    const m = new Map<string, string>();
    allUniqueTags.forEach((t, i) => m.set(t, TAG_COLORS_LIST[i % TAG_COLORS_LIST.length]));
    return m;
  }, [allUniqueTags]);

  const noteColor = React.useCallback((note: Note) => {
    const root = note.tags[0]?.split("/")[0];
    return root ? (tagColorMap.get(root) ?? "#2f81f7") : "#2f81f7";
  }, [tagColorMap]);

  const simRef = React.useRef<{
    nodes: GNode[]; edges: GEdge[];
    raf: number; dragging: number | null; hover: number | null; W: number; H: number;
  }>({ nodes: [], edges: [], raf: 0, dragging: null, hover: null, W: 800, H: 600 });

  React.useEffect(() => {
    const sim = simRef.current;
    sim.dragging = null;
    sim.hover = null;

    // Note nodes
    const noteNodes: GNode[] = graphNotes.map((note) => ({
      id: note.id, title: note.title || "Untitled",
      x: sim.W / 2 + (Math.random() - 0.5) * 400,
      y: sim.H / 2 + (Math.random() - 0.5) * 300,
      vx: 0, vy: 0,
      r: 7 + Math.min(wikiTargets(note.body).length * 2, 10),
      kind: "note" as const,
      color: noteColor(note),
    }));

    // Tag nodes (one per unique top-level tag)
    const tagNodes: GNode[] = allUniqueTags.map((tag, i) => ({
      id: -(i + 1), title: `#${tag}`,
      x: sim.W / 2 + Math.cos((i / allUniqueTags.length) * Math.PI * 2) * 200,
      y: sim.H / 2 + Math.sin((i / allUniqueTags.length) * Math.PI * 2) * 200,
      vx: 0, vy: 0, r: 14,
      kind: "tag" as const,
      color: tagColorMap.get(tag) ?? "#8b949e",
      tag,
    }));

    sim.nodes = [...noteNodes, ...(showTags ? tagNodes : [])];

    // Wiki-link edges (note → note)
    const wikiEdges: GEdge[] = [];
    graphNotes.forEach((note, i) => {
      for (const target of wikiTargets(note.body)) {
        const j = graphNotes.findIndex((n) => n.title.trim().toLowerCase() === target.toLowerCase());
        if (j !== -1 && j !== i) wikiEdges.push({ s: i, t: j });
      }
    });

    // Tag edges (note → tag node)
    const tagEdges: GEdge[] = [];
    if (showTags) {
      graphNotes.forEach((note, i) => {
        note.tags.forEach((tag) => {
          const rootTag = tag.split("/")[0];
          const ti = allUniqueTags.indexOf(rootTag);
          if (ti !== -1) tagEdges.push({ s: i, t: noteNodes.length + ti });
        });
      });
    }

    sim.edges = [...wikiEdges, ...tagEdges];
  }, [graphNotes, showTags, allUniqueTags, noteColor]);

  React.useEffect(() => {
    const sim = simRef.current;

    const animate = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = sim.W || canvas.width;
      const H = sim.H || canvas.height;
      const { nodes, edges } = sim;

      // Physics
      for (let i = 0; i < nodes.length; i++) {
        if (sim.dragging === i) continue;
        const node = nodes[i];
        const isTag = node.kind === "tag";

        if (isTag) {
          const tagIndex = allUniqueTags.indexOf(node.tag ?? "");
          const ringRadius = Math.min(W, H) * 0.34;
          const angle = (tagIndex / Math.max(allUniqueTags.length, 1)) * Math.PI * 2 - Math.PI / 2;
          node.x = W / 2 + Math.cos(angle) * ringRadius;
          node.y = H / 2 + Math.sin(angle) * ringRadius;
          node.vx = 0;
          node.vy = 0;
          continue;
        }

        let fx = 0, fy = 0;

        // Repulsion
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const dx = node.x - nodes[j].x, dy = node.y - nodes[j].y;
          const d2 = dx * dx + dy * dy + 1;
          const strength = isTag ? 12000 : 5500;
          const f = strength / d2;
          const d = Math.sqrt(d2);
          fx += (dx / d) * f; fy += (dy / d) * f;
        }

        // Spring attraction along edges
        for (const e of edges) {
          const other = e.s === i ? e.t : e.t === i ? e.s : -1;
          if (other === -1) continue;
          const dx = nodes[other].x - node.x, dy = nodes[other].y - node.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const restLen = node.kind === "tag" || nodes[other].kind === "tag" ? 160 : 140;
          const stretch = (d - restLen) * 0.04;
          fx += (dx / d) * stretch; fy += (dy / d) * stretch;
        }

        // Center gravity (weaker for tag nodes so they spread)
        const gravity = isTag ? 0.006 : 0.012;
        fx += (W / 2 - node.x) * gravity;
        fy += (H / 2 - node.y) * gravity;

        node.vx = (node.vx + fx * 0.12) * 0.76;
        node.vy = (node.vy + fy * 0.12) * 0.76;
        node.x = Math.max(node.r + 12, Math.min(W - node.r - 12, node.x + node.vx));
        node.y = Math.max(node.r + 24, Math.min(H - node.r - 24, node.y + node.vy));
      }

      // Draw
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0d1117";
      ctx.fillRect(0, 0, W, H);

      // Edges
      const highlighted = sim.hover !== null && sim.hover >= 0
        ? new Set<number>([sim.hover])
        : null;
      if (highlighted) {
        for (const e of edges) {
          if (e.s === sim.hover) highlighted.add(e.t);
          if (e.t === sim.hover) highlighted.add(e.s);
        }
      }

      for (const e of edges) {
        const a = nodes[e.s], b = nodes[e.t];
        if (!a || !b) continue;
        const isTagEdge = a.kind === "tag" || b.kind === "tag";
        const isActive = !highlighted || highlighted.has(e.s) || highlighted.has(e.t);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const targetR = b.kind === "tag" ? b.r + 3 : b.r + 2;
        const endX = b.x - (dx / dist) * targetR;
        const endY = b.y - (dy / dist) * targetR;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(endX, endY);
        if (isTagEdge) {
          const tagNode = a.kind === "tag" ? a : b;
          ctx.strokeStyle = isActive ? tagNode.color + "aa" : tagNode.color + "35";
          ctx.lineWidth = isActive ? 1.8 : 1;
        } else {
          ctx.strokeStyle = isActive ? "rgba(139,148,158,.95)" : "rgba(45,51,59,.65)";
          ctx.lineWidth = isActive ? 2 : 1.2;
        }
        ctx.stroke();

        if (isTagEdge) {
          const tagNode = a.kind === "tag" ? a : b;
          const angle = Math.atan2(dy, dx);
          const arrow = 7;
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(endX - arrow * Math.cos(angle - 0.42), endY - arrow * Math.sin(angle - 0.42));
          ctx.lineTo(endX - arrow * Math.cos(angle + 0.42), endY - arrow * Math.sin(angle + 0.42));
          ctx.closePath();
          ctx.fillStyle = isActive ? tagNode.color : tagNode.color + "55";
          ctx.fill();
        }
      }

      // Tag nodes (draw behind note nodes)
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.kind !== "tag") continue;
        const hovered = sim.hover === i;

        // Glow ring
        const glow = node.r + (hovered ? 8 : 5);
        ctx.fillStyle = node.color + (hovered ? "44" : "1e");
        ctx.fillRect(node.x - glow, node.y - glow, glow * 2, glow * 2);

        // Square hub
        ctx.fillStyle = node.color + (hovered ? "66" : "33");
        ctx.fillRect(node.x - node.r, node.y - node.r, node.r * 2, node.r * 2);
        ctx.strokeStyle = node.color;
        ctx.lineWidth = hovered ? 4 : 2;
        ctx.strokeRect(node.x - node.r, node.y - node.r, node.r * 2, node.r * 2);

        // Label (always visible)
        ctx.fillStyle = node.color;
        ctx.font = hovered ? "bold 12px -apple-system, sans-serif" : "bold 11px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(node.title, node.x, node.y + node.r + 14);
      }

      // Note nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.kind !== "note") continue;
        const hovered = sim.hover === i;

        // Glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r + (hovered ? 7 : 3), 0, Math.PI * 2);
        ctx.fillStyle = node.color + (hovered ? "55" : "28");
        ctx.fill();
        // Circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.strokeStyle = node.color + "bb";
        ctx.lineWidth = hovered ? 3.5 : 1.5;
        ctx.stroke();
        // Label
        const label = node.title.length > 20 ? node.title.slice(0, 20) + "…" : node.title;
        ctx.fillStyle = hovered ? "#e6edf3" : "#8b949e";
        ctx.font = hovered ? "bold 11px -apple-system, sans-serif" : "11px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(label, node.x, node.y + node.r + 14);
      }

      sim.raf = requestAnimationFrame(animate);
    };

    sim.raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(sim.raf);
  }, [graphNotes, showTags, allUniqueTags]);

  // Resize canvas
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      simRef.current.W = canvas.width;
      simRef.current.H = canvas.height;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Mouse interactions
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sim = simRef.current;

    const getNode = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      return sim.nodes.findIndex((n) => Math.hypot(n.x - mx, n.y - my) <= n.r + 4);
    };

    const onDown = (e: MouseEvent) => { const i = getNode(e); if (i !== -1) sim.dragging = i; };
    const onMove = (e: MouseEvent) => {
      if (sim.dragging === null) {
        sim.hover = getNode(e);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      sim.nodes[sim.dragging].x = e.clientX - rect.left;
      sim.nodes[sim.dragging].y = e.clientY - rect.top;
      sim.hover = sim.dragging;
    };
    const onUp = (e: MouseEvent) => {
      if (sim.dragging !== null) {
        const node = sim.nodes[sim.dragging];
        if (node.kind === "note") {
          const note = graphNotes.find((n) => n.id === node.id);
          if (note) onOpen(note);
        }
        sim.dragging = null;
      }
    };
    const onLeave = () => {
      sim.hover = null;
      if (sim.dragging !== null) sim.dragging = null;
    };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("mouseleave", onLeave);
    return () => {
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [graphNotes, onOpen]);

  return (
    <div className="graph-modal-backdrop" onClick={onClose}>
      <div className="graph-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: "1px solid var(--border)" }}>
          <strong>Knowledge Graph</strong>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
            <input type="checkbox" checked={showTags} onChange={(e) => setShowTags(e.target.checked)} />
            Show tags
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
            <input type="checkbox" checked={showOrphans} onChange={(e) => setShowOrphans(e.target.checked)} />
            Show orphans
          </label>
          <span className="subtle" style={{ marginLeft: "auto", fontSize: 11 }}>{graphNotes.length} notes · drag to move · click to open</span>
          <button className="btn btn-sm" onClick={onClose}>✕ Close</button>
        </div>
        {showTags && allUniqueTags.length > 0 && (
          <div className="graph-legend">
            {allUniqueTags.map((tag) => (
              <span key={tag} className="graph-legend-item">
                <span className="graph-legend-swatch graph-legend-hub" style={{ background: tagColorMap.get(tag) ?? "#8b949e" }} />
                #{tag}
              </span>
            ))}
            <span className="graph-legend-item graph-legend-key">
              <span className="graph-legend-swatch graph-legend-note" />
              Note
            </span>
          </div>
        )}
        <canvas ref={canvasRef} className="graph-canvas" style={{ width: "100%", flex: 1, display: "block" }} />
      </div>
    </div>
  );
}

// ─── Note Editor ──────────────────────────────────────────────────────────────

interface SourceCursor {
  line: number;
  column: number;
}

const vaultMarkdownHighlight = HighlightStyle.define([
  { tag: highlightTags.heading1, color: "#58a6ff", fontWeight: "800" },
  { tag: highlightTags.heading2, color: "#58a6ff", fontWeight: "750" },
  { tag: highlightTags.heading3, color: "#79c0ff", fontWeight: "700" },
  { tag: [highlightTags.heading4, highlightTags.heading5, highlightTags.heading6], color: "#a5d6ff", fontWeight: "650" },
  { tag: highlightTags.strong, color: "#f0f6fc", fontWeight: "800" },
  { tag: highlightTags.emphasis, color: "#d2a8ff", fontStyle: "italic" },
  { tag: [highlightTags.link, highlightTags.url], color: "#58a6ff", textDecoration: "underline" },
  { tag: highlightTags.monospace, color: "#a5d6ff", backgroundColor: "rgba(110,118,129,.16)" },
  { tag: highlightTags.quote, color: "#8b949e", fontStyle: "italic" },
  { tag: highlightTags.list, color: "#ffa657", fontWeight: "700" },
  { tag: highlightTags.meta, color: "#ff7b72" },
]);

const RUNBOOK_COMMAND = /^(?:sudo|apt(?:-get)?|dnf|yum|curl|wget|tar|echo|source|go|npm|npx|podman|docker|systemctl|service|ssh|scp|rsync|ls|cd|pwd|mkdir|cp|mv|chmod|chown|cat|grep|find|ip|nmcli|netsh|ping|traceroute|qm|pct|pvesh|vzdump|git)\b/i;
const RUNBOOK_SECTION = /^(?:step\s+\d+(?:\.\d+)?\b|\d+(?:\.\d+)*[.)]?\s+(?:purpose|scope|requirements?|prerequisites?|procedure|verification|rollback|troubleshooting|references?|conclusion|important correction)\b)/i;
const RUNBOOK_LANGUAGE = /^(?:bash|shell|sh|zsh|powershell|ps1|python|javascript|typescript|sql|yaml|json|go)$/i;
const RUNBOOK_WARNING = /^(?:security reminder|warning|important|caution|note)\s*:/i;
const RUNBOOK_LABEL = /^[A-Z][A-Za-z0-9 /_-]{1,32}:\s*\S/;

function runbookDecorations(view: EditorView) {
  const ranges: Range<Decoration>[] = [];
  for (let number = 1; number <= view.state.doc.lines; number++) {
    const line = view.state.doc.line(number);
    const text = line.text.trim();
    let className = "";

    if (RUNBOOK_WARNING.test(text)) className = "cm-runbook-warning";
    else if (RUNBOOK_SECTION.test(text)) className = "cm-runbook-section";
    else if (RUNBOOK_LANGUAGE.test(text)) className = "cm-runbook-language";
    else if (RUNBOOK_COMMAND.test(text)) className = "cm-runbook-command";
    else if (RUNBOOK_LABEL.test(text)) className = "cm-runbook-label";

    if (className) ranges.push(Decoration.line({ class: className }).range(line.from));
  }
  return Decoration.set(ranges, true);
}

const runbookHighlightPlugin = ViewPlugin.fromClass(class {
  decorations;

  constructor(view: EditorView) {
    this.decorations = runbookDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged) this.decorations = runbookDecorations(update.view);
  }
}, {
  decorations: (plugin) => plugin.decorations,
});

function MarkdownSourceEditor({
  value,
  onChange,
  onViewReady,
  onCursorChange,
  readOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onViewReady: (view: EditorView | null) => void;
  onCursorChange: (cursor: SourceCursor) => void;
  readOnly?: boolean;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const [failed, setFailed] = React.useState(false);
  const onChangeRef = React.useRef(onChange);
  const onViewReadyRef = React.useRef(onViewReady);
  const onCursorChangeRef = React.useRef(onCursorChange);

  onChangeRef.current = onChange;
  onViewReadyRef.current = onViewReady;
  onCursorChangeRef.current = onCursorChange;

  React.useEffect(() => {
    if (!hostRef.current) return;

    let view: EditorView;
    try {
      view = new EditorView({
        doc: value,
        parent: hostRef.current,
        extensions: [
        basicSetup,
        markdown(),
        oneDark,
        syntaxHighlighting(vaultMarkdownHighlight),
        runbookHighlightPlugin,
        CodeMirrorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
        EditorView.contentAttributes.of({
          "aria-label": "Markdown source editor",
          spellcheck: "true",
          ...(readOnly ? { "aria-readonly": "true" } : {}),
        }),
        EditorView.theme({
          "&": { height: "100%", backgroundColor: "#0d1117" },
          ".cm-scroller": {
            minHeight: "360px",
            overflow: "auto",
            fontFamily: '"Cascadia Code", Consolas, monospace',
            fontSize: "14px",
            lineHeight: "1.55",
          },
          ".cm-content": { padding: "12px 0 28px" },
          ".cm-line": { padding: "0 14px" },
          ".cm-gutters": {
            backgroundColor: "#0d1117",
            borderRight: "1px solid #21262d",
            color: "#6e7681",
          },
          ".cm-activeLine": { backgroundColor: "rgba(110, 118, 129, .08)" },
          ".cm-activeLineGutter": {
            backgroundColor: "rgba(110, 118, 129, .10)",
            color: "#c9d1d9",
          },
          ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
            backgroundColor: "rgba(56, 139, 253, .32) !important",
          },
          "&.cm-focused": { outline: "none" },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          if (update.docChanged || update.selectionSet) {
            const head = update.state.selection.main.head;
            const line = update.state.doc.lineAt(head);
            onCursorChangeRef.current({ line: line.number, column: head - line.from + 1 });
          }
        }),
        ],
      });
    } catch {
      onViewReadyRef.current(null);
      setFailed(true);
      return;
    }

    viewRef.current = view;
    onViewReadyRef.current(view);
    onCursorChangeRef.current({ line: 1, column: 1 });

    return () => {
      onViewReadyRef.current(null);
      viewRef.current = null;
      view.destroy();
    };
  }, []);

  React.useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;

    const head = Math.min(view.state.selection.main.head, value.length);
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      selection: { anchor: head },
    });
  }, [value]);

  if (failed) {
    return (
      <div className="note-source-fallback" role="status">
        <div>Syntax highlighting is unavailable for this note. Showing safe plain text.</div>
        <pre>{value}</pre>
      </div>
    );
  }

  return (
    <div className="note-source-editor">
      <div ref={hostRef} className="note-source-editor-host" />
      {!value && (
        <div className="note-source-placeholder" aria-hidden="true">
          # Heading<br /><br />Write in Markdown…<br /><br />- [ ] Task<br />- Link with [[Note title]]
        </div>
      )}
    </div>
  );
}

function NoteEditor({ initial, backlinks, allTags, onExport, onCancel, onSave, onWikiLink }: {
  initial: Pick<Note, "title" | "body" | "tags" | "color">;
  backlinks: Note[];
  allTags: string[];
  onExport?: () => void;
  onCancel: () => void;
  onSave: (note: NoteInput) => Promise<boolean>;
  onWikiLink: (title: string) => void;
}) {
  const [title, setTitle] = React.useState(initial.title);
  const [body, setBody] = React.useState(initial.body);
  const [tagsText, setTagsText] = React.useState(initial.tags.join(", "));
  const [color, setColor] = React.useState(initial.color);
  const [mode, setMode] = React.useState<EditorMode>("edit");
  const [saving, setSaving] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [showOutline, setShowOutline] = React.useState(false);
  const [showTemplates, setShowTemplates] = React.useState(false);
  const [cursor, setCursor] = React.useState<SourceCursor>({ line: 1, column: 1 });
  const sourceViewRef = React.useRef<EditorView | null>(null);

  const isDirty = body !== initial.body || title !== initial.title || tagsText !== initial.tags.join(", ");

  // Save function (stable ref for Ctrl+S)
  const saveRef = React.useRef<() => Promise<void>>(async () => {});
  saveRef.current = async () => {
    setSaving(true);
    await onSave({
      title: title.trim(),
      body,
      tags: Array.from(new Set(tagsText.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean))),
      color,
    });
    setSaving(false);
  };

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleCancel = () => {
    if (isDirty && !window.confirm("You have unsaved changes. Discard them?")) return;
    onCancel();
  };

  // Toolbar helpers
  const insertAtCursor = (before: string, after = "", placeholder = "") => {
    const view = sourceViewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const selected = view.state.doc.sliceString(from, to) || placeholder;
    const insert = before + selected + after;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + before.length, head: from + before.length + selected.length },
      scrollIntoView: true,
    });
    view.focus();
  };

  const insertLinePrefix = (prefix: string) => {
    const view = sourceViewRef.current;
    if (!view) return;
    const head = view.state.selection.main.head;
    const lineStart = view.state.doc.lineAt(head).from;
    const insert = prefix + " ";
    view.dispatch({
      changes: { from: lineStart, insert },
      selection: { anchor: head + insert.length },
      scrollIntoView: true,
    });
    view.focus();
  };

  const applyTemplate = (tmpl: typeof TEMPLATES[number]) => {
    setBody(applyTemplateVars(tmpl.body));
    if (!title) setTitle(tmpl.name);
    setShowTemplates(false);
  };

  const scrollToHeading = (h: Heading) => {
    const view = sourceViewRef.current;
    if (!view) return;
    const lineNumber = Math.min(h.line + 1, view.state.doc.lines);
    const pos = view.state.doc.line(lineNumber).from;
    view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    view.focus();
  };

  const outline = React.useMemo(() => parseOutline(body), [body]);
  const sourceFilename = `${safeName(title || "Untitled")}.md`;
  const primaryFolder = tagsText.split(",").map((tag) => tag.trim().replace(/^#/, "")).find(Boolean);
  const wordCount = React.useMemo(() => body.trim() ? body.trim().split(/\s+/).length : 0, [body]);
  const lineCount = React.useMemo(() => body.split("\n").length, [body]);

  const editorMinH = fullscreen ? "calc(100vh - 300px)" : "360px";
  const modalStyle: React.CSSProperties = fullscreen
    ? { position: "fixed", inset: 0, zIndex: 110, borderRadius: 0, maxWidth: "100%", maxHeight: "100%", margin: 0, display: "flex", flexDirection: "column" }
    : { maxWidth: 940 };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) handleCancel(); }}>
      <div className="modal" style={modalStyle}>
        {/* Modal header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{initial.title ? "Edit note" : "New note"}</h3>
          <div className="btn-row">
            {onExport && <button className="btn btn-sm" onClick={onExport} title="Download as .md">⬇ Export</button>}
            <button className={`btn btn-sm ${showOutline ? "btn-primary" : ""}`} onClick={() => setShowOutline((v) => !v)} title="Toggle outline">¶ Outline</button>
            <button className="btn btn-sm" onClick={() => setFullscreen((v) => !v)} title="Toggle fullscreen">
              {fullscreen ? "⊡ Restore" : "⊞ Full"}
            </button>
            <button className="btn btn-sm" onClick={handleCancel}>✕</button>
          </div>
        </div>

        <div className="note-editor">
          <input
            className="input note-editor-title"
            placeholder="Note title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />

          <div className="note-source-chrome" aria-label="Open note">
            <div className="note-source-tab" title={sourceFilename}>
              <span className="note-source-file-icon">↓</span>
              <span>{sourceFilename}</span>
              {isDirty && <span className="note-source-dirty" title="Unsaved changes">●</span>}
            </div>
            <div className="note-source-breadcrumb" aria-label="Note location">
              <span>Vault</span><span>›</span>
              {primaryFolder && <><span>{primaryFolder}</span><span>›</span></>}
              <strong>{sourceFilename}</strong>
            </div>
          </div>

          {/* Markdown toolbar */}
          <div style={{ position: "relative" }}>
            <div className="md-toolbar">
              <button className="md-btn" onClick={() => insertAtCursor("**", "**", "bold")} title="Bold"><strong>B</strong></button>
              <button className="md-btn" onClick={() => insertAtCursor("_", "_", "italic")} title="Italic"><em>I</em></button>
              <div className="md-sep" />
              <button className="md-btn" onClick={() => insertLinePrefix("#")} title="Heading 1">H1</button>
              <button className="md-btn" onClick={() => insertLinePrefix("##")} title="Heading 2">H2</button>
              <button className="md-btn" onClick={() => insertLinePrefix("###")} title="Heading 3">H3</button>
              <div className="md-sep" />
              <button className="md-btn" onClick={() => insertAtCursor("`", "`", "code")} title="Inline code">` `</button>
              <button className="md-btn" onClick={() => insertAtCursor("```\n", "\n```", "code")} title="Code block">```</button>
              <div className="md-sep" />
              <button className="md-btn" onClick={() => insertLinePrefix("- [ ]")} title="Task checkbox">☑</button>
              <button className="md-btn" onClick={() => insertAtCursor("\n| Column 1 | Column 2 |\n|----------|----------|\n| Cell     | Cell     |\n")} title="Insert table">⊞ Table</button>
              <button className="md-btn" onClick={() => insertAtCursor("\n---\n")} title="Horizontal rule">—</button>
              <div className="md-sep" />
              <button
                className={`md-btn ${showTemplates ? "md-btn-active" : ""}`}
                onClick={() => setShowTemplates((v) => !v)}
                title="Insert template"
              >📋 Templates {showTemplates ? "▾" : "▸"}</button>
            </div>
            {showTemplates && (
              <div className="templates-dropdown">
                {TEMPLATES.map((t) => (
                  <button key={t.name} className="template-item" onClick={() => applyTemplate(t)}>
                    <span>{t.emoji}</span> {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View mode tabs */}
          <div className="note-editor-toolbar" role="tablist">
            {(["edit", "preview", "split"] as EditorMode[]).map((m) => (
              <button key={m} className={`btn btn-sm ${mode === m ? "btn-primary" : ""}`} onClick={() => setMode(m)} role="tab" aria-selected={mode === m}>
                {m === "edit" ? "Source" : m === "preview" ? "Preview" : "Split"}
              </button>
            ))}
            <span className="spacer" />
            <span className="subtle">Ctrl+S · [[link]]</span>
          </div>

          {/* Editor workspace + outline */}
          <div style={{
            display: "grid",
            gridTemplateColumns: showOutline ? "1fr 180px" : "1fr",
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
            minHeight: editorMinH,
          }}>
            <div className={`note-editor-workspace mode-${mode}`} style={{ border: 0, borderRadius: 0, minHeight: editorMinH }}>
              {mode !== "preview" && (
                <MarkdownSourceEditor
                  value={body}
                  onChange={setBody}
                  onViewReady={(view) => { sourceViewRef.current = view; }}
                  onCursorChange={setCursor}
                />
              )}
              {mode !== "edit" && (
                <div className="note-preview-pane" style={{ maxHeight: fullscreen ? "calc(100vh - 300px)" : "54vh" }}>
                  <MarkdownPreview markdown={body} onWikiLink={onWikiLink} />
                </div>
              )}
            </div>
            {showOutline && (
              <div className="outline-panel">
                <div className="outline-label">Outline</div>
                {outline.length === 0
                  ? <span className="outline-empty">No headings</span>
                  : outline.map((h, i) => (
                    <button key={i} className={`outline-heading outline-h${h.level}`} onClick={() => scrollToHeading(h)}>
                      {h.text}
                    </button>
                  ))}
              </div>
            )}
            <div className="note-editor-statusbar" style={{ gridColumn: "1 / -1" }}>
              <span>{mode === "preview" ? "Preview" : `Ln ${cursor.line}, Col ${cursor.column}`}</span>
              <span className="spacer" />
              <span>{lineCount} lines</span>
              <span>{wordCount} words</span>
              <span>Markdown</span>
              <span>UTF-8</span>
            </div>
          </div>

          {/* Tag input with autocomplete */}
          <TagInput value={tagsText} onChange={setTagsText} allTags={allTags} />
          <AutoTagSuggestions body={body} tagsText={tagsText} onAdd={(tag) => {
            const existing = tagsText.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean);
            if (!existing.includes(tag)) {
              setTagsText(existing.length ? existing.join(", ") + ", " + tag : tag);
            }
          }} />

          {/* Color picker */}
          <div className="note-color-row">
            <span className="subtle">Color</span>
            {COLORS.map((c) => (
              <button
                key={c.key || "default"}
                className={`note-color-swatch ${noteColorClass(c.key)} ${color === c.key ? "is-selected" : ""}`}
                title={c.label}
                onClick={() => setColor(c.key)}
              />
            ))}
          </div>

          {/* Backlinks */}
          {backlinks.length > 0 && (
            <div className="note-backlinks">
              <strong>Linked from</strong>
              <div>{backlinks.map((n) => (
                <button key={n.id} className="wiki-link" onClick={() => onWikiLink(n.title)}>← {n.title}</button>
              ))}</div>
            </div>
          )}

          {/* Actions */}
          <div className="modal-actions">
            {isDirty && <span className="subtle" style={{ marginRight: "auto", fontSize: 11 }}>● Unsaved changes</span>}
            <button className="btn" onClick={handleCancel} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void saveRef.current()} disabled={saving}>
              {saving ? "Saving…" : "Save note"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tag Input with Autocomplete ──────────────────────────────────────────────

// ─── Auto-tag Suggestions ─────────────────────────────────────────────────────

function AutoTagSuggestions({ body, tagsText, onAdd }: {
  body: string;
  tagsText: string;
  onAdd: (tag: string) => void;
}) {
  const detected = React.useMemo(() => detectBodyTags(body), [body]);
  const existing = tagsText.split(",").map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean);
  const newTags = detected.filter((t) => !existing.includes(t));

  if (newTags.length === 0) return null;

  return (
    <div className="autotag-row">
      <span className="autotag-label">Detected in body:</span>
      {newTags.map((tag) => (
        <button key={tag} className="autotag-chip" onClick={() => onAdd(tag)} title={`Add #${tag} as a tag`}>
          #{tag} <span className="autotag-plus">+</span>
        </button>
      ))}
      <button
        className="autotag-chip autotag-add-all"
        onClick={() => newTags.forEach(onAdd)}
        title="Add all detected tags"
      >Add all</button>
    </div>
  );
}

// ─── Tag Input with Autocomplete ──────────────────────────────────────────────

function TagInput({ value, onChange, allTags }: { value: string; onChange: (v: string) => void; allTags: string[] }) {
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const currentTag = (value.split(",").pop() ?? "").trim().replace(/^#/, "");
  const existing = value.split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean);
  const suggestions = currentTag.length >= 1
    ? allTags.filter((t) => t.toLowerCase().includes(currentTag.toLowerCase()) && !existing.includes(t))
    : [];

  const applySuggestion = (tag: string) => {
    const parts = value.split(",");
    parts[parts.length - 1] = " " + tag;
    onChange(parts.join(",").replace(/^\s*,/, "").trimStart());
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="tag-input-wrap">
      <input
        ref={inputRef}
        className="input"
        placeholder="Tags, comma-separated  (e.g. runbook, cyber/incident, docx)"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
      />
      {open && suggestions.length > 0 && (
        <div className="tag-autocomplete">
          {suggestions.slice(0, 8).map((tag) => (
            <button key={tag} onMouseDown={() => applySuggestion(tag)}>#{tag}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Markdown Preview ─────────────────────────────────────────────────────────

function renderInline(text: string, onWikiLink: (title: string) => void): React.ReactNode[] {
  const pattern = /(\[\[[^\]\n]+\]\]|`[^`\n]+`|\*\*[^*\n]+\*\*|_[^_\n]+_|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const m of text.matchAll(pattern)) {
    const i = m.index ?? 0;
    if (i > cursor) out.push(text.slice(cursor, i));
    const tok = m[0];
    if (tok.startsWith("[[")) {
      const [target, alias] = tok.slice(2, -2).split("|", 2).map((p) => p.trim());
      out.push(<button key={i} className="wiki-link" onClick={() => onWikiLink(target)}>[[{alias || target}]]</button>);
    } else if (tok.startsWith("`")) {
      out.push(<code key={i}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("**")) {
      out.push(<strong key={i}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("_")) {
      out.push(<em key={i}>{tok.slice(1, -1)}</em>);
    } else {
      const lnk = tok.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      out.push(lnk ? <a key={i} href={lnk[2]} target="_blank" rel="noreferrer">{lnk[1]} ↗</a> : tok);
    }
    cursor = i + tok.length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function MarkdownPreview({ markdown, onWikiLink, compact = false }: {
  markdown: string; onWikiLink: (title: string) => void; compact?: boolean;
}) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let inCode = false;
  let codeLang = "";
  let codeLines: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = (key: string) => {
    if (tableRows.length === 0) { inTable = false; return; }
    const [headers, ...bodyRows] = tableRows;
    blocks.push(
      <table key={key}>
        <thead><tr>{(headers ?? []).map((h, ci) => <th key={ci}>{renderInline(h.trim(), onWikiLink)}</th>)}</tr></thead>
        {bodyRows.length > 0 && (
          <tbody>{bodyRows.map((row, ri) => (
            <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{renderInline(cell.trim(), onWikiLink)}</td>)}</tr>
          ))}</tbody>
        )}
      </table>
    );
    tableRows = [];
    inTable = false;
  };

  lines.forEach((line, idx) => {
    const fenceM = line.trim().match(/^```(\w*)$/);
    if (fenceM) {
      if (inTable) flushTable(`t${idx}`);
      if (inCode) {
        blocks.push(<RichCodeBlock key={`c${idx}`} lang={codeLang} code={codeLines.join("\n")} />);
        codeLines = []; inCode = false; codeLang = "";
      } else { inCode = true; codeLang = fenceM[1] ?? ""; }
      return;
    }
    if (inCode) { codeLines.push(line); return; }

    // Table rows
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed.slice(1, -1).split("|");
      if (!cells.every((c) => /^[\s\-:]+$/.test(c))) {
        inTable = true;
        tableRows.push(cells);
      }
      return;
    }
    if (inTable) flushTable(`t${idx}`);

    // Standard blocks
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const task = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/);
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);

    if (heading) {
      const Tag = `h${heading[1].length}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      blocks.push(<Tag key={idx}>{renderInline(heading[2], onWikiLink)}</Tag>);
    } else if (task) {
      blocks.push(
        <div className="markdown-task" key={idx}>
          <input type="checkbox" checked={task[1].toLowerCase() === "x"} readOnly />
          <span>{renderInline(task[2], onWikiLink)}</span>
        </div>
      );
    } else if (bullet) {
      blocks.push(<div className="markdown-list-item" key={idx}>• <span>{renderInline(bullet[1], onWikiLink)}</span></div>);
    } else if (ordered) {
      blocks.push(<div className="markdown-list-item" key={idx}>{ordered[1]}. <span>{renderInline(ordered[2], onWikiLink)}</span></div>);
    } else if (/^>\s?/.test(line)) {
      blocks.push(<blockquote key={idx}>{renderInline(line.replace(/^>\s?/, ""), onWikiLink)}</blockquote>);
    } else if (/^\s*(---|___|\*\*\*)\s*$/.test(line)) {
      blocks.push(<hr key={idx} />);
    } else if (line.trim()) {
      blocks.push(<p key={idx}>{renderInline(line, onWikiLink)}</p>);
    }
  });

  if (inCode && codeLines.length) blocks.push(<RichCodeBlock key="cf" lang={codeLang} code={codeLines.join("\n")} />);
  if (inTable) flushTable("tf");

  return (
    <div className={`markdown-preview${compact ? " is-compact" : ""}`} title={compact ? plainExcerpt(markdown) : undefined}>
      {blocks.length ? blocks : <span className="subtle">Nothing to preview yet.</span>}
    </div>
  );
}
