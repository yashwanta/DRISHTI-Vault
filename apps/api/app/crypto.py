"""Encryption & key management for DRISHTI-Vault.

Design (no custom crypto — uses argon2-cffi and cryptography only):

  Master password  ──Argon2id──►  KEK  (key-encrypting key, never stored)
                                       │
                       random DEK ──AES-256-GCM──►  wrapped_DEK  (stored)
                       (data-encrypting key)            ^^^^^^^^^^
                                                        safe at rest
                          │
                          └──► AES-256-GCM ──► field-level ciphertext for
                                              every secret field

Why wrap the DEK instead of deriving field keys directly from the password:
  * Changing the master password only re-wraps one DEK (fast, no row re-encrypt).
  * The verifier hash and the encryption path are independent: leaking the
    Argon2id verifier does NOT help decrypt rows; the password is still needed.

Master-password verifier:
  We store an Argon2id hash of the password (argon2-cffi, PHC string). This is
  used ONLY to verify the password is correct before deriving the KEK. It is
  never used as a key.

Constant-time comparison is handled inside argon2-cffi.
"""
from __future__ import annotations

import base64
import hmac
import secrets

from argon2 import PasswordHasher, Type
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


# ---- Argon2id parameters ----------------------------------------------------
# Memory-hard, tuned for a local single-user vault on a modern machine.
# ~64 MiB, 3 lanes, independent salt per vault. OWASP-aligned.
_ARGON2_TIME_COST = 3
_ARGON2_MEMORY_KIB = 64 * 1024
_ARGON2_PARALLELISM = 4
_ARGON2_HASHLEN = 32  # 256-bit verifier / KEK material

_ph = PasswordHasher(
    time_cost=_ARGON2_TIME_COST,
    memory_cost=_ARGON2_MEMORY_KIB,
    parallelism=_ARGON2_PARALLELISM,
    hash_len=_ARGON2_HASHLEN,
    salt_len=16,
    type=Type.ID,
)


# ---- Envelope helpers -------------------------------------------------------
def gen_salt(nbytes: int = 16) -> bytes:
    """Cryptographically random salt (128-bit default)."""
    return secrets.token_bytes(nbytes)


def gen_dek() -> bytes:
    """Fresh 256-bit data-encrypting key."""
    return AESGCM.generate_key(bit_length=256)


def hash_master_password(password: str) -> str:
    """Return an Argon2id PHC-string verifier for the master password."""
    return _ph.hash(password)


def verify_master_password(phc_hash: str, password: str) -> bool:
    """Constant-time verify (argon2-cffi). Returns True/False."""
    try:
        return _ph.verify(phc_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def needs_rehash(phc_hash: str) -> bool:
    """True if the stored verifier uses weaker params than current."""
    try:
        return _ph.check_needs_rehash(phc_hash)
    except InvalidHashError:
        return True


def derive_kek(password: str, salt: bytes) -> bytes:
    """Derive the 256-bit key-encrypting key from the master password.

    Uses Argon2id in raw-key derivation mode. The verifier hash (a different
    Argon2id computation with its own random salt) is NOT used here, so the
    two purposes stay independent.
    """
    from argon2.low_level import hash_secret_raw, Type as _Type

    return hash_secret_raw(
        secret=password.encode("utf-8"),
        salt=salt,
        time_cost=_ARGON2_TIME_COST,
        memory_cost=_ARGON2_MEMORY_KIB,
        parallelism=_ARGON2_PARALLELISM,
        hash_len=_ARGON2_HASHLEN,
        type=_Type.ID,
    )


def wrap_dek(kek: bytes, dek: bytes) -> bytes:
    """Encrypt the DEK with the KEK (AES-256-GCM). Returns nonce||ciphertext."""
    aesgcm = AESGCM(kek)
    nonce = secrets.token_bytes(12)
    ct = aesgcm.encrypt(nonce, dek, None)
    return nonce + ct


def unwrap_dek(kek: bytes, wrapped: bytes) -> bytes:
    """Decrypt the DEK. Raises on tamper/wrong key (GCM tag check)."""
    if len(wrapped) < 13:
        raise ValueError("invalid wrapped DEK")
    nonce, ct = wrapped[:12], wrapped[12:]
    return AESGCM(kek).decrypt(nonce, ct, None)


def encrypt_field(dek: bytes, plaintext) -> str:
    """Encrypt a secret field. None/empty -> stored as empty marker.

    Returns a self-describing token:  "v1:" + b64(nonce||ciphertext).
    """
    if plaintext is None:
        plaintext = ""
    if not isinstance(plaintext, str):
        plaintext = str(plaintext)
    if plaintext == "":
        return ""
    aesgcm = AESGCM(dek)
    nonce = secrets.token_bytes(12)
    ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return "v1:" + base64.b64encode(nonce + ct).decode("ascii")


def decrypt_field(dek: bytes, token: str | None) -> str:
    """Decrypt a field produced by encrypt_field. Empty -> ''."""
    if not token:
        return ""
    if not token.startswith("v1:"):
        # Unknown/legacy marker — treat as opaque, never echo raw secrets.
        return ""
    raw = base64.b64decode(token[3:])
    nonce, ct = raw[:12], raw[12:]
    return AESGCM(dek).decrypt(nonce, ct, None).decode("utf-8")


def constant_time_eq(a: bytes, b: bytes) -> bool:
    return hmac.compare_digest(a, b)
