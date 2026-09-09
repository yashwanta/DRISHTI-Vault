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
 * Single-file mode (default): pass `onPick`.
 * Multi-file mode: pass `multiple` + `onPickMultiple`.
 */
export function DropZone({
  accept,
  onPick,
  onPickMultiple,
  multiple = false,
  busy = false,
  hint,
  selected,
}: {
  accept: string;
  /** Called in single-file mode with the chosen file. */
  onPick?: (file: File | undefined) => void;
  /** Called in multi-file mode with all valid chosen files. */
  onPickMultiple?: (files: File[]) => void;
  multiple?: boolean;
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

  const validateOne = (file: File): boolean => {
    if (!allowed.length) return true;
    const name = file.name.toLowerCase();
    return allowed.some((ext) =>
      ext.startsWith(".") ? name.endsWith(ext) : file.type === ext
    );
  };

  const handleFiles = (files: FileList | null | undefined) => {
    if (!files || files.length === 0) return;

    if (multiple && onPickMultiple) {
      const valid = Array.from(files).filter(validateOne);
      const rejected = files.length - valid.length;
      if (rejected > 0) {
        setError(`${rejected} file(s) skipped — use: ${accept}`);
      } else {
        setError(null);
      }
      if (valid.length > 0) onPickMultiple(valid);
      return;
    }

    // single-file mode
    const f = files[0];
    if (!validateOne(f)) {
      setError(`Unsupported file. Use: ${accept}`);
      return;
    }
    setError(null);
    onPick?.(f);
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
          {busy
            ? "Processing…"
            : multiple
            ? "Drag & drop files here, or click to browse"
            : "Drag & drop a file here, or click to browse"}
        </div>
        {hint && !busy && (
          <div className="subtle" style={{ fontSize: 12 }}>
            {hint}
          </div>
        )}
        {busy && selected && <div style={{ fontWeight: 600 }}>{selected}</div>}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          hidden
          disabled={busy}
          onChange={(e) => {
            handleFiles(e.target.files);
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
