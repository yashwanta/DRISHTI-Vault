// Package crypto implements DRISHTI-Vault's encryption and key management.
//
// This is a Go port of the verified Python crypto core (apps/api/app/crypto.py).
// The algorithm is IDENTICAL so behavior matches:
//
//   - Master password → Argon2id PHC verifier (stored, used only to confirm)
//   - Master password → Argon2id raw 32-byte KEK (key-encrypting key, in memory)
//   - random 32-byte DEK (data-encrypting key) wrapped with the KEK (AES-256-GCM)
//   - per-field encryption with the DEK (AES-256-GCM, fresh 96-bit nonce/value)
//
// Parameters mirror the Python vault: t=3, m=64MiB, p=4, 32-byte output.
// No custom crypto — only stdlib + golang.org/x/crypto/argon2 + AES-GCM.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"

	"golang.org/x/crypto/argon2"
)

// Argon2id parameters — MUST match the Python vault (crypto.py).
const (
	ArgonTime    = 3
	ArgonMemory  = 64 * 1024 // KiB
	ArgonThreads = 4
	KeyLen       = 32 // 256-bit
	NonceLen     = 12 // 96-bit AES-GCM nonce
)

// FieldTokenPrefix marks an encrypted field token ("v1:" + b64(nonce||ct)).
const FieldTokenPrefix = "v1:"

// GenSalt returns n cryptographically random bytes (default 16 = 128-bit).
func GenSalt(n int) ([]byte, error) {
	if n <= 0 {
		n = 16
	}
	out := make([]byte, n)
	if _, err := rand.Read(out); err != nil {
		return nil, err
	}
	return out, nil
}

// GenDEK returns a fresh 256-bit data-encrypting key.
func GenDEK() ([]byte, error) {
	dek := make([]byte, KeyLen)
	if _, err := rand.Read(dek); err != nil {
		return nil, err
	}
	return dek, nil
}

// DeriveKEK derives the 256-bit key-encrypting key from the master password.
// Uses Argon2id in raw-key mode with the same params as the Python vault.
func DeriveKEK(password string, salt []byte) []byte {
	return argon2.IDKey([]byte(password), salt, ArgonTime, ArgonMemory,
		ArgonThreads, KeyLen)
}

// WrapDEK encrypts the DEK with the KEK (AES-256-GCM). Returns nonce||ciphertext.
func WrapDEK(kek, dek []byte) ([]byte, error) {
	g, err := newGCM(kek)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, NonceLen)
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	ct := g.Seal(nil, nonce, dek, nil)
	out := append([]byte{}, nonce...)
	out = append(out, ct...)
	return out, nil
}

// UnwrapDEK decrypts a wrapped DEK. Errors on tamper / wrong key (GCM tag).
func UnwrapDEK(kek, wrapped []byte) ([]byte, error) {
	if len(wrapped) < NonceLen+1 {
		return nil, errors.New("invalid wrapped DEK")
	}
	g, err := newGCM(kek)
	if err != nil {
		return nil, err
	}
	nonce, ct := wrapped[:NonceLen], wrapped[NonceLen:]
	return g.Open(nil, nonce, ct, nil)
}

// EncryptField encrypts a secret field. Empty/nil plaintext -> "" (stored empty).
// Returns a self-describing token: FieldTokenPrefix + base64(nonce||ciphertext).
func EncryptField(dek []byte, plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	g, err := newGCM(dek)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, NonceLen)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	ct := g.Seal(nil, nonce, []byte(plaintext), nil)
	raw := append([]byte{}, nonce...)
	raw = append(raw, ct...)
	return FieldTokenPrefix + base64.StdEncoding.EncodeToString(raw), nil
}

// DecryptField decrypts a token produced by EncryptField. Empty -> "".
// Unknown/legacy markers return "" (never echo raw opaque bytes).
func DecryptField(dek []byte, token string) (string, error) {
	if token == "" {
		return "", nil
	}
	if len(token) < len(FieldTokenPrefix) || token[:len(FieldTokenPrefix)] != FieldTokenPrefix {
		return "", nil
	}
	raw, err := base64.StdEncoding.DecodeString(token[len(FieldTokenPrefix):])
	if err != nil {
		return "", err
	}
	if len(raw) < NonceLen+1 {
		return "", errors.New("invalid field token")
	}
	g, err := newGCM(dek)
	if err != nil {
		return "", err
	}
	nonce, ct := raw[:NonceLen], raw[NonceLen:]
	pt, err := g.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt field: %w", err)
	}
	return string(pt), nil
}

func newGCM(key []byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
