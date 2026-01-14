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
    is_public = Column(Boolean, default=False)
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