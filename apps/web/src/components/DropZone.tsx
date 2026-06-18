import React from "react";

function humanSize(bytes: number): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Drag-and-drop + click-to-pick file selector.
 *
 * Shows the chosen file's name + size, a processing hint while busy, and rejects
 * files that don't match `accept`. Mirrors the look of the existing `.card` /
 * `.btn` primitives so it fits the rest of the UI.
 */
export function DropZone({
  accept,
  onPick,
  busy = false,
  hint,
  selected,
}: {
  accept: string;
  onPick: (file: File | undefined) => void;
  busy?: boolean;
  hint?: string;
  /** Optional label for the file currently queued (e.g. while previewing). */
  selected?: string;
}) {
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const allowed = React.useMemo(
    () =>
      accept
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    [accept]
  );

  const validate = (file: File | null | undefined): File | undefined => {
    if (!file) return undefined;
    if (allowed.length) {
      const name = file.name.toLowerCase();
      const ok = allowed.some((ext) =>
        ext.startsWith(".") ? name.endsWith(ext) : file.type === ext
      );
      if (!ok) {
        setError(`Unsupported file. Use: ${accept}`);
        return undefined;
      }
    }
    setError(null);
    return file;
  };

  const handleFiles = (files: FileList | null | undefined) => {
    const f = files && files[0];
    const valid = validate(f);
    if (valid) onPick(valid);
  };

  return (
    <div>
      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (busy) return;
          handleFiles(e.dataTransfer.files);
        }}
        style={{
          border: `2px dashed ${dragging ? "var(--accent, #3b82f6)" : "var(--border)"}`,
          borderRadius: 10,
          padding: "18px 14px",
          textAlign: "center",
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
          background: dragging ? "var(--panel-alt, rgba(255,255,255,0.04))" : "transparent",
          transition: "border-color .12s, background .12s",
        }}
      >
        <div className="subtle" style={{ marginBottom: 6 }}>
          {busy ? "Processing…" : "Drag & drop a file here, or click to browse"}
        </div>
        {hint && !busy && <div className="subtle" style={{ fontSize: 12 }}>{hint}</div>}
        {busy && selected && (
          <div style={{ fontWeight: 600 }}>{selected}</div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          hidden
          disabled={busy}
          onChange={(e) => {
            handleFiles(e.target.files);
            // allow re-picking the same file later
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <div className="subtle" style={{ color: "var(--danger)", marginTop: 6 }}>
          {error}
        </div>
      )}
    </div>
  );
}

export { humanSize };
