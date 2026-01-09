# backend/fix_db.py
import os
from sqlalchemy import text
from app.database import engine

def migrate():
    print("Connecting to database...")
    with engine.connect() as conn:
        # 1. is_official カラム
        try:
            conn.execute(text("ALTER TABLE memory_sets ADD COLUMN is_official BOOLEAN DEFAULT FALSE;"))
            conn.commit()
            print("✅ Added 'is_official' column.")
        except Exception as e:
            if "already exists" in str(e):
                print("ℹ️ 'is_official' column already exists.")
            else:
                print(f"❌ Error adding 'is_official': {e}")

        # 2. answer_time カラム
        try:
            conn.execute(text("ALTER TABLE memory_sets ADD COLUMN answer_time INTEGER DEFAULT 10;"))
            conn.commit()
            print("✅ Added 'answer_time' column.")
        except Exception as e:
            if "already exists" in str(e):
                print("ℹ️ 'answer_time' column already exists.")
            else:
                print(f"❌ Error adding 'answer_time': {e}")

        print("🎉 Migration completed.")

if __name__ == "__main__":
    migrate()