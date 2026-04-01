#!/bin/bash

echo "Ensuring database tables exist..."
# Create tables from SQLAlchemy models (idempotent - safe to run always)
for i in {1..5}; do
    if python -c "
from models import Base, get_engine
engine = get_engine()
Base.metadata.create_all(bind=engine)
print('Tables ensured')
"; then
        echo "Tables ready"
        break
    else
        echo "Table creation attempt $i failed, retrying in 3s..."
        sleep 3
    fi
done

echo "Running database migrations..."
# Stamp head if alembic has no version yet (fresh DB), then upgrade
python -c "
from sqlalchemy import text
from models import get_engine
engine = get_engine()
with engine.connect() as conn:
    result = conn.execute(text(\"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alembic_version')\"))
    exists = result.scalar()
    if not exists:
        print('FRESH_DB')
    else:
        result = conn.execute(text('SELECT version_num FROM alembic_version'))
        row = result.first()
        if row is None:
            print('FRESH_DB')
        else:
            print('HAS_MIGRATIONS')
" > /tmp/db_state.txt 2>/dev/null

DB_STATE=$(cat /tmp/db_state.txt 2>/dev/null)

if [ "$DB_STATE" = "FRESH_DB" ]; then
    echo "Fresh database detected, stamping alembic head..."
    alembic stamp head
fi

# Run any pending migrations
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
