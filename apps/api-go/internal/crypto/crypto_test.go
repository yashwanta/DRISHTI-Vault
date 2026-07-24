package crypto

import (
	"bytes"
	"strings"
	"testing"
)

func TestDEKWrapUnwrap(t *testing.T) {
	pw := "correct horse battery staple"
	salt, err := GenSalt(16)
	if err != nil {
		t.Fatal(err)
	}
	kek := DeriveKEK(pw, salt)
	dek, err := GenDEK()
	if err != nil {
		t.Fatal(err)
	}
	wrapped, err := WrapDEK(kek, dek)
	if err != nil {
		t.Fatal(err)
	}
	dek2, err := UnwrapDEK(kek, wrapped)
	if err != nil {
		t.Fatalf("unwrap: %v", err)
	}
	if !bytes.Equal(dek, dek2) {
		t.Fatal("DEK wrap/unwrap mismatch")
	}

	// wrong KEK must fail to unwrap
	wrongKEK := DeriveKEK("wrong password", salt)
	if _, err := UnwrapDEK(wrongKEK, wrapped); err == nil {
		t.Fatal("unwrap with wrong KEK must fail")
	}
}

func TestMasterPasswordVerify(t *testing.T) {
	pw := "correct horse battery staple"
	phc, err := HashMasterPassword(pw)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(phc, "$argon2id$") {
		t.Fatalf("verifier is not an argon2id PHC string: %s", phc)
	}
	ok, err := VerifyMasterPassword(phc, pw)
	if err != nil || !ok {
		t.Fatal("correct password failed verify")
	}
	ok, _ = VerifyMasterPassword(phc, "definitely-wrong")
	if ok {
		t.Fatal("wrong password incorrectly verified")
	}
	// malformed verifier -> false, no error (matches Python behavior)
	ok, err = VerifyMasterPassword("not-a-hash", pw)
	if ok || err != nil {
		t.Fatalf("malformed verifier should return (false,nil), got (%v,%v)", ok, err)
	}
}

func TestFieldEncryptDecrypt(t *testing.T) {
	dek, _ := GenDEK()
	secret := "super-secret-password-123"
	tok, err := EncryptField(dek, secret)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(tok, FieldTokenPrefix) {
		t.Fatalf("token missing prefix: %s", tok)
	}
	// ciphertext must NOT contain plaintext
	if strings.Contains(tok, secret) {
		t.Fatal("plaintext leaked into token")
	}
	dec, err := DecryptField(dek, tok)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if dec != secret {
		t.Fatalf("round-trip mismatch: got %q want %q", dec, secret)
	}

	// empty input -> empty token
	tok, _ = EncryptField(dek, "")
	if tok != "" {
		t.Fatal("empty plaintext must produce empty token")
	}
	dec, _ = DecryptField(dek, "")
	if dec != "" {
		t.Fatal("empty token must decrypt to empty")
	}
}

func TestFieldTamperRejection(t *testing.T) {
	dek, _ := GenDEK()
	tok, _ := EncryptField(dek, "tamper-test-secret")
	// flip a byte in the base64 payload
	bad := tok[:len(tok)-1]
	last := tok[len(tok)-1]
	if last == 'A' {
		bad += "B"
	} else {
		bad += "A"
	}
	if _, err := DecryptField(dek, bad); err == nil {
		t.Fatal("tampered token must fail to decrypt")
	}
}

func TestWrongDEKRejectsField(t *testing.T) {
	dek1, _ := GenDEK()
	dek2, _ := GenDEK()
	tok, _ := EncryptField(dek1, "only-dek1-can-read")
	if _, err := DecryptField(dek2, tok); err == nil {
		t.Fatal("decrypt with wrong DEK must fail")
	}
}
