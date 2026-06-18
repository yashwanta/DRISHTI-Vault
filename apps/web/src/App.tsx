import React from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { api } from "./api";
import { Layout } from "./components/Layout";
import { AuthGate } from "./pages/Auth";
import { DashboardPage } from "./pages/DashboardPage";
import { SitesPage } from "./pages/SitesPage";
import { AssetsPage } from "./pages/AssetsPage";
import { CredentialsPage } from "./pages/CredentialsPage";
import { NetworkPage } from "./pages/NetworkPage";
import { ChangeLogPage } from "./pages/ChangeLogPage";
import { AuditPage } from "./pages/AuditPage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  const [initialized, setInitialized] = React.useState<boolean | null>(null);
  const [authed, setAuthed] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [revealOpen, setRevealOpen] = React.useState(false);
  const [revealTtl, setRevealTtl] = React.useState(120);

  // Bootstrap: is vault set up? are we already authed (session cookie)?
  const refresh = React.useCallback(async () => {
    try {
      const b = await api.bootstrap();
      setInitialized(b.initialized);
      setRevealTtl(b.reveal_ttl);
    } catch {
      setInitialized(false);
    }
    try {
      const me = await api.me();
      setAuthed(true);
      setUsername(me.username);
      setRevealOpen(me.reveal_open);
    } catch {
      setAuthed(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    // poll reveal state occasionally (cheap)
    const t = window.setInterval(async () => {
      try {
        const me = await api.me();
        setRevealOpen(me.reveal_open);
      } catch {
        setAuthed(false);
      }
    }, 5000);
    return () => window.clearInterval(t);
  }, [refresh]);

  if (initialized === null) {
    return <div style={{ padding: 40, color: "var(--muted)" }}>Loading…</div>;
  }

  if (!authed) {
    return (
      <HashRouter>
        <AuthGate
          initialized={initialized}
          loading={false}
          onAuthed={(u, _revealOpen, ttl) => {
            setAuthed(true);
            setUsername(u);
            setRevealOpen(false);
            setRevealTtl(ttl);
          }}
        />
      </HashRouter>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route
          element={
            <Layout
              username={username}
              revealOpen={revealOpen}
              onLocked={() => {
                setAuthed(false);
                setRevealOpen(false);
                refresh();
              }}
            />
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/sites" element={<SitesPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/credentials" element={<CredentialsPage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/changelog" element={<ChangeLogPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
