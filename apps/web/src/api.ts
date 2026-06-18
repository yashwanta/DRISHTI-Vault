// API client. All requests are same-origin in production (FastAPI serves the SPA).
// No secrets are ever persisted to localStorage/sessionStorage.

const BASE = "";

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const init: RequestInit = {
    credentials: "include",
    ...opts,
    headers: {
      ...(opts.body && !(opts.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(opts.headers || {}),
    },
  };
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
    const err = new Error(detail);
    (err as any).status = res.status;
    throw err;
  }
  return data as T;
}

export const api = {
  health: () => req<{ ok: boolean }>("/api/health"),
  bootstrap: () => req<any>("/api/bootstrap"),
  me: () => req<any>("/api/me"),

  setup: (username: string, master_password: string) =>
    req("/api/setup", {
      method: "POST",
      body: JSON.stringify({ username, master_password }),
    }),
  login: (username: string, master_password: string) =>
    req("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, master_password }),
    }),
  lock: () => req("/api/lock", { method: "POST" }),
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
  changeMasterPassword: (current_master_password: string,
                         new_master_password: string) =>
    req<any>("/api/change-master-password", {
      method: "POST",
      body: JSON.stringify({ current_master_password, new_master_password }),
    }),
};

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

