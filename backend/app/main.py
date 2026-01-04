# backend/app/main.py
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from datetime import timedelta, datetime
from typing import List, Dict, Optional, Set
import random
import json
import os
from dotenv import load_dotenv
from pydantic import BaseModel
import uuid

# 自作モジュールのインポート
from . import models, schemas, database
from .database import engine
from .manager import manager

load_dotenv()

# --- DB初期化 ---
models.Base.metadata.create_all(bind=engine)

# --- FastAPIアプリ定義 ---
app = FastAPI()

# --- CORS設定 ---
# 1. 完全一致するURLのリスト
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://braingarden.onrender.com",
]

# 2. 正規表現パターンの文字列（リストではなく、1本の文字列にする）
origin_regex = r"^http://(localhost|127\.0\.0\.1):517\d$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,           # リストを渡す
    allow_origin_regex=origin_regex,  # 文字列を渡す
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================
#  認証・DB設定
# ==========================

SECRET_KEY = os.getenv("SECRET_KEY", "YOUR_SECRET_KEY_HERE")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 1日

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    from jose import jwt
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    from jose import jwt, JWTError
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ==========================
#  ゲーム用データモデル・変数
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
    questionsPerRound: int = 1
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

class RankEntry(BaseModel):
    name: str
    time: float
    set_id: str
    win_score: int
    condition_type: str

# メモリ内データ（ルーム管理用）
active_rooms: Dict[str, RoomInfo] = {}
room_passwords: Dict[str, str] = {}
room_owner_tokens: Dict[str, str] = {}
room_clients: Dict[str, Set[str]] = {}

RANKING_FILE = "ranking.json"

DEFAULT_MEMORY_SETS = {
    "default": [
        {"text": "apple", "kana": "アップル"},
        {"text": "banana", "kana": "バナナ"},
        {"text": "cherry", "kana": "チェリー"},
        {"text": "grape", "kana": "ブドウ"},
        {"text": "orange", "kana": "オレンジ"},
        {"text": "peach", "kana": "モモ"},
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

def load_ranking():
    if not os.path.exists(RANKING_FILE): return []
    with open(RANKING_FILE, "r", encoding="utf-8") as f:
        try: return json.load(f)
        except: return []

def save_ranking(data):
    with open(RANKING_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

# ==========================
#  API エンドポイント
# ==========================

@app.get("/")
def read_root():
    return {"message": "Hello, Brain Garden API!"}

# ランキング関連
@app.get("/api/ranking", response_model=List[RankEntry])
def get_ranking(set_id: str, win_score: int, condition_type: str):
    all_ranks = load_ranking()
    filtered = [
        r for r in all_ranks 
        if r.get("set_id") == set_id and 
           r.get("win_score") == win_score and 
           r.get("condition_type") == condition_type
    ]
    filtered.sort(key=lambda x: x["time"])
    return filtered[:10]

@app.post("/api/ranking")
def post_ranking(entry: RankEntry):
    all_ranks = load_ranking()
    all_ranks.append(entry.dict())
    save_ranking(all_ranks)
    return {"message": "Ranking updated"}

# 認証関連
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

@app.post("/token", response_model=schemas.Token)
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
            id=s.id,
            title=s.title,
            words=json.loads(s.words_json),
            owner_id=s.owner_id,
            memorize_time=s.memorize_time,
            questions_per_round=s.questions_per_round,
            win_score=s.win_score,
            condition_type=s.condition_type,
            order_type=s.order_type
        ))
    return schemas.UserResponse(
        id=current_user.id,
        username=current_user.username,
        memory_sets=formatted_sets
    )

# メモリーセット関連
@app.post("/api/my-sets", response_model=schemas.MemorySetResponse)
def create_memory_set(item: schemas.MemorySetCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    words_json_str = json.dumps([w.dict() for w in item.words], ensure_ascii=False)
    new_set = models.MemorySet(
        title=item.title, 
        words_json=words_json_str, 
        owner_id=current_user.id,
        memorize_time=item.memorize_time,
        questions_per_round=item.questions_per_round,
        win_score=item.win_score,
        condition_type=item.condition_type,
        order_type=item.order_type
    )
    db.add(new_set)
    db.commit()
    db.refresh(new_set)
    return schemas.MemorySetResponse(
        id=new_set.id, 
        title=new_set.title, 
        words=json.loads(new_set.words_json), 
        owner_id=new_set.owner_id,
        memorize_time=new_set.memorize_time,
        questions_per_round=new_set.questions_per_round,
        win_score=new_set.win_score,
        condition_type=new_set.condition_type,
        order_type=new_set.order_type
    )

@app.get("/api/my-sets", response_model=List[schemas.MemorySetResponse])
def read_memory_sets(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    sets = db.query(models.MemorySet).filter(models.MemorySet.owner_id == current_user.id).all()
    results = []
    for s in sets:
        results.append(schemas.MemorySetResponse(
            id=s.id, 
            title=s.title, 
            words=json.loads(s.words_json), 
            owner_id=s.owner_id,
            memorize_time=s.memorize_time,
            questions_per_round=s.questions_per_round,
            win_score=s.win_score,
            condition_type=s.condition_type,
            order_type=s.order_type
        ))
    return results

@app.get("/api/sets")
def get_memory_sets(db: Session = Depends(get_db)):
    response_sets = [
        {"id": "default", "name": "基本セット (フルーツ)"},
        {"id": "programming", "name": "プログラミング用語"},
        {"id": "animals", "name": "動物の名前"},
        {"id": "english_hard", "name": "超難問英単語"},
    ]
    db_sets = db.query(models.MemorySet).all()
    for s in db_sets:
        response_sets.append({"id": str(s.id), "name": s.title})
    return response_sets

# 問題取得 API
@app.get("/api/problem")
def get_problem(
    room_id: Optional[str] = None, 
    set_id: Optional[str] = None, 
    seed: Optional[str] = None, 
    wrong_history: Optional[str] = None, 
    current_index: int = 0,
    db: Session = Depends(get_db)
):
    target_set_id = "default"
    if room_id and room_id in active_rooms:
        target_set_id = active_rooms[room_id].memorySetId
    elif set_id:
        target_set_id = set_id
    
    order_type = "random"
    target_problems = DEFAULT_MEMORY_SETS["default"]

    if target_set_id in DEFAULT_MEMORY_SETS:
        target_problems = DEFAULT_MEMORY_SETS[target_set_id]
    else:
        if str(target_set_id).isdigit():
            db_id = int(target_set_id)
            db_set = db.query(models.MemorySet).filter(models.MemorySet.id == db_id).first()
            if db_set:
                order_type = db_set.order_type
                try:
                    loaded_words = json.loads(db_set.words_json)
                    if loaded_words: target_problems = loaded_words
                except: pass

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
def create_room(req: CreateRoomRequest, db: Session = Depends(get_db)):
    if req.name in active_rooms:
        raise HTTPException(status_code=400, detail="そのルーム名は既に使用されています")
    
    mem_time, q_per_round = 3, 1
    cond_type, win_score = req.conditionType, req.winScore

    if req.memorySetId != "default" and req.memorySetId.isdigit():
        db_set = db.query(models.MemorySet).filter(models.MemorySet.id == int(req.memorySetId)).first()
        if db_set:
            mem_time = db_set.memorize_time
            q_per_round = db_set.questions_per_round

    new_room = RoomInfo(
        id=req.name, name=req.name, hostName=req.hostName,
        isLocked=req.password != "", winScore=win_score,
        memorySetId=req.memorySetId, memorizeTime=mem_time,
        questionsPerRound=q_per_round, conditionType=cond_type
    )
    
    active_rooms[req.name] = new_room
    room_passwords[req.name] = req.password
    room_clients[req.name] = set()
    owner_token = str(uuid.uuid4())
    room_owner_tokens[req.name] = owner_token
    
    return {"message": "Room created", "room": new_room, "ownerToken": owner_token}

@app.delete("/api/rooms/{room_id}")
def delete_room(room_id: str, token: Optional[str] = None):
    if room_id not in active_rooms:
        raise HTTPException(status_code=404, detail="ルームが見つかりません")
    
    is_owner = room_owner_tokens.get(room_id) == token
    is_empty = active_rooms[room_id].playerCount <= 0
    
    if not (is_owner or is_empty):
        raise HTTPException(status_code=403, detail="権限がありません")
    
    for d in [active_rooms, room_passwords, room_owner_tokens, room_clients]:
        d.pop(room_id, None)
    return {"message": "Room deleted"}

@app.post("/api/rooms/verify")
def verify_room_password(req: VerifyPasswordRequest):
    if room_passwords.get(req.roomId) == req.password:
        return {"message": "OK"}
    raise HTTPException(status_code=401, detail="パスワードが違います")

# ==========================
#  WebSocket 補助関数
# ==========================

async def delayed_room_cleanup(room_id: str):
    """
    5秒待機してからルームを削除する。
    再接続によってタスクがキャンセルされた場合は、manager.cleanup_tasks から自身を消して終了する。
    """
    try:
        await asyncio.sleep(5)
        # 5秒後、まだ誰もいなければ削除を実行
        if room_id in active_rooms and active_rooms[room_id].playerCount <= 0:
            print(f"Cleaning up empty room after grace period: {room_id}")
            for d in [active_rooms, room_passwords, room_owner_tokens, room_clients]:
                d.pop(room_id, None)
            manager.active_connections.pop(room_id, None)
    except asyncio.CancelledError:
        # 再接続時に manager.connect 側でキャンセルされた場合
        pass
    finally:
        # 管理辞書から自分自身を確実に消去する（popなので二重消去エラーにならない）
        manager.cleanup_tasks.pop(room_id, None)

# ==========================
#  WebSocket
# ==========================

@app.websocket("/ws/{room_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, player_id: str):
    # 接続を確立
    await websocket.accept()

    # ルームが存在するか確認
    if room_id not in active_rooms:
        await websocket.close(code=4000)
        return

    # 接続管理マネージャーに登録（既存のクリーンアップタスクがあればここでキャンセルされる）
    await manager.connect(websocket, room_id)
    
    # ルームのクライアントリストとカウントを更新
    if room_id not in room_clients: 
        room_clients[room_id] = set()
    room_clients[room_id].add(player_id)
    active_rooms[room_id].playerCount = len(room_clients[room_id])

    try:
        # 2人揃ったら対戦準備完了通知
        if active_rooms[room_id].playerCount == 2:
            active_rooms[room_id].status = "playing"
            active_rooms[room_id].seed = str(uuid.uuid4())
            await manager.broadcast("MATCHED", room_id)
        
        # 接続したプレイヤーの存在を周囲に通知（BattleMode.tsxの受信処理用）
        # ※実際には playerName 送信はフロント側の wsSend で行われる
        
        while True:
            # クライアントからのメッセージ待機
            data = await websocket.receive_text()
            
            # 再戦時などのステータス更新処理
            if data.endswith(":MATCHED"):
                active_rooms[room_id].seed = str(uuid.uuid4())
                active_rooms[room_id].status = "playing"
                
            # メッセージを部屋の全員にブロードキャスト
            await manager.broadcast(data, room_id)
            
    except (WebSocketDisconnect, Exception) as e:
        print(f"WS Disconnect or Error ({player_id}): {e}")
    finally:
        # 切断時のクリーンアップ
        manager.disconnect(websocket, room_id)
        
        if room_id in room_clients:
            room_clients[room_id].discard(player_id)
            
            if room_id in active_rooms:
                count = len(room_clients[room_id])
                active_rooms[room_id].playerCount = count
                
                # 1人になったら待ち状態に戻す
                if count == 1:
                    active_rooms[room_id].status = "waiting"
                
                # 0人になったら削除予約タスクを開始
                if count <= 0:
                    task = asyncio.create_task(delayed_room_cleanup(room_id))
                    manager.cleanup_tasks[room_id] = task