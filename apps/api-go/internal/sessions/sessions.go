package sessions

import (
	"crypto/rand"
	"encoding/base64"
	"sync"
	"time"
)

type Session struct {
	ID, Username, Role             string
	UserID                         int64
	DEK                            []byte
	Created, LastSeen, RevealUntil time.Time
}
type Store struct {
	mu    sync.Mutex
	items map[string]*Session
	idle  time.Duration
}

func New(idleMinutes int) *Store {
	return &Store{items: map[string]*Session{}, idle: time.Duration(idleMinutes) * time.Minute}
}
func (s *Store) Create(username string, userID int64, role string, dek []byte) *Session {
	raw := make([]byte, 32)
	_, _ = rand.Read(raw)
	now := time.Now()
	x := &Session{ID: base64.RawURLEncoding.EncodeToString(raw), Username: username,
		UserID: userID, Role: role, DEK: append([]byte(nil), dek...), Created: now, LastSeen: now}
	s.mu.Lock()
	s.items[x.ID] = x
	s.mu.Unlock()
	return x
}
func (s *Store) Get(id string) *Session {
	if id == "" {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	x := s.items[id]
	if x == nil {
		return nil
	}
	if time.Since(x.LastSeen) > s.idle {
		s.wipeLocked(id)
		return nil
	}
	x.LastSeen = time.Now()
	return x
}
func (s *Store) Lock(id string) { s.mu.Lock(); defer s.mu.Unlock(); s.wipeLocked(id) }
func (s *Store) OpenReveal(id string, ttl int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if x := s.items[id]; x != nil {
		x.RevealUntil = time.Now().Add(time.Duration(ttl) * time.Second)
	}
}
func (s *Store) RevealOpen(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	x := s.items[id]
	return x != nil && time.Now().Before(x.RevealUntil)
}
func (s *Store) wipeLocked(id string) {
	if x := s.items[id]; x != nil {
		for i := range x.DEK {
			x.DEK[i] = 0
		}
		delete(s.items, id)
	}
}
