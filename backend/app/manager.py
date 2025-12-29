from fastapi import WebSocket
from typing import List, Dict

# 接続管理マネージャー
class ConnectionManager:
    def __init__(self):
        # どの部屋(room_id)に、誰(websocket)がいるかを記録する辞書
        # 例: { "room_1": [userA, userB], "room_2": [userC] }
        self.active_connections: Dict[str, List[WebSocket]] = {}

    # 1. 接続したとき
    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    # 2. 切断したとき
    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            # 部屋が空になったら部屋情報を消す
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    # 3. メッセージを送るとき（部屋にいる全員へ）
    async def broadcast(self, message: str, room_id: str):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                await connection.send_text(message)

# インスタンスを作成
manager = ConnectionManager()