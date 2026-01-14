# backend/app/schemas.py
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime

# --- 単語データ ---
class WordItem(BaseModel):
    text: str
    kana: str = ""

# --- メモリーセット ---
class MemorySetBase(BaseModel):
    title: str
    words: List[WordItem]
    memorize_time: int = 3
    answer_time: int = 10
    questions_per_round: int = 1
    win_score: int = 10
    condition_type: str = "score"
    order_type: str = "random"
    is_official: bool = False

class MemorySetCreate(MemorySetBase):
    pass

class MemorySetResponse(MemorySetBase):
    id: int
    owner_id: Optional[int] = None
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

# --- ランキング用 ---
class RankEntry(BaseModel):
    name: str
    time: float
    set_id: str
    win_score: int
    condition_type: str
    accuracy: float
    avg_speed: float
    class Config:
        from_attributes = True


# ==========================
#  Stats（成績）Schemas
# ==========================

class SessionAggregates(BaseModel):
    length_bucket_stats: Dict[str, Dict[str, int]] = {}
    wrong_chars_by_length_bucket: Dict[str, Dict[str, int]] = {}
    char_type_stats: Dict[str, Dict[str, int]] = {}

class PlaySessionCreate(BaseModel):
    mode: str               # "solo" / "battle" / "overall" / "typing"
    set_id: str
    time: Optional[float] = None
    accuracy: float = 0.0
    avg_speed: Optional[float] = None
    total_questions: int = 0

    # battle向け（将来拡張込み）
    result: Optional[str] = None
    score_for: Optional[int] = None
    score_against: Optional[int] = None
    opponent_user_id: Optional[int] = None
    room_id: Optional[str] = None

    aggregates: SessionAggregates

class PlaySessionResponse(BaseModel):
    id: int
    user_id: int
    mode: str
    set_id: str
    created_at: datetime

    time: Optional[float] = None
    accuracy: float = 0.0
    avg_speed: Optional[float] = None
    total_questions: int = 0

    result: Optional[str] = None
    score_for: Optional[int] = None
    score_against: Optional[int] = None
    opponent_user_id: Optional[int] = None
    room_id: Optional[str] = None

    attempt_index: int
    aggregates: Optional[SessionAggregates] = None

class StatsSeriesPoint(BaseModel):
    created_at: datetime
    attempt_index: int
    time: Optional[float] = None
    accuracy: float = 0.0
    avg_speed: Optional[float] = None

class StatsSetSummary(BaseModel):
    set_id: str
    play_count: int

    best_accuracy: Optional[float] = None
    avg_accuracy: Optional[float] = None
    median_accuracy: Optional[float] = None
    stdev_accuracy: Optional[float] = None

    best_time: Optional[float] = None
    avg_time: Optional[float] = None
    median_time: Optional[float] = None

    avg_speed: Optional[float] = None

class RequiredAttemptsItem(BaseModel):
    set_id: str
    required_attempts_90: Optional[int] = None
    ratio_vs_avg: Optional[float] = None

class StatsResponse(BaseModel):
    sessions: List[StatsSeriesPoint] = []
    set_summaries: List[StatsSetSummary] = []
    required_attempts_avg: Optional[float] = None
    required_attempts_by_set: List[RequiredAttemptsItem] = []

class LengthBucketItem(BaseModel):
    bucket: str
    total: int
    incorrect: int
    miss_rate: float

class LengthStatsResponse(BaseModel):
    buckets: List[LengthBucketItem] = []

class WrongCharItem(BaseModel):
    char: str
    count: int

class WrongCharsResponse(BaseModel):
    bucket: str
    top: List[WrongCharItem] = []

class RadarResponse(BaseModel):
    roman: float = 0.0
    digit: float = 0.0
    kanji: float = 0.0
    hiragana: float = 0.0
    symbol: float = 0.0
