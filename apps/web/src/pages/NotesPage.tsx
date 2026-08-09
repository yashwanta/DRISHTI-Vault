import React from "react";
import { api } from "../api";
import { DropZone } from "../components/DropZone";
import { Empty, Modal, useToast } from "../components/ui";
import type { Note, NoteInput } from "../types";

const COLORS = [
  { key: "", label: "Default" },
  { key: "yellow", label: "Yellow" },
  { key: "green", label: "Green" },
  { key: "blue", label: "Blue" },
  { key: "pink", label: "Pink" },
  { key: "purple", label: "Purple" },
  { key: "gray", label: "Gray" },
] as const;

type EditorMode = "edit" | "preview" | "split";
type EditorState =
  | { kind: "none" }
  | { kind: "new"; title?: string }
  | { kind: "edit"; note: Note };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function noteColorClass(color: string): string {
  return COLORS.some((item) => item.key === color) && color
    ? `note-color-${color}`
    : "note-color-default";
}

function wikiTargets(markdown: string): string[] {
  return Array.from(markdown.matchAll(/\[\[([^\]\n|]+)(?:\|[^\]\n]+)?\]\]/g))
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function plainExcerpt(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " code ")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, alias) => alias || target)
    .replace(/!?(\[([^\]]+)\])\([^)]*\)/g, "$2")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function NotesPage() {
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [query, setQuery] = React.useState("");
  const [selectedTag, setSelectedTag] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [editor, setEditor] = React.useState<EditorState>({ kind: "none" });
  const [uploading, setUploading] = React.useState(false);
  const [uploadName, setUploadName] = React.useState("");
  const { show, node } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await api.listNotes();
      setNotes(result.items);
    } catch (error: unknown) {
      const message = `Failed to load notes: ${errorMessage(error)}`;
      setLoadError(message);
      show(message);
    } finally {
      setLoading(false);
    }
  }, [show]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const allTags = React.useMemo(
    () =>
      Array.from(new Set(notes.flatMap((note) => note.tags))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [notes]
  );

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return notes.filter((note) => {
      const matchesTag = !selectedTag || note.tags.includes(selectedTag);
      const haystack = `${note.title}\n${note.body}\n${note.tags.join(" ")}`.toLowerCase();
      return matchesTag && (!needle || haystack.includes(needle));
    });
  }, [notes, query, selectedTag]);

  const pinned = filtered.filter((note) => note.pinned);
  const others = filtered.filter((note) => !note.pinned);

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
    } catch (error: unknown) {
      show(`Save failed: ${errorMessage(error)}`);
      return false;
    }
  };

  const togglePin = async (note: Note) => {
    try {
      await api.toggleNotePin(note.id);
      await refresh();
    } catch (error: unknown) {
      show(errorMessage(error));
    }
  };

  const removeNote = async (note: Note) => {
    if (!window.confirm(`Delete “${note.title || "Untitled"}”? This cannot be undone.`)) return;
    try {
      await api.deleteNote(note.id);
      show("Note deleted");
      await refresh();
    } catch (error: unknown) {
      show(`Delete failed: ${errorMessage(error)}`);
    }
  };

  const openWikiNote = React.useCallback(
    (title: string) => {
      const match = notes.find(
        (note) => note.title.trim().toLowerCase() === title.trim().toLowerCase()
      );
      setEditor(match ? { kind: "edit", note: match } : { kind: "new", title });
    },
    [notes]
  );

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadName(file.name);
    try {
      const imported = await api.importNote(file);
      const updated = await refresh();
      const note = updated.find((item) => item.id === imported.id);
      show(`Imported “${imported.title}”`);
      if (note) setEditor({ kind: "edit", note });
    } catch (error: unknown) {
      show(`Import failed: ${errorMessage(error)}`);
    } finally {
      setUploading(false);
      setUploadName("");
    }
  };

  return (
    <div className="notes-page">
      <header className="notes-page-header">
        <div>
          <h1 className="h1">Notes</h1>
          <p className="subtle notes-security-line">
            🔒 {notes.length} encrypted note{notes.length === 1 ? "" : "s"} · search stays in this browser session
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditor({ kind: "new" })}>
          + New note
        </button>
      </header>

      <section className="notes-import-panel" aria-label="Import notes">
        <div className="notes-import-copy">
          <strong>Import a document</strong>
          <span className="subtle">Markdown is preserved; DOCX headings and text become Markdown.</span>
        </div>
        <DropZone
          accept=".md,.markdown,.docx"
          busy={uploading}
          selected={uploadName}
          hint="Markdown or Word (.docx), up to 8 MB · legacy .doc is not supported"
          onPick={(file) => void importFile(file)}
        />
      </section>

      <div className="notes-toolbar">
        <input
          className="input notes-search"
          aria-label="Search notes"
          placeholder="🔍 Search titles, content, and tags…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="input notes-tag-filter"
          aria-label="Filter by tag"
          value={selectedTag}
          onChange={(event) => setSelectedTag(event.target.value)}
        >
          <option value="">All tags</option>
          {allTags.map((tag) => <option key={tag} value={tag}>#{tag}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="subtle">Loading…</div>
      ) : loadError ? (
        <div className="banner">
          {loadError} <button className="btn btn-sm" onClick={() => void load()}>Retry</button>
        </div>
      ) : notes.length === 0 ? (
        <Empty>Create a note or import a Markdown/DOCX document to begin.</Empty>
      ) : filtered.length === 0 ? (
        <Empty>No notes match the current search and tag filter.</Empty>
      ) : (
        <div className="notes-sections">
          {pinned.length > 0 && (
            <section>
              <h2 className="notes-section-title">📌 Pinned</h2>
              <NoteGrid notes={pinned} onEdit={(note) => setEditor({ kind: "edit", note })} onPin={togglePin} onDelete={removeNote} onWikiLink={openWikiNote} />
            </section>
          )}
          {others.length > 0 && (
            <section>
              {pinned.length > 0 && <h2 className="notes-section-title">All notes</h2>}
              <NoteGrid notes={others} onEdit={(note) => setEditor({ kind: "edit", note })} onPin={togglePin} onDelete={removeNote} onWikiLink={openWikiNote} />
            </section>
          )}
        </div>
      )}

      {editor.kind !== "none" && (
        <NoteEditor
          key={editor.kind === "edit" ? `edit-${editor.note.id}` : `new-${editor.title || "blank"}`}
          initial={editor.kind === "edit" ? editor.note : { title: editor.title || "", body: "", tags: [], color: "" }}
          backlinks={editor.kind === "edit" ? notes.filter((note) => note.id !== editor.note.id && wikiTargets(note.body).some((target) => target.toLowerCase() === editor.note.title.trim().toLowerCase())) : []}
          onCancel={() => setEditor({ kind: "none" })}
          onSave={saveNote}
          onWikiLink={openWikiNote}
        />
      )}
      {node}
    </div>
  );
}

function NoteGrid({ notes, onEdit, onPin, onDelete, onWikiLink }: {
  notes: Note[];
  onEdit: (note: Note) => void;
  onPin: (note: Note) => void;
  onDelete: (note: Note) => void;
  onWikiLink: (title: string) => void;
}) {
  return (
    <div className="note-card-grid">
      {notes.map((note) => (
        <article key={note.id} className={`note-card ${noteColorClass(note.color)}`}>
          <div className="note-card-header">
            <button className="note-title-button" onClick={() => onEdit(note)}>{note.title || "Untitled"}</button>
            <button className={`note-pin-button ${note.pinned ? "is-pinned" : ""}`} onClick={() => void onPin(note)} title={note.pinned ? "Unpin" : "Pin to top"} aria-label={note.pinned ? "Unpin note" : "Pin note"}>📌</button>
          </div>
          <div className="note-card-preview">
            {note.body ? <MarkdownPreview markdown={note.body} onWikiLink={onWikiLink} compact /> : <span className="subtle">Empty note</span>}
          </div>
          {note.tags.length > 0 && <div className="note-tags">{note.tags.map((tag) => <span key={tag} className="pill">#{tag}</span>)}</div>}
          <div className="note-card-footer">
            <span className="subtle" title={note.updated_at}>Edited {new Date(note.updated_at).toLocaleDateString()}</span>
            <div className="note-card-actions">
              <button className="btn btn-sm" onClick={() => onEdit(note)}>Open</button>
              <button className="btn btn-sm" onClick={() => void onDelete(note)}>Delete</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function NoteEditor({ initial, backlinks, onCancel, onSave, onWikiLink }: {
  initial: Pick<Note, "title" | "body" | "tags" | "color">;
  backlinks: Note[];
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

  const save = async () => {
    setSaving(true);
    await onSave({
      title: title.trim(),
      body,
      tags: Array.from(new Set(tagsText.split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean))),
      color,
    });
    setSaving(false);
  };

  return (
    <Modal title={initial.title ? "Edit note" : "New note"} onClose={onCancel} wide>
      <div className="note-editor">
        <input className="input note-editor-title" placeholder="Note title" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        <div className="note-editor-toolbar" role="tablist" aria-label="Editor view">
          {(["edit", "preview", "split"] as EditorMode[]).map((item) => (
            <button key={item} className={`btn btn-sm ${mode === item ? "btn-primary" : ""}`} onClick={() => setMode(item)} aria-selected={mode === item} role="tab">
              {item === "edit" ? "Edit" : item === "preview" ? "Preview" : "Split"}
            </button>
          ))}
          <span className="spacer" />
          <span className="subtle">Markdown · link notes with [[Note title]]</span>
        </div>
        <div className={`note-editor-workspace mode-${mode}`}>
          {mode !== "preview" && <textarea className="input note-markdown-input" aria-label="Markdown note body" placeholder="# Heading\n\nWrite in Markdown…\n\n- [ ] Task\n- Link another note with [[Note title]]" value={body} onChange={(event) => setBody(event.target.value)} />}
          {mode !== "edit" && <div className="note-preview-pane"><MarkdownPreview markdown={body} onWikiLink={onWikiLink} /></div>}
        </div>
        <input className="input" placeholder="Tags, comma-separated (runbook, network)" value={tagsText} onChange={(event) => setTagsText(event.target.value)} />
        <div className="note-color-row" aria-label="Note color">
          <span className="subtle">Color</span>
          {COLORS.map((item) => <button key={item.key || "default"} className={`note-color-swatch ${noteColorClass(item.key)} ${color === item.key ? "is-selected" : ""}`} title={item.label} aria-label={item.label} onClick={() => setColor(item.key)} />)}
        </div>
        {backlinks.length > 0 && <div className="note-backlinks"><strong>Linked mentions</strong><div>{backlinks.map((note) => <button key={note.id} className="wiki-link" onClick={() => onWikiLink(note.title)}>← {note.title}</button>)}</div></div>}
        <div className="modal-actions">
          <button className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save note"}</button>
        </div>
      </div>
    </Modal>
  );
}

function renderInline(text: string, onWikiLink: (title: string) => void): React.ReactNode[] {
  const pattern = /(\[\[[^\]\n]+\]\]|`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;
  const output: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index || 0;
    if (index > cursor) output.push(text.slice(cursor, index));
    const token = match[0];
    if (token.startsWith("[[")) {
      const [target, alias] = token.slice(2, -2).split("|", 2).map((part) => part.trim());
      output.push(<button key={`${index}-${token}`} className="wiki-link" onClick={() => onWikiLink(target)}>[[{alias || target}]]</button>);
    } else if (token.startsWith("`")) {
      output.push(<code key={`${index}-${token}`}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      output.push(<strong key={`${index}-${token}`}>{token.slice(2, -2)}</strong>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      output.push(link ? <a key={`${index}-${token}`} href={link[2]} target="_blank" rel="noreferrer">{link[1]} ↗</a> : token);
    }
    cursor = index + token.length;
  }
  if (cursor < text.length) output.push(text.slice(cursor));
  return output;
}

function MarkdownPreview({ markdown, onWikiLink, compact = false }: {
  markdown: string;
  onWikiLink: (title: string) => void;
  compact?: boolean;
}) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let inCode = false;
  let code: string[] = [];

  lines.forEach((line, index) => {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        blocks.push(<pre key={`code-${index}`}><code>{code.join("\n")}</code></pre>);
        code = [];
      }
      inCode = !inCode;
      return;
    }
    if (inCode) {
      code.push(line);
      return;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const task = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/);
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (heading) {
      const Tag = `h${heading[1].length}` as keyof JSX.IntrinsicElements;
      blocks.push(<Tag key={index}>{renderInline(heading[2], onWikiLink)}</Tag>);
    } else if (task) {
      blocks.push(<div className="markdown-task" key={index}><input type="checkbox" checked={task[1].toLowerCase() === "x"} readOnly /> <span>{renderInline(task[2], onWikiLink)}</span></div>);
    } else if (bullet || ordered) {
      blocks.push(<div className="markdown-list-item" key={index}>{ordered ? `${line.trim().match(/^\d+/)?.[0]}.` : "•"} <span>{renderInline((bullet || ordered)?.[1] || "", onWikiLink)}</span></div>);
    } else if (/^>\s?/.test(line)) {
      blocks.push(<blockquote key={index}>{renderInline(line.replace(/^>\s?/, ""), onWikiLink)}</blockquote>);
    } else if (/^\s*(---|___|\*\*\*)\s*$/.test(line)) {
      blocks.push(<hr key={index} />);
    } else if (line.trim()) {
      blocks.push(<p key={index}>{renderInline(line, onWikiLink)}</p>);
    }
  });
  if (inCode && code.length) blocks.push(<pre key="code-final"><code>{code.join("\n")}</code></pre>);
  return <div className={`markdown-preview ${compact ? "is-compact" : ""}`} title={compact ? plainExcerpt(markdown) : undefined}>{blocks.length ? blocks : <span className="subtle">Nothing to preview yet.</span>}</div>;
}
