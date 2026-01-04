import asyncio
from fastapi import WebSocket
from typing import List, Dict

# 接続管理マネージャー
class ConnectionManager:
    def __init__(self):
        # どの部屋(room_id)に、誰(websocket)がいるかを記録する辞書
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # ルームの削除予約（猶予期間）タスクを管理する辞書
        self.cleanup_tasks: Dict[str, asyncio.Task] = {}

    # 1. 接続したとき
    async def connect(self, websocket: WebSocket, room_id: str):
        # もしこのルームが削除予約（猶予期間）中なら、削除をキャンセルする
        if room_id in self.cleanup_tasks:
            task = self.cleanup_tasks[room_id]
            task.cancel()
            try:
                # タスクがキャンセルされるまで待機
                await task
            except asyncio.CancelledError:
                pass
            
            # 【重要】ここにあった del self.cleanup_tasks[room_id] を削除しました。
            # main.py の delayed_room_cleanup にある finally ブロックが 
            # 辞書からの削除（pop）を自動で行うため、ここで del すると競合して KeyError になります。
            
            print(f"Cleanup task cancelled for room: {room_id} (Reconnected)")

        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        
        # WebSocketオブジェクトをリストに追加
        self.active_connections[room_id].append(websocket)
        return True # 接続成功

    # 2. 切断したとき
    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)
            
            # 実際のルーム削除（active_connections 自体の掃除）は、
            # 人数が0になった際に main.py 側が猶予期間を持って行います。

    # 3. メッセージを送るとき（部屋にいる全員へ）
    async def broadcast(self, message: str, room_id: str):
        if room_id in self.active_connections:
            # 送信対象を固定するためにコピーを取る
            targets = self.active_connections[room_id][:]
            for connection in targets:
                try:
                    # 接続状態を確認してから送信
                    await connection.send_text(message)
                except Exception as e:
                    print(f"Broadcast error (room:{room_id}): {e}")
                    # 送信エラー時はその接続をリストから除外
                    if connection in self.active_connections[room_id]:
                        self.active_connections[room_id].remove(connection)
                    try:
                        await connection.close()
                    except:
                        pass

# インスタンスを作成
manager = ConnectionManager()