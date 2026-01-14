# backend/app/models.py
from sqlalchemy import Column, Integer, String, ForeignKey, Text, Float, Boolean, DateTime, func
from sqlalchemy.orm import relationship
from .database import Base

# ユーザーテーブル
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True) # ログイン名
    hashed_password = Column(String) # 暗号化されたパスワード

    # リレーション: ユーザーは複数のメモリーセットを持つ
    memory_sets = relationship("MemorySet", back_populates="owner")
    # ユーザーは複数の単語統計を持つ
    word_stats = relationship("UserWordStat", back_populates="user")

# メモリーセットテーブル
class MemorySet(Base):
    __tablename__ = "memory_sets"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    words_json = Column(Text) 

    # セットごとのゲーム設定
    memorize_time = Column(Integer, default=3)
    answer_time = Column(Integer, default=10)
    questions_per_round = Column(Integer, default=1)
    win_score = Column(Integer, default=10)
    condition_type = Column(String, default="score")
    
    # 出題順序 (random: ランダム / review: 苦手優先 / sequential: 順番)
    order_type = Column(String, default="random") 

    # 公式セット判定フラグ
    is_official = Column(Boolean, default=False)

    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True) # 公式セットは owner_id が Null を許容
    owner = relationship("User", back_populates="memory_sets")

# 単語ごとの正誤回数を記録するテーブル
class UserWordStat(Base):
    __tablename__ = "user_word_stats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    word_text = Column(String, index=True)
    correct_count = Column(Integer, default=0)
    miss_count = Column(Integer, default=0)
    last_attempt_at = Column(DateTime, default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="word_stats")

# ランキングテーブル
class Ranking(Base):
    __tablename__ = "rankings"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    set_id = Column(String, index=True)
    win_score = Column(Integer)
    condition_type = Column(String)
    
    # 評価指標
    time = Column(Float)            # 総クリアタイム
    accuracy = Column(Float)        # 暗記正答率 (%)
    avg_speed = Column(Float)       # 1問あたりの平均回答速度 (秒)
    
    # 同点判定用 (新しい記録を優先)
    created_at = Column(DateTime, default=func.now())

# 成績テーブル
class PlaySession(Base):
    __tablename__ = "play_sessions"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    mode = Column(String, index=True, nullable=False)  # solo / battle / typing
    set_id = Column(String, index=True, nullable=False)
    created_at = Column(DateTime, default=func.now(), index=True)

    # 成長表示用の基本指標
    time = Column(Float, nullable=True)          # 総クリアタイム（ソロ中心）
    accuracy = Column(Float, default=0.0)        # %（0-100想定）
    avg_speed = Column(Float, nullable=True)     # 1問あたり秒など（既存 ranking と合わせる）
    total_questions = Column(Integer, default=0)

    # battle 向け（nullable）
    result = Column(String, nullable=True)       # win/lose/draw
    score_for = Column(Integer, nullable=True)
    score_against = Column(Integer, nullable=True)
    opponent_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    room_id = Column(String, nullable=True)

    # ★重要：同一 user_id+mode+set_id の何回目か
    attempt_index = Column(Integer, default=1, nullable=False)

    # 1:1 集計
    aggregate = relationship(
        "SessionAggregate",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan"
    )


class SessionAggregate(Base):
    """1セッション内の集計ログ（全文ではなく集計のみを保存）"""
    __tablename__ = "session_aggregates"

    # 1:1 なので session_id を PK にする
    session_id = Column(Integer, ForeignKey("play_sessions.id", ondelete="CASCADE"), primary_key=True)

    # Postgresでも今回は TEXT（JSON文字列）で保存（fix_db.py と一致）
    length_bucket_stats = Column(Text, default="{}")
    wrong_chars_by_length_bucket = Column(Text, default="{}")
    char_type_stats = Column(Text, default="{}")

    session = relationship("PlaySession", back_populates="aggregate")