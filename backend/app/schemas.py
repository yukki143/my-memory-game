# backend/app/schemas.py
from pydantic import BaseModel
from typing import List, Optional

# --- 単語データ ---
class WordItem(BaseModel):
    text: str
    kana: str = ""

# --- メモリーセット ---
class MemorySetBase(BaseModel):
    title: str
    words: List[WordItem]
    memorize_time: int = 3
    questions_per_round: int = 1
    win_score: int = 10
    condition_type: str = "score"
    order_type: str = "random"

class MemorySetCreate(MemorySetBase):
    pass

class MemorySetResponse(MemorySetBase):
    id: int
    owner_id: int
    
    class Config:
        from_attributes = True

# --- ユーザー ---
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    memory_sets: List[MemorySetResponse] = []
    class Config:
        from_attributes = True

# --- ログイン用 ---
class Token(BaseModel):
    access_token: str
    token_type: str

# ★追加: ランキング用スキーマ
class RankEntry(BaseModel):
    name: str
    time: float
    set_id: str
    win_score: int
    condition_type: str
    
    class Config:
        from_attributes = True