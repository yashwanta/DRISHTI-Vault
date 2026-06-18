import React from "react";
import { api } from "../api";
import { ConfirmDialog, Empty, Field, Modal, StatusPill, useToast } from "../components/ui";

const empty = { name: "", plant_code: "", location: "", status: "Active", notes: "" };

export function SitesPage() {
  const [items, setItems] = React.useState<any[]>([]);
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<any | null>(null);
  const [form, setForm] = React.useState<any>(empty);
  const [del, setDel] = React.useState<any | null>(null);
  const { show, node } = useToast();

  const load = () => api.listSites().then((r) => setItems(r.items));
  React.useEffect(() => { load(); }, []);

  const filtered = items.filter((s) => {
    const t = q.toLowerCase();
    return !t || [s.name, s.plant_code, s.location, s.status, s.notes]
      .filter(Boolean).some((x) => String(x).toLowerCase().includes(t));
  });

  const openNew = () => { setForm(empty); setEditing({}); };
  const openEdit = (s: any) => { setForm({ ...s }); setEditing(s); };

  const save = async () => {
    if (!form.name.trim()) { show("Site name is required"); return; }
    await api.saveSite({
      name: form.name.trim(),
      plant_code: form.plant_code || null,
      location: form.location || null,
      status: form.status,
      notes: form.notes || null,
    }, form.id);
    setEditing(null);
    show("Site saved");
    load();
  };

  const doDelete = async () => {
    await api.deleteSite(del.id);
    setDel(null);
    show("Site deleted");
    load();
  };

  return (
    <div>
      <h1 className="h1">Sites / Plants</h1>
      <div className="toolbar">
        <input placeholder="Search sites…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="spacer" />
        <button className="btn btn-primary" onClick={openNew}>+ Add Site</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {filtered.length === 0 ? (
          <Empty>No sites. Click <strong>+ Add Site</strong> or import from Excel.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Site / Plant</th><th>Plant Code</th><th>Location</th>
                <th>Status</th><th>VM Count</th><th>Credential Count</th>
                <th>Notes</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.plant_code || "—"}</td>
                  <td>{s.location || "—"}</td>
                  <td><StatusPill status={s.status} /></td>
                  <td>{s.vm_count ?? 0}</td>
                  <td>{s.credential_count ?? 0}</td>
                  <td className="muted" style={{ maxWidth: 200 }}>{s.notes || "—"}</td>
                  <td>
                    <div className="btn-row">
                      <button className="btn btn-sm" onClick={() => openEdit(s)}>Edit</button>
                      <button className="btn btn-sm" onClick={() => setDel(s)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <Modal title={form.id ? "Edit Site" : "Add Site"} onClose={() => setEditing(null)}>
          <div className="form-grid">
            <Field label="Site / Plant" full>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </Field>
            <Field label="Plant Code"><input value={form.plant_code || ""} onChange={(e) => setForm({ ...form, plant_code: e.target.value })} /></Field>
            <Field label="Location"><input value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Active</option><option>Planned</option><option>Retired</option>
              </select>
            </Field>
            <Field label="Notes"><input value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <div className="btn-row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save</button>
          </div>
        </Modal>
      )}

      {del && (
        <ConfirmDialog
          title="Delete site?"
          message={`Delete "${del.name}"? Linked assets/credentials will be unlinked, not deleted.`}
          onConfirm={doDelete}
          onCancel={() => setDel(null)}
        />
      )}
      {node}
    </div>
  );
}
