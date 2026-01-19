#!/bin/bash

echo "Running database migrations..."
# Intentar migraciones con reintentos (DB puede no estar lista)
for i in {1..5}; do
    if alembic upgrade head; then
        echo "Migrations completed successfully"
        break
    else
        echo "Migration attempt $i failed, retrying in 3s..."
        sleep 3
    fi
done

echo "Starting API server..."
exec uvicorn app:app --host 0.0.0.0 --port 3000
