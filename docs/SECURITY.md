# Security Model

DRISHTI-Vault is a **local-only, single-user** password vault. This document
describes how secrets are protected. No cryptographic primitives are
hand-rolled — only audited libraries (`argon2-cffi`, `cryptography`) are used.

## Threat model & scope

- **In scope:** protecting secrets at rest on the local machine, enforcing
  re-authentication before revealing them, and preventing accidental exposure
  via logs, browser storage, or network exposure.
- **Out of scope (explicit):** multi-user access, remote/network access,
  protection against a fully-compromised host (malware with the user's
  privileges can read RAM/keystrokes). Keep the host secure.

## Master password

- Required on first launch to initialize the vault.
- **Never stored in plaintext.** Only an **Argon2id** verifier (PHC string) is
  persisted in the `users` table.
- The verifier is used solely to confirm the password is correct; it is **not**
  used as an encryption key.
- Argon2id parameters: `t=3`, `m=64 MiB`, `p=4`, 256-bit output, 128-bit salt.
- `argon2-cffi` performs constant-time verification.

## Key hierarchy

```
Master password  ──Argon2id(password, kdf_salt)──►  KEK  (256-bit, in memory only)
                                                          │
                                  random DEK  ◄──AES-256-GCM(wrap)──  wrapped_DEK  (stored)
                                  (256-bit)                                   ^^^^^^^^^^
                                     │                                       safe at rest
                                     └──► AES-256-GCM ──► per-field ciphertext
```

- The **DEK** (data-encrypting key) is a random 256-bit key generated at setup.
- It is wrapped (encrypted) with the KEK and stored; the KEK is never stored.
- Secret fields (username, password, url, notes) are encrypted individually
  with the DEK using AES-256-GCM (fresh 96-bit nonce per value).
- On login, the KEK is derived, the DEK is unwrapped **into server RAM**, and
  held only in the in-memory session store for that browser session.
- **Changing the master password** only re-wraps the DEK — no row re-encryption.

## Session & reveal window

- Authentication sets an opaque, **httpOnly**, `SameSite=Strict` session cookie.
  The DEK lives server-side, keyed by that session — it is **never** sent to the
  browser and **never** placed in `localStorage`/`sessionStorage`.
- **Auto-lock:** after `IDLE_LOCK_MINUTES` (default 15) of inactivity the
  session (and its DEK) is wiped from RAM, both server-side and client-side.
- **Reveal window:** viewing or copying a password requires a short-lived
  reveal window opened by re-entering the master password
  (`POST /api/reveal`, default `REVEAL_TTL=120s`). Outside the window,
  `/credentials/{id}/view` and `/copy` return `403`. This enforces
  "re-auth before reveal."

## Clipboard handling

- Copy writes to the clipboard **in the browser**; the server records only the
  *event* (never the value).
- The client **auto-clears the clipboard after 30s** (`CLIPBOARD_TTL`) and
  audited as `credential.copy`.

## What is / is not logged

- **Audited (metadata only):** login, lock, reveal-open, credential
  view/copy/edit/delete/rotate, asset/site/network/changelog changes, Excel
  import, encrypted backup export/restore.
- **Never logged:** passwords, tokens, usernames, URLs, notes, DEK, KEK,
  verifiers. A logging filter also redacts lines containing obvious secret
  field names as a backstop.

## Network exposure

- The server binds **only to `127.0.0.1:7788`**. The app refuses to start if
  configured for `0.0.0.0` or any other interface.
- No CORS to network origins; no telemetry; no external API calls; no cloud sync.
- Swagger/OpenAPI docs are disabled on the running server.

## Two-password model

DRISHTI-Vault uses **two separate, independent passwords**:

| Password | Purpose | Required for | Stored as |
|----------|---------|--------------|-----------|
| **Master Password** | Unlocks the vault; derives the KEK that wraps the DEK | login, reveal/copy, **export**, **restore**, **change master password** | Argon2id verifier only (never plaintext) |
| **Vault Backup Password** | Encrypts the backup *envelope* file | export & restore of `.drishtivaultbackup` files | **Never stored** — entered each time |

Neither password is ever stored in plaintext, logged, or saved to
`localStorage`/`sessionStorage`/`.env`/config files.

### The "second gate" rule

A logged-in session is **never** enough for sensitive actions. The Master
Password must be re-entered for:

- revealing or copying a stored password (opens the reveal window)
- exporting an encrypted backup
- previewing/restoring a backup
- changing the master password

### Master Password

- First launch requires creating it (min 10 chars).
- Hashed with **Argon2id** (`argon2-cffi`); only the PHC verifier is stored.
- Changing it re-wraps the DEK under a new KEK + salt — **existing secrets stay
  valid** (the DEK itself is unchanged). Neither old nor new password is logged.

### Vault Backup Password

- Entered at export time (with confirmation); never stored anywhere.
- Derives an AES-256-GCM key (via Argon2id) that encrypts **only the backup
  envelope**.
- The same password is required to decrypt/restore the file.

## Backup encryption

- Backup files use extension **`.drishtivaultbackup`** and naming
  `DRISHTI_Vault_Backup_YYYY-MM-DD_HHMM.drishtivaultbackup`, saved to
  `backups/encrypted`.
- `POST /api/backup/export` requires: **unlocked session + re-entered Master
  Password + Vault Backup Password + confirmation**.
- The envelope payload is AES-256-GCM encrypted with the backup key; secret
  fields stay encrypted under the vault DEK inside it, so the file **never
  contains plaintext secrets**.
- A backup can only be read with the Vault Backup Password **and** the vault's
  Master Password (the latter unwraps the per-row DEK on restore).

### Restore flow (two-gate, with preview)

1. Unlocked session + re-entered Master Password + `.drishtivaultbackup` file +
   Vault Backup Password → **decrypt → preview**
2. Preview shows: created date, backup version, schema version, and counts
   (sites, assets, credentials, network, change log, audit log) + a warning
   that full restore replaces the database.
3. User chooses **Full restore (replace)**, **Merge import**, or **Cancel**.
4. Re-enter the Master Password to confirm.

### Restore hardening

- Wrong Master Password → export/import blocked (401).
- Wrong Vault Backup Password → restore blocked (400); the error is deliberately
  generic and never reveals whether a specific credential exists.
- After **5 failed restore attempts**, a 5-minute cool-down is enforced
  (429). A full app restart also clears the lockout.
- A **full replace** locks the vault afterward (the restored DEK differs); the
  user re-authenticates with the restored Master Password. A **merge** keeps the
  active session.
- Every export/restore attempt writes a `backup_events` row (success/failure
  only) and an audit event — **never** passwords, keys, or decrypted content.

### Auth rate-limiting

- Master-password checks at **login, setup, reveal, and change-master-password**
  are throttled: after **5 failed attempts**, a 5-minute cool-down is enforced
  (429); even the *correct* password is rejected while the cool-down is active.
- State is process-scoped/in-memory, so a full app (or container) restart also
  clears it. This blocks online brute-force of the master password.

### Signed backups (Ed25519)

- Every export generates a fresh **Ed25519** keypair. The signature covers
  `salt || nonce || ciphertext`. The public key is stored in the envelope
  (plaintext); the private key is encrypted under the backup-derived key.
- On restore, after AES-GCM decryption the signature is **verified** — any
  tampering with the ciphertext/nonce/salt fails verification and the restore is
  rejected. This is an independent authenticity/integrity backstop on top of
  AES-GCM's own AEAD tag.
- Unsigned legacy backups (created before signing) are still accepted, since
  AES-GCM already authenticates the ciphertext.

### Container hardening

When run via Podman the container is least-privilege: **non-root** (`uid=1001`),
**read-only root filesystem**, **all capabilities dropped**, **no privilege
escalation**, and resource limits. See [CONTAINER.md](CONTAINER.md).

## Git hygiene

- `.gitignore` excludes the database, backups, logs, key material, and `.env`.
- Sample/seed data contains **only dummy values** — no real credentials.
