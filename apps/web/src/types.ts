// Shared TypeScript types for DRISHTI-Vault frontend.

export interface Session {
  username: string;
  reveal_open: boolean;
  reveal_ttl: number;
}

export interface Bootstrap {
  initialized: boolean;
  idle_lock_minutes: number;
  clipboard_ttl: number;
  reveal_ttl: number;
}

export interface Site {
  id: number;
  name: string;
  plant_code: string | null;
  location: string | null;
  status: string;
  notes: string | null;
  vm_count?: number;
  credential_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Asset {
  id: number;
  site_id: number | null;
  site_name?: string | null;
  app_vm_name: string;
  asset_type: string;
  vm_id: string | null;
  hostname: string | null;
  ip_address: string | null;
  web_url?: string | null;
  has_web_url?: boolean;
  environment: string | null;
  os_info: string | null;
  owner: string | null;
  status: string;
  notes?: string | null;
  has_notes?: boolean;
}

export interface Credential {
  id: number;
  title: string;
  site_id: number | null;
  site_name?: string | null;
  asset_id: number | null;
  asset_name?: string | null;
  cred_type: string;
  username_masked: string;
  has_password: boolean;
  password_masked: string;
  url_masked: string;
  port: number | null;
  rotation_due: string | null;
  status: string;
}

export interface CredentialDetail {
  id: number;
  title: string;
  cred_type: string;
  username: string;
  password: string;
  url_host: string;
  port: number | null;
  notes: string;
}

export interface NetworkRow {
  id: number;
  site_id: number | null;
  site_name?: string | null;
  vlan_id: string | null;
  vlan_name: string | null;
  subnet: string | null;
  gateway: string | null;
  dhcp_scope: string | null;
  dns_servers: string | null;
  notes: string | null;
}

export interface ChangeLogRow {
  id: number;
  event_date: string | null;
  site_id: number | null;
  site_name?: string | null;
  asset_id: number | null;
  asset_name: string | null;
  field_changed: string | null;
  changed_by: string | null;
  reason_ticket: string | null;
  approved_by: string | null;
  notes: string | null;
}

export interface AuditRow {
  id: number;
  event_ts: string;
  actor: string | null;
  action: string;
  target_type: string | null;
  target_id: number | null;
  detail: string | null;
  source_ip: string | null;
}

export interface Dashboard {
  total_sites: number;
  total_assets: number;
  total_credentials: number;
  credentials_due_rotation: number;
  recent_changes: ChangeLogRow[];
  recent_audit: AuditRow[];
}

export interface ImportPreview {
  sites: any[];
  assets: any[];
  network: any[];
  changelog: any[];
  detected_secrets: any[];
  detected_secrets_count: number;
  sheet_names: string[];
}
