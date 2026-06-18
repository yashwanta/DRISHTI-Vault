import React from "react";
import { api } from "../api";

function StatCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: number | string;
  accent?: string;
  hint?: string;
}) {
  return (
    <div className="card">
      <div className="subtle" style={{ textTransform: "uppercase", letterSpacing: ".04em" }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, margin: "6px 0", color: accent }}>
        {value}
      </div>
      {hint && <div className="subtle">{hint}</div>}
    </div>
  );
}

export function DashboardPage() {
  const [data, setData] = React.useState<any>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const load = () => {
    api.dashboard().then(setData).catch((e) => setErr(e.message));
  };
  React.useEffect(load, []);

  if (err) return <div className="card">Error: {err}</div>;
  if (!data) return <div className="card muted">Loading dashboard…</div>;

  return (
    <div>
      <h1 className="h1" style={{ marginBottom: 16 }}>
        Dashboard
      </h1>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <StatCard label="Total Sites" value={data.total_sites} accent="var(--accent)" />
        <StatCard label="Total Assets" value={data.total_assets} accent="var(--accent)" />
        <StatCard label="Total Credentials" value={data.total_credentials} accent="var(--accent)" />
        <StatCard
          label="Credentials Due for Rotation"
          value={data.credentials_due_rotation}
          accent={data.credentials_due_rotation > 0 ? "var(--warning)" : "var(--success)"}
          hint={data.credentials_due_rotation > 0 ? "Action needed" : "All current"}
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 18 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Recent Changes</h3>
          {data.recent_changes.length === 0 ? (
            <div className="muted">No changes recorded.</div>
          ) : (
            <table>
              <tbody>
                {data.recent_changes.map((c: any) => (
                  <tr key={c.id}>
                    <td>{c.event_date || "—"}</td>
                    <td>{c.asset_name || "—"}</td>
                    <td className="muted">{c.field_changed || "—"}</td>
                    <td className="muted">{c.changed_by || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Recent Audit Events</h3>
          {data.recent_audit.length === 0 ? (
            <div className="muted">No audit events.</div>
          ) : (
            <table>
              <tbody>
                {data.recent_audit.map((a: any) => (
                  <tr key={a.id}>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>
                      {(a.event_ts || "").slice(11, 19)}
                    </td>
                    <td><code>{a.action}</code></td>
                    <td className="muted">{a.actor || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
