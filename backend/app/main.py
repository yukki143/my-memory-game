from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import WebSocket, WebSocketDisconnect
from app.manager import manager
import random # ランダムに選ぶためのライブラリ
import json # ★追加
import os   # ★追加
from pydantic import BaseModel # ★追加
from typing import List # ★追加

app = FastAPI()

# Reactからのアクセス許可
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):517\d$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ★仮の問題データ（後でデータベースに入れます）
SAMPLE_PROBLEMS = [
    {"text": "apple", "kana": "アップル"},
    {"text": "今日の朝食はクロワッサンでした", "kana": "きょうのちょうしょくはくろわっさんでした"},
    {"text": "cherry", "kana": "チェリー"},
    {"text": "dog", "kana": "イヌ"},
    {"text": "elephant", "kana": "ゾウ"},
    {"text": "fastapi", "kana": "ファストAPI"},
]

@app.get("/")
def read_root():
    return {"message": "Hello, Memory e-Sports!"}

# ★追加: ランダムに1問出すAPI
@app.get("/api/problem")
def get_problem():
    # 1. 正解をランダムに選ぶ
    correct = random.choice(SAMPLE_PROBLEMS)
    
    # 2. 正解以外のリストを作る（ハズレ候補）
    others = [p for p in SAMPLE_PROBLEMS if p["text"] != correct["text"]]
    
    # 3. ハズレ候補からランダムに3つ選ぶ
    wrong_options = random.sample(others, 3)
    
    # 4. 正解とハズレを混ぜる
    options = [correct] + wrong_options
    random.shuffle(options)
    
    # 5. 「正解データ」と「選択肢リスト」をセットで返す
    return {
        "correct": correct,
        "options": options
    }

@app.websocket("/ws/{room_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_id: str):
    # 接続処理
    await manager.connect(websocket, room_id)
    
    try:
        # 部屋に入ったことを全員に知らせる
        await manager.broadcast(f"{client_id} さんが入室しました！", room_id)
        
        # ずっと相手からのメッセージを待ち受けるループ
        while True:
            data = await websocket.receive_text()
            # 受け取ったメッセージを部屋の全員に転送（チャット機能）
            await manager.broadcast(f"{client_id}: {data}", room_id)
            
    except WebSocketDisconnect:
        # 切断されたら
        manager.disconnect(websocket, room_id)
        await manager.broadcast(f"{client_id} さんが退出しました...", room_id)

# ランキングデータの保存ファイル名
RANKING_FILE = "ranking.json"

# データ型定義
class RankEntry(BaseModel):
    name: str
    time: float # タイム（秒）

# ランキングを読み込む関数
def load_ranking():
    if not os.path.exists(RANKING_FILE):
        return []
    with open(RANKING_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except:
            return []

# ランキングを保存する関数
def save_ranking(data):
    with open(RANKING_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

# API: ランキングを取得 (TOP 10)
@app.get("/api/ranking")
def get_ranking():
    data = load_ranking()
    # タイムが早い順（昇順）にソートしてTop10を返す
    sorted_data = sorted(data, key=lambda x: x["time"])[:10]
    return sorted_data

# API: スコアを登録
@app.post("/api/ranking")
def add_ranking(entry: RankEntry):
    data = load_ranking()
    data.append(entry.dict())
    save_ranking(data)
    return {"message": "Rank registered!"}