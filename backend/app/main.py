# backend/app/main.py
import asyncio
import os
import json
import random
import uuid
from typing import List, Dict, Optional, Set
from datetime import timedelta, datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from dotenv import load_dotenv

# 自作モジュール
from . import models, schemas, database
from .database import engine, SessionLocal
from .manager import manager
from .dependencies import (
    get_db, get_current_user, create_access_token, 
    get_password_hash, verify_password, ACCESS_TOKEN_EXPIRE_MINUTES
)
from .routers import memory_sets 

load_dotenv()

# --- DB初期化 ---
models.Base.metadata.create_all(bind=engine)

# --- 公式データの定義 ---
DEFAULT_MEMORY_SETS = {
    "default": [
        {"text": "apple", "kana": "アップル"},
        {"text": "banana", "kana": "バナナ"},
        {"text": "cherry", "kana": "チェリー"},
        {"text": "grape", "kana": "ブドウ"},
        {"text": "orange", "kana": "オレンジ"},
        {"text": "peach", "kana": "モモ"},
        {"text": "watermelon", "kana": "スイカ"},
        {"text": "kiwifruit", "kana": "キウイ"},
        {"text": "lemon", "kana": "レモン"},
        {"text": "strawberry", "kana": "イチゴ"},
        {"text": "mango", "kana": "マンゴー"},
    ],
    "programming": [
        {"text": "Python", "kana": "パイソン"},
        {"text": "React", "kana": "リアクト"},
        {"text": "Docker", "kana": "ドッカー"},
        {"text": "Algorithm", "kana": "アルゴリズム"},
        {"text": "Database", "kana": "データベース"},
        {"text": "Frontend", "kana": "フロントエンド"},
    ],
    "animals": [
        {"text": "Lion", "kana": "ライオン"},
        {"text": "Elephant", "kana": "ゾウ"},
        {"text": "Giraffe", "kana": "キリン"},
        {"text": "Penguin", "kana": "ペンギン"},
        {"text": "Dolphin", "kana": "イルカ"},
    ],
    "english_hard": [
        {"text": "procrastinate", "kana": "先延ばしにする"},
        {"text": "ambiguous", "kana": "曖昧な"},
        {"text": "resilient", "kana": "回復力のある"},
    ],
}

OFFICIAL_TITLE_MAP = {
    "default": "基本セット (フルーツ)",
    "programming": "プログラミング用語",
    "animals": "動物の名前",
    "english_hard": "超難問英単語"
}

def seed_official_sets():
    db = SessionLocal()
    try:
        for set_key, words in DEFAULT_MEMORY_SETS.items():
            title = OFFICIAL_TITLE_MAP.get(set_key, set_key)
            exists = db.query(models.MemorySet).filter(
                models.MemorySet.title == title,
                models.MemorySet.is_official == True
            ).first()
            if not exists:
                new_set = models.MemorySet(
                    title=title,
                    words_json=json.dumps(words, ensure_ascii=False),
                    is_official=True,
                    owner_id=None
                )
                db.add(new_set)
        db.commit()
    except Exception as e:
        print(f"Seeding error: {e}")
        db.rollback()
    finally:
        db.close()

# --- FastAPIアプリ定義 ---
app = FastAPI()

@app.on_event("startup")
async def startup_event():
    seed_official_sets()

app.include_router(memory_sets.router)

# --- CORS設定 ---
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://braingarden.onrender.com",
]
origin_regex = r"^http://(localhost|127\.0\.0\.1):517\d$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ヘルスチェック
@app.get("/")
def read_root():
    return {"status": "ok"}

# ==========================
#  データモデル
# ==========================

class RoomInfo(BaseModel):
    id: str
    name: str
    hostName: str
    isLocked: bool
    winScore: int
    conditionType: str = "score"
    status: str = "waiting"
    playerCount: int = 0
    memorySetId: str = "default"
    memorizeTime: int = 3
    answerTime: int = 10
    questionsPerRound: int = 1
    currentRound: int = 0
    resolvedRound: int = 0 # ★追加: 決着済みの最新ラウンド番号
    seed: Optional[str] = None 

class CreateRoomRequest(BaseModel):
    name: str
    hostName: str
    password: str = ""
    winScore: int
    memorySetId: str 
    conditionType: str = "score"

class VerifyPasswordRequest(BaseModel):
    roomId: str
    password: str

# メモリ内データ
active_rooms: Dict[str, RoomInfo] = {}
room_passwords: Dict[str, str] = {}
room_owner_tokens: Dict[str, str] = {}
room_clients: Dict[str, Set[str]] = {}

# 対戦中の動的な状態管理
room_player_states: Dict[str, Dict[str, str]] = {} # room_id -> {player_id: status("pending"|"correct"|"wrong")}
room_retry_players: Dict[str, Set[str]] = {}       # room_id -> {player_id, ...}

# ==========================
#  API エンドポイント
# ==========================

@app.get("/api/ranking", response_model=List[schemas.RankEntry])
def get_ranking(set_id: str, win_score: int, condition_type: str, db: Session = Depends(get_db)):
    results = db.query(models.Ranking).filter(
        models.Ranking.set_id == set_id,
        models.Ranking.win_score == win_score,
        models.Ranking.condition_type == condition_type
    ).order_by(models.Ranking.time.asc()).limit(10).all()
    return results

@app.post("/api/ranking")
def post_ranking(entry: schemas.RankEntry, db: Session = Depends(get_db)):
    new_rank = models.Ranking(
        name=entry.name, time=entry.time, set_id=entry.set_id,
        win_score=entry.win_score, condition_type=entry.condition_type
    )
    db.add(new_rank)
    db.commit()
    db.refresh(new_rank)
    return {"message": "Ranking updated"}

@app.post("/api/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = get_password_hash(user.password)
    new_user = models.User(username=user.username, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    formatted_sets = []
    for s in current_user.memory_sets:
        formatted_sets.append(schemas.MemorySetResponse(
            id=s.id, title=s.title,
            words=json.loads(s.words_json) if s.words_json else [],
            owner_id=s.owner_id, memorize_time=s.memorize_time,
            answer_time=s.answer_time, questions_per_round=s.questions_per_round,
            win_score=s.win_score, condition_type=s.condition_type,
            order_type=s.order_type, is_official=s.is_official
        ))
    return schemas.UserResponse(id=current_user.id, username=current_user.username, memory_sets=formatted_sets)

@app.get("/api/problem")
def get_problem(
    room_id: Optional[str] = None, 
    set_id: Optional[str] = None, 
    seed: Optional[str] = None, 
    wrong_history: Optional[str] = None, 
    current_index: int = 0,
    db: Session = Depends(get_db)
):
    target_id = None
    if room_id and room_id in active_rooms:
        target_id = active_rooms[room_id].memorySetId
    else:
        target_id = set_id or "default"

    target_problems = None
    order_type = "random"

    if str(target_id).isdigit():
        db_set = db.query(models.MemorySet).filter(models.MemorySet.id == int(target_id)).first()
        if db_set:
            try:
                target_problems = json.loads(db_set.words_json)
                order_type = db_set.order_type
            except: pass

    if not target_problems and target_id in OFFICIAL_TITLE_MAP:
        title = OFFICIAL_TITLE_MAP[target_id]
        db_set = db.query(models.MemorySet).filter(models.MemorySet.title == title, models.MemorySet.is_official == True).first()
        if db_set:
            try:
                target_problems = json.loads(db_set.words_json)
                order_type = db_set.order_type
            except: pass

    if not target_problems and target_id in DEFAULT_MEMORY_SETS:
        target_problems = DEFAULT_MEMORY_SETS[target_id]

    if not target_problems:
        target_problems = DEFAULT_MEMORY_SETS["default"]

    effective_seed = seed
    if effective_seed is None and room_id and room_id in active_rooms:
        effective_seed = active_rooms[room_id].seed
    rng = random.Random(effective_seed) if effective_seed is not None else random

    if order_type == "sequential":
        idx = current_index % len(target_problems)
        correct = target_problems[idx]
    elif order_type == "review":
        wrong_list = wrong_history.split(",") if wrong_history else []
        weighted_pool = []
        for p in target_problems:
            weight = 5 if p["text"] in wrong_list else 1
            weighted_pool.extend([p] * weight)
        correct = rng.choice(weighted_pool)
    else:
        correct = rng.choice(target_problems)
    
    others = [p for p in target_problems if p["text"] != correct["text"]]
    sample_size = min(3, len(others))
    wrong_options = rng.sample(others, sample_size)
    options = [correct] + wrong_options
    rng.shuffle(options)
    
    return {"correct": correct, "options": options}

# ==========================
#  ルーム管理 API
# ==========================

@app.get("/api/rooms")
def get_rooms():
    return list(active_rooms.values())

@app.post("/api/rooms")
def create_room(req: CreateRoomRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.name in active_rooms:
        raise HTTPException(status_code=400, detail="そのルーム名は既に使用されています")
    
    mem_time, ans_time, q_per_round = 3, 10, 1
    if req.memorySetId.isdigit():
        target_set = db.query(models.MemorySet).filter(models.MemorySet.id == int(req.memorySetId)).filter(
            or_(models.MemorySet.is_official == True, models.MemorySet.owner_id == current_user.id)
        ).first()
    elif req.memorySetId in OFFICIAL_TITLE_MAP:
        target_set = db.query(models.MemorySet).filter(models.MemorySet.title == OFFICIAL_TITLE_MAP[req.memorySetId], models.MemorySet.is_official == True).first()
    else:
        target_set = None

    if target_set:
        mem_time, ans_time, q_per_round = target_set.memorize_time, target_set.answer_time, target_set.questions_per_round

    new_room = RoomInfo(
        id=req.name, name=req.name, hostName=req.hostName,
        isLocked=req.password != "", winScore=req.winScore,
        memorySetId=req.memorySetId, memorizeTime=mem_time,
        answerTime=ans_time, questionsPerRound=q_per_round,
        conditionType=req.conditionType,
        currentRound=0,
        resolvedRound=0
    )
    
    active_rooms[req.name] = new_room
    room_passwords[req.name] = req.password
    room_clients[req.name] = set()
    owner_token = str(uuid.uuid4())
    room_owner_tokens[req.name] = owner_token
    
    return {"message": "Room created", "room": new_room, "ownerToken": owner_token}

@app.delete("/api/rooms/{room_id}")
def delete_room(room_id: str, token: Optional[str] = None, current_user: models.User = Depends(get_current_user)):
    if room_id not in active_rooms:
        raise HTTPException(status_code=404, detail="ルームが見つかりません")
    is_owner = room_owner_tokens.get(room_id) == token
    is_empty = active_rooms[room_id].playerCount <= 0
    if not (is_owner or is_empty):
        raise HTTPException(status_code=403, detail="権限がありません")
    for d in [active_rooms, room_passwords, room_owner_tokens, room_clients, room_player_states, room_retry_players]:
        d.pop(room_id, None)
    return {"message": "Room deleted"}

@app.post("/api/rooms/verify")
def verify_room_password(req: VerifyPasswordRequest):
    if room_passwords.get(req.roomId) == req.password:
        return {"message": "OK"}
    raise HTTPException(status_code=401, detail="パスワードが違います")

async def delayed_room_cleanup(room_id: str):
    try:
        await asyncio.sleep(5)
        if room_id in active_rooms and active_rooms[room_id].playerCount <= 0:
            for d in [active_rooms, room_passwords, room_owner_tokens, room_clients, room_player_states, room_retry_players]:
                d.pop(room_id, None)
            manager.active_connections.pop(room_id, None)
    except asyncio.CancelledError: pass
    finally: manager.cleanup_tasks.pop(room_id, None)

# ==========================
#  WebSocket 審判ロジック (強化版)
# ==========================

async def proceed_to_next_round(room_id: str, round_to_finish: int):
    """
    指定されたラウンドを終了し、少し待機してから次のラウンドへ進める。
    """
    room = active_rooms.get(room_id)
    # ★ 二重実行防止: 既に次のラウンドへ進んでいる場合は無視
    if not room or room.currentRound != round_to_finish:
        return

    # 演出用の待機 (1.5秒) 
    await asyncio.sleep(1.5)

    # 次のラウンドの準備
    room.currentRound += 1
    room.seed = str(uuid.uuid4())
    
    # 状態をリセット
    if room_id in room_player_states:
        for pid in room_player_states[room_id]:
            room_player_states[room_id][pid] = "pending"

    next_info = json.dumps({"round": room.currentRound, "seed": room.seed})
    await manager.broadcast(f"SERVER:NEXT_ROUND:{next_info}", room_id)

@app.websocket("/ws/battle/{room_id}/{player_id}")
@app.websocket("/ws/{room_id}/{player_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    room_id: str, 
    player_id: str,
    setName: Optional[str] = None
):
    await websocket.accept()
    await asyncio.sleep(0.1)

    if room_id not in active_rooms:
        await websocket.close(code=4000)
        return
    
    await manager.connect(websocket, room_id)
    if room_id not in room_clients: room_clients[room_id] = set()
    room_clients[room_id].add(player_id)
    
    room = active_rooms[room_id]
    room.playerCount = len(room_clients[room_id])
    
    if room_id not in room_player_states:
        room_player_states[room_id] = {}
    room_player_states[room_id][player_id] = "pending"

    try:
        if room.playerCount == 2 and room.status == "waiting":
            room.status = "playing"
            room.currentRound = 1
            room.resolvedRound = 0 # 初期化
            room.seed = str(uuid.uuid4())
            await asyncio.sleep(0.3)
            await manager.broadcast("SERVER:MATCHED", room_id)
            init_payload = json.dumps({"round": room.currentRound, "seed": room.seed})
            await manager.broadcast(f"SERVER:NEXT_ROUND:{init_payload}", room_id)
        
        while True:
            data = await websocket.receive_text()
            parts = data.split(":", 1)
            sender_id = parts[0]
            command = parts[1] if len(parts) > 1 else ""

            # --------------------------------------------------
            # 正解 (SCORE_UP) 受信時
            # --------------------------------------------------
            if command.startswith("SCORE_UP:round"):
                try:
                    reported_round = int(command.replace("SCORE_UP:round", ""))
                    # ★ 判定強化: 現在のラウンドかつ、まだこのラウンドで正解者が出ていない場合のみ受理
                    if reported_round == room.currentRound and reported_round > room.resolvedRound:
                        # 即座にこのラウンドを決着済みとしてロック
                        room.resolvedRound = reported_round
                        
                        # 全員に正解を通知（ブロードキャストは1回だけになる）
                        await manager.broadcast(data, room_id)
                        
                        room_player_states[room_id][player_id] = "correct"
                        # 次のラウンドへの移行タスクを開始
                        asyncio.create_task(proceed_to_next_round(room_id, reported_round))
                except Exception as e: print(e)
                continue

            # --------------------------------------------------
            # ミス (MISS) 受信時
            # --------------------------------------------------
            if command.startswith("MISS:round"):
                try:
                    reported_round = int(command.replace("MISS:round", ""))
                    # ★ 既に決着済みのラウンドに対するミス通知は無視（ちらつき防止）
                    if reported_round == room.currentRound and reported_round > room.resolvedRound:
                        # ミスしたことを通知
                        await manager.broadcast(data, room_id)
                        room_player_states[room_id][player_id] = "wrong"
                        
                        # 全員がミスしたか判定
                        states = room_player_states[room_id].values()
                        if all(s == "wrong" for s in states):
                            # 全員ミスのためラウンド決着
                            room.resolvedRound = reported_round
                            asyncio.create_task(proceed_to_next_round(room_id, reported_round))
                except Exception as e: print(e)
                continue

            # --------------------------------------------------
            # 再戦 (RETRY) 受信時
            # --------------------------------------------------
            if command == "RETRY":
                if room_id not in room_retry_players:
                    room_retry_players[room_id] = set()
                room_retry_players[room_id].add(player_id)
                
                if len(room_retry_players[room_id]) >= room.playerCount:
                    room.status = "playing"
                    room.currentRound = 1
                    room.resolvedRound = 0 # リセット
                    room.seed = str(uuid.uuid4())
                    room_retry_players[room_id].clear()
                    
                    await manager.broadcast("SERVER:MATCHED", room_id)
                    init_payload = json.dumps({"round": room.currentRound, "seed": room.seed})
                    await manager.broadcast(f"SERVER:NEXT_ROUND:{init_payload}", room_id)
                else:
                    await manager.broadcast(data, room_id)
                continue

            await manager.broadcast(data, room_id)
            
    except (WebSocketDisconnect, Exception) as e:
        print(f"WS Disconnect/Error: {e}")
    finally:
        manager.disconnect(websocket, room_id)
        if room_id in room_clients:
            room_clients[room_id].discard(player_id)
            if room_id in active_rooms:
                room.playerCount = len(room_clients[room_id])
                if room.playerCount == 1: room.status = "waiting"
                if room_id in room_player_states:
                    room_player_states[room_id].pop(player_id, None)
                if room.playerCount <= 0:
                    task = asyncio.create_task(delayed_room_cleanup(room_id))
                    manager.cleanup_tasks[room_id] = task

# 静的ファイルの配信設定
frontend_path = os.path.join(os.getcwd(), "../frontend/dist")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
    @app.exception_handler(404)
    async def not_found_exception_handler(request, exc):
        return FileResponse(os.path.join(frontend_path, "index.html"))