package crypto

import (
	"github.com/alexedwards/argon2id"
)

// Argon2id PHC parameters for the master-password verifier.
// These match the Python vault's PasswordHasher config (salt_len=16).
//
// NOTE: argon2id.Hash params must be expressible in a PHC string. We use
// memory=64MiB, iterations=3, parallelism=4, salt=16, key=32 — identical to
// the Python _ph settings.
var masterHashParams = &argon2id.Params{
	Memory:      ArgonMemory, // KiB; matches argon2-cffi memory_cost=65536
	Iterations:  ArgonTime,
	Parallelism: ArgonThreads,
	SaltLength:  16,
	KeyLength:   KeyLen,
}

// HashMasterPassword returns an Argon2id PHC-string verifier for the password.
func HashMasterPassword(password string) (string, error) {
	return argon2id.CreateHash(password, masterHashParams)
}

// VerifyMasterPassword checks a password against a PHC verifier.
// Returns (ok, err). ok=false (nil err) means mismatch.
func VerifyMasterPassword(phcHash, password string) (bool, error) {
	match, err := argon2id.ComparePasswordAndHash(password, phcHash)
	if err != nil {
		// Invalid/malformed hash -> treat as no match rather than a hard error,
		// matching the Python "return False on InvalidHashError" behavior.
		return false, nil
	}
	return match, nil
}

// NeedsRehash reports whether a stored verifier uses weaker params than current.
func NeedsRehash(phcHash string) bool {
	params, _, _, err := argon2id.DecodeHash(phcHash)
	if err != nil || params == nil {
		return true
	}
	return params.Memory != masterHashParams.Memory ||
		params.Iterations != masterHashParams.Iterations ||
		params.Parallelism != masterHashParams.Parallelism ||
		params.KeyLength != masterHashParams.KeyLength
}
