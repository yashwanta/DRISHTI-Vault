import React from "react";
import { Modal } from "./ui";

// A flexible multi-field password modal. Used for:
//   - Export (master + backup + confirm)
//   - Change master password (current + new + confirm)
//   - Restore preview (master + backup)
//
// No value is ever persisted to localStorage/sessionStorage. Values live only
// in component state for the duration of the modal.

export interface PwField {
  key: string;            // key in the returned object
  label: string;
  minLength?: number;
  placeholder?: string;
}

export function MultiPasswordPrompt({
  title,
  fields,
  confirmLabel = "Confirm",
  onCancel,
  onSubmit,
  busyLabel = "Working…",
}: {
  title: string;
  fields: PwField[];
  confirmLabel?: string;
  onCancel: () => void;
  onSubmit: (values: Record<string, string>) => Promise<void> | void;
  busyLabel?: string;
}) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [show, setShow] = React.useState<Record<string, boolean>>({});
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const set = (k: string, v: string) => {
    setValues((p) => ({ ...p, [k]: v }));
  };

  const submit = async () => {
    setErr(null);
    for (const f of fields) {
      const v = values[f.key] || "";
      if (f.minLength && v.length < f.minLength) {
        setErr(`${f.label} must be at least ${f.minLength} characters`);
        return;
      }
      if (!v) {
        setErr(`${f.label} is required`);
        return;
      }
    }
    // special-case confirm fields
    const backup = values["backup_password"];
    const confirm = values["backup_password_confirm"];
    if (backup !== undefined && confirm !== undefined && backup !== confirm) {
      setErr("Vault Backup Password fields do not match");
      return;
    }
    const newPw = values["new_master_password"];
    const newConfirm = values["new_master_password_confirm"];
    if (newPw !== undefined && newConfirm !== undefined && newPw !== newConfirm) {
      setErr("New master password fields do not match");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(values);
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onCancel}>
      {fields.map((f) => (
        <div key={f.key}>
          <label>{f.label}</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type={show[f.key] ? "text" : "password"}
              value={values[f.key] || ""}
              placeholder={f.placeholder}
              autoFocus={f.key === fields[0].key}
              onChange={(e) => set(f.key, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button
              className="btn btn-sm"
              type="button"
              onClick={() => setShow((p) => ({ ...p, [f.key]: !p[f.key] }))}
            >
              {show[f.key] ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      ))}
      {err && (
        <div style={{ color: "var(--danger)", marginTop: 10, fontSize: 12 }}>{err}</div>
      )}
      <div className="btn-row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
        <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
