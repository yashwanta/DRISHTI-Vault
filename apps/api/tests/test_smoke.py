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
MASTER = "correct horse battery staple"
BACKUP_PW = "vault-backup-password-1234"
WRONG_MASTER = "definitely-not-right!!"
WRONG_BACKUP = "wrong-backup-password-0000"


def check(label, cond):
    print(("  [OK] " if cond else "  [FAIL] ") + label)
    assert cond, label


def relogin():
    c.post("/api/login", json={"username": "admin", "master_password": MASTER})


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

r = c.post("/api/setup", json={"username": "admin", "master_password": MASTER})
check("setup ok", r.status_code == 200)

r = c.post("/api/login", json={"username": "admin", "master_password": MASTER})
check("login ok", r.status_code == 200)

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
r = c.post("/api/login", json={"username": "admin",
                               "master_password": "new-correct-horse-battery"})
check("login with new master ok", r.status_code == 200)

# old master no longer works
r = c.post("/api/login", json={"username": "admin", "master_password": MASTER})
check("old master rejected after change", r.status_code == 401)

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
    r = c.post("/api/login", json={"username": "admin", "master_password": "NOPE-" * 4})
    if r.status_code == 429:
        locked_now = True
        break
    fails += 1
check("5 failed logins trigger auth lockout", locked_now and fails == 5)

# while locked, even the CORRECT master is rejected
r = c.post("/api/login", json={"username": "admin", "master_password": MASTER})
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
