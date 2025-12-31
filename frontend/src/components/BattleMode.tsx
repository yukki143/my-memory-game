import { useState, useEffect, useRef } from 'react';
import GamePC from './GamePC';
import GameMobile from './GameMobile';
import ForestPath from './ForestPath';

function BattleMode() {
  const [roomId, setRoomId] = useState("room1");
  const [playerName, setPlayerName] = useState("Player" + Math.floor(Math.random() * 100));
  const [isConnected, setIsConnected] = useState(false);
  const [gameStatus, setGameStatus] = useState<'waiting' | 'countdown' | 'playing' | 'finished'>('waiting');
  const [countdownValue, setCountdownValue] = useState(3);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);

  // ゲームを強制的に次の問題に進めるためのトリガー
  const [resetKey, setResetKey] = useState(0);

  // 不正解フラグ
  const [iMissed, setIMissed] = useState(false);
  const [opponentMissed, setOpponentMissed] = useState(false);

  // リトライ管理フラグ
  const [isRetryReady, setIsRetryReady] = useState(false);
  const [opponentRetryReady, setOpponentRetryReady] = useState(false);

  const WINNING_SCORE = 10;
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

// ■ 1. サーバー接続 & カウントダウン開始トリガー
  const joinRoom = () => {
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${roomId}/${playerName}`);
    
    ws.onopen = () => {
      setIsConnected(true);
      // 接続したら即座にカウントダウン状態へ移行
      setGameStatus('countdown');
      setCountdownValue(3);
    };

    ws.onmessage = (event) => {
      const msg = event.data as string;
      if (msg.startsWith(playerName)) return; // 自分のメッセージは無視

      // 相手のアクションを受け取る
      if (msg.includes("SCORE_UP")) {
         // 相手が正解 -> 相手に点数 & 自分は強制的に次の問題へ
         setOpponentScore(prev => prev + 1);
         forceNextRound(); 
      } else if (msg.includes("MISS")) {
        // 相手が不正解だった場合
         setOpponentMissed(true); // 相手のミスフラグをON
      } else if (msg.includes("RETRY")) {
        // 相手がリトライを希望した
        setOpponentRetryReady(true);
      }
    };
    socketRef.current = ws;
  };

  useEffect(() => {
    // 「自分がミスして相手待ち」または「相手がミスして自分待ち」の状態かどうか
    const isOneSideWaiting = (iMissed && !opponentMissed) || (!iMissed && opponentMissed);

    if (!isOneSideWaiting) return; // 待機状態でなければ何もしない

    // 5秒後に強制的に次の問題へ
    const timer = setTimeout(() => {
        console.log("Time over! Force next round.");
        forceNextRound();
    }, 5000);

    // クリーンアップ関数
    return () => clearTimeout(timer);
  }, [iMissed, opponentMissed]);

  useEffect(() => {
    if (opponentMissed && iMissed) {
        // 両者不正解！ -> 次へ
        forceNextRound();
    }
  }, [opponentMissed, iMissed]);

  useEffect(() => {
    if (isRetryReady && opponentRetryReady) {
        restartGame();
    }
  }, [isRetryReady, opponentRetryReady]);

  // ■ ゲーム再起動（スコアなどをリセット）
  const restartGame = () => {
    // ステートを全リセット
    setMyScore(0);
    setOpponentScore(0);
    setIMissed(false);
    setOpponentMissed(false);
    setIsRetryReady(false);
    setOpponentRetryReady(false);
    setResetKey(prev => prev + 1); // 問題も更新

    // カウントダウンから開始
    setGameStatus('countdown');
    setCountdownValue(3);
  };

  // ■ リトライボタンを押した時の処理
  const handleRetry = () => {
    setIsRetryReady(true);
    // サーバーに「自分はリトライしたい」と伝える
    if (socketRef.current) {
        socketRef.current.send("RETRY");
    }
  };

  // ■ 次のラウンドへ強制移行 (リセット処理)
  const forceNextRound = () => {
    // 演出のため少し待つ
    setTimeout(() => {
        setResetKey(prev => prev + 1);
        // ★重要: フラグをリセット
        setIMissed(false);
        setOpponentMissed(false);
    }, 200); 
  };

  // ■ 正解送信
  const addScore = () => {
    if (gameStatus !== 'playing') return;
    const newScore = myScore + 1;
    setMyScore(newScore);
    if (socketRef.current) socketRef.current.send("SCORE_UP");
    if (newScore >= WINNING_SCORE) setGameStatus('finished');
    
    forceNextRound(); // 自分が正解したら問答無用で次へ
  };

  // ■ 不正解送信 (修正)
  const sendMiss = () => {
    if (gameStatus !== 'playing') return;
    
    setIMissed(true); // 自分のミスフラグをON
    if (socketRef.current) socketRef.current.send("MISS");

    // もしこの時点で「既に相手がミスしていた」なら、自分が最後の一人なので次へ進める
    if (opponentMissed) {
        forceNextRound();
    }
  };

  // カウントダウン
  useEffect(() => {
    if (gameStatus === 'countdown' && countdownValue > 0) {
      const timer = setTimeout(() => setCountdownValue(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (gameStatus === 'countdown' && countdownValue === 0) {
      setGameStatus('playing');
    }
  }, [gameStatus, countdownValue]);

  // 終了判定
  useEffect(() => {
    if (opponentScore >= WINNING_SCORE) setGameStatus('finished');
  }, [opponentScore]);

  // フラグ: スコアボードを表示するかどうか
  // 要件: 「カウントダウン」と「playing」のときだけ表示
  const showHUD = gameStatus === 'countdown' || gameStatus === 'playing';

  // ★ モバイル用スコアカードコンポーネント（内部定義）
  const MobileScoreBoard = () => (
    <div className="absolute top-3 right-3 z-50 w-[60vw] max-w-[260px] theme-wood-box p-2 flex justify-between items-center shadow-xl bg-[#d7ccc8] border-2 border-[#8d6e63]">
      {/* YOU (Left) */}
      <div className="flex flex-col w-[45%]">
        <div className="flex justify-between items-end mb-1">
          <span className="text-xs font-bold font-hakoniwa truncate max-w-[70%]">YOU</span>
          <span className="text-xl font-black font-pop leading-none text-green-700">{myScore}</span>
        </div>
        <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden border border-gray-500">
          <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${Math.min((myScore / WINNING_SCORE) * 100, 100)}%` }}></div>
        </div>
      </div>

      {/* VS Separator */}
      <div className="font-black text-amber-900 opacity-50 text-sm px-2">VS</div>

      {/* RIVAL (Right) */}
      <div className="flex flex-col w-[45%]">
         <div className="flex justify-between items-end mb-1">
          <span className="text-xl font-black font-pop leading-none text-red-700">{opponentScore}</span>
          <span className="text-xs font-bold font-hakoniwa truncate max-w-[70%] text-right">RIVAL</span>
        </div>
        <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden border border-gray-500">
          <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${Math.min((opponentScore / WINNING_SCORE) * 100, 100)}%` }}></div>
        </div>
      </div>
    </div>
  );

return (
    // 外枠: relative
    <div className="relative h-screen w-screen overflow-hidden flex flex-col items-center justify-center p-4">
      
      {/* ★背景: 森の道アニメーション */}
      <ForestPath overlayOpacity={0.2} />

      {/* 左上の戻るボタン */}
      <button 
        onClick={() => window.location.href = '/'} 
        className="absolute top-4 left-4 z-50 theme-wood-btn px-6 py-3 flex items-center gap-2 font-bold text-sm md:text-base font-pop"
      >
        <span>←</span>
        <span>もどる</span>
      </button>

      {/* ★ここに移動: 右上のスコアボード（スマホのみ表示） */}
      {isMobile && showHUD && <MobileScoreBoard />}

      {/* メインコンテンツ: z-10 */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">

        {!isConnected ? (
            <>
                {/* 1. タイトル（カードの外、上側に配置） */}
                <h1 
                    className="text-4xl md:text-6xl mb-8 text-center text-battle-logo font-hakoniwa animate-fade-in-down"
                    data-text="BATTLE STAGE"
                >
                    BATTLE STAGE
                </h1>

                {/* 2. 入力フォームのカード（タイトルは含めない） */}
                <div className="theme-wood-box p-8 w-full max-w-md shadow-2xl animate-fade-in-up">
                    <h2 className="text-2xl font-bold mb-6 text-center font-hakoniwa text-[#5d4037]">バトルに参加する</h2>
                    <input 
                        className="text-black border-4 border-[#8d6e63] p-4 mb-4 w-full rounded-xl bg-[#fff8e1] font-bold focus:outline-none focus:border-[#5d4037]"
                        value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="ルームID"
                    />
                    <input 
                        className="text-black border-4 border-[#8d6e63] p-4 mb-6 w-full rounded-xl bg-[#fff8e1] font-bold focus:outline-none focus:border-[#5d4037]"
                        value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="プレイヤー名"
                    />
                    <button onClick={joinRoom} className="w-full theme-leaf-btn py-4 rounded-xl font-black text-2xl shadow-lg font-pop transform transition hover:scale-105">
                        JOIN BATTLE
                    </button>
                </div>
            </>
        ) : (
            /* 接続後：ゲーム画面 */
            <div className="flex flex-col items-center justify-center shrink-0">

                <div className="w-full h-full flex flex-row justify-center items-center gap-4 md:gap-12 pb-4">

                    {/* 左サイド (YOU) - PCかつshowHUDがtrueの時のみ表示 */}
                    {!isMobile && showHUD && (
                        <div className="w-64 theme-leaf-box p-6 text-center shrink-0 shadow-xl border-4 border-green-800 bg-green-100">
                            <div className="text-xl font-bold mb-2 font-hakoniwa text-green-900">YOU</div>
                            <div className="text-3xl font-black mb-4 truncate font-pop text-green-800">{playerName}</div>
                            <div className="text-7xl font-black mb-4 font-pop text-green-600 drop-shadow-sm">{myScore}</div>
                            <div className="w-full bg-green-900/20 rounded-full h-5 overflow-hidden border-2 border-green-700/50">
                                <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${(myScore / WINNING_SCORE) * 100}%` }}></div>
                            </div>
                        </div>
                    )}

                    {/* 中央ゲームエリア */}
                    <div className="flex flex-col items-center justify-center shrink-0">
                        {/* カウントダウン表示 */}
                        {gameStatus === 'countdown' && (
                            <div className="flex flex-col items-center justify-center">
                                <div className="text-2xl md:text-3xl font-bold text-white drop-shadow-md font-hakoniwa mb-4">MATCHED!</div>
                                <div className="text-5xl md:text-5xl font-black text-[#ffca28] drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] font-pop scale-150 pt-2">
                                    {countdownValue > 0 ? countdownValue : "START!"}
                                </div>
                            </div>
                        )}
                        {gameStatus === 'playing' && (
                            <div className="bg-white/90 rounded-3xl overflow-hidden shadow-xl text-black border-8 border-[#d4a373] w-[85vw] max-w-[400px] aspect-[9/16] md:w-auto md:max-w-none md:h-[70vh] md:aspect-[16/9]">
                            {isMobile ? (
                                <GameMobile 
                                    onScore={addScore} 
                                    onWrong={sendMiss}   // ★追加
                                    resetKey={resetKey}  // ★追加
                                /> 
                            ) : (
                                <GamePC 
                                    onScore={addScore} 
                                    onWrong={sendMiss}   // ★追加
                                    resetKey={resetKey}  // ★追加
                                />
                            )}
                            </div>
                        )}

                        {gameStatus === 'finished' && (
                          <div className="flex flex-col items-center animate-bounce text-center theme-wood-box p-8">
                            {myScore >= WINNING_SCORE ? (
                              <>
                              <div className="text-6xl md:text-8xl font-black text-yellow-500 drop-shadow-md mb-2 font-pop">YOU WIN!</div>
                              <p className="text-xl md:text-2xl font-bold font-hakoniwa">やったね！おめでとう！</p>
                              </>
                            ) : (
                              <>
                              <div className="text-6xl md:text-8xl font-black text-blue-500 drop-shadow-md mb-2 font-pop">YOU LOSE...</div>
                              <p className="text-xl md:text-2xl font-bold font-hakoniwa">ドンマイ！つぎは勝てる！</p>
                              </>
                            )}
                            {/* ★変更: リトライボタンのUI制御 */}
                            {isRetryReady ? (
                                <div className="mt-8 px-6 py-4 bg-gray-200 rounded-full font-bold text-gray-600 animate-pulse">
                                    相手の承認を待っています...
                                </div>
                            ) : (
                                <button onClick={handleRetry} className="mt-8 theme-leaf-btn py-3 px-10 rounded-full font-black text-xl font-pop shadow-lg transform transition hover:scale-105">
                                    リトライ
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* 右サイド (RIVAL) - PCのみ表示 */}
                {!isMobile && showHUD && (
                    <div className="w-64 theme-wood-box p-6 text-center shrink-0 shadow-xl border-4 border-[#8d6e63] bg-[#fff8e1]">
                        <div className="text-xl font-bold mb-2 font-hakoniwa text-[#5d4037]">RIVAL</div>
                        <div className="text-3xl font-black mb-4 drop-shadow font-pop text-[#3e2723]">OPPONENT</div>
                        <div className="text-7xl font-black mb-4 drop-shadow-md font-pop text-[#bf360c]">{opponentScore}</div>
                        <div className="w-full bg-amber-900/20 rounded-full h-5 overflow-hidden border-2 border-amber-900/50">
                            <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${(opponentScore / WINNING_SCORE) * 100}%` }}></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
        )}
      </div>
    </div>
  );
}

export default BattleMode;