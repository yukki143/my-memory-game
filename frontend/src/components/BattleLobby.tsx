import { useState, useEffect, useRef } from 'react';

function BattleLobby() {
  const [roomId, setRoomId] = useState("room1");
  const [playerName, setPlayerName] = useState("player1");
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  
  // WebSocketを記憶しておく箱
  const socketRef = useRef<WebSocket | null>(null);

  // 接続ボタンを押したとき
  const joinRoom = () => {
    // サーバーに接続！
    // 注意: ws:// (WebSocketプロトコル) を使います
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${roomId}/${playerName}`);
    
    ws.onopen = () => {
      setIsConnected(true);
      setLogs(prev => [...prev, "🔵 サーバーに接続しました"]);
    };

    ws.onmessage = (event) => {
      // サーバーからメッセージが来たとき
      setLogs(prev => [...prev, event.data]);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setLogs(prev => [...prev, "🔴 切断されました"]);
    };

    socketRef.current = ws;
  };

  // メッセージ送信
  const sendMessage = () => {
    if (socketRef.current && message) {
      socketRef.current.send(message);
      setMessage("");
    }
  };

  return (
    <div className="p-8 bg-purple-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-purple-700">対戦ロビー (接続テスト)</h1>

      {!isConnected ? (
        <div className="bg-white p-6 rounded shadow-md max-w-md">
          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2">ルームID</label>
            <input 
              className="border p-2 w-full rounded" 
              value={roomId} onChange={(e) => setRoomId(e.target.value)} 
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2">あなたの名前</label>
            <input 
              className="border p-2 w-full rounded" 
              value={playerName} onChange={(e) => setPlayerName(e.target.value)} 
            />
          </div>
          <button 
            onClick={joinRoom}
            className="w-full bg-purple-600 text-white font-bold py-2 rounded hover:bg-purple-700"
          >
            入室する
          </button>
        </div>
      ) : (
        <div className="bg-white p-6 rounded shadow-md max-w-2xl">
          <div className="h-64 overflow-y-auto border bg-gray-50 p-4 mb-4 rounded">
            {logs.map((log, i) => (
              <div key={i} className="mb-1 border-b pb-1">{log}</div>
            ))}
          </div>
          <div className="flex gap-2">
            <input 
              className="border p-2 flex-grow rounded"
              value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="メッセージを入力..."
            />
            <button 
              onClick={sendMessage}
              className="bg-green-500 text-white px-6 rounded font-bold"
            >
              送信
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BattleLobby;