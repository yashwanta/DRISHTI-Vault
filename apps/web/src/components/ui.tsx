import React from "react";

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { maxWidth: 860 } : undefined}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>{title}</h3>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  danger = true,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p style={{ marginTop: 0 }}>{message}</p>
      <div className="btn-row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className={danger ? "btn btn-danger" : "btn btn-primary"} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "full" : ""}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  let cls = "pill";
  if (s === "active") cls = "pill pill-active";
  else if (s === "planned" || s === "future") cls = "pill pill-warn";
  else if (s === "retired" || s === "disabled" || s === "inactive") cls = "pill pill-danger";
  return <span className={cls}>{status || "—"}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function useToast() {
  const [msg, setMsg] = React.useState<string | null>(null);
  const show = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  };
  const node = msg ? (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        background: "var(--panel-alt)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 16px",
        zIndex: 200,
        boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
      }}
    >
      {msg}
    </div>
  ) : null;
  return { show, node };
}
