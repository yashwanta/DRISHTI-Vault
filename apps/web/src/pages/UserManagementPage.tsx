import React from "react";
import { api } from "../api";
import {
  ConfirmDialog, Empty, Field, Modal, StatusPill, useToast,
} from "../components/ui";
import { MultiPasswordPrompt } from "../components/MultiPasswordPrompt";

interface UserRow {
  id: number;
  username: string;
  role: string;
  full_name: string | null;
  active: boolean;
  must_change_pw: boolean;
  site_ids?: number[];
  created_at?: string;
}

const emptyUser = {
  username: "", full_name: "", role: "location_admin",
  password: "", site_ids: [] as number[],
};

export function UserManagementPage() {
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [sites, setSites] = React.useState<any[]>([]);
  const [canReset, setCanReset] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<any | null>(null);
  const [form, setForm] = React.useState<any>(emptyUser);
  const [assignFor, setAssignFor] = React.useState<UserRow | null>(null);
  const [resetFor, setResetFor] = React.useState<UserRow | null>(null);
  const [deact, setDeact] = React.useState<UserRow | null>(null);
  const { show, node } = useToast();

  const load = () => {
    api.listUsers().then((r) => { setUsers(r.items); setCanReset(r.can_reset_password); });
    api.listSites().then((r) => setSites(r.items));
  };
  React.useEffect(() => { load(); }, []);

  const filtered = users.filter((u) => {
    const t = q.toLowerCase();
    return !t || [u.username, u.full_name, u.role].filter(Boolean)
      .some((x) => String(x).toLowerCase().includes(t));
  });

  const openNew = () => { setForm({ ...emptyUser }); setEditing({}); };
  const openEdit = (u: UserRow) => {
    setForm({ id: u.id, full_name: u.full_name || "", role: u.role,
              active: u.active, site_ids: u.site_ids || [] });
    setEditing(u);
  };

  const save = async () => {
    if (!form.id && !form.username.trim()) { show("Username required"); return; }
    try {
      if (form.id) {
        await api.updateUser(form.id, {
          full_name: form.full_name || null,
          role: form.role, active: form.active,
        });
      } else {
        if ((form.password || "").length < 10) { show("Password must be ≥10 chars"); return; }
        await api.createUser({
          username: form.username.trim(),
          full_name: form.full_name || null,
          role: form.role,
          password: form.password,
          site_ids: form.role === "location_admin" ? form.site_ids : [],
        });
      }
      setEditing(null);
      show("User saved");
      load();
    } catch (e: any) { show(e.message); }
  };

  const saveAssign = async (ids: number[]) => {
    if (!assignFor) return;
    try {
      await api.assignSites(assignFor.id, ids);
      show("Sites assigned");
      setAssignFor(null);
      load();
    } catch (e: any) { show(e.message); }
  };

  const doReset = async (v: Record<string, string>) => {
    if (!resetFor) return;
    try {
      await api.resetUserPassword(resetFor.id, v.new_password);
      show(`Password reset for ${resetFor.username}`);
      setResetFor(null);
      load();
    } catch (e: any) { show(e.message); }
  };

  const doDeactivate = async () => {
    if (!deact) return;
    try {
      await api.deactivateUser(deact.id);
      show("User deactivated");
      setDeact(null);
      load();
    } catch (e: any) { show(e.message); }
  };

  const roleLabel = (r: string) =>
    r === "super_admin" ? "Super Admin" : r === "global_admin" ? "Global Admin" : "Location Admin";

  return (
    <div>
      <h1 className="h1">User Management</h1>
      <p className="subtle" style={{ marginTop: 0 }}>
        Manage Global / Location admins. The reserved Super Admin (Yash) is
        protected and shown only when you are signed in as Yash.
      </p>
      <div className="toolbar">
        <input placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="spacer" />
        <button className="btn btn-primary" onClick={openNew}>+ Add User</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {filtered.length === 0 ? <Empty>No users.</Empty> : (
          <table>
            <thead>
              <tr>
                <th>Username</th><th>Name</th><th>Role</th><th>Active</th>
                <th>Sites</th><th>Password</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.username}</strong></td>
                  <td>{u.full_name || "—"}</td>
                  <td>
                    <span className={u.role === "super_admin" ? "pill pill-active" : "pill"}>
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td><StatusPill status={u.active ? "Active" : "Retired"} /></td>
                  <td className="muted">
                    {u.role === "location_admin"
                      ? (u.site_ids || []).map((id) => sites.find((s) => s.id === id)?.name).filter(Boolean).join(", ") || "—"
                      : (u.role === "super_admin" ? "all" : "all")}
                  </td>
                  <td className="muted">
                    {u.must_change_pw ? <span style={{ color: "var(--warning)" }}>must change</span> : "set"}
                  </td>
                  <td>
                    <div className="btn-row">
                      <button className="btn btn-sm" onClick={() => openEdit(u)}>Edit</button>
                      {u.role === "location_admin" && (
                        <button className="btn btn-sm" onClick={() => setAssignFor(u)}>Sites</button>
                      )}
                      {canReset && u.role !== "super_admin" && (
                        <button className="btn btn-sm" onClick={() => setResetFor(u)}>Reset PW</button>
                      )}
                      {u.role !== "super_admin" && (
                        <button className="btn btn-sm btn-danger" onClick={() => setDeact(u)}>Deactivate</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit */}
      {editing && (
        <Modal title={form.id ? "Edit User" : "Add User"} onClose={() => setEditing(null)}>
          <div className="form-grid">
            <Field label="Username" full>
              <input value={form.username || ""} disabled={!!form.id}
                     onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </Field>
            <Field label="Full name" full>
              <input value={form.full_name || ""}
                     onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="Role">
              <select value={form.role} disabled={form.role === "super_admin"}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="global_admin">Global Admin (all sites)</option>
                <option value="location_admin">Location Admin (assigned sites)</option>
              </select>
            </Field>
            <Field label="Active">
              <select value={form.active === false ? "0" : "1"}
                      onChange={(e) => setForm({ ...form, active: e.target.value === "1" })}>
                <option value="1">Active</option>
                <option value="0">Deactivated</option>
              </select>
            </Field>
            {!form.id && (
              <Field label="Temporary password (min 10)" full>
                <input type="password" value={form.password || ""}
                       onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </Field>
            )}
          </div>
          <div className="subtle" style={{ marginTop: 8 }}>
            {form.id
              ? "Password is not changed here. Use Reset PW to set a new one."
              : "User must change this password at first login."}
          </div>
          <div className="btn-row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save</button>
          </div>
        </Modal>
      )}

      {/* Assign sites */}
      {assignFor && (
        <SiteAssignModal
          user={assignFor}
          sites={sites}
          initial={assignFor.site_ids || []}
          onSave={saveAssign}
          onCancel={() => setAssignFor(null)}
        />
      )}

      {/* Reset password */}
      {resetFor && (
        <MultiPasswordPrompt
          title={`Reset password — ${resetFor.username}`}
          confirmLabel="Reset password"
          busyLabel="Resetting…"
          onCancel={() => setResetFor(null)}
          onSubmit={doReset}
          fields={[
            { key: "new_password", label: "New temporary password (min 10)", minLength: 10 },
          ]}
        />
      )}

      {deact && (
        <ConfirmDialog
          title="Deactivate user?"
          message={`Deactivate "${deact.username}"? They will no longer be able to log in.`}
          confirmLabel="Deactivate"
          onConfirm={doDeactivate}
          onCancel={() => setDeact(null)}
        />
      )}
      {node}
    </div>
  );
}

function SiteAssignModal({
  user, sites, initial, onSave, onCancel,
}: {
  user: UserRow; sites: any[]; initial: number[];
  onSave: (ids: number[]) => void; onCancel: () => void;
}) {
  const [sel, setSel] = React.useState<Set<number>>(new Set(initial));
  const toggle = (id: number) => {
    const n = new Set(sel);
    n.has(id) ? n.delete(id) : n.add(id);
    setSel(n);
  };
  return (
    <Modal title={`Assign sites — ${user.username}`} onClose={onCancel}>
      {sites.length === 0 ? (
        <Empty>No sites defined yet.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sites.map((s) => (
            <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" style={{ width: "auto" }}
                     checked={sel.has(s.id)} onChange={() => toggle(s.id)} />
              {s.name} <span className="muted">({s.plant_code || "—"})</span>
            </label>
          ))}
        </div>
      )}
      <div className="btn-row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onSave([...sel])}>
          Assign {sel.size} site{sel.size === 1 ? "" : "s"}
        </button>
      </div>
    </Modal>
  );
}
