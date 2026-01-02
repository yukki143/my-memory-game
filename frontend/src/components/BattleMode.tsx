import { useState, useEffect, useRef } from 'react';
import GamePC from './GamePC';
import GameMobile from './GameMobile';
import ForestPath from './ForestPath';

// 問題の型定義
type Problem = {
  text: string;
  kana: string;
};

// ★ モバイル用スコアカードコンポーネント（内部定義）
type MobileScoreBoardProps = {
  myScore: number;
  opponentScore: number;
  winningScore: number;
};

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

  // 時間管理（クリアタイム計算用）
  const [startTime, setStartTime] = useState(0);
  const [clearTime, setClearTime] = useState(0); // エラー解消のため定義

  // リトライ管理フラグ
  const [isRetryReady, setIsRetryReady] = useState(false);
  const [opponentRetryReady, setOpponentRetryReady] = useState(false);

  // --- 詳細リザルト用データ ---
  const [myTypoCount, setMyTypoCount] = useState(0);     
  const [myMissWordCount, setMyMissWordCount] = useState(0); 
  const [winStreak, setWinStreak] = useState(0); 
  
  // ★追加: 詳細分析用のState
  const [missedKeyStats, setMissedKeyStats] = useState<{ [key: string]: number }>({});
  const [missedProblems, setMissedProblems] = useState<Problem[]>([]);

  const WINNING_SCORE = 10;
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

// ■ 1. サーバー接続 & カウントダウン開始トリガー
  const joinRoom = () => {

    setMyScore(0);
    setOpponentScore(0);
    setIMissed(false);
    setOpponentMissed(false);

    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${roomId}/${playerName}`);
    
    ws.onopen = () => {
      setIsConnected(true);
      // 接続したら即座にカウントダウン状態へ移行
      setGameStatus('countdown');
      setCountdownValue(3);
    };

    ws.onmessage = (event) => {
      const msg = event.data as string;
      if (msg.startsWith(playerName)) return; 

      if (msg.includes("SCORE_UP")) {
         // ★修正: Stateの更新関数内で判定ロジックを入れる
         setOpponentScore(prev => {
             const newOpponentScore = prev + 1;
             
             // 相手が勝った場合
             if (newOpponentScore >= WINNING_SCORE) {
                 setGameStatus('finished');
                 setClearTime((Date.now() - startTime) / 1000);
                 setWinStreak(0); // 負けたら連勝リセット
             } else {
                 forceNextRound();
             }
             return newOpponentScore;
         });
         
      } else if (msg.includes("MISS")) {
         setOpponentMissed(true);
      } else if (msg.includes("RETRY")) {
         setOpponentRetryReady(true);
      }
    };
  };

  // タイムアウト監視
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

  // カウントダウンロジック (setIntervalに変更して安定化)
  useEffect(() => {
    if (gameStatus === 'countdown') {
        const interval = setInterval(() => {
            setCountdownValue(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    // 0になるタイミングでゲーム開始
                    setGameStatus('playing');
                    setStartTime(Date.now());
                    setResetKey(k => k + 1);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }
  }, [gameStatus]);

  // 終了判定（Stateの同期用）
  // useEffect(() => {
  //   if (isFinished && gameStatus !== 'finished') {
  //       setGameStatus('finished');
  //       setClearTime((Date.now() - startTime) / 1000);

  //       if (myScore >= WINNING_SCORE) {
  //           setWinStreak(prev => prev + 1);
  //       } else {
  //           setWinStreak(0);
  //       }
  //   }
  // }, [myScore, opponentScore, gameStatus, startTime, isFinished]);
  
  const restartGame = () => {
    setMyScore(0);
    setOpponentScore(0);
    setIMissed(false);
    setOpponentMissed(false);
    setIsRetryReady(false);
    setOpponentRetryReady(false);
    
    // 統計リセット（連勝数は維持！）
    setMyTypoCount(0);
    setMyMissWordCount(0);
    setMissedKeyStats({});
    setMissedProblems([]);
    setClearTime(0);

    setGameStatus('countdown');
    setCountdownValue(3);
  };

  // ■ リトライボタンを押した時の処理
  const handleRetry = () => {
    setIsRetryReady(true);
    // サーバーに「自分はリトライしたい」と伝える
    if (socketRef.current) socketRef.current.send("RETRY");
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
    
    // 現在のスコアではなく、加算後のスコアで判定するために変数に入れる
    const newScore = myScore + 1;
    setMyScore(newScore);

    if (socketRef.current) socketRef.current.send("SCORE_UP");

    // ★修正: ここで即座に終了判定を行う
    if (newScore >= WINNING_SCORE) {
        setGameStatus('finished');
        setClearTime((Date.now() - startTime) / 1000);
        
        // 勝った場合は連勝数を増やす
        setWinStreak(prev => prev + 1);
        
        // ★重要: ゲーム終了なら forceNextRound (次の問題へ) は実行しない
        return; 
    }
    
    forceNextRound(); // ゲーム続行時のみ実行
  };

  // 問題データを受け取って記録する
  const sendMiss = (problem?: Problem) => {
    if (gameStatus !== 'playing') return;
    setIMissed(true);
    setMyMissWordCount(prev => prev + 1);
    
    // ミス問題リストに追加
    if (problem) {
        setMissedProblems(prev => [...prev, problem]);
    }

    if (socketRef.current) socketRef.current.send("MISS");
    if (opponentMissed) forceNextRound();
  };

  const handleTypo = (expectedChar: string) => {
      if (gameStatus === 'playing') {
          setMyTypoCount(prev => prev + 1);
          setMissedKeyStats(prev => {
              const char = expectedChar.toUpperCase();
              return { ...prev, [char]: (prev[char] || 0) + 1 };
          });
      }
  };

  // ★ランク計算ロジック
  const getTypingRank = (count: number) => {
      if (count === 0) return 'S';
      if (count <= 3) return 'A';
      if (count <= 8) return 'B';
      if (count <= 12) return 'C';
      if (count <= 15) return 'D';
      return 'E';
  };

  const getMemoryRank = (score: number, miss: number) => {
      const total = score + miss;
      if (total === 0) return '-';
      const percentage = (score / total) * 100;
      if (percentage === 100) return 'S';
      if (percentage >= 90) return 'A';
      if (percentage >= 80) return 'B';
      if (percentage >= 70) return 'C';
      if (percentage >= 60) return 'D';
      return 'E';
  };

  const getSortedMissedKeys = () => {
      return Object.entries(missedKeyStats)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);
  };

  const showHUD = gameStatus === 'countdown' || gameStatus === 'playing';
  const isResultScrollable = isMobile && gameStatus === 'finished';

const MobileScoreBoard = ({ myScore, opponentScore, winningScore }: MobileScoreBoardProps) => (
  <div className="absolute top-3 right-3 z-50 w-[60vw] max-w-[260px] theme-wood-box p-2 flex justify-between items-center shadow-xl bg-[#d7ccc8] border-2 border-[#8d6e63]">
    {/* YOU (Left) */}
    <div className="flex flex-col w-[45%]">
      <div className="flex justify-between items-end mb-1">
        <span className="text-xs font-bold font-hakoniwa truncate max-w-[70%]">YOU</span>
        <span className="text-xl font-black font-pop leading-none text-green-700">{myScore}</span>
      </div>
      <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden border border-gray-500">
        <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${Math.min((myScore / winningScore) * 100, 100)}%` }}></div>
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
        <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${Math.min((opponentScore / winningScore) * 100, 100)}%` }}></div>
      </div>
    </div>
  </div>
);

  return (
    <div className={`relative w-screen flex flex-col items-center justify-center p-4 
        ${isResultScrollable ? 'min-h-screen overflow-y-auto' : 'h-screen overflow-hidden'}`}>
      
      {/* 背景色レイヤー */}
      <div className="absolute inset-0 bg-green-100 -z-20" />
      
      {/* 背景アニメーション */}
      <ForestPath overlayOpacity={0.2} />

      {/* 戻るボタン */}
      <button 
        onClick={() => window.location.href = '/'} 
        className="absolute top-4 left-4 z-50 theme-wood-btn px-6 py-3 flex items-center gap-2 font-bold text-sm md:text-base font-pop"
      >
        <span>←</span>
        <span>もどる</span>
      </button>

      {/* モバイル用スコア */}
      {isMobile && showHUD && (
        <MobileScoreBoard 
          myScore={myScore} 
          opponentScore={opponentScore} 
          winningScore={WINNING_SCORE} 
        />
      )}

      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">

        {!isConnected ? (
            /* --- 待機・接続画面 --- */
            <>
                <h1 className="text-4xl md:text-6xl mb-8 text-center text-battle-logo font-hakoniwa animate-fade-in-down" data-text="BATTLE STAGE">
                    BATTLE STAGE
                </h1>
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
            /* --- 接続後エリア --- */
            <div className="w-full h-full flex flex-col items-center justify-center">
                
                {/* ★修正ポイント: 「ゲーム中画面」と「結果画面」を完全に分けることでタグの閉じ忘れを防ぐ*/}

                {gameStatus === 'countdown' || gameStatus === 'playing' ? (
                    /* --- 1. ゲーム中レイアウト (3カラム: YOU | GAME | RIVAL) --- */
                    <div className="w-full h-full flex flex-row justify-center items-center gap-4 md:gap-12 pb-4">
                        
                        {/* 左サイド (YOU) */}
                        {!isMobile && showHUD && (
                            <div className="w-64 theme-leaf-box p-6 text-center shrink-0 shadow-xl border-4 border-green-800 bg-green-100 animate-slide-in-left">
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
                            {gameStatus === 'countdown' && (
                                <div className="flex flex-col items-center justify-center">
                                    <div className="text-2xl md:text-3xl font-bold text-white drop-shadow-md font-hakoniwa mb-4">MATCHED!</div>
                                    <div className="text-5xl md:text-5xl font-black text-[#ffca28] drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] font-pop scale-150 mt-2">
                                        {countdownValue > 0 ? countdownValue : "START!"}
                                    </div>
                                </div>
                            )}

                            {gameStatus === 'playing' && (
                                <div className={`bg-white/90 rounded-3xl overflow-hidden shadow-2xl border-8 border-[#d4a373] animate-pop-in
                                    ${isMobile ? 'w-[90vw] aspect-[3/4] mt-10' : 'w-[95vw] max-w-5xl h-[70vh] min-h-[500px]'}`}>
                                    {isMobile ? (
                                        <GameMobile onScore={addScore} onWrong={sendMiss} resetKey={resetKey} /> 
                                    ) : (
                                        <GamePC onScore={addScore} onWrong={sendMiss} onTypo={handleTypo} resetKey={resetKey} />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 右サイド (RIVAL) */}
                        {!isMobile && showHUD && (
                            <div className="w-64 theme-wood-box p-6 text-center shrink-0 shadow-xl border-4 border-[#8d6e63] bg-[#fff8e1] animate-slide-in-right">
                                <div className="text-xl font-bold mb-2 font-hakoniwa text-[#5d4037]">RIVAL</div>
                                <div className="text-3xl font-black mb-4 drop-shadow font-pop text-[#3e2723]">OPPONENT</div>
                                <div className="text-7xl font-black mb-4 drop-shadow-md font-pop text-[#bf360c]">{opponentScore}</div>
                                <div className="w-full bg-amber-900/20 rounded-full h-5 overflow-hidden border-2 border-amber-900/50">
                                    <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${(opponentScore / WINNING_SCORE) * 100}%` }}></div>
                                </div>
                            </div>
                        )}
                    </div>

                ) : (
                    /* --- 2. 結果画面レイアウト (2カラム: 結果 | 分析) --- */
                    <div className={`relative z-50 w-full max-w-6xl flex flex-col md:flex-row gap-6 items-stretch justify-center p-2 
                        ${isMobile ? 'h-auto mt-20 pb-10' : 'h-[85vh]'}`}>
                        
                        {/* 左カード: 勝敗 & 連勝記録 */}
                        <div className="flex-1 h-full min-w-0">
                            <div className="theme-wood-box p-6 h-full flex flex-col items-center shadow-2xl animate-fade-in-up">
                                {myScore >= WINNING_SCORE ? (
                                    <>
                                        <div className="text-5xl md:text-7xl font-black text-yellow-500 drop-shadow-md mb-2 pt-12 font-pop animate-bounce">YOU WIN!</div>
                                        <p className="text-3xl font-bold font-hakoniwa text-[#5d4037]">おめでとう！</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-5xl md:text-7xl font-black text-blue-500 drop-shadow-md mb-2 pt-12 font-pop">YOU LOSE...</div>
                                        <p className="text-3xl font-bold font-hakoniwa text-[#5d4037]">ドンマイ！</p>
                                    </>
                                )}

                                {/* 連勝表示 */}
                                <div className="mt-8 bg-[#fff8e1] border-4 border-[#d4a373] rounded-2xl p-6 w-full max-w-xs text-center shadow-inner transform rotate-1">
                                    <div className="text-3xl font-bold text-[#8d6e63] font-hakoniwa mb-2">連続勝利数</div>
                                    <div className="text-3xl font-bold text-[#8d6e63] font-hakoniwa mb-2">👑</div>
                                    <div className="text-6xl font-black font-pop text-[#d97706] drop-shadow-sm flex items-center justify-center gap-0">
                                        <span className="text-3xl"></span>{winStreak}
                                    </div>
                                </div>

                                {/* スコア対比 */}
                                <div className="mt-8 flex justify-center items-center gap-8 w-full font-pop">
                                    <div className="text-center">
                                        <div className="text-4xs font-bold text-green-800">YOU</div>
                                        <div className="text-8xl font-black text-green-600">{myScore}</div>
                                    </div>
                                    <div className="text-2xl font-black text-[#5d4037] opacity-50">-</div>
                                    <div className="text-center">
                                        <div className="text-4xs font-bold text-red-800">RIVAL</div>
                                        <div className="text-8xl font-black text-red-600">{opponentScore}</div>
                                    </div>
                                </div>

                                <div className="mt-auto mb-24 w-full flex justify-center">
                                    {isRetryReady ? (
                                        <div className="px-6 py-4 bg-gray-200 rounded-full font-bold text-gray-600 animate-pulse w-full text-center">
                                            相手の承認を待っています...
                                        </div>
                                    ) : (
                                        <button onClick={handleRetry} className="theme-leaf-btn py-3 rounded-xl font-black text-xl font-pop shadow-lg transform transition hover:scale-105 w-full max-w-xs">
                                            再戦
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 右カード: 詳細分析 */}
                        <div className="flex-1 h-full min-w-0">
                          <div className="theme-wood-box p-6 flex-1 h-full flex flex-col shadow-2xl animate-fade-in-up delay-100 overflow-hidden">
                              <h3 className="text-xl font-bold mb-4 border-b-4 border-[#8d6e63] pb-2 text-[#5d4037] flex items-center gap-2 font-hakoniwa shrink-0">
                                  バトル分析
                              </h3>
                              
                              <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                                  {/* ランクスコア */}
                                  <div className="bg-[#fff8e1] p-4 rounded-xl border-4 border-[#d4a373] shadow-inner">
                                      <h4 className="text-sm font-bold text-[#5d4037] mb-3 text-center border-b border-[#d4a373] pb-1 mx-4">プレイ評価</h4>

                                      <div className="flex justify-around items-center">
                                          <div className="text-center">
                                              <div className="text-sm font-bold text-[#8d6e63] mb-1">暗記力</div>
                                              <div className="text-5xl font-black font-pop text-[#d97706] drop-shadow-sm">{getMemoryRank(WINNING_SCORE, missedProblems.length)}</div>
                                          </div>
                                          {!isMobile && (
                                              <>
                                                  <div className="w-px h-12 bg-[#d4a373]"></div>
                                                  <div className="text-center">
                                                      <div className="text-sm font-bold text-[#8d6e63] mb-1">タイピング</div>
                                                      <div className="text-5xl font-black font-pop text-[#d97706] drop-shadow-sm">{getTypingRank(myTypoCount)}</div>
                                                  </div>
                                              </>
                                          )}
                                      </div>
                                  </div>

                                  {/* ミスキー (PCのみ) */}
                                  {!isMobile && (
                                      <div className="bg-white/80 p-4 rounded-xl border-2 border-red-200 shadow-sm">
                                          <div className="text-sm font-bold text-red-800 mb-2 flex items-center gap-2">
                                              <span>⌨️ 苦手なキー</span>
                                              <span className="text-xs font-normal bg-red-100 px-2 py-0.5 rounded text-red-600">Total: {myTypoCount}</span>
                                          </div>
                                          <div className="flex gap-2 flex-wrap">
                                              {getSortedMissedKeys().length === 0 ? (
                                                  <span className="text-sm text-gray-400 w-full text-center py-2">ミスなし！Perfect!</span>
                                              ) : (
                                                  getSortedMissedKeys().map(([key, count]) => (
                                                      <div key={key} className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-lg font-bold border border-red-200 flex items-center gap-2 shadow-sm">
                                                          <span className="font-mono text-2xl">{key}</span>
                                                          <span className="text-sm opacity-60">x{count}</span>
                                                      </div>
                                                  ))
                                              )}
                                          </div>
                                      </div>
                                  )}

                                  {/* ミス問題リスト */}
                                  <div className="bg-white/80 p-4 rounded-xl border-2 border-blue-200 shadow-sm min-h-[150px]">
                                      <div className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                                          <span>❌ ミスした問題</span>
                                          <span className="text-xs font-normal bg-blue-100 px-2 py-0.5 rounded text-blue-600">Total: {missedProblems.length}</span>
                                      </div>
                                      <div className="bg-white rounded border border-blue-100 max-h-[200px] overflow-y-auto">
                                          {missedProblems.length === 0 ? (
                                              <div className="text-center text-gray-400 text-sm py-8">全問正解！すごい！</div>
                                          ) : (
                                              <ul className="divide-y divide-blue-50">
                                                  {missedProblems.map((p, i) => (
                                                      <li key={i} className="p-2 flex justify-between items-center hover:bg-blue-50/50 transition">
                                                          <span className="font-bold text-red-600 mr-2">{p.text}</span>
                                                          <span className="text-gray-500 text-xs">{p.kana}</span>
                                                      </li>
                                                  ))}
                                              </ul>
                                          )}
                                      </div>
                                  </div>
                              </div>
                          </div>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
}

export default BattleMode;