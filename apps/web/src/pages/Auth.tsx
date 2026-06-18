import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { WarningBanner } from "../components/WarningBanner";

export function AuthGate({
  initialized,
  loading,
  onAuthed,
}: {
  initialized: boolean;
  loading: boolean;
  onAuthed: (username: string, revealOpen: boolean, revealTtl: number) => void;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = React.useState<"login" | "setup">("login");
  const [username, setUsername] = React.useState("admin");
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!loading) setMode(initialized ? "login" : "setup");
  }, [initialized, loading]);

  if (loading) {
    return (
      <Center>
        <div className="muted">Loading vault…</div>
      </Center>
    );
  }

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (mode === "setup") {
        if (pw.length < 10) throw new Error("Master password must be at least 10 characters");
        if (pw !== pw2) throw new Error("Passwords do not match");
        await api.setup(username.trim() || "admin", pw);
      }
      const res: any = await api.login(username.trim() || "admin", pw);
      onAuthed(res.username, false, res.reveal_ttl);
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Center>
      <div className="card" style={{ width: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 34 }}>🔐</div>
          <h2 style={{ margin: "8px 0 0" }}>DRISHTI-Vault</h2>
          <div className="subtle">
            {mode === "setup"
              ? "Create your master password"
              : "Enter your master password"}
          </div>
        </div>
        <WarningBanner />
        <div style={{ height: 16 }} />
        <label>Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={mode === "login"}
        />
        <label>Master password</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type={show ? "text" : "password"}
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && mode === "login" && submit()}
          />
          <button className="btn btn-sm" type="button" onClick={() => setShow(!show)}>
            {show ? "Hide" : "Show"}
          </button>
        </div>
        {mode === "setup" && (
          <>
            <label>Confirm master password</label>
            <input
              type={show ? "text" : "password"}
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <div className="subtle" style={{ marginTop: 8 }}>
              ⚠ This password cannot be recovered. Without it, all encrypted data is
              permanently unreadable. See <strong>docs/RECOVERY.md</strong>.
            </div>
          </>
        )}
        {err && (
          <div style={{ color: "var(--danger)", marginTop: 10, fontSize: 12 }}>{err}</div>
        )}
        <button
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 18, padding: "10px" }}
          onClick={submit}
          disabled={busy}
        >
          {busy ? "…" : mode === "setup" ? "Create vault" : "Unlock vault"}
        </button>
      </div>
    </Center>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      {children}
    </div>
  );
}
