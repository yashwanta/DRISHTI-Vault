import React from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { ConfirmDialog, Empty, Field, Modal, useToast } from "../components/ui";

const empty = {
  event_date: "", site_id: null as number | null, asset_id: null as number | null,
  asset_name: "", field_changed: "", changed_by: "", reason_ticket: "",
  approved_by: "", notes: "",
};

export function ChangeLogPage() {
  const [params] = useSearchParams();
  const presetAsset = params.get("asset");
  const [items, setItems] = React.useState<any[]>([]);
  const [sites, setSites] = React.useState<any[]>([]);
  const [assets, setAssets] = React.useState<any[]>([]);
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<any | null>(null);
  const [form, setForm] = React.useState<any>(empty);
  const [del, setDel] = React.useState<any | null>(null);
  const { show, node } = useToast();

  const load = () => {
    api.listChangelog().then((r) => setItems(r.items));
    api.listSites().then((r) => setSites(r.items));
    api.listAssets().then((r) => setAssets(r.items));
  };
  React.useEffect(() => { load(); }, []);

  const filtered = items.filter((c) => {
    const t = q.toLowerCase();
    return !t || [c.event_date, c.asset_name, c.field_changed, c.changed_by,
      c.reason_ticket, c.approved_by].filter(Boolean)
      .some((x) => String(x).toLowerCase().includes(t));
  });

  const openNew = () => {
    setForm({
      ...empty,
      asset_id: presetAsset ? Number(presetAsset) : null,
      asset_name: presetAsset ? assets.find((a) => a.id === Number(presetAsset))?.app_vm_name || "" : "",
      event_date: new Date().toISOString().slice(0, 10),
    });
    setEditing({});
  };
  const openEdit = (c: any) => { setForm({ ...c }); setEditing(c); };

  const save = async () => {
    await api.saveChangelog({
      event_date: form.event_date || null,
      site_id: form.site_id || null,
      asset_id: form.asset_id || null,
      asset_name: form.asset_name || null,
      field_changed: form.field_changed || null,
      changed_by: form.changed_by || null,
      reason_ticket: form.reason_ticket || null,
      approved_by: form.approved_by || null,
      notes: form.notes || null,
    }, form.id);
    setEditing(null);
    show("Saved");
    load();
  };

  const doDelete = async () => {
    await api.deleteChangelog(del.id);
    setDel(null);
    show("Deleted");
    load();
  };

  return (
    <div>
      <h1 className="h1">Change Log</h1>
      <div className="toolbar">
        <input placeholder="Search changes…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="spacer" />
        <button className="btn btn-primary" onClick={openNew}>+ Add Change</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {filtered.length === 0 ? <Empty>No change log entries.</Empty> : (
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Site</th><th>Asset / VM</th><th>Field Changed</th>
                <th>Changed By</th><th>Reason / Ticket #</th><th>Approved By</th>
                <th>Notes</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>{c.event_date || "—"}</td>
                  <td className="muted">{c.site_name || "—"}</td>
                  <td>{c.asset_name || "—"}</td>
                  <td><span className="pill">{c.field_changed || "—"}</span></td>
                  <td>{c.changed_by || "—"}</td>
                  <td>{c.reason_ticket || "—"}</td>
                  <td>{c.approved_by || "—"}</td>
                  <td className="muted" style={{ maxWidth: 200 }}>{c.notes || "—"}</td>
                  <td>
                    <div className="btn-row">
                      <button className="btn btn-sm" onClick={() => openEdit(c)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setDel(c)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <Modal title={form.id ? "Edit Change" : "Add Change"} onClose={() => setEditing(null)} wide>
          <div className="form-grid">
            <Field label="Date"><input type="date" value={form.event_date || ""} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></Field>
            <Field label="Site / Plant">
              <select value={form.site_id ?? ""} onChange={(e) => setForm({ ...form, site_id: e.target.value || null })}>
                <option value="">—</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Asset / VM">
              <select value={form.asset_id ?? ""} onChange={(e) => {
                const a = assets.find((x) => x.id === Number(e.target.value));
                setForm({ ...form, asset_id: e.target.value ? Number(e.target.value) : null, asset_name: a?.app_vm_name || form.asset_name });
              }}>
                <option value="">—</option>
                {assets.map((a) => <option key={a.id} value={a.id}>{a.app_vm_name}</option>)}
              </select>
            </Field>
            <Field label="Asset Name (free text)"><input value={form.asset_name || ""} onChange={(e) => setForm({ ...form, asset_name: e.target.value })} /></Field>
            <Field label="Field Changed"><input value={form.field_changed || ""} onChange={(e) => setForm({ ...form, field_changed: e.target.value })} /></Field>
            <Field label="Changed By"><input value={form.changed_by || ""} onChange={(e) => setForm({ ...form, changed_by: e.target.value })} /></Field>
            <Field label="Reason / Ticket #"><input value={form.reason_ticket || ""} onChange={(e) => setForm({ ...form, reason_ticket: e.target.value })} /></Field>
            <Field label="Approved By"><input value={form.approved_by || ""} onChange={(e) => setForm({ ...form, approved_by: e.target.value })} /></Field>
            <Field label="Notes" full><input value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <div className="btn-row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save</button>
          </div>
        </Modal>
      )}

      {del && (
        <ConfirmDialog title="Delete entry?" message="Delete this change log entry?"
          onConfirm={doDelete} onCancel={() => setDel(null)} />
      )}
      {node}
    </div>
  );
}
