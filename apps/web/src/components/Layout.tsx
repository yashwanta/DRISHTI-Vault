import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { WarningBanner } from "./WarningBanner";
import { api } from "../api";

const NAV = [
  { to: "/", label: "Dashboard", icon: "▦" },
  { to: "/sites", label: "Sites / Plants", icon: "🏭" },
  { to: "/assets", label: "VM & Server Inventory", icon: "🖥" },
  { to: "/credentials", label: "Credentials Vault", icon: "🔐" },
  { to: "/network", label: "Network Reference", icon: "🌐" },
  { to: "/changelog", label: "Change Log", icon: "📋" },
  { to: "/audit", label: "Audit Log", icon: "📜" },
  { to: "/settings", label: "Settings / Backup", icon: "⚙" },
];

export function Layout({
  username,
  revealOpen,
  onLocked,
}: {
  username: string;
  revealOpen: boolean;
  onLocked: () => void;
}) {
  const navigate = useNavigate();
  const [idleMin, setIdleMin] = React.useState(15);

  React.useEffect(() => {
    api.bootstrap().then((b) => setIdleMin(b.idle_lock_minutes || 15));
  }, []);

  const lock = async () => {
    try {
      await api.lock();
    } catch {}
    onLocked();
  };

  // inactivity auto-lock on the client (mirrors server-side check)
  React.useEffect(() => {
    let timer: number | undefined;
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => lock(), idleMin * 60 * 1000);
    };
    const events = ["mousemove", "keydown", "click", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idleMin]);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 250,
          borderRight: "1px solid var(--border)",
          background: "var(--panel)",
          padding: 16,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
          🔐 DRISHTI-Vault
        </div>
        <div className="subtle" style={{ marginBottom: 18 }}>
          Local IT vault
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              style={({ isActive }) => ({
                display: "block",
                padding: "9px 11px",
                borderRadius: 7,
                color: isActive ? "var(--text)" : "var(--muted)",
                background: isActive ? "var(--panel-alt)" : "transparent",
                border: isActive ? "1px solid var(--border)" : "1px solid transparent",
                fontSize: 13,
              })}
            >
              <span style={{ marginRight: 9 }}>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 }}>
          <div className="subtle" style={{ marginBottom: 6 }}>
            Signed in: <strong style={{ color: "var(--text)" }}>{username}</strong>
          </div>
          <div className="subtle" style={{ marginBottom: 8 }}>
            Reveal:{" "}
            <span style={{ color: revealOpen ? "var(--success)" : "var(--muted)" }}>
              {revealOpen ? "Open" : "Locked"}
            </span>
          </div>
          <button className="btn btn-sm" style={{ width: "100%" }} onClick={lock}>
            🔒 Lock vault
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: 20, overflow: "auto" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <WarningBanner />
          <div style={{ height: 16 }} />
          <Outlet />
          <div style={{ height: 40 }} />
        </div>
      </main>
    </div>
  );
}
