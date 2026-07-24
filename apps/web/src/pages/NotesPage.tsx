import React from "react";
import { api } from "../api";
import { Empty, Modal, useToast } from "../components/ui";

/**
 * Encrypted Notes — OneNote-style.
 *
 * Notes are fully encrypted at rest (title + body + tags). The server returns
 * decrypted notes for an authenticated session (no master-password re-auth /
 * reveal window — see routes/notes.py). This page fetches them and searches
 * CLIENT-SIDE in the box below.
 *
 * Editing/creating sends plaintext over the (localhost) connection; the server
 * encrypts before storing. No note content is ever persisted in the browser.
 */

const COLORS: { key: string; label: string; bg: string }[] = [
  { key: "", label: "Default", bg: "var(--panel)" },
  { key: "yellow", label: "Yellow", bg: "#fff7c2" },
  { key: "green", label: "Green", bg: "#d8f5d6" },
  { key: "blue", label: "Blue", bg: "#d4ecff" },
  { key: "pink", label: "Pink", bg: "#ffd9ec" },
  { key: "purple", label: "Purple", bg: "#e3d4ff" },
  { key: "gray", label: "Gray", bg: "#e2e3e6" },
];

const COLOR_BG: Record<string, string> = COLORS.reduce(
  (m, c) => ((m[c.key] = c.bg), m),
  {} as Record<string, string>
);

type EditorState =
  | { kind: "none" }
  | { kind: "new" }
  | { kind: "edit"; note: any };

export function NotesPage() {
  const [notes, setNotes] = React.useState<any[]>([]);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [editor, setEditor] = React.useState<EditorState>({ kind: "none" });
  const { show, node } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.listNotes();
      setNotes(r.items);
    } catch (e: any) {
      show("Failed to load notes: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [show]);

  React.useEffect(() => {
    load();
  }, [load]);

  // ---- client-side search over decrypted content ----
  const q = query.trim().toLowerCase();
  const filtered = q
    ? notes.filter((n) => {
        const hay = (
          (n.title || "") + "\n" + (n.body || "") + "\n" +
          (n.tags || []).join(" ")
        ).toLowerCase();
        return hay.includes(q);
      })
    : notes;

  const pinned = filtered.filter((n) => n.pinned);
  const others = filtered.filter((n) => !n.pinned);

  // ---- mutations ----
  const saveNote = async (data: {
    title: string; body: string; tags: string[]; color: string;
  }) => {
    try {
      if (editor.kind === "new") {
        await api.createNote({ ...data, pinned: false });
        show("Note created");
      } else if (editor.kind === "edit") {
        await api.updateNote(editor.note.id, data);
        show("Note saved");
      }
      setEditor({ kind: "none" });
      const r = await api.listNotes();
      setNotes(r.items);
    } catch (e: any) {
      show("Save failed: " + e.message);
    }
  };

  const togglePin = async (n: any) => {
    try {
      await api.toggleNotePin(n.id);
      const r = await api.listNotes();
      setNotes(r.items);
    } catch (e: any) { show(e.message); }
  };

  const removeNote = async (n: any) => {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    try {
      await api.deleteNote(n.id);
      show("Note deleted");
      const r = await api.listNotes();
      setNotes(r.items);
    } catch (e: any) { show("Delete failed: " + e.message); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 className="h1" style={{ margin: 0 }}>Notes</h1>
        <input
          className="input"
          placeholder="🔍 Search notes (title, body, tags)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, minWidth: 220, maxWidth: 460 }}
        />
        <button className="btn btn-primary" onClick={() => setEditor({ kind: "new" })}>
          + New note
        </button>
      </div>
      <p className="subtle">
        {notes.length} note{notes.length === 1 ? "" : "s"} ·
        fully encrypted at rest · search runs locally in your browser
      </p>

      {loading ? (
        <div className="subtle">Loading…</div>
      ) : notes.length === 0 ? (
        <Empty>No notes yet. Click “New note” to create one.</Empty>
      ) : filtered.length === 0 ? (
        <Empty>No notes match “{query}”.</Empty>
      ) : (
        <>
          {pinned.length > 0 && (
            <NoteGrid
              notes={pinned}
              onEdit={(n) => setEditor({ kind: "edit", note: n })}
              onPin={togglePin}
              onDelete={removeNote}
            />
          )}
          {pinned.length > 0 && others.length > 0 && (
            <div className="subtle" style={{ margin: "16px 0 8px" }}>
              — Other notes —
            </div>
          )}
          <NoteGrid
            notes={others}
            onEdit={(n) => setEditor({ kind: "edit", note: n })}
            onPin={togglePin}
            onDelete={removeNote}
          />
        </>
      )}

      {editor.kind !== "none" && (
        <NoteEditor
          initial={
            editor.kind === "edit"
              ? editor.note
              : { title: "", body: "", tags: [], color: "" }
          }
          onCancel={() => setEditor({ kind: "none" })}
          onSave={saveNote}
        />
      )}

      {node}
    </div>
  );
}

function NoteGrid({
  notes, onEdit, onPin, onDelete,
}: {
  notes: any[];
  onEdit: (n: any) => void;
  onPin: (n: any) => void;
  onDelete: (n: any) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 14,
        alignItems: "start",
      }}
    >
      {notes.map((n) => (
        <div
          key={n.id}
          style={{
            background: COLOR_BG[n.color] || "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 14,
            minHeight: 120,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
            <strong style={{ wordBreak: "break-word" }}>{n.title || "(untitled)"}</strong>
            <span
              onClick={() => onPin(n)}
              title={n.pinned ? "Unpin" : "Pin to top"}
              style={{ cursor: "pointer", opacity: n.pinned ? 1 : 0.4 }}
            >
              📌
            </span>
          </div>
          <div
            className="muted"
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              flex: 1,
              marginTop: 6,
              maxHeight: 180,
              overflow: "hidden",
            }}
          >
            {n.body}
          </div>
          {n.tags?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
              {n.tags.map((t: string) => (
                <span key={t} className="pill" style={{ fontSize: 11 }}>#{t}</span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn btn-sm" onClick={() => onEdit(n)}>Edit</button>
            <button className="btn btn-sm" onClick={() => onDelete(n)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function NoteEditor({
  initial, onCancel, onSave,
}: {
  initial: { title: string; body: string; tags: string[]; color: string };
  onCancel: () => void;
  onSave: (d: { title: string; body: string; tags: string[]; color: string }) => void;
}) {
  const [title, setTitle] = React.useState(initial.title || "");
  const [body, setBody] = React.useState(initial.body || "");
  const [tagsText, setTagsText] = React.useState((initial.tags || []).join(", "));
  const [color, setColor] = React.useState(initial.color || "");

  return (
    <Modal title={initial.title ? "Edit note" : "New note"} onClose={onCancel} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          className="input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <textarea
          className="input"
          placeholder="Take a note…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          style={{ resize: "vertical", fontFamily: "inherit" }}
        />
        <input
          className="input"
          placeholder="Tags, comma-separated (e.g. runbook, springfield)"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
        />
        <div>
          <div className="subtle" style={{ marginBottom: 6 }}>Color</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {COLORS.map((c) => (
              <button
                key={c.key || "default"}
                title={c.label}
                onClick={() => setColor(c.key)}
                style={{
                  width: 26, height: 26, borderRadius: 6,
                  background: c.bg, border: color === c.key ? "2px solid var(--accent, #3b82f6)" : "1px solid var(--border)",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </div>
        <div className="btn-row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() =>
              onSave({
                title: title.trim(),
                body,
                tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
                color,
              })
            }
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
