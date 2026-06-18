import React from "react";
import { api } from "../api";
import { ConfirmDialog, Empty, Field, Modal, useToast } from "../components/ui";

const empty = {
  site_id: null as number | null, vlan_id: "", vlan_name: "", subnet: "",
  gateway: "", dhcp_scope: "", dns_servers: "", notes: "",
};

export function NetworkPage() {
  const [items, setItems] = React.useState<any[]>([]);
  const [sites, setSites] = React.useState<any[]>([]);
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<any | null>(null);
  const [form, setForm] = React.useState<any>(empty);
  const [del, setDel] = React.useState<any | null>(null);
  const { show, node } = useToast();

  const load = () => {
    api.listNetwork().then((r) => setItems(r.items));
    api.listSites().then((r) => setSites(r.items));
  };
  React.useEffect(() => { load(); }, []);

  const filtered = items.filter((n) => {
    const t = q.toLowerCase();
    return !t || [n.vlan_id, n.vlan_name, n.subnet, n.gateway, n.dns_servers, n.site_name]
      .filter(Boolean).some((x) => String(x).toLowerCase().includes(t));
  });

  const openNew = () => { setForm(empty); setEditing({}); };
  const openEdit = (n: any) => { setForm({ ...n }); setEditing(n); };

  const save = async () => {
    await api.saveNetwork({
      site_id: form.site_id || null,
      vlan_id: form.vlan_id || null,
      vlan_name: form.vlan_name || null,
      subnet: form.subnet || null,
      gateway: form.gateway || null,
      dhcp_scope: form.dhcp_scope || null,
      dns_servers: form.dns_servers || null,
      notes: form.notes || null,
    }, form.id);
    setEditing(null);
    show("Saved");
    load();
  };

  const doDelete = async () => {
    await api.deleteNetwork(del.id);
    setDel(null);
    show("Deleted");
    load();
  };

  return (
    <div>
      <h1 className="h1">Network Reference</h1>
      <div className="toolbar">
        <input placeholder="Search VLANs…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="spacer" />
        <button className="btn btn-primary" onClick={openNew}>+ Add VLAN</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {filtered.length === 0 ? <Empty>No network entries.</Empty> : (
          <table>
            <thead>
              <tr>
                <th>Site</th><th>VLAN ID</th><th>VLAN Name</th><th>Subnet</th>
                <th>Gateway</th><th>DHCP Scope</th><th>DNS</th><th>Notes</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => (
                <tr key={n.id}>
                  <td className="muted">{n.site_name || "—"}</td>
                  <td><strong>{n.vlan_id || "—"}</strong></td>
                  <td>{n.vlan_name || "—"}</td>
                  <td>{n.subnet || "—"}</td>
                  <td>{n.gateway || "—"}</td>
                  <td>{n.dhcp_scope || "—"}</td>
                  <td>{n.dns_servers || "—"}</td>
                  <td className="muted" style={{ maxWidth: 200 }}>{n.notes || "—"}</td>
                  <td>
                    <div className="btn-row">
                      <button className="btn btn-sm" onClick={() => openEdit(n)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setDel(n)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <Modal title={form.id ? "Edit VLAN" : "Add VLAN"} onClose={() => setEditing(null)} wide>
          <div className="form-grid">
            <Field label="Site / Plant">
              <select value={form.site_id ?? ""} onChange={(e) => setForm({ ...form, site_id: e.target.value || null })}>
                <option value="">—</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="VLAN ID"><input value={form.vlan_id || ""} onChange={(e) => setForm({ ...form, vlan_id: e.target.value })} /></Field>
            <Field label="VLAN Name"><input value={form.vlan_name || ""} onChange={(e) => setForm({ ...form, vlan_name: e.target.value })} /></Field>
            <Field label="Subnet"><input value={form.subnet || ""} onChange={(e) => setForm({ ...form, subnet: e.target.value })} /></Field>
            <Field label="Gateway"><input value={form.gateway || ""} onChange={(e) => setForm({ ...form, gateway: e.target.value })} /></Field>
            <Field label="DHCP Scope"><input value={form.dhcp_scope || ""} onChange={(e) => setForm({ ...form, dhcp_scope: e.target.value })} /></Field>
            <Field label="DNS"><input value={form.dns_servers || ""} onChange={(e) => setForm({ ...form, dns_servers: e.target.value })} /></Field>
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
          title="Delete VLAN?"
          message="Delete this network reference entry?"
          onConfirm={doDelete}
          onCancel={() => setDel(null)}
        />
      )}
      {node}
    </div>
  );
}
