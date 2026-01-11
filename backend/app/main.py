# backend/app/main.py 全文修正
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
from sqlalchemy import or_, func
from sqlalchemy import desc, asc
from pydantic import BaseModel, Field
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


def get_current_user_optional(db: Session = Depends(get_db), token: Optional[str] = None):
    if not token:
        return None
    try:
        return get_current_user(token, db)
    except:
        return None


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
    resolvedRound: int = 0
    seed: Optional[str] = None
    gameSessionId: str = Field(default_factory=lambda: str(uuid.uuid4()))


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
room_player_states: Dict[str, Dict[str, str]] = {}
room_retry_players: Dict[str, Set[str]] = {}
room_player_names: Dict[str, Dict[str, str]] = {}
room_player_scores: Dict[str, Dict[str, int]] = {}

# player_id ごとの現在の接続(WebSocket)を保持するためのマップ
# 高速な再接続時に古い接続を確実にクローズするために使用
player_websockets: Dict[str, tuple[WebSocket, str]] = {}

# ==========================
#  API エンドポイント
# ==========================

@app.get("/api/ranking", response_model=List[schemas.RankEntry])
def get_ranking(set_id: str, win_score: int, condition_type: str, db: Session = Depends(get_db)):
    query = db.query(models.Ranking).filter(
        models.Ranking.set_id == set_id,
        models.Ranking.win_score == win_score,
        models.Ranking.condition_type == condition_type
    )

    query = query.order_by(
        desc(models.Ranking.accuracy),
        asc(models.Ranking.avg_speed),
        desc(models.Ranking.created_at)
    )

    return query.limit(10).all()


@app.post("/api/ranking")
def post_ranking(entry: schemas.RankEntry, db: Session = Depends(get_db)):
    new_rank = models.Ranking(
        name=entry.name,
        time=entry.time,
        set_id=entry.set_id,
        win_score=entry.win_score,
        condition_type=entry.condition_type,
        accuracy=entry.accuracy,
        avg_speed=entry.avg_speed
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
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
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
            except:
                pass

    if not target_problems and target_id in OFFICIAL_TITLE_MAP:
        title = OFFICIAL_TITLE_MAP[target_id]
        db_set = db.query(models.MemorySet).filter(
            models.MemorySet.title == title,
            models.MemorySet.is_official == True
        ).first()
        if db_set:
            try:
                target_problems = json.loads(db_set.words_json)
                order_type = db_set.order_type
            except:
                pass

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
        if current_user:
            stats = db.query(models.UserWordStat).filter(models.UserWordStat.user_id == current_user.id).all()
            miss_map = {s.word_text: s.miss_count for s in stats}
            weights = []
            for p in target_problems:
                weight = 1 + (miss_map.get(p["text"], 0) * 5)
                weights.append(weight)
            correct = rng.choices(target_problems, weights=weights, k=1)[0]
        else:
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


@app.post("/api/word_stats")
def record_word_stat(word_text: str, is_correct: bool, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    stat = db.query(models.UserWordStat).filter(
        models.UserWordStat.user_id == current_user.id,
        models.UserWordStat.word_text == word_text
    ).first()

    if not stat:
        stat = models.UserWordStat(
            user_id=current_user.id,
            word_text=word_text,
            correct_count=0,
            miss_count=0
        )
        db.add(stat)

    if is_correct:
        stat.correct_count += 1
    else:
        stat.miss_count += 1
    db.commit()
    return {"status": "ok"}


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
        target_set = db.query(models.MemorySet).filter(
            models.MemorySet.title == OFFICIAL_TITLE_MAP[req.memorySetId],
            models.MemorySet.is_official == True
        ).first()
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

    room_player_scores[req.name] = {}
    room_player_names[req.name] = {}
    room_player_states[req.name] = {}

    return {"message": "Room created", "room": new_room, "ownerToken": owner_token}


@app.delete("/api/rooms/{room_id}")
def delete_room(room_id: str, token: Optional[str] = None, current_user: models.User = Depends(get_current_user)):
    if room_id not in active_rooms:
        raise HTTPException(status_code=404, detail="ルームが見つかりません")
    is_owner = room_owner_tokens.get(room_id) == token
    is_empty = active_rooms[room_id].playerCount <= 0
    if not (is_owner or is_empty):
        raise HTTPException(status_code=403, detail="権限がありません")
    for d in [active_rooms, room_passwords, room_owner_tokens, room_clients, room_player_states, room_retry_players, room_player_names, room_player_scores]:
        d.pop(room_id, None)
    return {"message": "Room deleted"}


@app.post("/api/rooms/verify")
def verify_room_password(req: VerifyPasswordRequest):
    if room_passwords.get(req.roomId) == req.password:
        return {"message": "OK"}
    raise HTTPException(status_code=401, detail="パスワードが違います")


# ★ 最後の修正：delayed_room_cleanup を安全化（接続掃除→pop）
async def delayed_room_cleanup(room_id: str):
    try:
        await asyncio.sleep(1)
        if room_id in active_rooms and active_rooms[room_id].playerCount <= 0:
            # ルーム関連データの削除
            for d in [
                active_rooms,
                room_passwords,
                room_owner_tokens,
                room_clients,
                room_player_states,
                room_retry_players,
                room_player_names,
                room_player_scores,
            ]:
                try:
                    d.pop(room_id, None)
                except:
                    pass

            # ★ manager 側の接続を「掃除してから」pop する（競合しにくい）
            try:
                conns = manager.active_connections.get(room_id, [])
                for ws in conns[:]:
                    try:
                        manager.disconnect(ws, room_id)
                    except:
                        pass
                manager.active_connections.pop(room_id, None)
            except:
                pass

    except asyncio.CancelledError:
        pass
    finally:
        try:
            manager.cleanup_tasks.pop(room_id, None)
        except:
            pass


# ==========================
#  WebSocket 審判ロジック
# ==========================

async def proceed_to_next_round(room_id: str, round_to_finish: int, session_id: str):
    room = active_rooms.get(room_id)
    if not room or room.gameSessionId != session_id or room.status != "playing" or room.currentRound != round_to_finish:
        return

    await asyncio.sleep(0.5)

    if not room or room.gameSessionId != session_id or room.status != "playing" or room.currentRound != round_to_finish:
        return

    room.currentRound += 1
    room.seed = str(uuid.uuid4())

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
    # 【強化】既存の同じプレイヤーの接続があれば強制終了させる（ゾンビ排除）
    if player_id in player_websockets:
        old_ws, old_room = player_websockets[player_id]
        try:
            manager.disconnect(old_ws, old_room)  # ★先に外す
            await old_ws.close(code=1000)
        except:
            pass

    await websocket.accept()
    player_websockets[player_id] = (websocket, room_id)

    if room_id not in active_rooms:
        await websocket.close(code=4000)
        return

    await manager.connect(websocket, room_id)
    room = active_rooms[room_id]

    # データ構造の初期化
    if room_id not in room_clients:
        room_clients[room_id] = set()
    if room_id not in room_player_states:
        room_player_states[room_id] = {}
    if room_id not in room_player_names:
        room_player_names[room_id] = {}
    if room_id not in room_player_scores:
        room_player_scores[room_id] = {}

    room_clients[room_id].add(player_id)
    room.playerCount = len(room_clients[room_id])

    if player_id not in room_player_states[room_id]:
        room_player_states[room_id][player_id] = "pending"
    if player_id not in room_player_scores[room_id]:
        room_player_scores[room_id][player_id] = 0

    # 初期同期
    try:
        sync_payload = {
            "status": room.status,
            "currentRound": room.currentRound,
            "seed": room.seed,
            "scores": room_player_scores[room_id],
            "names": room_player_names[room_id],
            "winScore": room.winScore,
            "conditionType": room.conditionType
        }
        await websocket.send_text(f"SERVER:SYNC:{json.dumps(sync_payload)}")
    except:
        return

    try:
        if room.playerCount == 2 and room.status == "waiting" and room.currentRound == 0:
            room.status = "playing"
            room.currentRound = 1
            room.resolvedRound = 0
            room.seed = str(uuid.uuid4())
            room.gameSessionId = str(uuid.uuid4())
            await asyncio.sleep(0.3)
            await manager.broadcast("SERVER:MATCHED", room_id)
            init_payload = json.dumps({"round": room.currentRound, "seed": room.seed})
            await manager.broadcast(f"SERVER:NEXT_ROUND:{init_payload}", room_id)

        while True:
            data = await websocket.receive_text()
            parts = data.split(":", 1)
            sender_id = parts[0]
            command = parts[1] if len(parts) > 1 else ""

            if command.startswith("NAME:"):
                name = command[5:]
                room_player_names[room_id][player_id] = name
                await manager.broadcast(f"{player_id}:NAME:{name}", room_id)
                continue

            if command.startswith("SCORE_UP:round"):
                try:
                    reported_round = int(command.replace("SCORE_UP:round", ""))
                    if reported_round == room.currentRound and reported_round > room.resolvedRound:
                        room.resolvedRound = reported_round
                        room_player_scores[room_id][player_id] = room_player_scores[room_id].get(player_id, 0) + 1
                        await manager.broadcast(data, room_id)
                        room_player_states[room_id][player_id] = "correct"
                        asyncio.create_task(proceed_to_next_round(room_id, reported_round, room.gameSessionId))
                except:
                    pass
                continue

            if command.startswith("MISS:round"):
                try:
                    reported_round = int(command.replace("MISS:round", ""))
                    if reported_round == room.currentRound and reported_round > room.resolvedRound:
                        await manager.broadcast(data, room_id)
                        room_player_states[room_id][player_id] = "wrong"
                        states = room_player_states[room_id].values()
                        if all(s == "wrong" for s in states):
                            room.resolvedRound = reported_round
                            asyncio.create_task(proceed_to_next_round(room_id, reported_round, room.gameSessionId))
                except:
                    pass
                continue

            if command == "RETRY":
                if room_id not in room_retry_players:
                    room_retry_players[room_id] = set()
                room_retry_players[room_id].add(player_id)
                await manager.broadcast(data, room_id)

                if len(room_retry_players[room_id]) >= 2:
                    room.status = "playing"
                    room.currentRound = 1
                    room.resolvedRound = 0
                    room.seed = str(uuid.uuid4())
                    room.gameSessionId = str(uuid.uuid4())
                    room_retry_players[room_id].clear()

                    if room_id in room_player_scores:
                        for pid in room_player_scores[room_id]:
                            room_player_scores[room_id][pid] = 0
                    if room_id in room_player_states:
                        for pid in room_player_states[room_id]:
                            room_player_states[room_id][pid] = "pending"

                    await asyncio.sleep(0.5)
                    await manager.broadcast("SERVER:MATCHED", room_id)
                    init_payload = json.dumps({"round": room.currentRound, "seed": room.seed})
                    await manager.broadcast(f"SERVER:NEXT_ROUND:{init_payload}", room_id)
                continue

            await manager.broadcast(data, room_id)

    except:
        pass
    finally:
        # ★finally 内は「絶対落ちない」ようにガードする
        try:
            manager.disconnect(websocket, room_id)
        except:
            pass

        try:
            if player_id in player_websockets and player_websockets[player_id][0] == websocket:
                player_websockets.pop(player_id, None)
        except:
            pass

        try:
            if room_id in room_clients:
                room_clients[room_id].discard(player_id)

            if room_id in active_rooms:
                target_room = active_rooms[room_id]
                try:
                    target_room.playerCount = len(room_clients.get(room_id, set()))
                except:
                    pass

                if target_room.playerCount == 1:
                    target_room.status = "waiting"

                if target_room.playerCount <= 0:
                    try:
                        task = asyncio.create_task(delayed_room_cleanup(room_id))
                        manager.cleanup_tasks[room_id] = task
                    except:
                        pass
                else:
                    try:
                        await manager.broadcast("SERVER:OPPONENT_LEFT", room_id)
                    except:
                        pass
        except:
            pass


# 静的ファイルの配信設定
frontend_path = os.path.join(os.getcwd(), "../frontend/dist")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

    @app.exception_handler(404)
    async def not_found_exception_handler(request, exc):
        return FileResponse(os.path.join(frontend_path, "index.html"))
