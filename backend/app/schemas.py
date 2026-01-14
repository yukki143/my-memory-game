# backend/app/schemas.py
from pydantic import BaseModel
from typing import List, Optional

# --- 単語データ ---
class WordItem(BaseModel):
    """個別の単語データ"""
    text: str
    kana: str = ""

# --- メモリーセット ---
class MemorySetBase(BaseModel):
    """メモリーセットの基本構造"""
    title: str
    words: List[WordItem]
    memorize_time: int = 3
    answer_time: int = 10 
    questions_per_round: int = 1
    is_public: bool = False
    win_score: int = 10
    condition_type: str = "score" # 'score' (正解数) または 'total' (出題数)
    order_type: str = "random"    # 'random', 'review' (苦手優先), 'sequential'
    is_official: bool = False 
    is_public: bool = False

class MemorySetCreate(MemorySetBase):
    """メモリーセット作成用"""
    pass

class MemorySetResponse(MemorySetBase):
    """メモリーセット取得レスポンス用"""
    id: int
    owner_id: Optional[int] = None 
    
    class Config:
        from_attributes = True

# --- ユーザー ---
class UserBase(BaseModel):
    """ユーザー情報の基本構造"""
    username: str

class UserCreate(UserBase):
    """ユーザー登録用"""
    password: str

class UserResponse(UserBase):
    """ユーザー情報取得レスポンス用"""
    id: int
    memory_sets: List[MemorySetResponse] = []
    class Config:
        from_attributes = True

# --- ログイン用 ---
class Token(BaseModel):
    """認証トークン用"""
    access_token: str
    token_type: str

# --- ランキング用 ---
class RankEntry(BaseModel):
    """ランキングエントリー用。新しい評価指標を含みます"""
    name: str
    time: float        # クリアまでの総タイム
    set_id: str        # 対象のメモリーセットID
    win_score: int     # クリア条件となる目標値
    condition_type: str # 終了条件 ('score' または 'total')
    accuracy: float    # 暗記正答率: 一発で答えられた割合
    avg_speed: float   # 1問あたりの平均回答速度
    
    class Config:
        from_attributes = True