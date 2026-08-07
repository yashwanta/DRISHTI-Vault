import React from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Asset, Credential, CredentialDetail, Site } from "../types";
import { ConfirmDialog, Empty, Field, Modal, StatusPill, useToast } from "../components/ui";
import { PasswordPrompt } from "../components/PasswordPrompt";

type PendingAction =
  | { type: "view"; credential: Credential }
  | { type: "copy"; credential: Credential; field: "username" | "password" }
  | { type: "rotate"; credential: Credential };

type SortColumn = "title" | "cred_type" | "username_masked" | "status" | "rotation_due";
type SortState = { col: SortColumn; dir: "asc" | "desc" };
type RotationState = "overdue" | "soon" | "ok" | "none";

type CredentialGroup = {
  key: string;
  name: string;
  credentials: Credential[];
};

type MeResponse = {
  reveal_open: boolean;
  reveal_ttl: number;
};

type RotateResponse = {
  new_password?: string;
  clipboard_ttl?: number;
};

type CredentialForm = {
  id?: number;
  title: string;
  site_id: number | null;
  asset_id: number | null;
  cred_type: string;
  username: string;
  password: string;
  url_host: string;
  port: number | null;
  rotation_due: string;
  status: string;
  notes: string;
  editing: boolean;
  usernamePlaceholder: string;
};

const EMPTY_FORM: CredentialForm = {
  title: "",
  site_id: null,
  asset_id: null,
  cred_type: "Linux SSH",
  username: "",
  password: "",
  url_host: "",
  port: null,
  rotation_due: "",
  status: "Active",
  notes: "",
  editing: false,
  usernamePlaceholder: "",
};

const COLUMNS: Array<{ col: SortColumn; label: string }> = [
  { col: "title", label: "Title" },
  { col: "cred_type", label: "Type" },
  { col: "username_masked", label: "Username" },
  { col: "status", label: "Status" },
  { col: "rotation_due", label: "Rotation Due" },
];

function credIcon(type: string): string {
  const icons: Record<string, string> = {
    "Linux SSH": "🖥️",
    "Windows RDP": "🪟",
    "Web Login": "🌐",
    Database: "🗄️",
    "API Key": "🔑",
    WiFi: "📶",
    "Network Device": "🔌",
    Email: "📧",
    "Service Account": "⚙️",
  };
  return icons[type] ?? "🔐";
}

function rotationStatus(date: string | null): RotationState {
  if (!date) return "none";

  const parts = date.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return "none";

  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const due = new Date(parts[0], parts[1] - 1, parts[2]);
  const daysUntilDue = Math.round((due.getTime() - todayLocal.getTime()) / 86_400_000);

  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= 30) return "soon";
  return "ok";
}

function generatePassword(length = 20): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => chars[b % chars.length]).join("");
}

function formatTtl(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}m ${String(safeSeconds % 60).padStart(2, "0")}s`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred";
}

function CredTypePill({ type }: { type: string }) {
  return <span className="pill cred-type-pill">{credIcon(type)} {type}</span>;
}

function RotationBadge({ date }: { date: string | null }) {
  const state = rotationStatus(date);
  if (state === "none") return <span className="muted">—</span>;

  const prefix = state === "overdue" ? "⚠" : state === "soon" ? "⏰" : "✓";
  return <span className={`pill rotation-pill rotation-${state}`}>{prefix} {date}</span>;
}

export function CredentialsPage() {
  const [params] = useSearchParams();
  const presetAsset = params.get("asset");
  const { show, node } = useToast();
  const showRef = React.useRef(show);
  showRef.current = show;
  const showToast = React.useCallback((message: string) => showRef.current(message), []);

  const [items, setItems] = React.useState<Credential[]>([]);
  const [types, setTypes] = React.useState<string[]>([]);
  const [sites, setSites] = React.useState<Site[]>([]);
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [clipboardTtl, setClipboardTtl] = React.useState(30);

  const [query, setQuery] = React.useState("");
  const [siteFilter, setSiteFilter] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [viewMode, setViewMode] = React.useState<"table" | "cards">("table");
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(new Set());
  const [sort, setSort] = React.useState<SortState>({ col: "title", dir: "asc" });

  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState<CredentialForm>(EMPTY_FORM);
  const [showPassword, setShowPassword] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [deleting, setDeleting] = React.useState<Credential | null>(null);
  const [viewing, setViewing] = React.useState<CredentialDetail | null>(null);
  const [revealTtl, setRevealTtl] = React.useState(0);
  const [showReveal, setShowReveal] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null);

  const [copyCountdown, setCopyCountdown] = React.useState(0);
  const clipboardTimerRef = React.useRef<number | undefined>();
  const countdownTimerRef = React.useRef<number | undefined>();

  const load = React.useCallback(async () => {
    try {
      const [credentialResponse, siteResponse, assetResponse] = await Promise.all([
        api.listCredentials(),
        api.listSites(),
        api.listAssets(),
      ]);
      setItems(credentialResponse.items as Credential[]);
      setTypes(credentialResponse.cred_types);
      setClipboardTtl(credentialResponse.clipboard_ttl || 30);
      setSites(siteResponse.items as Site[]);
      setAssets(assetResponse.items as Asset[]);
    } catch (error: unknown) {
      showToast(errorMessage(error));
    }
  }, [showToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => () => {
    window.clearTimeout(clipboardTimerRef.current);
    window.clearInterval(countdownTimerRef.current);
  }, []);

  React.useEffect(() => {
    if (!viewing) return;

    const syncRevealWindow = async () => {
      try {
        const session = await api.me() as MeResponse;
        if (!session.reveal_open || session.reveal_ttl <= 0) {
          setViewing(null);
          setRevealTtl(0);
          showToast("Reveal window expired");
          return;
        }
        setRevealTtl(session.reveal_ttl);
      } catch {
        setViewing(null);
        setRevealTtl(0);
      }
    };

    const pollTimer = window.setInterval(() => void syncRevealWindow(), 30_000);
    return () => window.clearInterval(pollTimer);
  }, [showToast, viewing]);

  React.useEffect(() => {
    if (!viewing || revealTtl <= 0) return;

    const revealTimer = window.setInterval(() => {
      setRevealTtl((current) => {
        if (current > 1) return current - 1;
        setViewing(null);
        showToast("Reveal window expired");
        return 0;
      });
    }, 1000);

    return () => window.clearInterval(revealTimer);
  }, [showToast, viewing]);

  const startClipboardClear = React.useCallback((ttl: number) => {
    window.clearTimeout(clipboardTimerRef.current);
    window.clearInterval(countdownTimerRef.current);

    const safeTtl = Math.max(1, ttl);
    setCopyCountdown(safeTtl);
    countdownTimerRef.current = window.setInterval(() => {
      setCopyCountdown((current) => {
        if (current > 1) return current - 1;
        window.clearInterval(countdownTimerRef.current);
        return 0;
      });
    }, 1000);

    clipboardTimerRef.current = window.setTimeout(() => {
      void navigator.clipboard.writeText("").catch(() => undefined);
      window.clearInterval(countdownTimerRef.current);
      setCopyCountdown(0);
      showToast("Clipboard auto-cleared");
    }, safeTtl * 1000);
  }, [showToast]);

  const filtered = React.useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    const matching = items.filter((credential) => {
      const matchesQuery = !search || [
        credential.title,
        credential.site_name,
        credential.asset_name,
        credential.cred_type,
        credential.username_masked,
      ].some((value) => value?.toLocaleLowerCase().includes(search));

      return matchesQuery
        && (!siteFilter || String(credential.site_id) === siteFilter)
        && (!typeFilter || credential.cred_type === typeFilter);
    });

    return [...matching].sort((left, right) => {
      const leftValue = String(left[sort.col] ?? "");
      const rightValue = String(right[sort.col] ?? "");
      const result = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: "base" });
      return sort.dir === "asc" ? result : -result;
    });
  }, [items, query, siteFilter, sort, typeFilter]);

  const grouped = React.useMemo<CredentialGroup[]>(() => {
    const groups = new Map<string, CredentialGroup>();
    filtered.forEach((credential) => {
      const key = credential.site_id == null ? "no-site" : `site-${credential.site_id}`;
      const group = groups.get(key) ?? {
        key,
        name: credential.site_name || "No Site",
        credentials: [],
      };
      group.credentials.push(credential);
      groups.set(key, group);
    });
    return Array.from(groups.values()).sort((a, b) => {
      if (a.key === "no-site") return 1;
      if (b.key === "no-site") return -1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [filtered]);

  const toggleSort = (col: SortColumn) => {
    setSort((current) => current.col === col
      ? { col, dir: current.dir === "asc" ? "desc" : "asc" }
      : { col, dir: "asc" });
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const closeForm = () => {
    setFormOpen(false);
    setShowPassword(false);
    setForm({ ...EMPTY_FORM });
  };

  const openNew = () => {
    const assetId = presetAsset ? Number(presetAsset) : null;
    setForm({
      ...EMPTY_FORM,
      cred_type: types[0] ?? EMPTY_FORM.cred_type,
      asset_id: assetId && Number.isFinite(assetId) ? assetId : null,
    });
    setShowPassword(false);
    setFormOpen(true);
  };

  const openEdit = (credential: Credential) => {
    setForm({
      ...EMPTY_FORM,
      id: credential.id,
      title: credential.title,
      site_id: credential.site_id,
      asset_id: credential.asset_id,
      cred_type: credential.cred_type,
      port: credential.port,
      rotation_due: credential.rotation_due ?? "",
      status: credential.status,
      editing: true,
      usernamePlaceholder: credential.username_masked || "Leave blank to keep existing username",
    });
    setShowPassword(false);
    setFormOpen(true);
  };

  const saveCredential = async () => {
    if (!form.title.trim()) {
      showToast("Title required");
      return;
    }

    const body: Record<string, unknown> = {
      title: form.title.trim(),
      site_id: form.site_id,
      asset_id: form.asset_id,
      cred_type: form.cred_type,
      port: form.port,
      rotation_due: form.rotation_due || null,
      status: form.status,
    };
    if (form.username) body.username = form.username;
    if (form.password) body.password = form.password;
    if (form.url_host) body.url_host = form.url_host;
    if (form.notes) body.notes = form.notes;

    setSaving(true);
    try {
      await api.saveCredential(body, form.id);
      closeForm();
      showToast("Credential saved");
      await load();
    } catch (error: unknown) {
      showToast(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const copyPassword = React.useCallback(async (
    credentialId: number,
    password: string,
    ttl = clipboardTtl,
  ) => {
    await navigator.clipboard.writeText(password);
    startClipboardClear(ttl);
    await api.copyCredential(credentialId);
  }, [clipboardTtl, startClipboardClear]);

  const copyUsername = React.useCallback(async (credentialId: number, username: string) => {
    await navigator.clipboard.writeText(username);
    await api.copyCredential(credentialId);
  }, []);

  const executeAction = React.useCallback(async (action: PendingAction) => {
    try {
      if (action.type === "view") {
        const [detail, session] = await Promise.all([
          api.viewCredential(action.credential.id) as Promise<CredentialDetail>,
          api.me() as Promise<MeResponse>,
        ]);
        if (!session.reveal_open || session.reveal_ttl <= 0) {
          showToast("Reveal window expired. Re-enter the master password.");
          return;
        }
        setRevealTtl(session.reveal_ttl);
        setViewing(detail);
        return;
      }

      if (action.type === "copy") {
        const detail = await api.viewCredential(action.credential.id) as CredentialDetail;
        if (action.field === "username") {
          await copyUsername(action.credential.id, detail.username || "");
          showToast("Username copied");
        } else {
          await copyPassword(action.credential.id, detail.password || "");
          showToast(`Password copied · clipboard clears in ${clipboardTtl}s`);
        }
        return;
      }

      const response = await api.rotateCredential(action.credential.id) as RotateResponse;
      const rotatedPassword = response.new_password || "";
      const ttl = response.clipboard_ttl || clipboardTtl;
      await copyPassword(action.credential.id, rotatedPassword, ttl);
      showToast(`Password rotated and copied · clipboard clears in ${ttl}s`);
      await load();
    } catch (error: unknown) {
      showToast(errorMessage(error));
    }
  }, [clipboardTtl, copyPassword, copyUsername, load, showToast]);

  const requireReveal = React.useCallback(async (action: PendingAction) => {
    try {
      const session = await api.me() as MeResponse;
      if (session.reveal_open && session.reveal_ttl > 0) {
        await executeAction(action);
        return;
      }
      setPendingAction(action);
      setShowReveal(true);
    } catch (error: unknown) {
      showToast(errorMessage(error));
    }
  }, [executeAction, showToast]);

  const completeReveal = async (masterPassword: string) => {
    await api.openReveal(masterPassword);
    const action = pendingAction;
    setPendingAction(null);
    setShowReveal(false);
    showToast("Reveal window open");
    if (action) await executeAction(action);
  };

  const closeView = () => {
    setViewing(null);
    setRevealTtl(0);
  };

  const deleteCredential = async () => {
    if (!deleting) return;
    try {
      await api.deleteCredential(deleting.id);
      setDeleting(null);
      showToast("Credential deleted");
      await load();
    } catch (error: unknown) {
      showToast(errorMessage(error));
    }
  };

  const renderActions = (credential: Credential) => (
    <div className="cred-actions">
      <button className="btn btn-sm" title="Copy username" onClick={() => void requireReveal({ type: "copy", credential, field: "username" })}>📋 User</button>
      <button className="btn btn-sm" title="Copy password" onClick={() => void requireReveal({ type: "copy", credential, field: "password" })}>🔐 Pass</button>
      <button className="btn btn-sm" onClick={() => void requireReveal({ type: "view", credential })}>View</button>
      <button className="btn btn-sm" onClick={() => openEdit(credential)}>Edit</button>
      <button className="btn btn-sm" onClick={() => void requireReveal({ type: "rotate", credential })}>Rotate</button>
      <button className="btn btn-sm btn-danger" onClick={() => setDeleting(credential)}>Delete</button>
    </div>
  );

  const renderCards = (credentials: Credential[], mobileOnly = false) => (
    <div className={mobileOnly ? "cred-card-grid cred-mobile-cards" : "cred-card-grid"}>
      {credentials.map((credential) => (
        <article key={credential.id} className="card cred-card">
          <div className="cred-card-header">
            <div>
              <div className="cred-card-title">{credential.title}</div>
              {credential.asset_name && <div className="subtle">{credential.asset_name}</div>}
            </div>
            <StatusPill status={credential.status} />
          </div>
          <CredTypePill type={credential.cred_type} />
          <dl className="cred-card-details">
            <div><dt>Site</dt><dd>{credential.site_name || "No Site"}</dd></div>
            <div><dt>Username</dt><dd>{credential.username_masked || "—"}</dd></div>
            <div><dt>Rotation</dt><dd><RotationBadge date={credential.rotation_due} /></dd></div>
          </dl>
          {renderActions(credential)}
        </article>
      ))}
    </div>
  );

  return (
    <div>
      <header className="cred-page-header">
        <div>
          <h1 className="h1">Credentials Vault</h1>
          <div className="subtle">Secrets stay masked until the reveal window is unlocked.</div>
        </div>
        {copyCountdown > 0 && <span className="pill pill-warn">⏳ Clipboard clears in {copyCountdown}s</span>}
      </header>

      <div className="toolbar cred-toolbar">
        <input placeholder="Search credentials…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)} aria-label="Filter by site">
          <option value="">All Sites</option>
          {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
        </select>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter by credential type">
          <option value="">All Types</option>
          {types.map((type) => <option key={type}>{type}</option>)}
        </select>
        <div className="spacer" />
        <div className="cred-view-toggle" role="group" aria-label="Credential layout">
          <button className={`btn btn-sm${viewMode === "table" ? " btn-primary" : ""}`} onClick={() => setViewMode("table")} aria-pressed={viewMode === "table"}>☰ Table</button>
          <button className={`btn btn-sm${viewMode === "cards" ? " btn-primary" : ""}`} onClick={() => setViewMode("cards")} aria-pressed={viewMode === "cards"}>⊞ Cards</button>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add Credential</button>
      </div>

      {filtered.length === 0 ? (
        <div className="card"><Empty>No credentials match the current filters.</Empty></div>
      ) : grouped.map((group) => {
        const collapsed = collapsedGroups.has(group.key);
        return (
          <section key={group.key} className="site-group">
            <button className="site-group-header" onClick={() => toggleGroup(group.key)} aria-expanded={!collapsed}>
              <span className="site-group-chevron" aria-hidden="true">{collapsed ? "▶" : "▼"}</span>
              <span className="site-group-name">{group.name}</span>
              <span className="pill">{group.credentials.length}</span>
            </button>
            {!collapsed && (viewMode === "cards" ? renderCards(group.credentials) : (
              <div className="site-group-body">
                <div className="card cred-table-wrap">
                  <table className="cred-table">
                    <thead>
                      <tr>
                        {COLUMNS.map(({ col, label }) => (
                          <th key={col} aria-sort={sort.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                            <button className="sort-button" onClick={() => toggleSort(col)}>
                              {label}<span className="sort-indicator">{sort.col === col ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.credentials.map((credential) => (
                        <tr key={credential.id}>
                          <td>
                            <strong>{credential.title}</strong>
                            {credential.asset_name && <div className="subtle">{credential.asset_name}</div>}
                            {renderActions(credential)}
                          </td>
                          <td><CredTypePill type={credential.cred_type} /></td>
                          <td className="muted">{credential.username_masked || "—"}</td>
                          <td><StatusPill status={credential.status} /></td>
                          <td><RotationBadge date={credential.rotation_due} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {renderCards(group.credentials, true)}
              </div>
            ))}
          </section>
        );
      })}

      {formOpen && (
        <Modal title={form.editing ? "Edit Credential" : "Add Credential"} onClose={closeForm} wide>
          <div className="form-grid">
            <Field label="Title" full><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} autoFocus /></Field>
            <Field label="Linked Site">
              <select value={form.site_id ?? ""} onChange={(event) => setForm({ ...form, site_id: event.target.value ? Number(event.target.value) : null })}>
                <option value="">—</option>
                {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
              </select>
            </Field>
            <Field label="Linked Asset / VM">
              <select value={form.asset_id ?? ""} onChange={(event) => setForm({ ...form, asset_id: event.target.value ? Number(event.target.value) : null })}>
                <option value="">—</option>
                {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.app_vm_name}</option>)}
              </select>
            </Field>
            <Field label="Credential Type">
              <select value={form.cred_type} onChange={(event) => setForm({ ...form, cred_type: event.target.value })}>
                {types.map((type) => <option key={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Port"><input type="number" value={form.port ?? ""} onChange={(event) => setForm({ ...form, port: event.target.value ? Number(event.target.value) : null })} /></Field>
            <Field label="Username">
              <input value={form.username} placeholder={form.editing ? form.usernamePlaceholder : ""} onChange={(event) => setForm({ ...form, username: event.target.value })} />
            </Field>
            <Field label="Password" full>
              <div className="password-input-row">
                <input type={showPassword ? "text" : "password"} value={form.password} placeholder={form.editing ? "Leave blank to keep existing password" : ""} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                <button className="btn btn-sm" type="button" title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)}>{showPassword ? "🙈" : "👁"}</button>
                <button className="btn btn-sm btn-primary" type="button" onClick={() => { setForm({ ...form, password: generatePassword() }); setShowPassword(true); }}>Generate</button>
              </div>
              {form.editing && <div className="form-helper">Only fill in secret fields you want to change.</div>}
            </Field>
            <Field label="URL / Host"><input value={form.url_host} placeholder={form.editing ? "Leave blank to keep existing URL / host" : "https://… or hostname"} onChange={(event) => setForm({ ...form, url_host: event.target.value })} /></Field>
            <Field label="Rotation Due"><input type="date" value={form.rotation_due} onChange={(event) => setForm({ ...form, rotation_due: event.target.value })} /></Field>
            <Field label="Status">
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Retired</option></select>
            </Field>
            <Field label="Notes" full><textarea rows={3} value={form.notes} placeholder={form.editing ? "Leave blank to keep existing notes" : ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={closeForm} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void saveCredential()} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </Modal>
      )}

      {viewing && (
        <Modal title={viewing.title} onClose={closeView}>
          <div className="reveal-banner">🔓 Reveal window: {formatTtl(revealTtl)}</div>
          <div className="view-grid">
            <div className="view-label">Type</div><div><CredTypePill type={viewing.cred_type} /></div>
            <div className="view-label">Username</div>
            <div className="view-value-actions"><code className="secret-box">{viewing.username || "—"}</code><button className="btn btn-sm" onClick={() => void copyUsername(viewing.id, viewing.username || "").then(() => showToast("Username copied")).catch((error: unknown) => showToast(errorMessage(error)))}>Copy</button></div>
            <div className="view-label">Password</div>
            <div className="view-value-actions"><code className="secret-box">{viewing.password || "—"}</code><button className="btn btn-sm btn-primary" onClick={() => void copyPassword(viewing.id, viewing.password || "").then(() => showToast(`Password copied · clipboard clears in ${clipboardTtl}s`)).catch((error: unknown) => showToast(errorMessage(error)))}>{copyCountdown > 0 ? `Copied · ${copyCountdown}s` : "Copy"}</button></div>
            <div className="view-label">URL / Host</div>
            <div className="view-value-actions"><code className="secret-box">{viewing.url_host || "—"}</code>{/^https?:\/\//i.test(viewing.url_host) && <a className="btn btn-sm" href={viewing.url_host} target="_blank" rel="noopener noreferrer">Launch ↗</a>}</div>
            <div className="view-label">Port</div><div>{viewing.port ?? "—"}</div>
            <div className="view-label">Notes</div><div className="view-notes">{viewing.notes || "—"}</div>
          </div>
        </Modal>
      )}

      {showReveal && (
        <PasswordPrompt title="Re-enter master password" label="Master password (opens reveal window)" confirmLabel="Unlock reveal" onConfirm={completeReveal} onCancel={() => { setShowReveal(false); setPendingAction(null); }} />
      )}

      {deleting && (
        <ConfirmDialog title="Delete credential?" message={`Delete "${deleting.title}"? This permanently removes the secret.`} onConfirm={() => void deleteCredential()} onCancel={() => setDeleting(null)} />
      )}

      {node}
    </div>
  );
}
