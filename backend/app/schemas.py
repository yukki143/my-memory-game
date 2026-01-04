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
    # ★追加: 出題順序の設定
    order_type: str = "random"

class MemorySetCreate(MemorySetBase):
    pass

class MemorySetResponse(MemorySetBase):
    id: int
    owner_id: int
    
    class Config:
        #orm_mode = True
        from_attributes = True  # <-- これに変更

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