import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { ConfirmDialog, Empty, Field, Modal, StatusPill, useToast } from "../components/ui";

const empty = {
  site_id: null as number | null, app_vm_name: "", asset_type: "Ubuntu Server",
  vm_id: "", hostname: "", ip_address: "", web_url: "", environment: "",
  os_info: "", owner: "", status: "Active", notes: "",
};

export function AssetsPage() {
  const navigate = useNavigate();
  const [items, setItems] = React.useState<any[]>([]);
  const [types, setTypes] = React.useState<string[]>([]);
  const [sites, setSites] = React.useState<any[]>([]);
  const [q, setQ] = React.useState("");
  const [siteFilter, setSiteFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [editing, setEditing] = React.useState<any | null>(null);
  const [form, setForm] = React.useState<any>(empty);
  const [del, setDel] = React.useState<any | null>(null);
  const { show, node } = useToast();

  const load = () => {
    api.listAssets().then((r) => { setItems(r.items); setTypes(r.asset_types); });
    api.listSites().then((r) => setSites(r.items));
  };
  React.useEffect(() => { load(); }, []);

  const filtered = items.filter((a) => {
    const t = q.toLowerCase();
    const matchQ = !t || [a.app_vm_name, a.hostname, a.ip_address, a.asset_type,
      a.vm_id, a.owner, a.os_info].filter(Boolean)
      .some((x) => String(x).toLowerCase().includes(t));
    return matchQ
      && (!siteFilter || String(a.site_id) === siteFilter)
      && (!statusFilter || a.status === statusFilter)
      && (!typeFilter || a.asset_type === typeFilter);
  });

  const openNew = () => { setForm(empty); setEditing({}); };
  const openEdit = async (a: any) => {
    const full = await api.getAsset(a.id);
    setForm({
      ...empty,
      ...full,
      site_id: full.site_id,
    });
    setEditing(a);
  };

  const save = async () => {
    if (!form.app_vm_name.trim()) { show("VM/Application name required"); return; }
    await api.saveAsset({
      site_id: form.site_id || null,
      app_vm_name: form.app_vm_name.trim(),
      asset_type: form.asset_type,
      vm_id: form.vm_id || null,
      hostname: form.hostname || null,
      ip_address: form.ip_address || null,
      web_url: form.web_url || null,
      environment: form.environment || null,
      os_info: form.os_info || null,
      owner: form.owner || null,
      status: form.status,
      notes: form.notes || null,
    }, form.id);
    setEditing(null);
    show("Asset saved");
    load();
  };

  const doDelete = async () => {
    await api.deleteAsset(del.id);
    setDel(null);
    show("Asset deleted");
    load();
  };

  return (
    <div>
      <h1 className="h1">VM &amp; Server Inventory</h1>
      <div className="toolbar">
        <input placeholder="Search assets…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
          <option value="">All Sites</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option>Active</option><option>Planned</option><option>Retired</option>
        </select>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={openNew}>+ Add Asset</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {filtered.length === 0 ? (
          <Empty>No assets found.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Site</th><th>Application / VM</th><th>Type</th><th>VM ID</th>
                <th>Hostname</th><th>IP</th><th>Env</th><th>OS</th><th>Owner</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td className="muted">{a.site_name || "—"}</td>
                  <td><strong>{a.app_vm_name}</strong></td>
                  <td><span className="pill">{a.asset_type}</span></td>
                  <td>{a.vm_id || "—"}</td>
                  <td>{a.hostname || "—"}</td>
                  <td>{a.ip_address || "—"}</td>
                  <td>{a.environment || "—"}</td>
                  <td className="muted">{a.os_info || "—"}</td>
                  <td>{a.owner || "—"}</td>
                  <td><StatusPill status={a.status} /></td>
                  <td>
                    <div className="btn-row">
                      <button className="btn btn-sm" onClick={() => openEdit(a)}>Edit</button>
                      <button className="btn btn-sm" onClick={() => navigate(`/credentials?asset=${a.id}`)}>Credentials</button>
                      <button className="btn btn-sm" onClick={() => navigate(`/changelog?asset=${a.id}`)}>Change Log</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setDel(a)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <Modal title={form.id ? "Edit Asset" : "Add Asset"} onClose={() => setEditing(null)} wide>
          <div className="form-grid">
            <Field label="Site / Plant">
              <select value={form.site_id ?? ""} onChange={(e) => setForm({ ...form, site_id: e.target.value || null })}>
                <option value="">—</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Application / VM Name"><input value={form.app_vm_name} onChange={(e) => setForm({ ...form, app_vm_name: e.target.value })} autoFocus /></Field>
            <Field label="Asset Type">
              <select value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value })}>
                {types.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="VM ID"><input value={form.vm_id || ""} onChange={(e) => setForm({ ...form, vm_id: e.target.value })} /></Field>
            <Field label="Hostname"><input value={form.hostname || ""} onChange={(e) => setForm({ ...form, hostname: e.target.value })} /></Field>
            <Field label="IP Address"><input value={form.ip_address || ""} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} /></Field>
            <Field label="Web URL"><input value={form.web_url || ""} onChange={(e) => setForm({ ...form, web_url: e.target.value })} /></Field>
            <Field label="Environment"><input value={form.environment || ""} onChange={(e) => setForm({ ...form, environment: e.target.value })} /></Field>
            <Field label="Operating System"><input value={form.os_info || ""} onChange={(e) => setForm({ ...form, os_info: e.target.value })} /></Field>
            <Field label="Owner"><input value={form.owner || ""} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Active</option><option>Planned</option><option>Retired</option>
              </select>
            </Field>
            <Field label="Notes" full><input value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <div className="btn-row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save</button>
          </div>
        </Modal>
      )}

      {del && (
        <ConfirmDialog
          title="Delete asset?"
          message={`Delete "${del.app_vm_name}"? This cannot be undone.`}
          onConfirm={doDelete}
          onCancel={() => setDel(null)}
        />
      )}
      {node}
    </div>
  );
}
