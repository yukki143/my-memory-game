# backend/fix_db.py
import os
from dotenv import load_dotenv
from sqlalchemy import text
from app.database import engine

load_dotenv()

def migrate():
    print(f"Connecting to database to migrate...")
    try:
        with engine.begin() as conn:
            # --- memory_sets テーブルの修正 ---
            print("Checking 'memory_sets' columns...")
            conn.execute(text(
                "ALTER TABLE memory_sets ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE;"
            ))
            conn.execute(text(
                "ALTER TABLE memory_sets ADD COLUMN IF NOT EXISTS answer_time INTEGER DEFAULT 10;"
            ))
            
            # --- rankings テーブルの修正 (今回追加したロジック) ---
            print("Checking 'rankings' columns...")
            # エラーの原因である 'name' カラムを追加
            conn.execute(text(
                "ALTER TABLE rankings ADD COLUMN IF NOT EXISTS name VARCHAR;"
            ))
            # 他のカラムも念のため存在を確認し、なければ追加
            conn.execute(text(
                "ALTER TABLE rankings ADD COLUMN IF NOT EXISTS time FLOAT;"
            ))
            conn.execute(text(
                "ALTER TABLE rankings ADD COLUMN IF NOT EXISTS set_id VARCHAR;"
            ))
            conn.execute(text(
                "ALTER TABLE rankings ADD COLUMN IF NOT EXISTS win_score INTEGER;"
            ))
            conn.execute(text(
                "ALTER TABLE rankings ADD COLUMN IF NOT EXISTS condition_type VARCHAR;"
            ))
            
        print("🎉 Migration completed successfully.")
    except Exception as e:
        print(f"❌ Migration failed: {e}")

if __name__ == "__main__":
    migrate()