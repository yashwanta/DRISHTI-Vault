import React from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { api, ApiError } from "./api";
import { Layout } from "./components/Layout";
import { AuthGate } from "./pages/Auth";
import { DashboardPage } from "./pages/DashboardPage";
import { SitesPage } from "./pages/SitesPage";
import { AssetsPage } from "./pages/AssetsPage";
import { CredentialsPage } from "./pages/CredentialsPage";
import { NetworkPage } from "./pages/NetworkPage";
import { ChangeLogPage } from "./pages/ChangeLogPage";
import { AuditPage } from "./pages/AuditPage";
import { NotesPage } from "./pages/NotesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UserManagementPage } from "./pages/UserManagementPage";

export function App() {
  const [initialized, setInitialized] = React.useState<boolean | null>(null);
  const [authed, setAuthed] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [role, setRole] = React.useState<string>("super_admin");
  const [revealOpen, setRevealOpen] = React.useState(false);
  const [revealTtl, setRevealTtl] = React.useState(120);
  const [mustChangePw, setMustChangePw] = React.useState(false);

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
      setRole(me.role || "super_admin");
      setRevealOpen(me.reveal_open);
      setMustChangePw(!!me.must_change_pw);
    } catch {
      setAuthed(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    const t = window.setInterval(async () => {
      try {
        const me = await api.me();
        setRevealOpen(me.reveal_open);
        setRole(me.role || "super_admin");
        setMustChangePw(!!me.must_change_pw);
      } catch (error: unknown) {
        // Only a confirmed expired/invalid session should return the user to
        // the login screen. A temporary request failure must not destroy an
        // otherwise valid UI session.
        if (error instanceof ApiError && error.status === 401) {
          setAuthed(false);
          setRevealOpen(false);
        }
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
          onAuthed={(r) => {
            setAuthed(true);
            setUsername(r.username);
            setRole(r.role);
            setRevealOpen(false);
            setRevealTtl(r.revealTtl);
            setMustChangePw(r.mustChangePw);
          }}
        />
      </HashRouter>
    );
  }

  const isAdmin = role === "super_admin" || role === "global_admin";

  return (
    <HashRouter>
      <Routes>
        <Route
          element={
            <Layout
              username={username}
              role={role}
              revealOpen={revealOpen}
              mustChangePw={mustChangePw}
              onLocked={() => {
                setAuthed(false);
                setRevealOpen(false);
                refresh();
              }}
              onPwChanged={() => setMustChangePw(false)}
            />
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/sites" element={<SitesPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/credentials" element={<CredentialsPage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/changelog" element={<ChangeLogPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* User Management is admin-only */}
          <Route path="/users" element={isAdmin ? <UserManagementPage /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
