# backend/fix_db.py
import os
from dotenv import load_dotenv
from sqlalchemy import text
# Base と engine をインポート
from app.database import engine, Base
# モデルをインポートすることで、Base.metadata.create_all がテーブル構造を把握できるようにします
from app.models import User, MemorySet, UserWordStat, Ranking

load_dotenv()

def migrate():
    print(f"Connecting to database to migrate...")
    try:
        # --- 0. テーブルの新規作成 ---
        # models.py に定義されているテーブルがなければ作成します
        print("Creating tables defined in models.py...")
        Base.metadata.create_all(bind=engine)
        print("Base tables created or already exist.")

        with engine.begin() as conn:
            # --- 1. memory_sets テーブルの修正 ---
            # すでに作成されているはずですが、カラムの不足がないか念のため確認します
            print("Checking 'memory_sets' columns...")
            conn.execute(text(
                "ALTER TABLE memory_sets ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE;"
            ))
            conn.execute(text(
                "ALTER TABLE memory_sets ADD COLUMN IF NOT EXISTS answer_time INTEGER DEFAULT 10;"
            ))
            
            # --- 2. rankings テーブルの修正 ---
            print("Checking 'rankings' columns for evaluation metrics...")
            conn.execute(text("ALTER TABLE rankings ADD COLUMN IF NOT EXISTS name VARCHAR;"))
            conn.execute(text("ALTER TABLE rankings ADD COLUMN IF NOT EXISTS time FLOAT;"))
            conn.execute(text("ALTER TABLE rankings ADD COLUMN IF NOT EXISTS set_id VARCHAR;"))
            conn.execute(text("ALTER TABLE rankings ADD COLUMN IF NOT EXISTS win_score INTEGER;"))
            conn.execute(text("ALTER TABLE rankings ADD COLUMN IF NOT EXISTS condition_type VARCHAR;"))
            
            conn.execute(text(
                "ALTER TABLE rankings ADD COLUMN IF NOT EXISTS accuracy FLOAT DEFAULT 0.0;"
            ))
            conn.execute(text(
                "ALTER TABLE rankings ADD COLUMN IF NOT EXISTS avg_speed FLOAT DEFAULT 0.0;"
            ))
            conn.execute(text(
                "ALTER TABLE rankings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"
            ))
            
            # --- 3. models.py に含まれていないテーブルの作成 ---
            # play_sessions などは現在の models.py に定義がないため、SQLで直接作成します
            print("Checking additional tables (play_sessions, etc.)...")
            
            # play_sessions
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS play_sessions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    mode VARCHAR NOT NULL,
                    set_id VARCHAR NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    time FLOAT,
                    accuracy FLOAT DEFAULT 0.0,
                    avg_speed FLOAT,
                    total_questions INTEGER DEFAULT 0,
                    result VARCHAR,
                    score_for INTEGER,
                    score_against INTEGER,
                    opponent_user_id INTEGER REFERENCES users(id),
                    room_id VARCHAR,
                    attempt_index INTEGER DEFAULT 1
                );
            """))

            # インデックスの作成
            print("Creating indexes for stats performance...")
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_play_sessions_user_id ON play_sessions (user_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_play_sessions_mode ON play_sessions (mode);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_play_sessions_set_id ON play_sessions (set_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_play_sessions_created_at ON play_sessions (created_at);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_play_sessions_user_mode_set ON play_sessions (user_id, mode, set_id);"))

            # session_aggregates
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS session_aggregates (
                    session_id INTEGER PRIMARY KEY REFERENCES play_sessions(id) ON DELETE CASCADE,
                    length_bucket_stats TEXT,
                    wrong_chars_by_length_bucket TEXT,
                    char_type_stats TEXT
                );
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_session_aggregates_session_id ON session_aggregates (session_id);"))

        print("🎉 Migration completed successfully. New database is ready.")
    except Exception as e:
        print(f"❌ Migration failed: {e}")

if __name__ == "__main__":
    migrate()