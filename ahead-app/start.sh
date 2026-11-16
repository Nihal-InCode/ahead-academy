#!/bin/sh
set -e

echo "=================================================="
echo "🚀 Ahead Academy Backend Starting..."
echo "Node: $(node -v)"
echo "Python: $(python3 --version 2>&1)"
echo "Port: ${PORT:-8080}"
echo "DB Path: ${ATTENDANCE_DB_PATH:-/app/attendance.db}"
echo "=================================================="

# Ensure persistent database directory exists with full read/write permissions
if [ -n "$ATTENDANCE_DB_PATH" ]; then
    DB_DIR=$(dirname "$ATTENDANCE_DB_PATH")
    if [ ! -d "$DB_DIR" ]; then
        echo "[Startup] Creating database directory: $DB_DIR"
        mkdir -p "$DB_DIR"
    fi
    chmod 777 "$DB_DIR" 2>/dev/null || true
    if [ -f "$ATTENDANCE_DB_PATH" ]; then
        chmod 666 "$ATTENDANCE_DB_PATH" 2>/dev/null || true
    fi
fi

# Ensure bundled db is writable
chmod 666 /app/attendance.db 2>/dev/null || true

exec node backend/server.js
