#!/bin/sh
set -e

echo "=================================================="
echo "🚀 Ahead Academy Backend Starting..."
echo "Node: $(node -v)"
echo "Python: $(python3 --version 2>&1)"
echo "Port: ${PORT:-8080}"
echo "DB Path: ${ATTENDANCE_DB_PATH:-/app/attendance.db}"
echo "=================================================="

# Ensure persistent database directory exists if ATTENDANCE_DB_PATH is specified
if [ -n "$ATTENDANCE_DB_PATH" ]; then
    DB_DIR=$(dirname "$ATTENDANCE_DB_PATH")
    if [ ! -d "$DB_DIR" ]; then
        echo "[Startup] Creating database directory: $DB_DIR"
        mkdir -p "$DB_DIR"
    fi
fi

# Hand execution over to node backend/server.js so Node is PID 1
exec node backend/server.js
