# backend/fix_db.py
import os
from sqlalchemy import text
from app.database import engine

def migrate():
    with engine.connect() as conn:
        # PostgreSQL の「既にカラムがあれば何もしない」書き方
        conn.execute(text("ALTER TABLE memory_sets ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE memory_sets ADD COLUMN IF NOT EXISTS answer_time INTEGER DEFAULT 10;"))
        conn.commit()
        print("✅ Migration success")

if __name__ == "__main__":
    migrate()