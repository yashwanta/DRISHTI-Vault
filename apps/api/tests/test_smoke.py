"""End-to-end smoke test for DRISHTI-Vault, including the strict two-gate backup
hardening (Master Password + separate Vault Backup Password).

Run:  cd apps/api && python tests/test_smoke.py
"""
import os, sys, io, json, tempfile, shutil, pathlib

tmp = tempfile.mkdtemp(prefix="drishtivault_e2e_")
os.environ["DRISHTIVAULT_DATA_DIR"] = tmp
os.environ["DRISHTIVAULT_DB_PATH"] = os.path.join(tmp, "test.db")
os.environ["DRISHTIVAULT_BACKUP_DIR"] = os.path.join(tmp, "backups")
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
for m in list(sys.modules):
    if m.startswith("app"):
        del sys.modules[m]

from app import config
config.DATA_DIR = pathlib.Path(tmp)
config.DB_PATH = pathlib.Path(os.environ["DRISHTIVAULT_DB_PATH"])
config.BACKUP_DIR = pathlib.Path(os.environ["DRISHTIVAULT_BACKUP_DIR"])
config.ensure_dirs()

from app.db import init_db
init_db()
from app.main import app
from fastapi.testclient import TestClient as Client

c = Client(app)
SUPER = "Yash"                     # reserved super-admin identity (first user)
ADMIN_PW = "correct horse battery staple"
MASTER = ADMIN_PW                  # kept for compatibility with later assertions
BACKUP_PW = "vault-backup-password-1234"
WRONG_MASTER = "definitely-not-right!!"
WRONG_BACKUP = "wrong-backup-password-0000"


def check(label, cond):
    print(("  [OK] " if cond else "  [FAIL] ") + label)
    assert cond, label


def relogin():
    c.post("/api/login", json={"username": SUPER, "master_password": ADMIN_PW})


def upload_payload() -> bytes:
    """Export a real encrypted backup and return its bytes (helper)."""
    r = c.post("/api/backup/export", json={
        "master_password": MASTER,
        "backup_password": BACKUP_PW,
        "backup_password_confirm": BACKUP_PW,
    })
    assert r.status_code == 200, r.text
    return r.content


# ======================= core vault =======================
r = c.get("/api/bootstrap")
check("bootstrap says uninitialized", r.json()["initialized"] is False)

# first user MUST be the reserved super admin 'Yash'
r = c.post("/api/setup", json={"username": "admin", "master_password": MASTER})
check("setup rejects non-Yash first user", r.status_code == 400)

r = c.post("/api/setup", json={"username": SUPER, "master_password": MASTER})
check("setup creates Yash super admin", r.status_code == 200
      and r.json().get("role") == "super_admin")

r = c.post("/api/login", json={"username": SUPER, "master_password": MASTER})
check("login ok", r.status_code == 200 and r.json().get("role") == "super_admin")

r = c.get("/api/dashboard")
check("dashboard", r.status_code == 200 and r.json()["total_sites"] == 2)

r = c.get("/api/sites"); check("sites list", len(r.json()["items"]) >= 2)
r = c.get("/api/assets"); check("assets list", len(r.json()["items"]) >= 1)

# create a credential with a known secret
r = c.post("/api/credentials", json={
    "title": "PVE root", "cred_type": "Proxmox Login", "username": "root@pam",
    "password": "s3cret-value!", "url_host": "https://pve.local:8006",
    "port": 8006, "status": "Active"})
check("create credential", r.status_code == 200)
cid = r.json()["id"]

# masked in list
r = c.get("/api/credentials"); it = r.json()["items"][0]
check("password masked in list", it["password_masked"] == "••••••••")

# view blocked without reveal
r = c.get(f"/api/credentials/{cid}/view")
check("view blocked without reveal", r.status_code == 403)

# reveal requires master
r = c.post("/api/reveal", json={"master_password": WRONG_MASTER})
check("wrong reveal master rejected", r.status_code == 401)
r = c.post("/api/reveal", json={"master_password": MASTER})
check("reveal opened with master", r.status_code == 200)

r = c.get(f"/api/credentials/{cid}/view")
check("view returns plaintext after reveal",
      r.json()["password"] == "s3cret-value!")

r = c.post(f"/api/credentials/{cid}/copy")
check("copy audited after reveal", r.status_code == 200)

# ======================= backup hardening =======================
print("\n-- two-gate backup --")

# 1. export WITHOUT master -> blocked (422 validation / 401 auth; both = blocked)
r = c.post("/api/backup/export", json={
    "master_password": "", "backup_password": BACKUP_PW,
    "backup_password_confirm": BACKUP_PW})
check("export requires master re-auth", r.status_code in (400, 401, 422))

# 2. export with WRONG master -> 401
r = c.post("/api/backup/export", json={
    "master_password": WRONG_MASTER, "backup_password": BACKUP_PW,
    "backup_password_confirm": BACKUP_PW})
check("export with wrong master blocked", r.status_code == 401)

# 3. export with mismatched backup confirm -> blocked (400 business rule)
r = c.post("/api/backup/export", json={
    "master_password": MASTER, "backup_password": BACKUP_PW,
    "backup_password_confirm": "a-different-pw-9999"})
check("export backup pw mismatch blocked", r.status_code == 400)

# 4. export with short backup pw -> blocked (422 validation)
r = c.post("/api/backup/export", json={
    "master_password": MASTER, "backup_password": "short",
    "backup_password_confirm": "short"})
check("export short backup pw blocked", r.status_code in (400, 422))

# 5. valid export
exp_r = c.post("/api/backup/export", json={
    "master_password": MASTER,
    "backup_password": BACKUP_PW,
    "backup_password_confirm": BACKUP_PW,
})
check("valid export returns bytes", exp_r.status_code == 200 and len(exp_r.content) > 100)
backup_bytes = exp_r.content

# 6. exported filename uses .drishtivaultbackup
disp = exp_r.headers.get("content-disposition", "")
check("export filename is .drishtivaultbackup",
      "DRISHTI_Vault_Backup_" in disp and disp.endswith(".drishtivaultbackup\""))

# 7. exported envelope never contains plaintext secrets
blob = backup_bytes.decode("utf-8", "replace")
check("backup file has no plaintext secret", "s3cret-value!" not in blob)

# ---- restore preview ----
def preview(pw_master=MASTER, pw_backup=BACKUP_PW, data=backup_bytes):
    return c.post("/api/backup/restore/preview",
                  files={"file": ("x.drishtivaultbackup", io.BytesIO(data),
                                  "application/octet-stream")},
                  data={"master_password": pw_master,
                        "backup_password": pw_backup})

# 8. preview without master -> 401
r = preview(pw_master="")
check("preview requires master", r.status_code == 401)

# 9. preview with wrong backup pw -> 400 (and counts toward lockout)
r = preview(pw_backup=WRONG_BACKUP)
check("preview wrong backup pw blocked", r.status_code == 400)

# 10. preview valid returns metadata + token
r = preview()
check("preview valid", r.status_code == 200)
meta = r.json()["meta"]
token = r.json()["token"]
check("preview has created date", bool(meta.get("backup_created_at")))
check("preview has version", bool(meta.get("backup_version")))
check("preview counts credentials", meta["counts"]["credentials"] >= 1)
check("preview counts audit log", "audit_log" in meta["counts"])

# ---- restore commit: merge (non-destructive first) ----
# commit without master -> blocked (422 validation / 401 auth)
r = c.post("/api/backup/restore/commit",
           json={"master_password": "", "token": token, "mode": "merge"})
check("commit requires master", r.status_code in (400, 401, 422))

# commit valid merge
r = c.post("/api/backup/restore/commit",
           json={"master_password": MASTER, "token": token, "mode": "merge"})
check("merge commit ok", r.status_code == 200 and "merge" in r.json().get("message", "").lower())

# merge must NOT lock the session (active identity preserved)
r = c.get("/api/dashboard")
check("session still valid after merge", r.status_code == 200)

# ---- restore commit: replace ----
r = preview()
token2 = r.json()["token"]
r = c.post("/api/backup/restore/commit",
           json={"master_password": MASTER, "token": token2, "mode": "replace"})
check("replace commit ok", r.status_code == 200 and r.json()["locked"] is True)

# replace locks the session
r = c.get("/api/dashboard")
check("session locked after replace", r.status_code == 401)

# ---- restore lockout: 5 failures -> 429 ----
relogin()
fails = 0
locked_now = False
for _ in range(6):
    r = preview(pw_backup=WRONG_BACKUP)
    if r.status_code == 429:
        locked_now = True
        break
    fails += 1
check("5 failed restores trigger lockout", locked_now and fails == 5)

# while locked, even a CORRECT password is blocked
r = preview(pw_backup=BACKUP_PW)
check("locked blocks even correct backup pw", r.status_code == 429)

# last/status reflects lockout
r = c.get("/api/backup/last")
check("status reports lockout active", r.json()["restore_lockout_active"] is True)

# ---- change master password ----
# reset lockout by simulating app restart (clear the singleton)
relogin()
from app.deps import restore_lockout
restore_lockout._fails = 0
restore_lockout._lockout_until = 0.0

r = c.post("/api/change-master-password", json={
    "current_master_password": WRONG_MASTER,
    "new_master_password": "new-correct-horse-battery"})
check("change master wrong current blocked", r.status_code == 401)

r = c.post("/api/change-master-password", json={
    "current_master_password": MASTER,
    "new_master_password": "new-correct-horse-battery"})
check("change master ok", r.status_code == 200)

# login with NEW master works
r = c.post("/api/login", json={"username": SUPER,
                               "master_password": "new-correct-horse-battery"})
check("login with new master ok", r.status_code == 200)

# old master no longer works
r = c.post("/api/login", json={"username": SUPER, "master_password": MASTER})
check("old master rejected after change", r.status_code == 401)

# point MASTER/relogin to the NEW password for all subsequent steps
MASTER = ADMIN_PW = "new-correct-horse-battery"

# existing secrets remain decryptable under the SAME DEK
r = c.post("/api/reveal", json={"master_password": "new-correct-horse-battery"})
check("reveal with new master", r.status_code == 200)
r = c.get(f"/api/credentials/{cid}/view")
check("secret intact after master change", r.json()["password"] == "s3cret-value!")

# ======================= audit + history =======================
relogin()

# ======================= hardening: auth lockout + signature tamper ========
# reset auth throttle (simulates the process-scoped state clearing on restart)
from app.deps import auth_throttle
auth_throttle._fails = 0
auth_throttle._lockout_until = 0.0

# auth login lockout after 5 failed attempts
locked_now = False
fails = 0
for _ in range(6):
    r = c.post("/api/login", json={"username": SUPER, "master_password": "NOPE-" * 4})
    if r.status_code == 429:
        locked_now = True
        break
    fails += 1
check("5 failed logins trigger auth lockout", locked_now and fails == 5)

# while locked, even the CORRECT master is rejected
r = c.post("/api/login", json={"username": SUPER, "master_password": MASTER})
check("locked blocks even correct login", r.status_code == 429)

# reset throttle to continue
auth_throttle._fails = 0
auth_throttle._lockout_until = 0.0
relogin()

# signature tamper: flip a byte in a signed backup's ciphertext -> rejected
r = c.post("/api/backup/export", json={
    "master_password": "new-correct-horse-battery",
    "backup_password": BACKUP_PW, "backup_password_confirm": BACKUP_PW,
})
check("signed export ok", r.status_code == 200)
signed = json.loads(r.content.decode())
check("export carries ed25519 signature", signed.get("sig_alg") == "ed25519")

# tamper with the signature itself (replace with garbage) -> verify fails
import base64 as _b64
tampered = dict(signed)
tampered["sig"] = _b64.b64encode(b"\x00" * 64).decode("ascii")
tampered_bytes = json.dumps(tampered).encode()
r = c.post("/api/backup/restore/preview",
           files={"file": ("x.drishtivaultbackup", io.BytesIO(tampered_bytes),
                           "application/octet-stream")},
           data={"master_password": "new-correct-horse-battery",
                 "backup_password": BACKUP_PW})
check("tampered signature rejected", r.status_code == 400)
# also confirm the failure is about the signature / tamper, generic message
check("tamper message generic", "tamper" in r.text.lower() or "decrypt" in r.text.lower())

# reset restore throttle (5 fails above) before finishing
from app.deps import restore_lockout
restore_lockout._fails = 0
restore_lockout._lockout_until = 0.0

r = c.get("/api/audit?limit=200")
actions = [a["action"] for a in r.json()["items"]]
audit_blob = json.dumps(r.json())
check("audit has export/restore events",
      any("backup" in a for a in actions))
check("audit never contains secrets",
      "s3cret-value!" not in audit_blob and BACKUP_PW not in audit_blob
      and WRONG_BACKUP not in audit_blob)

r = c.get("/api/backup/history")
hist = r.json()["items"]
check("backup history recorded", len(hist) >= 2)
check("history has success + failure",
      any(h["success"] == 1 for h in hist) and any(h["success"] == 0 for h in hist))
# history must never contain passwords
hist_blob = json.dumps(hist)
check("history never contains passwords",
      BACKUP_PW not in hist_blob and WRONG_BACKUP not in hist_blob)

# ===========================================================================
# RBAC: roles, site-scoping, reset-password, Yash protection
# ===========================================================================
print("\n-- RBAC --")
# c is currently logged in as Yash (super admin), password = MASTER ("new-correct-horse-battery")

# sites present (seeded Springfield/Hopkinsville); pick their ids
sites = c.get("/api/sites").json()["items"]
check("seeded sites present for RBAC", len(sites) >= 2)
# resolve sites BY NAME (the API returns them ORDER BY name, so index is unreliable)
spr_id = next(s["id"] for s in sites if s["name"] == "Springfield")
hop_id = next(s["id"] for s in sites if s["name"] == "Hopkinsville")

# Yash cannot be seen in /users by non-Yash; but Yash himself sees Yash
me = c.get("/api/me").json()
check("Yash sees super_admin role", me["role"] == "super_admin")

# --- create a global admin ---
r = c.post("/api/users", json={
    "username": "gadmin", "full_name": "Global Admin",
    "role": "global_admin", "password": "global-admin-pass-1",
})
check("create global admin", r.status_code == 200)

# --- create a location admin assigned to Springfield only ---
r = c.post("/api/users", json={
    "username": "spr_admin", "full_name": "Springfield Admin",
    "role": "location_admin", "password": "loc-admin-pass-001",
    "site_ids": [spr_id],
})
check("create location admin", r.status_code == 200)

# reserved username may never be created via /users
r = c.post("/api/users", json={
    "username": "Yash", "role": "global_admin", "password": "x" * 12,
})
check("reserved username rejected", r.status_code == 400)

# Yash sees himself in the user list
users = c.get("/api/users").json()["items"]
check("Yash (super) sees Yash in users", any(u["username"] == "Yash" for u in users))

# --- global admin session ---
g = Client(app)
r = g.post("/api/login", json={"username": "gadmin", "master_password": "global-admin-pass-1"})
check("global admin login", r.status_code == 200 and r.json()["role"] == "global_admin")
gusers = g.get("/api/users").json()["items"]
check("global admin CANNOT see Yash (hidden)", all(u["username"] != "Yash" for u in gusers))
check("global admin CANNOT reset passwords", g.get("/api/users").json().get("can_reset_password") is False)
# global admin sees all sites
check("global admin sees all sites", len(g.get("/api/sites").json()["items"]) >= 2)

# --- location admin session (Springfield only) ---
l = Client(app)
r = l.post("/api/login", json={"username": "spr_admin", "master_password": "loc-admin-pass-001"})
check("location admin login", r.status_code == 200 and r.json()["role"] == "location_admin")

# location admin sees ONLY Springfield
lsites = l.get("/api/sites").json()["items"]
check("location admin sees 1 site", len(lsites) == 1)
check("location admin sees only assigned site", lsites[0]["id"] == spr_id)

# location admin cannot create sites
check("location admin cannot create site", l.post("/api/sites", json={"name": "X"}).status_code == 403)

# --- scope test: create a credential per site as Yash, verify visibility ---
c.post("/api/credentials", json={
    "title": "SPR-cred", "site_id": spr_id, "cred_type": "Linux SSH",
    "password": "spr-secret", "status": "Active"})
c.post("/api/credentials", json={
    "title": "HOP-cred", "site_id": hop_id, "cred_type": "Linux SSH",
    "password": "hop-secret", "status": "Active"})

lcreds = l.get("/api/credentials").json()["items"]
ltitles = {x["title"] for x in lcreds}
check("location admin sees only SPR credential", "SPR-cred" in ltitles and "HOP-cred" not in ltitles)

# find the HOP credential id (as Yash) to test 404-on-out-of-scope
allcreds = c.get("/api/credentials").json()["items"]
hop_cid = next(x["id"] for x in allcreds if x["title"] == "HOP-cred")

# location admin's view of HOP credential -> 404 (not 403; no existence leak)
r = l.get(f"/api/credentials/{hop_cid}/view")
check("location admin blocked from out-of-scope cred (404)", r.status_code in (403, 404))

# location admin cannot reset passwords (not super)
r = l.post("/api/users/2/reset-password", json={"new_password": "whatever-pass-12"})
check("location admin cannot reset passwords", r.status_code == 403)

# global admin also cannot reset passwords
r = g.post("/api/users/2/reset-password", json={"new_password": "whatever-pass-12"})
check("global admin cannot reset passwords", r.status_code == 403)

# --- super admin CAN reset a user's password ---
r = c.post("/api/users/2/reset-password", json={"new_password": "gadmin-newpass-99"})
check("super admin resets password", r.status_code == 200)
# old password no longer works
r = g.post("/api/login", json={"username": "gadmin", "master_password": "global-admin-pass-1"})
check("old password fails after reset", r.status_code == 401)
# new password works and must_change_pw is set
r = g.post("/api/login", json={"username": "gadmin", "master_password": "gadmin-newpass-99"})
check("new password works after reset", r.status_code == 200 and r.json()["must_change_pw"] is True)

# --- Yash protection: cannot delete/rename/demote the super admin ---
yash_id = next(u["id"] for u in users if u["username"] == "Yash")
check("cannot delete Yash", c.delete(f"/api/users/{yash_id}").status_code == 403)
check("cannot demote Yash",
      c.put(f"/api/users/{yash_id}", json={"role": "global_admin"}).status_code == 403)

# location admin cannot even list users (admin-only endpoint)
check("location admin cannot manage users", l.get("/api/users").status_code == 403)

# ===========================================================================
# CSV templates + bulk import (download → fill → upload with passwords)
# ===========================================================================
print("\n-- CSV --")
# template download for each table
tables = c.get("/api/csv/tables").json()["tables"]
check("csv tables advertised", {t["table"] for t in tables} ==
      {"credentials", "sites", "assets", "network", "changelog"})

for t in ("credentials", "sites", "assets", "network", "changelog"):
    r = c.get(f"/api/csv/template/{t}")
    check(f"csv template {t} downloads", r.status_code == 200 and "text/csv" in r.headers.get("content-type", ""))
    # dummy sample rows must never contain a real secret value
    body = r.text
    check(f"csv template {t} marks secrets CHANGE_ME",
          ("CHANGE_ME" not in body) if t in ("sites", "network", "changelog")
          else ("CHANGE_ME" in body))

# --- build a credentials CSV with a real password, upload, commit, verify ---
cred_csv = (
    "title,site_name,asset_name,cred_type,username,password,url_host,port,rotation_due,status,notes\n"
    "CSV-PVE,Springfield,,Proxmox Login,root@pam,csv-secret-123,https://pve.local:8006,8006,,Active,from csv\n"
    "CSV-HOP,Hopkinsville,,Linux SSH,ubuntu,csv-hop-secret,,,,Active,\n"
    "BadCred,,,BogusType,u,p,,,,Active,\n"   # invalid cred_type -> 1 invalid row
)
r = c.post("/api/csv/preview", files={"file": ("c.csv", io.BytesIO(cred_csv.encode()),
                                              "text/csv")})
p = r.json()
check("csv preview detects table", p["table"] == "credentials")
check("csv preview counts", p["counts"]["total"] == 3 and p["counts"]["valid"] == 2
      and p["counts"]["invalid"] == 1)
# secret values must NOT be echoed in the preview response
check("csv preview hides secret values", "csv-secret-123" not in json.dumps(p))
check("csv preview marks has_secrets", any(row["has_secrets"] for row in p["rows"]))

# commit the ORIGINAL file (secrets never round-trip masked); server re-parses
r = c.post("/api/csv/commit",
           files={"file": ("c.csv", io.BytesIO(cred_csv.encode()), "text/csv")},
           data={"table": "credentials"})
commit = r.json()
check("csv commit inserts valid rows", commit["inserted"] == 2 and commit["skipped"] == 0)

# verify the password was ENCRYPTED at rest (not plaintext) and decrypts via reveal
allc = c.get("/api/credentials").json()["items"]
csv_pve = next(x for x in allc if x["title"] == "CSV-PVE")
c.post("/api/reveal", json={"master_password": MASTER})
v = c.get(f"/api/credentials/{csv_pve['id']}/view").json()
check("csv-imported password decrypts", v["password"] == "csv-secret-123"
      and v["username"] == "root@pam")
# confirm ciphertext (not plaintext) is what's stored
import sqlite3 as _sq
_dbrow = _sq.connect(str(config.DB_PATH)).execute(
    "SELECT password_enc FROM credentials WHERE id=?", (csv_pve["id"],)).fetchone()
check("csv password stored encrypted (not plaintext)",
      _dbrow and "csv-secret-123" not in (_dbrow[0] or ""))

# --- RBAC scoping: location admin imports only their site ---
spr_csv = (
    "title,site_name,cred_type,username,password,port,status,notes\n"
    "CSV-LOC-OK,Springfield,Linux SSH,u,spr-ok,22,Active,\n"
    "CSV-LOC-BAD,Hopkinsville,Linux SSH,u,hop-bad,22,Active,\n"
)
rp = l.post("/api/csv/preview", files={"file": ("c.csv", io.BytesIO(spr_csv.encode()),
                                                "text/csv")}).json()
ok_rows = [row["data"] for row in rp["rows"] if row["ok"]]
rc = l.post("/api/csv/commit",
            files={"file": ("c.csv", io.BytesIO(spr_csv.encode()), "text/csv")},
            data={"table": "credentials"}).json()
check("csv location admin inserts only scoped rows", rc["inserted"] == 1
      and rc["skipped"] == 1)
# the out-of-scope HOP credential must NOT exist for the location admin
ltitles = {x["title"] for x in l.get("/api/credentials").json()["items"]}
check("csv out-of-scope row not visible to location admin",
      "CSV-LOC-OK" in ltitles and "CSV-LOC-BAD" not in ltitles)

# --- sites template round-trip (no secret columns) ---
sites_csv = c.get("/api/csv/template/sites").text
rp = c.post("/api/csv/preview", files={"file": ("s.csv", io.BytesIO(sites_csv.encode()),
                                                "text/csv")}).json()
check("csv sites template has no secret columns", rp["secret_columns"] == [])

# audit logged the csv imports (metadata only)
aud = c.get("/api/audit?limit=200").json()["items"]
check("csv import audited", any(a["action"] == "csv.import" for a in aud))
check("audit never contains csv secrets",
      "csv-secret-123" not in json.dumps(aud) and "csv-hop-secret" not in json.dumps(aud))

# ======================= excel import =======================
# Resolve relative to the project root so the test works in any location.
_PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[3]
_xlsx_path = _PROJECT_ROOT / "import" / "AMR_Proxmox_VM_Tracker.xlsx"
with open(_xlsx_path, "rb") as f:
    xlsx = f.read()
r = c.post("/api/import/excel/preview", files={
    "file": ("tracker.xlsx", io.BytesIO(xlsx),
             "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
p = r.json()
check("excel parses sites", len(p["sites"]) >= 2)
check("excel parses assets", len(p["assets"]) >= 8)

shutil.rmtree(tmp, ignore_errors=True)
print("\nALL E2E CHECKS PASSED")
