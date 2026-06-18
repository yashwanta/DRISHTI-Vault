import React from "react";
import { api } from "../api";
import { Empty } from "../components/ui";

export function AuditPage() {
  const [items, setItems] = React.useState<any[]>([]);
  const [q, setQ] = React.useState("");
  const [total, setTotal] = React.useState(0);

  const load = () => api.listAudit(1000, 0).then((r) => { setItems(r.items); setTotal(r.total); });
  React.useEffect(() => { load(); }, []);

  const filtered = items.filter((a) => {
    const t = q.toLowerCase();
    return !t || [a.action, a.actor, a.detail, a.target_type].filter(Boolean)
      .some((x) => String(x).toLowerCase().includes(t));
  });

  const actionColor = (action: string) => {
    if (action.includes("delete")) return "var(--danger)";
    if (action.includes("copy") || action.includes("view")) return "var(--warning)";
    if (action.includes("create") || action.includes("restore")) return "var(--success)";
    return "var(--accent)";
  };

  return (
    <div>
      <h1 className="h1">Audit Log</h1>
      <div className="subtle" style={{ marginBottom: 12 }}>
        Immutable record of sensitive actions. Secret values are never logged. {total} total events.
      </div>
      <div className="toolbar">
        <input placeholder="Search audit…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="spacer" />
        <button className="btn" onClick={load}>↻ Refresh</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {filtered.length === 0 ? <Empty>No audit events.</Empty> : (
          <table>
            <thead>
              <tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th><th>IP</th></tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>{a.event_ts}</td>
                  <td>{a.actor || "—"}</td>
                  <td><code style={{ color: actionColor(a.action) }}>{a.action}</code></td>
                  <td className="muted">{a.target_type ? `${a.target_type}#${a.target_id ?? ""}` : "—"}</td>
                  <td className="muted" style={{ maxWidth: 300 }}>{a.detail || "—"}</td>
                  <td className="muted">{a.source_ip || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
