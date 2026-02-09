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
            # --- 1. memory_sets テーブルの修正 ---
            print("Checking 'memory_sets' columns...")
            conn.execute(text(
                "ALTER TABLE memory_sets ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE;"
            ))
            conn.execute(text(
                "ALTER TABLE memory_sets ADD COLUMN IF NOT EXISTS answer_time INTEGER DEFAULT 10;"
            ))
            
            # --- 2. rankings テーブルの修正 (新しい評価指標の追加) ---
            print("Checking 'rankings' columns for evaluation metrics...")
            # 基本カラム
            conn.execute(text("ALTER TABLE rankings ADD COLUMN IF NOT EXISTS name VARCHAR;"))
            conn.execute(text("ALTER TABLE rankings ADD COLUMN IF NOT EXISTS time FLOAT;"))
            conn.execute(text("ALTER TABLE rankings ADD COLUMN IF NOT EXISTS set_id VARCHAR;"))
            conn.execute(text("ALTER TABLE rankings ADD COLUMN IF NOT EXISTS win_score INTEGER;"))
            conn.execute(text("ALTER TABLE rankings ADD COLUMN IF NOT EXISTS condition_type VARCHAR;"))
            
            # 新規追加の評価指標 (デフォルト値を0に設定)
            conn.execute(text(
                "ALTER TABLE rankings ADD COLUMN IF NOT EXISTS accuracy FLOAT DEFAULT 0.0;"
            ))
            conn.execute(text(
                "ALTER TABLE rankings ADD COLUMN IF NOT EXISTS avg_speed FLOAT DEFAULT 0.0;"
            ))
            conn.execute(text(
                "ALTER TABLE rankings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"
            ))
            
            # --- 3. user_word_stats テーブルの作成 (苦手優先/戦績用) ---
            print("Checking 'user_word_stats' table...")
            # PostgreSQL/SQLite 両対応のシンプルなDDL
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS user_word_stats (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id),
                    word_text VARCHAR,
                    correct_count INTEGER DEFAULT 0,
                    miss_count INTEGER DEFAULT 0,
                    last_attempt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))

            # --- 4. play_sessions / session_aggregates ---
            print("Checking 'play_sessions' and 'session_aggregates' tables...")

            # play_sessions（1プレイの要約）
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

            # 統計検索を高速化するためのインデックス
            print("Creating indexes for stats performance...")
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_play_sessions_user_id ON play_sessions (user_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_play_sessions_mode ON play_sessions (mode);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_play_sessions_set_id ON play_sessions (set_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_play_sessions_created_at ON play_sessions (created_at);"))

            # 「90%到達回数」などで user+mode+set の検索が多いので複合INDEXを推奨
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_play_sessions_user_mode_set ON play_sessions (user_id, mode, set_id);"))

            # session_aggregates（セッション内の集計JSON）
            # JSON型はDB差があるので TEXT で保存（SQLite/Postgres両対応しやすい）
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS session_aggregates (
                    session_id INTEGER PRIMARY KEY REFERENCES play_sessions(id) ON DELETE CASCADE,
                    length_bucket_stats TEXT,
                    wrong_chars_by_length_bucket TEXT,
                    char_type_stats TEXT
                );
            """))

            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_session_aggregates_session_id ON session_aggregates (session_id);"))


            # インデックスの作成 (検索高速化のため)
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_word_stats_user_id ON user_word_stats (user_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_word_stats_word_text ON user_word_stats (word_text);"))
            
        print("🎉 Migration completed successfully. Data preserved.")
    except Exception as e:
        print(f"❌ Migration failed: {e}")

if __name__ == "__main__":
    migrate()