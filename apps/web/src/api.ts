import type { Note, NoteImportResult, NoteInput } from "./types";

// API client. All requests are same-origin in production (the Go server serves the SPA).
// No secrets are ever persisted to localStorage/sessionStorage.

const BASE = "";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function req<T>(
  path: string,
  opts: RequestInit = {},
  timeoutMs?: number
): Promise<T> {
  const controller = timeoutMs && !opts.signal ? new AbortController() : null;
  const timeout = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  const init: RequestInit = {
    credentials: "include",
    ...opts,
    signal: opts.signal || controller?.signal,
    headers: {
      ...(opts.body && !(opts.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(opts.headers || {}),
    },
  };

  try {
    const res = await fetch(BASE + path, init);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let data: any = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const detail = (data && data.detail) || `HTTP ${res.status}`;
      throw new ApiError(res.status, detail);
    }
    return data as T;
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Request timed out. Refresh the page and try again.");
    }
    throw e;
  } finally {
    if (timeout !== null) window.clearTimeout(timeout);
  }
}

export const api = {
  health: () => req<{ ok: boolean }>("/api/health"),
  bootstrap: () => req<any>("/api/bootstrap"),
  me: () => req<any>("/api/me"),

  setup: (username: string, master_password: string) =>
    req<any>("/api/setup", {
      method: "POST",
      body: JSON.stringify({ username, master_password }),
    }),
  login: (username: string, master_password: string) =>
    req<any>("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, master_password }),
    }),
  lock: () => req("/api/lock", { method: "POST" }),
  changeMasterPassword: (current_master_password: string,
                         new_master_password: string) =>
    req<any>("/api/change-master-password", {
      method: "POST",
      body: JSON.stringify({ current_master_password, new_master_password }),
    }),

  // ---- User Management (admin) ----
  listUsers: () => req<{ items: any[]; roles: string[]; can_reset_password: boolean }>("/api/users"),
  createUser: (body: any) =>
    req("/api/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: number, body: any) =>
    req(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  assignSites: (id: number, site_ids: number[]) =>
    req(`/api/users/${id}/sites`, { method: "POST", body: JSON.stringify({ site_ids }) }),
  deactivateUser: (id: number) =>
    req(`/api/users/${id}`, { method: "DELETE" }),
  resetUserPassword: (id: number, new_password: string) =>
    req(`/api/users/${id}/reset-password`, {
      method: "POST", body: JSON.stringify({ new_password }),
    }),
  openReveal: (master_password: string) =>
    req("/api/reveal", {
      method: "POST",
      body: JSON.stringify({ master_password }),
    }),

  dashboard: () => req<any>("/api/dashboard"),

  listSites: () => req<{ items: any[] }>("/api/sites"),
  saveSite: (body: any, id?: number) =>
    req(id ? `/api/sites/${id}` : "/api/sites", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(body),
    }),
  deleteSite: (id: number) => req(`/api/sites/${id}`, { method: "DELETE" }),

  listAssets: () => req<{ items: any[]; asset_types: string[] }>("/api/assets"),
  getAsset: (id: number) => req<any>(`/api/assets/${id}`),
  saveAsset: (body: any, id?: number) =>
    req(id ? `/api/assets/${id}` : "/api/assets", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(body),
    }),
  deleteAsset: (id: number) => req(`/api/assets/${id}`, { method: "DELETE" }),

  listCredentials: () =>
    req<{ items: any[]; cred_types: string[]; clipboard_ttl: number }>(
      "/api/credentials"
    ),
  saveCredential: (body: any, id?: number) =>
    req(id ? `/api/credentials/${id}` : "/api/credentials", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(body),
    }),
  deleteCredential: (id: number) =>
    req(`/api/credentials/${id}`, { method: "DELETE" }),
  viewCredential: (id: number) => req<any>(`/api/credentials/${id}/view`),
  copyCredential: (id: number) =>
    req(`/api/credentials/${id}/copy`, { method: "POST" }),
  rotateCredential: (id: number) =>
    req<any>(`/api/credentials/${id}/rotate`, { method: "POST" }),

  listNetwork: () => req<{ items: any[] }>("/api/network"),
  saveNetwork: (body: any, id?: number) =>
    req(id ? `/api/network/${id}` : "/api/network", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(body),
    }),
  deleteNetwork: (id: number) => req(`/api/network/${id}`, { method: "DELETE" }),

  listChangelog: () => req<{ items: any[] }>("/api/changelog"),
  saveChangelog: (body: any, id?: number) =>
    req(id ? `/api/changelog/${id}` : "/api/changelog", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(body),
    }),
  deleteChangelog: (id: number) =>
    req(`/api/changelog/${id}`, { method: "DELETE" }),

  listAudit: (limit = 500, offset = 0) =>
    req<{ items: any[]; total: number }>(
      `/api/audit?limit=${limit}&offset=${offset}`
    ),

  previewImport: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return req<any>("/api/import/excel/preview", { method: "POST", body: fd });
  },
  commitImport: (payload: any) =>
    req("/api/import/excel/commit", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  exportBackup: (master_password: string, backup_password: string,
                 backup_password_confirm: string) =>
    req<Blob>("/api/backup/export", {
      method: "POST",
      body: JSON.stringify({
        master_password, backup_password, backup_password_confirm,
      }),
      headers: { Accept: "application/octet-stream" },
    }),
  restorePreview: (file: File, master_password: string, backup_password: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("master_password", master_password);
    fd.append("backup_password", backup_password);
    return req<any>("/api/backup/restore/preview", { method: "POST", body: fd });
  },
  restoreCommit: (master_password: string, token: string, mode: "replace" | "merge") =>
    req<any>("/api/backup/restore/commit", {
      method: "POST",
      body: JSON.stringify({ master_password, token, mode }),
    }),
  backupHistory: () => req<{ items: any[] }>("/api/backup/history"),
  backupLast: () =>
    req<{ last_export: string | null; last_restore: string | null;
         restore_lockout_active: boolean; restore_lockout_seconds: number }>(
      "/api/backup/last"),

  // ---- CSV templates / bulk import ----
  csvTables: () =>
    req<{ tables: any[] }>("/api/csv/tables"),
  csvPreview: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return req<any>("/api/csv/preview", { method: "POST", body: fd }, 30000);
  },
  csvCommit: (file: File, table: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("table", table);
    return req<any>("/api/csv/commit", { method: "POST", body: fd }, 30000);
  },

  // ---- Encrypted Notes ----
  // GET /notes returns decrypted content for an authenticated session (no
  // master-password re-auth / reveal window - unlike credentials). Search is
  // performed client-side on the result. See routes/notes.py for the trade-off.
  listNotes: () => req<{ items: Note[] }>("/api/notes"),
  createNote: (body: NoteInput) =>
    req<{ id: number }>("/api/notes", { method: "POST", body: JSON.stringify(body) }),
  updateNote: (id: number, body: NoteInput) =>
    req(`/api/notes/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteNote: (id: number) =>
    req(`/api/notes/${id}`, { method: "DELETE" }),
  toggleNotePin: (id: number) =>
    req<{ id: number; pinned: boolean }>(`/api/notes/${id}/pin`, { method: "POST" }),
  importNote: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return req<NoteImportResult>("/api/notes/import", { method: "POST", body: fd }, 30000);
  },
};

// Download a CSV template (blob fetch; generic req() returns JSON).
export async function downloadCsvTemplate(table: string): Promise<Blob> {
  const res = await fetch(`/api/csv/template/${table}`, { credentials: "include" });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { detail = (await res.json()).detail || detail; } catch {}
    throw new Error(detail);
  }
  return res.blob();
}

// Specialized blob fetch for backup download (the generic req() returns JSON).
export async function downloadBackup(
  master_password: string,
  backup_password: string,
  backup_password_confirm: string
): Promise<{ blob: Blob; createdAt: string }> {
  const res = await fetch("/api/backup/export", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      master_password, backup_password, backup_password_confirm,
    }),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  return {
    blob: await res.blob(),
    createdAt: res.headers.get("X-Backup-Created-At") || "",
  };
}
