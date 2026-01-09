# backend/fix_db.py
import os
from dotenv import load_dotenv
from sqlalchemy import text
from app.database import engine

load_dotenv()

def migrate():
    print(f"Connecting to database to migrate...")
    try:
        with engine.connect() as conn:
            # is_official カラムの追加
            try:
                conn.execute(text("ALTER TABLE memory_sets ADD COLUMN is_official BOOLEAN DEFAULT FALSE;"))
                conn.commit()
                print("✅ Added 'is_official' column.")
            except Exception as e:
                print(f"ℹ️ 'is_official' column check: {e}")

            # answer_time カラムの追加
            try:
                conn.execute(text("ALTER TABLE memory_sets ADD COLUMN answer_time INTEGER DEFAULT 10;"))
                conn.commit()
                print("✅ Added 'answer_time' column.")
            except Exception as e:
                print(f"ℹ️ 'answer_time' column check: {e}")

            print("🎉 Migration completed successfully.")
    except Exception as e:
        print(f"❌ Migration failed: {e}")

if __name__ == "__main__":
    migrate()