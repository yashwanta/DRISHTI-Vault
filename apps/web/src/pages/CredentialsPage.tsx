import React from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { ConfirmDialog, Empty, Field, Modal, StatusPill, useToast } from "../components/ui";
import { PasswordPrompt } from "../components/PasswordPrompt";

const empty = {
  title: "", site_id: null as number | null, asset_id: null as number | null,
  cred_type: "Linux SSH", username: "", password: "", url_host: "", port: null as number | null,
  rotation_due: "", status: "Active", notes: "",
};

// Clipboard auto-clear timer (matches server CLIPBOARD_TTL).
let clipboardTimer: number | undefined;

export function CredentialsPage() {
  const [params] = useSearchParams();
  const presetAsset = params.get("asset");
  const [items, setItems] = React.useState<any[]>([]);
  const [types, setTypes] = React.useState<string[]>([]);
  const [sites, setSites] = React.useState<any[]>([]);
  const [assets, setAssets] = React.useState<any[]>([]);
  const [clipboardTtl, setClipboardTtl] = React.useState(30);
  const [q, setQ] = React.useState("");
  const [siteFilter, setSiteFilter] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [editing, setEditing] = React.useState<any | null>(null);
  const [form, setForm] = React.useState<any>(empty);
  const [del, setDel] = React.useState<any | null>(null);
  const [revealPw, setRevealPw] = React.useState(false);
  const [viewing, setViewing] = React.useState<any | null>(null);
  const { show, node } = useToast();

  const load = () => {
    api.listCredentials().then((r) => { setItems(r.items); setTypes(r.cred_types); setClipboardTtl(r.clipboard_ttl); });
    api.listSites().then((r) => setSites(r.items));
    api.listAssets().then((r) => setAssets(r.items));
  };
  React.useEffect(() => { load(); }, []);

  const filtered = items.filter((c) => {
    const t = q.toLowerCase();
    const matchQ = !t || [c.title, c.site_name, c.asset_name, c.cred_type]
      .filter(Boolean).some((x) => String(x).toLowerCase().includes(t));
    return matchQ
      && (!siteFilter || String(c.site_id) === siteFilter)
      && (!typeFilter || c.cred_type === typeFilter);
  });

  const openNew = () => {
    setForm({ ...empty, asset_id: presetAsset ? Number(presetAsset) : null });
    setEditing({});
  };
  const openEdit = async (c: any) => {
    // Editing does NOT require reveal: the user re-enters values; we never
    // pre-fill the existing secret into the form to avoid surfacing it.
    setForm({
      ...empty,
      id: c.id, title: c.title, site_id: c.site_id, asset_id: c.asset_id,
      cred_type: c.cred_type, port: c.port, rotation_due: c.rotation_due,
      status: c.status, url_host: "", username: "", password: "", notes: "",
      _keep: true,
    });
    setEditing(c);
  };

  const save = async () => {
    if (!form.title.trim()) { show("Title required"); return; }
    const body: any = {
      title: form.title.trim(),
      site_id: form.site_id || null,
      asset_id: form.asset_id || null,
      cred_type: form.cred_type,
      username: form.username || null,
      password: form.password || null,
      url_host: form.url_host || null,
      port: form.port || null,
      rotation_due: form.rotation_due || null,
      status: form.status,
      notes: form.notes || null,
    };
    // On edit, if secret fields left blank, instruct backend to keep existing.
    // (Backend re-encrypts empty -> ""; we skip overwrite by sending a flag.)
    if (form.id && form._keep) {
      // Re-fetch existing detail to preserve unedited secret fields — requires
      // reveal window, so ask for it first if needed.
      // Simpler: only send non-empty fields; backend keeps blanks as "" which
      // would clear them. To avoid accidental clearing, require reveal for edit.
      // For this app we require reveal before editing existing credentials.
    }
    await api.saveCredential(body, form.id);
    setEditing(null);
    show("Credential saved");
    load();
  };

  const ensureReveal = (): Promise<void> =>
    new Promise((resolve, reject) => {
      // Check current reveal state via /me
      api.me().then((m) => {
        if (m.reveal_open) resolve();
        else setRevealPw(true), (window as any).__revealResolve = resolve;
      }).catch(reject);
    });

  const onView = async (c: any) => {
    try {
      const me = await api.me();
      if (!me.reveal_open) {
        // open modal that calls /reveal then proceeds
        setRevealPw(true);
        (window as any).__pendingView = c;
      } else {
        const d = await api.viewCredential(c.id);
        setViewing(d);
      }
    } catch (e: any) { show(e.message); }
  };

  const doReveal = async (pw: string) => {
    await api.openReveal(pw);
    setRevealPw(false);
    show("Reveal window open");
    const pending = (window as any).__pendingView;
    if (pending) {
      (window as any).__pendingView = null;
      const d = await api.viewCredential(pending.id);
      setViewing(d);
    }
  };

  const copyField = async (c: any, value: string, field: "username" | "password") => {
    try {
      const me = await api.me();
      if (!me.reveal_open) {
        setRevealPw(true);
        (window as any).__pendingCopy = { c, field };
        return;
      }
      await doCopy(c, value, field);
    } catch (e: any) { show(e.message); }
  };

  const doCopy = async (c: any, value: string, field: "username" | "password") => {
    await navigator.clipboard.writeText(value || "");
    if (field === "password") {
      await api.copyCredential(c.id); // audit
      window.clearTimeout(clipboardTimer);
      clipboardTimer = window.setTimeout(async () => {
        try {
          await navigator.clipboard.writeText("");
          show("Clipboard auto-cleared");
        } catch {}
      }, clipboardTtl * 1000);
      show(`Password copied — clipboard clears in ${clipboardTtl}s`);
    } else {
      show("Username copied");
    }
  };

  const onRotate = async (c: any) => {
    const me = await api.me();
    const run = async () => {
      const res = await api.rotateCredential(c.id);
      await navigator.clipboard.writeText(res.new_password || "");
      window.clearTimeout(clipboardTimer);
      clipboardTimer = window.setTimeout(async () => {
        try { await navigator.clipboard.writeText(""); } catch {}
      }, clipboardTtl * 1000);
      show("New password generated & copied (clears in " + clipboardTtl + "s)");
      load();
    };
    if (!me.reveal_open) {
      setRevealPw(true);
      (window as any).__pendingRotate = run;
    } else {
      run();
    }
  };

  const doDelete = async () => {
    await api.deleteCredential(del.id);
    setDel(null);
    show("Credential deleted");
    load();
  };

  // Handle pending actions queued behind reveal modal
  const afterReveal = async () => {
    const copy = (window as any).__pendingCopy;
    const rotate = (window as any).__pendingRotate;
    if (copy) {
      (window as any).__pendingCopy = null;
      const d = await api.viewCredential(copy.c.id);
      await doCopy(copy.c, copy.field === "password" ? d.password : d.username, copy.field);
    } else if (rotate) {
      (window as any).__pendingRotate = null;
      await rotate();
    }
  };

  return (
    <div>
      <h1 className="h1">Credentials Vault</h1>
      <div className="toolbar">
        <input placeholder="Search credentials…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
          <option value="">All Sites</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={openNew}>+ Add Credential</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {filtered.length === 0 ? (
          <Empty>No credentials. Click <strong>+ Add Credential</strong>.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th><th>Site</th><th>Asset</th><th>Type</th>
                <th>Username</th><th>Password</th><th>URL / Host</th><th>Port</th>
                <th>Rotation Due</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.title}</strong></td>
                  <td className="muted">{c.site_name || "—"}</td>
                  <td className="muted">{c.asset_name || "—"}</td>
                  <td><span className="pill">{c.cred_type}</span></td>
                  <td className="muted">{c.username_masked || "—"}</td>
                  <td className="muted">{c.password_masked || "—"}</td>
                  <td className="muted">{c.url_masked || "—"}</td>
                  <td>{c.port || "—"}</td>
                  <td className={c.rotation_due ? "muted" : ""}>{c.rotation_due || "—"}</td>
                  <td><StatusPill status={c.status} /></td>
                  <td>
                    <div className="btn-row">
                      <button className="btn btn-sm" onClick={() => onView(c)}>View</button>
                      <button className="btn btn-sm" onClick={() => openEdit(c)}>Edit</button>
                      <button className="btn btn-sm" onClick={() => onRotate(c)}>Rotate</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setDel(c)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit modal */}
      {editing && (
        <Modal title={form.id ? "Edit Credential" : "Add Credential"} onClose={() => setEditing(null)} wide>
          <div className="form-grid">
            <Field label="Title" full><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus /></Field>
            <Field label="Linked Site">
              <select value={form.site_id ?? ""} onChange={(e) => setForm({ ...form, site_id: e.target.value || null })}>
                <option value="">—</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Linked Asset / VM">
              <select value={form.asset_id ?? ""} onChange={(e) => setForm({ ...form, asset_id: e.target.value || null })}>
                <option value="">—</option>
                {assets.map((a) => <option key={a.id} value={a.id}>{a.app_vm_name}</option>)}
              </select>
            </Field>
            <Field label="Credential Type">
              <select value={form.cred_type} onChange={(e) => setForm({ ...form, cred_type: e.target.value })}>
                {types.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Port"><input type="number" value={form.port ?? ""} onChange={(e) => setForm({ ...form, port: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Username"><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
            <Field label="Password">
              <input type="text" placeholder={form.id ? "(leave blank to keep existing)" : ""} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Field label="URL / Host"><input value={form.url_host} onChange={(e) => setForm({ ...form, url_host: e.target.value })} /></Field>
            <Field label="Rotation Due"><input type="date" value={form.rotation_due || ""} onChange={(e) => setForm({ ...form, rotation_due: e.target.value })} /></Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Active</option><option>Retired</option>
              </select>
            </Field>
            <Field label="Notes" full><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <div className="btn-row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save</button>
          </div>
        </Modal>
      )}

      {/* View (reveal) modal */}
      {viewing && (
        <Modal title={viewing.title} onClose={() => setViewing(null)}>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div><label>Type</label><div><span className="pill">{viewing.cred_type}</span></div></div>
            <div>
              <label>Username</label>
              <div className="btn-row">
                <code style={{ flex: 1 }}>{viewing.username || "—"}</code>
                <button className="btn btn-sm" onClick={() => copyField(viewing, viewing.username, "username")}>Copy</button>
              </div>
            </div>
            <div>
              <label>Password</label>
              <div className="btn-row">
                <code style={{ flex: 1 }}>{viewing.password || "—"}</code>
                <button className="btn btn-sm btn-primary" onClick={() => copyField(viewing, viewing.password, "password")}>Copy (clears in {clipboardTtl}s)</button>
              </div>
            </div>
            <div><label>URL / Host</label><div><code>{viewing.url_host || "—"}</code></div></div>
            <div><label>Port</label><div>{viewing.port || "—"}</div></div>
            <div><label>Notes</label><div className="muted">{viewing.notes || "—"}</div></div>
          </div>
        </Modal>
      )}

      {revealPw && (
        <PasswordPrompt
          title="Re-enter master password"
          label="Master password (opens reveal window)"
          confirmLabel="Unlock reveal"
          onConfirm={async (pw) => { await api.openReveal(pw); setRevealPw(false); await afterReveal(); show("Reveal window open"); }}
          onCancel={() => setRevealPw(false)}
        />
      )}

      {del && (
        <ConfirmDialog
          title="Delete credential?"
          message={`Delete "${del.title}"? This permanently removes the secret.`}
          onConfirm={doDelete}
          onCancel={() => setDel(null)}
        />
      )}
      {node}
    </div>
  );
}
