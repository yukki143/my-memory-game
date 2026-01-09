# backend/fix_db.py
import os
from dotenv import load_dotenv
from sqlalchemy import text
from app.database import engine

# .envファイルを明示的に読み込む
load_dotenv()

def migrate():
    print(f"Connecting to: {engine.url}")
    try:
        with engine.connect() as conn:
            # カラムを追加するSQL
            conn.execute(text("ALTER TABLE memory_sets ADD COLUMN is_official BOOLEAN DEFAULT FALSE;"))
            conn.commit()
            print("✅ Successfully added 'is_official' column to 'memory_sets' table.")
    except Exception as e:
        if "already exists" in str(e):
            print("ℹ️ Column 'is_official' already exists. Skipping.")
        else:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    migrate()