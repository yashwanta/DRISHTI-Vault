//go:build !windows && !linux

package database

import _ "modernc.org/sqlite"

const driverName = "sqlite"
