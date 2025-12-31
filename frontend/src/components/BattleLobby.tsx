import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ForestPath from './ForestPath'; // ★追加

function BattleLobby() {
  const [roomId, setRoomId] = useState("room1");
  const [playerName, setPlayerName] = useState("player1");
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  
  const navigate = useNavigate(); // ホームに戻る用
  const socketRef = useRef<WebSocket | null>(null);

  const joinRoom = () => {
    // 環境変数があればそれを使う、なければローカルホスト
    // Viteの場合、import.meta.env.VITE_API_URL などを使うのが一般的ですが、ここではハードコード例を維持
    const wsUrl = `ws://127.0.0.1:8000/ws/${roomId}/${playerName}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      setIsConnected(true);
      setLogs(prev => [...prev, "🔵 サーバーに接続しました"]);
    };

    ws.onmessage = (event) => {
      setLogs(prev => [...prev, event.data]);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setLogs(prev => [...prev, "🔴 切断されました"]);
    };

    socketRef.current = ws;
  };

  const sendMessage = () => {
    if (socketRef.current && message) {
      socketRef.current.send(message);
      setMessage("");
    }
  };

  return (
    // ★修正: 背景色クラス(bg-purple-50)を削除し、ForestPathを配置
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      
      {/* ★背景コンポーネント (ロビーなので 'walk' モード) */}
      <ForestPath speed="walk" overlayOpacity={0.4} />

      {/* メインコンテンツ (z-indexで手前に表示) */}
      <div className="z-10 w-full max-w-2xl px-4">
        
        <header className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-black text-green-800 drop-shadow-sm mb-2 font-hakoniwa">
            対戦ロビー
          </h1>
          <p className="text-green-700 font-bold bg-white/60 inline-block px-4 py-1 rounded-full backdrop-blur-sm">
            森の奥へ進み、対戦相手を探しています...
          </p>
        </header>

        {!isConnected ? (
          <div className="bg-white/70 backdrop-blur-md p-8 rounded-3xl shadow-xl border-4 border-green-100 max-w-md mx-auto transform transition-all hover:scale-105">
            <div className="mb-6">
              <label className="block text-green-800 font-black mb-2 text-lg">ルームID</label>
              <input 
                className="border-2 border-green-200 p-3 w-full rounded-xl focus:outline-none focus:border-green-500 font-bold text-gray-700 bg-green-50" 
                value={roomId} onChange={(e) => setRoomId(e.target.value)} 
                placeholder="例: room1"
              />
            </div>
            <div className="mb-8">
              <label className="block text-green-800 font-black mb-2 text-lg">あなたの名前</label>
              <input 
                className="border-2 border-green-200 p-3 w-full rounded-xl focus:outline-none focus:border-green-500 font-bold text-gray-700 bg-green-50" 
                value={playerName} onChange={(e) => setPlayerName(e.target.value)} 
                placeholder="例: 勇者"
              />
            </div>
            <div className="space-y-3">
              <button 
                onClick={joinRoom}
                className="w-full bg-gradient-to-br from-green-500 to-green-600 text-white font-black py-4 rounded-xl shadow-lg hover:shadow-green-500/30 hover:translate-y-[-2px] transition-all active:scale-95 text-lg"
              >
                🌲 入室して進む
              </button>
              <button 
                onClick={() => navigate('/')}
                className="w-full bg-white text-green-600 font-bold py-3 rounded-xl border-2 border-green-100 hover:bg-green-50 transition-colors"
              >
                戻る
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white/70 backdrop-blur-md p-6 rounded-3xl shadow-xl border-4 border-green-100 w-full animate-fade-in-up">
            <div className="flex justify-between items-center mb-4 border-b border-green-100 pb-2">
              <span className="font-bold text-green-800">Room: {roomId}</span>
              <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded font-mono">Connected</span>
            </div>
            
            <div className="h-64 overflow-y-auto bg-green-50/50 p-4 mb-4 rounded-xl border border-green-100 font-mono text-sm shadow-inner">
              {logs.length === 0 && (
                <div className="text-center text-gray-400 mt-20">ログはまだありません</div>
              )}
              {logs.map((log, i) => (
                <div key={i} className="mb-2 p-2 bg-white rounded shadow-sm border-l-4 border-green-400 animate-slide-in-right">
                  {log}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input 
                className="border-2 border-green-200 p-3 flex-grow rounded-xl focus:outline-none focus:border-green-500 shadow-sm"
                value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder="メッセージを入力..."
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button 
                onClick={sendMessage}
                className="bg-green-500 text-white px-6 rounded-xl font-bold hover:bg-green-600 shadow-md transition-colors active:scale-95"
              >
                送信
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BattleLobby;