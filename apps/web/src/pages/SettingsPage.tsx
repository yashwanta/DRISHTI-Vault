import React from "react";
import { api, downloadBackup, downloadCsvTemplate } from "../api";
import { ConfirmDialog, Empty, Modal, useToast } from "../components/ui";
import { DropZone, humanSize } from "../components/DropZone";
import { MultiPasswordPrompt } from "../components/MultiPasswordPrompt";

type DialogState =
  | { kind: "none" }
  | { kind: "changeMaster" }
  | { kind: "export" }
  | { kind: "restoreMaster" }   // step 2 of restore: enter master + backup pw
  | { kind: "restoreConfirm"; meta: any; token: string };

const BACKUP_MIN = 10;
const MASTER_MIN = 10;

const CSV_TABLES = ["credentials", "sites", "assets", "network", "changelog"];

export function SettingsPage() {
  const [settings, setSettings] = React.useState<any>(null);
  const [dialog, setDialog] = React.useState<DialogState>({ kind: "none" });
  const [busy, setBusy] = React.useState(false);
  const [excelBusy, setExcelBusy] = React.useState(false);
  const [csvBusy, setCsvBusy] = React.useState(false);
  const [importPreview, setImportPreview] = React.useState<any | null>(null);
  const [history, setHistory] = React.useState<any[]>([]);
  const [lastInfo, setLastInfo] = React.useState<any>(null);
  const [restoreFile, setRestoreFile] = React.useState<File | null>(null);
  // CSV import state
  const [csvFile, setCsvFile] = React.useState<File | null>(null);
  const [csvPreview, setCsvPreview] = React.useState<any | null>(null);
  // commit result (inserted/skipped + per-row errors) shown after CSV import
  const [csvResult, setCsvResult] = React.useState<any | null>(null);
  const [excelFileName, setExcelFileName] = React.useState<string>("");
  const [csvFileName, setCsvFileName] = React.useState<string>("");
  const { show, node } = useToast();

  // ---- CSV handlers ----
  const downloadTemplate = async (table: string) => {
    try {
      const blob = await downloadCsvTemplate(table);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `drishtivault-${table}-template.csv`;
      a.click();
      URL.revokeObjectURL(url);
      show(`Downloaded ${table} template`);
    } catch (e: any) { show("Download failed: " + e.message); }
  };

  const onPickCsv = async (file: File | undefined) => {
    if (!file) return;
    setCsvFile(file);
    setCsvFileName(`${file.name} · ${humanSize(file.size)}`);
    setCsvResult(null);
    setCsvBusy(true);
    try {
      const p = await api.csvPreview(file);
      setCsvPreview(p);
    } catch (e: any) {
      setCsvFile(null);
      setCsvFileName("");
      show("CSV preview failed: " + e.message);
    }
    finally { setCsvBusy(false); }
  };

  const commitCsv = async () => {
    if (!csvFile || !csvPreview) return;
    setCsvBusy(true);
    try {
      const res: any = await api.csvCommit(csvFile, csvPreview.table);
      setCsvResult(res);
      show(
        `Imported ${res.inserted} row(s) into ${csvPreview.table}`
        + (res.skipped ? ` (${res.skipped} skipped)` : "")
      );
      setCsvPreview(null);
      setCsvFile(null);
      setCsvFileName("");
    } catch (e: any) { show("CSV import failed: " + e.message); }
    finally { setCsvBusy(false); }
  };

  const refreshStatus = React.useCallback(() => {
    api.backupLast().then(setLastInfo).catch(() => {});
    api.backupHistory().then((r) => setHistory(r.items)).catch(() => {});
  }, []);

  React.useEffect(() => {
    fetch("/api/settings", { credentials: "include" })
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => {});
    refreshStatus();
  }, [refreshStatus]);

  // ---- Excel import (unchanged behavior) ----
  const onPickImport = async (file: File | undefined) => {
    if (!file) return;
    setExcelFileName(`${file.name} · ${humanSize(file.size)}`);
    setExcelBusy(true);
    try {
      setImportPreview(await api.previewImport(file));
    } catch (e: any) {
      show("Import error: " + e.message);
    } finally {
      setExcelBusy(false);
    }
  };

  const commitImport = async () => {
    setExcelBusy(true);
    try {
      const payload = {
        sites: importPreview.sites,
        assets: importPreview.assets,
        network: importPreview.network,
        changelog: importPreview.changelog,
      };
      const res: any = await api.commitImport(payload);
      show(`Imported: ${JSON.stringify(res.inserted)}`);
      setImportPreview(null);
      setExcelFileName("");
    } catch (e: any) {
      show("Commit failed: " + e.message);
    } finally {
      setExcelBusy(false);
    }
  };

  // ---- Change master password ----
  const onChangeMaster = async (v: Record<string, string>) => {
    await api.changeMasterPassword(
      v.current_master_password, v.new_master_password
    );
    setDialog({ kind: "none" });
    show("Master password changed. Secrets remain intact.");
  };

  // ---- Export (master + backup + confirm) ----
  const onExport = async (v: Record<string, string>) => {
    setBusy(true);
    try {
      const { blob, createdAt } = await downloadBackup(
        v.master_password,
        v.backup_password,
        v.backup_password_confirm
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DRISHTI_Vault_Backup_${fmtStamp()}.drishtivaultbackup`;
      a.click();
      URL.revokeObjectURL(url);
      setDialog({ kind: "none" });
      show(`Encrypted backup exported${createdAt ? ` (${createdAt})` : ""}`);
      refreshStatus();
    } catch (e: any) {
      show("Export failed: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  // ---- Restore flow ----
  const onPickRestore = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".drishtivaultbackup")) {
      show("Backup files must have the .drishtivaultbackup extension");
      return;
    }
    setRestoreFile(file);
    setDialog({ kind: "restoreMaster" });
  };

  const onRestorePreview = async (v: Record<string, string>) => {
    if (!restoreFile) return;
    setBusy(true);
    try {
      const res: any = await api.restorePreview(
        restoreFile,
        v.master_password,
        v.backup_password
      );
      setDialog({ kind: "restoreConfirm", meta: res.meta, token: res.token });
    } catch (e: any) {
      show("Restore failed: " + e.message);
      refreshStatus();
    } finally {
      setBusy(false);
    }
  };

  // commit needs a fresh master re-entry; handled by restoreCommitMode + dialog
  const [restoreCommitMode, setRestoreCommitMode] = React.useState<
    "replace" | "merge" | null
  >(null);

  const doCommitWithMaster = async (v: Record<string, string>) => {
    const mode = restoreCommitMode;
    if (!mode || dialog.kind !== "restoreConfirm") return;
    setBusy(true);
    try {
      const res: any = await api.restoreCommit(
        v.master_password,
        dialog.token,
        mode
      );
      const msg = res.message || "Restore complete.";
      setDialog({ kind: "none" });
      setRestoreCommitMode(null);
      setRestoreFile(null);
      show(msg);
      refreshStatus();
      if (res.locked) {
        setTimeout(() => location.reload(), 1500);
      }
    } catch (e: any) {
      show("Restore failed: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="h1">Settings / Backup</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Local Configuration</h3>
        <table>
          <tbody>
            <tr><td className="muted">Bind address</td><td><code>{settings?.host || "127.0.0.1"}:{settings?.port || 7788}</code></td></tr>
            <tr><td className="muted">Auto-lock</td><td>{settings?.idle_lock_minutes || 15} min inactivity</td></tr>
            <tr><td className="muted">Clipboard auto-clear</td><td>{settings?.clipboard_ttl || 30} s</td></tr>
            <tr><td className="muted">Reveal window</td><td>{settings?.reveal_ttl || 120} s</td></tr>
            <tr><td className="muted">Database</td><td><code>{settings?.db_path || "data/drishtivault.db"}</code></td></tr>
            <tr><td className="muted">Backup directory</td><td><code>{settings?.backup_dir || "backups/encrypted"}</code></td></tr>
          </tbody>
        </table>
      </div>

      {/* ===== Security / Backup section ===== */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Security / Backup</h3>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 14 }}>
          <div>
            <div className="subtle">Last successful backup</div>
            <div style={{ fontWeight: 600 }}>
              {lastInfo?.last_export || "—"}
            </div>
          </div>
          <div>
            <div className="subtle">Last successful restore</div>
            <div style={{ fontWeight: 600 }}>
              {lastInfo?.last_restore || "—"}
            </div>
          </div>
          <div>
            <div className="subtle">Restore lockout</div>
            <div style={{ fontWeight: 600, color: lastInfo?.restore_lockout_active ? "var(--danger)" : "var(--success)" }}>
              {lastInfo?.restore_lockout_active
                ? `Active — wait ${lastInfo.restore_lockout_seconds}s`
                : "Not active"}
            </div>
          </div>
        </div>

        <p className="subtle" style={{ marginTop: 0 }}>
          Export and restore both require an unlocked session <strong>plus</strong> the
          Master Password, and the backup file is protected by a separate Vault Backup
          Password. Neither password is stored, logged, or saved in the browser.
        </p>

        <div className="btn-row">
          <button className="btn" onClick={() => setDialog({ kind: "changeMaster" })}>
            🔑 Change Master Password
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={() => setDialog({ kind: "export" })}>
            ⬇ Export Encrypted Backup
          </button>
          <label className="btn" style={{ cursor: "pointer" }}>
            ⬆ Restore Encrypted Backup
            <input
              type="file"
              accept=".drishtivaultbackup"
              hidden
              onChange={(e) => onPickRestore(e.target.files?.[0])}
            />
          </label>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Import from Excel</h3>
          <p className="subtle">
            Reads <code>AMR_Proxmox_VM_Tracker.xlsx</code>. Imports sites, VM rows,
            network reference, and change log. Passwords detected in the workbook
            are <strong>flagged, never auto-imported</strong>.
          </p>
          <DropZone
            accept=".xlsx"
            busy={excelBusy}
            selected={excelFileName}
            hint=".xlsx workbook only"
            onPick={onPickImport}
          />
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Import from CSV (with passwords)</h3>
          <p className="subtle">
            Download a template, fill it in, and upload. Secret columns
            (passwords, keys) are <strong>encrypted on import</strong>. Preview
            is a dry run — nothing is written until you confirm.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: "100%", marginBottom: 12 }}
            onClick={() => downloadTemplate("credentials")}
          >
            Download Credentials Template
          </button>
          <label className="subtle" style={{ display: "block", marginBottom: 4 }}>
            Other templates
          </label>
          <div className="btn-row" style={{ marginBottom: 10, flexWrap: "wrap" }}>
            {CSV_TABLES.map((t) => (
              <button key={t} className="btn btn-sm" onClick={() => downloadTemplate(t)}>
                {t}
              </button>
            ))}
          </div>
          <label className="subtle" style={{ display: "block", marginBottom: 4 }}>
            Upload filled CSV
          </label>
          <DropZone
            accept=".csv"
            busy={csvBusy}
            selected={csvFileName}
            hint="Use a downloaded template; secret columns encrypt on import"
            onPick={onPickCsv}
          />
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Backup History</h3>
          {history.length === 0 ? (
            <Empty>No backup events yet.</Empty>
          ) : (
            <div style={{ maxHeight: 220, overflow: "auto" }}>
              <table>
                <tbody>
                  {history.map((h: any) => (
                    <tr key={h.id}>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>{h.event_ts}</td>
                      <td><code style={{ color: h.success ? "var(--success)" : "var(--danger)" }}>{h.kind}</code></td>
                      <td className="muted">{h.filename || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ===== Modals ===== */}

      {/* CSV import preview */}
      {csvPreview && (
        <Modal title={`CSV Preview — ${csvPreview.table}`} onClose={() => { setCsvPreview(null); setCsvFile(null); setCsvFileName(""); }} wide>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <Stat label="Total rows" n={csvPreview.counts.total} />
            <Stat label="Valid" n={csvPreview.counts.valid} />
            <Stat label="Invalid" n={csvPreview.counts.invalid} />
          </div>
          {csvPreview.secret_columns?.length > 0 && (
            <div className="banner" style={{ marginTop: 12 }}>
              🔐 Secret columns <strong>{csvPreview.secret_columns.join(", ")}</strong> will be
              encrypted on import. They are masked in this preview.
            </div>
          )}
          <div style={{ maxHeight: 280, overflow: "auto", marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Status</th>
                  {csvPreview.header.map((h: string) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {csvPreview.rows.map((r: any) => (
                  <tr key={r.row} style={r.ok ? undefined : { background: "rgba(255,0,0,0.06)" }}>
                    <td className="muted">{r.row}</td>
                    <td>
                      {r.ok
                        ? <span style={{ color: "var(--success)" }}>ok</span>
                        : <span style={{ color: "var(--danger)" }} title={r.errors.join("; ")}>
                            ✗ {r.errors.join("; ")}
                          </span>}
                    </td>
                    {csvPreview.header.map((h: string) => (
                      <td key={h} className="muted">{r.data[h] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="subtle" style={{ marginTop: 10 }}>
            {csvPreview.counts.invalid > 0 && `${csvPreview.counts.invalid} invalid row(s) will be skipped. `}
            Only valid rows are imported.
          </div>
          <div className="btn-row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
            <button className="btn" onClick={() => { setCsvPreview(null); setCsvFile(null); setCsvFileName(""); }}>Cancel</button>
            <button className="btn btn-primary" disabled={csvBusy || csvPreview.counts.valid === 0} onClick={commitCsv}>
              {csvBusy ? "Importing…" : `Import ${csvPreview.counts.valid} row(s)`}
            </button>
          </div>
        </Modal>
      )}

      {/* CSV commit result */}
      {csvResult && (
        <Modal
          title={`Import complete — ${csvResult.table}`}
          onClose={() => setCsvResult(null)}
          wide
        >
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Stat label="Inserted" n={csvResult.inserted} />
            <Stat label="Skipped" n={csvResult.skipped} />
          </div>
          {csvResult.errors?.length > 0 ? (
            <>
              <div className="subtle" style={{ marginTop: 14, marginBottom: 6 }}>
                Skipped rows:
              </div>
              <div style={{ maxHeight: 240, overflow: "auto" }}>
                <table>
                  <thead>
                    <tr><th>#</th><th>Reason</th></tr>
                  </thead>
                  <tbody>
                    {csvResult.errors.map((e: any, i: number) => (
                      <tr key={i}>
                        <td className="muted" style={{ whiteSpace: "nowrap" }}>{e.row ?? "—"}</td>
                        <td className="muted">{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="subtle" style={{ marginTop: 14 }}>No rows were skipped.</div>
          )}
          <div className="btn-row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
            <button className="btn btn-primary" onClick={() => setCsvResult(null)}>Done</button>
          </div>
        </Modal>
      )}

      {/* Excel import preview */}
      {importPreview && (
        <Modal title="Import Preview" onClose={() => { setImportPreview(null); setExcelFileName(""); }} wide>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
            <Stat label="Sites" n={importPreview.sites.length} />
            <Stat label="Assets" n={importPreview.assets.length} />
            <Stat label="Network" n={importPreview.network.length} />
            <Stat label="Change Log" n={importPreview.changelog.length} />
          </div>
          {importPreview.detected_secrets_count > 0 ? (
            <div className="banner" style={{ marginTop: 14 }}>
              ⚠ <strong>{importPreview.detected_secrets_count} potential password(s) detected</strong> in the
              workbook. For safety they are NOT imported. Add credentials manually
              in the Credentials Vault.
            </div>
          ) : (
            <div className="subtle" style={{ marginTop: 14 }}>No passwords detected in workbook.</div>
          )}
          <div className="btn-row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
            <button className="btn" onClick={() => { setImportPreview(null); setExcelFileName(""); }}>Cancel</button>
            <button className="btn btn-primary" onClick={commitImport} disabled={excelBusy}>
              {excelBusy ? "Importing…" : "Confirm Import (non-secret data)"}
            </button>
          </div>
        </Modal>
      )}

      {/* Change master password */}
      {dialog.kind === "changeMaster" && (
        <MultiPasswordPrompt
          title="Change Master Password"
          confirmLabel="Change password"
          busyLabel="Changing…"
          onCancel={() => setDialog({ kind: "none" })}
          onSubmit={onChangeMaster}
          fields={[
            { key: "current_master_password", label: "Current master password", minLength: 1 },
            { key: "new_master_password", label: "New master password (min 10 chars)", minLength: MASTER_MIN },
            { key: "new_master_password_confirm", label: "Confirm new master password", minLength: MASTER_MIN },
          ]}
        />
      )}

      {/* Export: master + backup + confirm */}
      {dialog.kind === "export" && (
        <MultiPasswordPrompt
          title="Export Encrypted Backup"
          confirmLabel="Export"
          busyLabel="Encrypting…"
          onCancel={() => setDialog({ kind: "none" })}
          onSubmit={onExport}
          fields={[
            { key: "master_password", label: "Master password (re-auth)", minLength: 1 },
            { key: "backup_password", label: "Vault Backup Password (min 10 chars)", minLength: BACKUP_MIN, placeholder: "Protects this backup file" },
            { key: "backup_password_confirm", label: "Confirm Vault Backup Password", minLength: BACKUP_MIN },
          ]}
        />
      )}

      {/* Restore step 2: master + backup password -> preview */}
      {dialog.kind === "restoreMaster" && (
        <MultiPasswordPrompt
          title={`Restore Backup — ${restoreFile?.name || ""}`}
          confirmLabel="Decrypt & preview"
          busyLabel="Decrypting…"
          onCancel={() => { setDialog({ kind: "none" }); setRestoreFile(null); }}
          onSubmit={onRestorePreview}
          fields={[
            { key: "master_password", label: "Master password (re-auth)", minLength: 1 },
            { key: "backup_password", label: "Vault Backup Password for this file", minLength: 1 },
          ]}
        />
      )}

      {/* Restore step 3: preview / confirm / merge */}
      {dialog.kind === "restoreConfirm" && (
        <Modal title="Restore Preview" onClose={() => { setDialog({ kind: "none" }); setRestoreFile(null); }} wide>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}>
            <div><div className="subtle">Backup created</div><div style={{ fontWeight: 600 }}>{dialog.meta.backup_created_at}</div></div>
            <div><div className="subtle">Backup version</div><div style={{ fontWeight: 600 }}>{dialog.meta.backup_version}</div></div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <Stat label="Sites" n={dialog.meta.counts.sites} />
            <Stat label="Assets" n={dialog.meta.counts.assets} />
            <Stat label="Credentials" n={dialog.meta.counts.credentials} />
            <Stat label="Network" n={dialog.meta.counts.network_reference} />
            <Stat label="Change Log" n={dialog.meta.counts.change_log} />
            <Stat label="Audit Log" n={dialog.meta.counts.audit_log} />
          </div>
          <div className="banner" style={{ marginTop: 14 }}>
            ⚠ <strong>Full restore replaces the current vault database.</strong> Merge
            adds the backup's rows without deleting your current data. Choose how to
            proceed, then re-enter the master password to confirm.
          </div>
          <div className="btn-row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
            <button
              className="btn"
              onClick={() => { setDialog({ kind: "none" }); setRestoreFile(null); }}
            >
              Cancel
            </button>
            <button className="btn" disabled={busy} onClick={() => { setRestoreCommitMode("merge"); }}>
              Merge import
            </button>
            <button className="btn btn-danger" disabled={busy} onClick={() => { setRestoreCommitMode("replace"); }}>
              Full restore (replace)
            </button>
          </div>
        </Modal>
      )}

      {/* Restore step 4: re-enter master to confirm the chosen mode */}
      {restoreCommitMode && (
        <MultiPasswordPrompt
          title={restoreCommitMode === "replace" ? "Confirm Full Restore" : "Confirm Merge Import"}
          confirmLabel={restoreCommitMode === "replace" ? "Replace vault" : "Merge import"}
          busyLabel="Applying…"
          onCancel={() => setRestoreCommitMode(null)}
          onSubmit={doCommitWithMaster}
          fields={[
            { key: "master_password", label: "Master password (confirm)", minLength: 1 },
          ]}
        />
      )}

      {node}
    </div>
  );
}

function Stat({ label, n }: { label: string; n: number }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 12 }}>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{n ?? 0}</div>
      <div className="subtle">{label}</div>
    </div>
  );
}

function fmtStamp(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
