# Recovery

## ⚠ Read this before you forget your master password

DRISHTI-Vault uses strong, authenticated cryptography on purpose. The trade-off is
the same as for any zero-knowledge vault:

> **There is no password-reset, no backdoor, and no master-password recovery.
> If you lose the master password, the encrypted data is permanently unreadable.**

This is by design: it means nobody — including the software author — can read
your secrets without the master password.

## Prevent data loss: keep an encrypted backup

1. Unlock the vault in your browser.
2. **Settings → Export Encrypted Backup** (or run `scripts\backup-drishtivault.ps1`).
3. Re-enter your **Master Password**, then enter a **Vault Backup Password**
   (at least 10 characters) and confirm it.
4. The **`.drishtivaultbackup`** file is written to `backups\encrypted`. Copy it to
   safe offline storage (USB in a locked drawer, etc.).

> ⚠ The Vault Backup Password is **separate from the Master Password** and is
> **never stored**. If you lose it, the backup file cannot be decrypted. Write
> it down and store it **separately** from the Master Password.

## If you forget the master password but have a backup

A backup does **not** let you bypass the master password — the secret fields
inside the backup are still encrypted under the vault DEK, which is wrapped
with the master password. So:

- The backup protects you against **hardware/disk failure**, not against
  forgetting the master password.

**Therefore:** write your master password down and store it somewhere physical
and secure (not on the same machine), and keep encrypted backups for
hardware-failure recovery.

## If the database / disk is lost

1. Reinstall/restore DRISHTI-Vault (or use a fresh machine).
2. Run `install.ps1`, then **before** starting, delete any old `data\drishtivault.db`
   so setup runs cleanly.
3. Start, create a new master password.
4. **Settings → Restore Encrypted Backup** → pick the `.drishtivaultbackup` file,
   re-enter the (new) Master Password, then enter the **Vault Backup Password**.
5. Review the preview, choose **Full restore (replace)**, and re-enter the
   Master Password to confirm.
6. The vault locks after a full restore; log in again with the **restored**
   Master Password (the one from when the backup was made).

## Disaster checklist

- [ ] Master Password written down & stored offline (not on this machine)
- [ ] Recent `.drishtivaultbackup` file exists in offline storage
- [ ] Vault Backup Password written down & stored **separately** from the Master Password
- [ ] Both passwords tested (you can actually decrypt the backup)

## If everything is lost (no password, no backup)

The data cannot be recovered. This is the security guarantee working as
intended. Re-initialize the vault and re-enter credentials from their original
sources.
