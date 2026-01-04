# backend/app/models.py
from sqlalchemy import Column, Integer, String, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from .database import Base
from sqlalchemy.dialects.postgresql import JSONB

# ユーザーテーブル
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True) # ログイン名
    hashed_password = Column(String) # 暗号化されたパスワード

    # リレーション: ユーザーは複数のメモリーセットを持つ
    memory_sets = relationship("MemorySet", back_populates="owner")

# メモリーセットテーブル
class MemorySet(Base):
    __tablename__ = "memory_sets"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    words_json = Column(Text) 

    # セットごとのゲーム設定
    memorize_time = Column(Integer, default=3)
    questions_per_round = Column(Integer, default=1)
    win_score = Column(Integer, default=10)
    condition_type = Column(String, default="score")
    
    # 出題順序 (random: ランダム / review: 苦手優先 / sequential: 順番)
    order_type = Column(String, default="random") 

    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="memory_sets")

# ★追加: ランキングテーブル
class Ranking(Base):
    __tablename__ = "rankings"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    time = Column(Float)
    set_id = Column(String, index=True)
    win_score = Column(Integer)
    condition_type = Column(String)