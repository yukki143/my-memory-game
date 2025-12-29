import { useState, useEffect, useRef } from 'react';
import GamePC from './GamePC';
import GameMobile from './GameMobile';

// ★対戦相手の動きを管理する型
type BattleData = {
  type: 'score_update' | 'game_start' | 'game_over';
  playerId: string;
  score: number;
};

function BattleMode() {
  const [roomId, setRoomId] = useState("room1");
  const [playerName, setPlayerName] = useState("Player" + Math.floor(Math.random() * 100));
  const [isConnected, setIsConnected] = useState(false);
  const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'finished'>('waiting');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  // スコア管理
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const WINNING_SCORE = 10; // 10点先取で勝ち

  const socketRef = useRef<WebSocket | null>(null);

  // ■ 1. サーバー接続
  const joinRoom = () => {
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${roomId}/${playerName}`);
    
    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      // サーバーからデータが届いた時の処理
      // メッセージは "PlayerA: { ...json... }" の形で来るので整形が必要ですが、
      // 簡易化のため、サーバー側を少し修正する方が楽です。
      // 今回は「相手が点を入れた！」という事実だけ単純に判定します。
      
      const msg = event.data as string;
      
      // 自分以外のメッセージ、かつ "SCORE_UP" という文字が含まれていたら
      if (!msg.startsWith(playerName) && msg.includes("SCORE_UP")) {
         setOpponentScore(prev => prev + 1);
      }
    };

    socketRef.current = ws;
  };

  // ■ 2. スコア送信（攻撃！）
  const addScore = () => {
    if (gameStatus !== 'playing') return;

    const newScore = myScore + 1;
    setMyScore(newScore);

    // サーバーに「点入れたよ！」と通知
    if (socketRef.current) {
      socketRef.current.send("SCORE_UP");
    }

    // 勝利判定
    if (newScore >= WINNING_SCORE) {
      setGameStatus('finished');
      // alert("あなたの勝ちです！🎉");
    }
  };

  // 相手のスコア監視（敗北判定）
  useEffect(() => {
    if (opponentScore >= WINNING_SCORE) {
      setGameStatus('finished');
      // alert("あなたの負けです...😭");
    }
  }, [opponentScore]);

return (
    // 外枠: 背景を青空に、文字色を濃く
    <div className="theme-mario-sky h-screen w-screen overflow-hidden text-slate-800 flex flex-col items-center justify-center p-4 relative">
      
      {/* タイトル: 赤色でポップに */}
      <h1 className="text-4xl md:text-6xl font-black mb-4 md:mb-8 text-red-500 drop-shadow-[0_4px_0_white] shrink-0 z-10">
        ⚡ BATTLE STAGE ⚡
      </h1>

      {/* 待機画面: 白いカード風 */}
      {!isConnected ? (
        <div className="theme-mario-card p-8 w-full max-w-md z-10">
           <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">バトルに参加する！</h2>
           <input 
             className="text-black border-4 border-blue-200 p-4 mb-4 w-full rounded-xl bg-blue-50 font-bold focus:outline-none focus:border-blue-400"
             value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="ルームID"
           />
           <input 
             className="text-black border-4 border-blue-200 p-4 mb-6 w-full rounded-xl bg-blue-50 font-bold focus:outline-none focus:border-blue-400"
             value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="プレイヤー名"
           />
           <button onClick={joinRoom} className="w-full theme-mario-green-btn py-4 rounded-xl font-black text-2xl shadow-lg">
             JOIN BATTLE!
           </button>
        </div>
      ) : (
        /* 対戦画面 */
        <div className="w-full h-full max-h-full flex flex-col items-center justify-center z-10 pb-10">
          
          <div className="w-full h-full flex flex-col-reverse md:flex-row justify-center items-center gap-4 md:gap-12 pb-4">
            
            {/* 左サイド (YOU): 緑の土管風 */}
            <div className="flex-1 w-full md:w-auto max-w-xs text-center p-4 md:p-6 theme-mario-green-box shrink-0">
              <div className="text-lg md:text-xl font-bold text-green-100 mb-1 md:mb-2">YOU</div>
              <div className="text-2xl md:text-4xl font-black mb-2 md:mb-4 truncate drop-shadow">{playerName}</div>
              <div className="text-5xl md:text-7xl font-black text-white mb-4 drop-shadow-md">{myScore}</div>
              {/* プログレスバー (黄色) */}
              <div className="w-full bg-green-800/50 rounded-full h-4 md:h-5 overflow-hidden border-2 border-green-900">
                <div 
                  className="bg-yellow-400 h-full transition-all duration-300 ease-out shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)]"
                  style={{ width: `${(myScore / WINNING_SCORE) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* 中央ゲームエリア */}
            <div className="flex flex-col items-center justify-center shrink-0 z-10">
              {/* READYボタン */}
              {gameStatus === 'waiting' && (
                <button 
                  onClick={() => setGameStatus('playing')}
                  className="theme-mario-brown-btn text-2xl md:text-4xl font-black py-4 md:py-6 px-12 md:px-20 rounded-full animate-pulse shadow-xl"
                >
                  READY? GO!
                </button>
              )}

              {/* ゲーム画面の枠 (ポップな黄色い枠に変更) */}
              {gameStatus === 'playing' && (
                <div className="bg-white rounded-3xl overflow-hidden shadow-[0_10px_0_rgba(0,0,0,0.2)] text-black 
                                border-8 border-yellow-400
                                w-[85vw] max-w-[400px] aspect-[9/16] 
                                md:w-auto md:max-w-none md:h-[70vh] md:aspect-[16/9]">
                  {isMobile ? (
                    <GameMobile onScore={addScore} />
                  ) : (
                    <GamePC onScore={addScore} />
                  )}
                </div>
              )}

              {/* 結果表示 (ポップなデザイン) */}
              {gameStatus === 'finished' && (
                 <div className="flex flex-col items-center animate-bounce text-center theme-mario-card p-8">
                   {myScore >= WINNING_SCORE ? (
                     <>
                       <div className="text-6xl md:text-8xl font-black text-yellow-500 drop-shadow-[0_4px_0_white] mb-2">⭐ WIN!</div>
                       <p className="text-xl md:text-2xl text-blue-600 font-bold">やったね！おめでとう！</p>
                     </>
                   ) : (
                     <>
                       <div className="text-6xl md:text-8xl font-black text-blue-500 drop-shadow-[0_4px_0_white] mb-2">💧 LOSE...</div>
                       <p className="text-xl md:text-2xl text-blue-600 font-bold">ドンマイ！つぎは勝てる！</p>
                     </>
                   )}
                   <button 
                     onClick={() => window.location.reload()} 
                     className="mt-8 theme-mario-green-btn py-3 px-10 rounded-full font-black text-xl"
                   >
                     もういちど！
                   </button>
                 </div>
              )}
            </div>

            {/* 右サイド (RIVAL): 茶色のブロック風 */}
            <div className="flex-1 w-full md:w-auto max-w-xs text-center p-4 md:p-6 theme-mario-brown-box shrink-0">
              <div className="text-lg md:text-xl font-bold text-amber-200 mb-1 md:mb-2">RIVAL</div>
              <div className="text-2xl md:text-4xl font-black mb-2 md:mb-4 drop-shadow">OPPONENT</div>
              <div className="text-5xl md:text-7xl font-black text-white mb-4 drop-shadow-md">{opponentScore}</div>
              {/* プログレスバー (赤) */}
              <div className="w-full bg-amber-900/50 rounded-full h-4 md:h-5 overflow-hidden border-2 border-amber-950">
                <div 
                  className="bg-red-500 h-full transition-all duration-300 ease-out shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)]"
                  style={{ width: `${(opponentScore / WINNING_SCORE) * 100}%` }}
                ></div>
              </div>
            </div>

          </div>
        </div>
      )}
      {/* 地面 */}
      <div className="absolute bottom-0 left-0 w-full h-12 theme-mario-ground-bar z-0"></div>
    </div>
  );
}

export default BattleMode;