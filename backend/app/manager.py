# backend/app/manager.py
import asyncio
from fastapi import WebSocket
from starlette.websockets import WebSocketState
from typing import List, Dict


class ConnectionManager:
    def __init__(self):
        # ルームごとのWebSocket接続リスト
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # ルーム削除の遅延クリーンアップタスク管理
        self.cleanup_tasks: Dict[str, asyncio.Task] = {}

    def _is_alive(self, ws: WebSocket) -> bool:
        """
        重要：client_state だけでは不十分。
        close() を送った後は application_state が先に切れることがあるため、
        両方が CONNECTED のときだけ「生存」とみなす。
        """
        try:
            return (
                ws.client_state == WebSocketState.CONNECTED
                and ws.application_state == WebSocketState.CONNECTED
            )
        except Exception:
            return False

    async def connect(self, websocket: WebSocket, room_id: str):
        """WebSocket接続を管理リストに追加し、必要に応じてクリーンアップタスクを中断する"""
        if room_id in self.cleanup_tasks:
            task = self.cleanup_tasks[room_id]
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            print(f"Cleanup task cancelled for room: {room_id} (Reconnected)")

        if room_id not in self.active_connections:
            self.active_connections[room_id] = []

        # ★死んでいる接続を事前に除去（ゾンビ削除）
        self.active_connections[room_id] = [
            ws for ws in self.active_connections[room_id] if self._is_alive(ws)
        ]

        # ★重複防止（念のため）
        if websocket not in self.active_connections[room_id]:
            self.active_connections[room_id].append(websocket)

        return True

    def disconnect(self, websocket: WebSocket, room_id: str):
        """WebSocket接続を管理リストから除外する（同一 ws が複数回入っていても全て消す）"""
        if room_id not in self.active_connections:
            return

        conns = self.active_connections[room_id]
        while websocket in conns:
            try:
                conns.remove(websocket)
            except ValueError:
                break

    async def broadcast(self, message: str, room_id: str):
        """
        指定したルームの全クライアントにメッセージを送信する。
        送信に失敗した/死んでいる接続は即座にリストから削除する。
        """
        if room_id not in self.active_connections:
            return

        targets = self.active_connections[room_id][:]

        for ws in targets:
            # ★送信前に両方の state をチェック
            if not self._is_alive(ws):
                self.disconnect(ws, room_id)
                continue

            try:
                await ws.send_text(message)
            except Exception as e:
                # close 済み送信は想定内なので、確実に除去
                msg = str(e)
                if "close message has been sent" not in msg:
                    print(f"Broadcast delivery failed for a client in room:{room_id}. Error: {e}")
                self.disconnect(ws, room_id)


manager = ConnectionManager()
