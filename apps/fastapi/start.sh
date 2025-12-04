#!/bin/bash
# Startup script for FastAPI on Render
# Render provides PORT environment variable automatically

PORT=${PORT:-8000}
HOST=${HOST:-0.0.0.0}

echo "Starting FastAPI server on ${HOST}:${PORT}"

# Use uvicorn with proper configuration for production
uvicorn main:app \
  --host "${HOST}" \
  --port "${PORT}" \
  --workers 1 \
  --timeout-keep-alive 75 \
  --timeout-graceful-shutdown 10 \
  --log-level info

