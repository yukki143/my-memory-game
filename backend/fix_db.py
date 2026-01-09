# backend/fix_db.py
import os
from dotenv import load_dotenv
from sqlalchemy import text
# app.database から engine をインポートすることで、
# database.py に書かれた URL 変換ロジックをそのまま利用できます。
from app.database import engine

load_dotenv()

def migrate():
    # engine.begin() を使うことで、ブロック終了時に自動で COMMIT または ROLLBACK されます。
    print(f"Connecting to database to migrate...")
    try:
        with engine.begin() as conn:
            # PostgreSQL 9.6以上であれば 'IF NOT EXISTS' が使用可能です。
            # これにより、カラムが既に存在してもエラー（例外）を投げずに無視されます。
            
            print("Checking 'is_official' column...")
            conn.execute(text(
                "ALTER TABLE memory_sets ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE;"
            ))
            
            print("Checking 'answer_time' column...")
            conn.execute(text(
                "ALTER TABLE memory_sets ADD COLUMN IF NOT EXISTS answer_time INTEGER DEFAULT 10;"
            ))
            
        print("🎉 Migration completed successfully.")
    except Exception as e:
        print(f"❌ Migration failed: {e}")

if __name__ == "__main__":
    migrate()