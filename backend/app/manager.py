# backend/app/manager.py
import asyncio
from fastapi import WebSocket
from starlette.websockets import WebSocketState
from typing import List, Dict

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.cleanup_tasks: Dict[str, asyncio.Task] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
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
        
        self.active_connections[room_id].append(websocket)
        return True

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)

    async def broadcast(self, message: str, room_id: str):
        if room_id in self.active_connections:
            targets = self.active_connections[room_id][:]
            for connection in targets:
                try:
                    # 接続が完全に確立されている場合のみ送信
                    if connection.client_state == WebSocketState.CONNECTED:
                        await connection.send_text(message)
                except Exception as e:
                    print(f"Broadcast error (room:{room_id}): {e}")
                    if connection in self.active_connections[room_id]:
                        self.active_connections[room_id].remove(connection)

manager = ConnectionManager()