import React from "react";
import { Modal } from "./ui";

// Reusable master-password prompt. Used for reveal-open, backup password, etc.
export function PasswordPrompt({
  title,
  label = "Master password",
  confirmLabel = "Confirm",
  minLength = 1,
  onCancel,
  onConfirm,
}: {
  title: string;
  label?: string;
  confirmLabel?: string;
  minLength?: number;
  onCancel: () => void;
  onConfirm: (pw: string) => Promise<void> | void;
}) {
  const [pw, setPw] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = async () => {
    if (pw.length < minLength) {
      setErr(`Must be at least ${minLength} characters`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onConfirm(pw);
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onCancel}>
      <label>{label}</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type={show ? "text" : "password"}
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="btn btn-sm" type="button" onClick={() => setShow(!show)}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {err && <div style={{ color: "var(--danger)", marginTop: 8, fontSize: 12 }}>{err}</div>}
      <div className="btn-row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
        <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? "…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
