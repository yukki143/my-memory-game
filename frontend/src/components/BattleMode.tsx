// src/BattleMode.tsx
import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GamePC from './GamePC';
import GameMobile from './GameMobile';
import ForestPath from './ForestPath';
import { DEFAULT_SETTINGS } from '../types';
import { useSound } from '../hooks/useSound';

type Problem = {
  text: string;
  kana: string;
};

type MobileScoreBoardProps = {
  myScore: number;
  opponentScore: number;
  winningScore: number;
  myName: string;
  opponentName: string;
};

const MobileScoreBoard = ({ myScore, opponentScore, winningScore, myName, opponentName }: MobileScoreBoardProps) => (
  <div className="absolute top-3 right-3 z-50 w-[60vw] max-w-[260px] theme-wood-box p-2 flex justify-between items-center shadow-xl bg-[#d7ccc8] border-2 border-[#8d6e63]">
    <div className="flex flex-col w-[45%]">
      <div className="flex justify-between items-end mb-1">
        <span className="text-xs font-bold font-hakoniwa truncate max-w-[70%]">{myName}</span>
        <span className="text-xl font-black font-pop leading-none text-green-700">{myScore}</span>
      </div>
      <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden border border-gray-500">
        <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${Math.min((myScore / winningScore) * 100, 100)}%` }}></div>
      </div>
    </div>
    <div className="font-black text-amber-900 opacity-50 text-sm px-2">VS</div>
    <div className="flex flex-col w-[45%]">
       <div className="flex justify-between items-end mb-1">
        <span className="text-xl font-black font-pop leading-none text-red-700">{opponentScore}</span>
        <span className="text-xs font-bold font-hakoniwa truncate max-w-[70%] text-right">{opponentName}</span>
      </div>
      <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden border border-gray-500">
        <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${Math.min((opponentScore / winningScore) * 100, 100)}%` }}></div>
      </div>
    </div>
  </div>
);

function BattleMode() {
  const location = useLocation();
  const navigate = useNavigate();

  const { 
      roomId = "room1", 
      playerName = "Guest",
      playerId = `Guest_${Math.random()}`, 
      isHost = false,
      settings = DEFAULT_SETTINGS,
      memorySetId
  } = location.state || {};

  const WINNING_SCORE = settings.clearConditionValue || 10;
  const CONDITION_TYPE = settings.conditionType || 'score';
  const { playSE } = useSound();

  const [isConnected, setIsConnected] = useState(false);
  const [gameStatus, setGameStatus] = useState<'waiting' | 'countdown' | 'playing' | 'finished'>('waiting');
  const [countdownValue, setCountdownValue] = useState(3);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [roundNumber, setRoundNumber] = useState(0);
  const [iMissed, setIMissed] = useState(false);
  const [opponentMissed, setOpponentMissed] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [clearTime, setClearTime] = useState(0); 
  const [isRetryReady, setIsRetryReady] = useState(false);
  const [opponentRetryReady, setOpponentRetryReady] = useState(false);
  const [myTypoCount, setMyTypoCount] = useState(0);     
  const [myMissWordCount, setMyMissWordCount] = useState(0); 
  const [winStreak, setWinStreak] = useState(0); 
  const [missedKeyStats, setMissedKeyStats] = useState<{ [key: string]: number }>({});
  const [missedProblems, setMissedProblems] = useState<Problem[]>([]);
  const [opponentName, setOpponentName] = useState("Rival");

  const socketRef = useRef<WebSocket | null>(null);
  const isConnecting = useRef(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (socketRef.current || isConnecting.current) return;
    isConnecting.current = true;
    joinRoom();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      isConnecting.current = false;
    };
  }, []);

  const joinRoom = () => {
    const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
    const WS_BASE = API_BASE.replace(/^http/, 'ws');
    
    const ws = new WebSocket(`${WS_BASE}/ws/${roomId}/${playerId}`);
    socketRef.current = ws;
    
    ws.onopen = () => {
      setIsConnected(true);
      setGameStatus('waiting');
    };

    ws.onmessage = (event) => {
      const msg = event.data as string;
      let senderId = "";
      let command = "";
      
      if (msg.includes(":")) {
          const parts = msg.split(":");
          senderId = parts[0];
          command = parts.slice(1).join(":");
      } else {
          command = msg;
      }

      if (senderId === playerId && command !== "MATCHED") return;

      if (command === "MATCHED") {
          prepareNextGame();
          startCountdown();
          wsSend("NAME:" + playerName);
      } 
      else if (command.startsWith("NAME:")) {
          setOpponentName(command.substring(5));
      }
      else if (command === "SCORE_UP") {
          setOpponentScore(prev => prev + 1);
      } 
      else if (command === "MISS") {
          setOpponentMissed(true);
      } 
      else if (command === "RETRY") {
          setOpponentRetryReady(true);
      }
    };

    ws.onclose = (event) => {
        setIsConnected(false);
        if (event.code === 4001) {
            alert("満員です");
            navigate('/lobby');
        } else if (event.code === 4000) {
            alert("ルームが見つかりません");
            navigate('/lobby');
        }
    };
  };

  const startCountdown = () => {
      setGameStatus('countdown');
      setCountdownValue(3);
  };

  const wsSend = (cmd: string) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(`${playerId}:${cmd}`);
      }
  };

  useEffect(() => {
    const isOneSideWaiting = (iMissed && !opponentMissed) || (!iMissed && opponentMissed);
    if (!isOneSideWaiting || gameStatus !== 'playing') return;
    const timer = setTimeout(() => {
        goNextRound();
    }, 5000);
    return () => clearTimeout(timer);
  }, [iMissed, opponentMissed, gameStatus]);

  useEffect(() => {
    if (opponentMissed && iMissed && gameStatus === 'playing') {
        setTimeout(goNextRound, 500); 
    }
  }, [opponentMissed, iMissed, gameStatus]);

  useEffect(() => {
    if (isRetryReady && opponentRetryReady && isHost) {
        wsSend("MATCHED");
    }
  }, [isRetryReady, opponentRetryReady, isHost]);

  useEffect(() => {
    if (gameStatus === 'countdown') {
        const interval = setInterval(() => {
            setCountdownValue(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setGameStatus('playing');
                    setStartTime(Date.now());
                    setRoundNumber(1);
                    setIMissed(false);
                    setOpponentMissed(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }
  }, [gameStatus]);


  const checkBattleFinish = (isWin: boolean) => {
    if (isWin) {
      playSE('/sounds/se_win.mp3');
    } else {
      playSE('/sounds/se_lose.mp3');
    }
  };

  useEffect(() => {
    if (opponentScore === 0 || gameStatus !== 'playing') return;
    
    setTimeout(() => {
        if (CONDITION_TYPE === 'score' && opponentScore >= WINNING_SCORE) {
            checkBattleFinish(false);
            setGameStatus('finished');
            setClearTime((Date.now() - startTime) / 1000);
            setWinStreak(0);
        } else {
            goNextRound();
        }
    }, 500);
  }, [opponentScore]);
  
  const prepareNextGame = () => {
    setMyScore(0);
    setOpponentScore(0);
    setIMissed(false);
    setOpponentMissed(false);
    setIsRetryReady(false);
    setOpponentRetryReady(false);
    setMyTypoCount(0);
    setMyMissWordCount(0);
    setMissedKeyStats({});
    setMissedProblems([]);
    setClearTime(0);
    setRoundNumber(0);
  };

  const handleRetry = () => {
    if (isRetryReady) return;
    setIsRetryReady(true);
    wsSend("RETRY");
  };

  const goNextRound = () => {
    if (gameStatus !== 'playing') return;

    if (CONDITION_TYPE === 'total' && roundNumber >= WINNING_SCORE) {
        const isWin = myScore > opponentScore;
        checkBattleFinish(isWin);
        setGameStatus('finished');
        setClearTime((Date.now() - startTime) / 1000);
        if (isWin) setWinStreak(prev => prev + 1);
        else setWinStreak(0);
        return;
    }
    setRoundNumber(prev => prev + 1);
    setIMissed(false);
    setOpponentMissed(false);
  };

  const addScore = () => {
    if (gameStatus !== 'playing') return;
    const newScore = myScore + 1;
    setMyScore(newScore);
    wsSend("SCORE_UP");

    setTimeout(() => {
        if (gameStatus !== 'playing') return;

        if (CONDITION_TYPE === 'score' && newScore >= WINNING_SCORE) {
            checkBattleFinish(true);
            setGameStatus('finished');
            setClearTime((Date.now() - startTime) / 1000);
            setWinStreak(prev => prev + 1);
        } else {
            goNextRound();
        }
    }, 500);
  };

  const sendMiss = (problem?: Problem) => {
    if (gameStatus !== 'playing') return;
    setIMissed(true);
    setMyMissWordCount(prev => prev + 1);
    if (problem) {
        setMissedProblems(prev => [...prev, problem]);
    }
    wsSend("MISS");
  };

  const handleTypo = (expectedChar: string) => {
      if (gameStatus === 'playing') {
          playSE('/sounds/se_typo.mp3');
          setMyTypoCount(prev => prev + 1);
          setMissedKeyStats(prev => {
              const char = expectedChar.toUpperCase();
              return { ...prev, [char]: (prev[char] || 0) + 1 };
          });
      }
  };

  const getTypingRank = (count: number, myScore: number) => {
    if (myScore === 0 && count === 0) return '-';
    if (count === 0) return 'S';
    if (count <= 3) return 'A';
    if (count <= 8) return 'B';
    if (count <= 12) return 'C';
    if (count <= 15) return 'D';
    return 'E';
  };


  const getMemoryRank = (score: number, miss: number) => {
      if (score === 0 && miss === 0) return '-';
      if (miss === 0) return 'S';
      if (miss === 1) return 'A';
      if (miss <= 3) return 'B';
      if (miss === 4) return 'C';
      if (miss === 5) return 'D';
      return 'E';
  };

  const getSortedMissedKeys = () => {
      return Object.entries(missedKeyStats).sort(([, a], [, b]) => b - a).slice(0, 5);
  };

  const showHUD = gameStatus === 'countdown' || gameStatus === 'playing';

  return (
    <div className={`relative w-screen flex flex-col items-center justify-center p-4 overflow-x-hidden
        ${isMobile && gameStatus === 'finished' ? 'min-h-screen overflow-y-auto' : 'h-screen overflow-hidden'}`}>
      
      <div className="fixed inset-0 bg-green-100 -z-20" />
      <div className="fixed inset-0 -z-10">
         <ForestPath overlayOpacity={0.2} />
      </div>

      <button onClick={() => navigate('/')} className="fixed top-4 left-4 z-[100] theme-wood-btn px-6 py-3 flex items-center gap-2 font-bold text-sm md:text-base cursor-pointer hover:scale-105 active:scale-95 transition-transform">
        <span>←</span> <span>もどる</span>
      </button>

      {isMobile && showHUD && (
        <MobileScoreBoard 
          myScore={myScore} 
          opponentScore={opponentScore} 
          winningScore={WINNING_SCORE}
          myName={playerName}
          opponentName={opponentName}
        />
      )}

      {iMissed && !opponentMissed && gameStatus === 'playing' && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex flex-col items-center justify-center animate-fade-in">
              <div className="text-4xl md:text-6xl font-black text-white drop-shadow-lg mb-2">WRONG!</div>
              <div className="text-xl font-bold text-white animate-pulse">相手の回答を待っています...</div>
          </div>
      )}

      <div className={`relative z-10 w-full flex flex-col items-center justify-center ${isMobile && gameStatus === 'finished' ? 'my-10' : 'h-full'}`}>

        {!isConnected ? (
            <div className="text-4xl md:text-6xl font-black text-white drop-shadow-lg animate-pulse tracking-wider">CONNECTING...</div>
        ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
                
                {gameStatus === 'waiting' && (
                    <div className="text-center animate-pulse">
                        <h2 className="text-4xl md:text-6xl font-black text-white drop-shadow-lg mb-4">WAITING FOR<br/>CHALLENGER...</h2>
                        <div className="text-xl font-bold text-[#fff8e1] bg-[#5d4037] px-6 py-2 rounded-full inline-block">Room: {roomId}</div>
                    </div>
                )}

                {gameStatus === 'countdown' && (
                    <div className="flex flex-col items-center justify-center">
                        <div className="text-2xl md:text-4xl font-bold text-white drop-shadow-md font-hakoniwa mb-4 animate-bounce">MATCHED!</div>
                        <div className="text-5xl md:text-5xl font-black text-[#ffca28] scale-150 pt-2 animate-pop-in">{countdownValue > 0 ? countdownValue : "START!"}</div>
                    </div>
                )}

                {gameStatus === 'playing' && (
                    <div className="w-full h-full flex flex-row justify-center items-center gap-4 md:gap-12 pb-4">
                        {!isMobile && (
                            <div className="w-64 theme-leaf-box p-6 text-center shrink-0 shadow-xl border-4 border-green-800 bg-green-100">
                                <div className="text-xl font-bold mb-2 font-hakoniwa text-green-900">YOU</div>
                                <div className="text-3xl font-black mb-4 truncate text-green-800">{playerName}</div>
                                <div className="text-7xl font-black mb-4 text-green-600 drop-shadow-sm">{myScore}</div>
                                <div className="w-full bg-green-900/20 rounded-full h-5 overflow-hidden border-2 border-green-700/50">
                                    <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${(myScore / WINNING_SCORE) * 100}%` }}></div>
                                </div>
                            </div>
                        )}

                        {/* ★修正: shrink-0を削除し、flex-1とmin-w-0を追加して縮小可能に */}
                        <div className="flex flex-col items-center justify-center flex-1 min-w-0">
                            <div className={`
                                overflow-hidden animate-pop-in relative
                                ${isMobile ? 'w-[90vw] h-[70vh] min-h-[550px] mt-4 bg-[#fff8e1] rounded-3xl border-4 border-[#d4a373] shadow-xl flex flex-col' 
                                           // ★修正: w-[95vw] を w-full に変更
                                           : 'bg-white/90 rounded-3xl shadow-2xl border-8 border-[#d4a373] w-full max-w-5xl h-[70vh] min-h-[500px]'}
                            `}>
                                {isMobile ? (
                                    <GameMobile 
                                      onScore={addScore} 
                                      onWrong={sendMiss} 
                                      resetKey={roundNumber}
                                      roomId={roomId}
                                      playerId={playerName}
                                      setId={memorySetId}
                                      seed={`${roomId}-${roundNumber}`} 
                                      settings={settings}
                                      wrongHistory={missedProblems.map(p => p.text)}
                                      totalAttempted={myScore + myMissWordCount}
                                    /> 
                                ) : (
                                    <GamePC 
                                        onScore={addScore} 
                                        onWrong={sendMiss} 
                                        onTypo={handleTypo} 
                                        resetKey={roundNumber}
                                        roomId={roomId}
                                        playerId={playerName}
                                        setId={memorySetId}
                                        settings={settings}
                                        seed={`${roomId}-${roundNumber}`}
                                        wrongHistory={missedProblems.map(p => p.text)}
                                        totalAttempted={myScore + myMissWordCount}
                                    />
                                )}
                            </div>
                        </div>

                        {!isMobile && (
                            <div className="w-64 theme-wood-box p-6 text-center shrink-0 shadow-xl border-4 border-[#8d6e63] bg-[#fff8e1]">
                                <div className="text-xl font-bold mb-2 font-hakoniwa text-[#5d4037]">RIVAL</div>
                                <div className="text-3xl font-black mb-4 truncate text-[#3e2723]">{opponentName}</div>
                                <div className="text-7xl font-black mb-4 text-[#bf360c]">{opponentScore}</div>
                                <div className="w-full bg-amber-900/20 rounded-full h-5 overflow-hidden border-2 border-amber-900/50">
                                    <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${(opponentScore / WINNING_SCORE) * 100}%` }}></div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {gameStatus === 'finished' && (
                    <div className={`relative z-50 w-full max-w-6xl flex flex-col md:flex-row gap-6 items-stretch justify-center p-2 
                        ${isMobile ? 'h-auto mt-20 pb-10' : 'h-[85vh]'}`}>
                        
                        <div className="flex-1 h-full min-w-0">
                            <div className="theme-wood-box p-6 h-full flex flex-col items-center shadow-2xl animate-fade-in-up">
                                {myScore > opponentScore ? (
                                    <>
                                        <div className="text-5xl md:text-7xl font-black text-yellow-500 drop-shadow-md mb-2 pt-12 animate-bounce">YOU WIN!</div>
                                        <p className="text-3xl font-bold font-hakoniwa text-[#5d4037]">おめでとう！</p>
                                    </>
                                ) : myScore < opponentScore ? (
                                    <>
                                        <div className="text-5xl md:text-7xl font-black text-blue-500 drop-shadow-md mb-2 pt-12">YOU LOSE...</div>
                                        <p className="text-3xl font-bold font-hakoniwa text-[#5d4037]">ドンマイ！</p>
                                    </>
                                ) : (
                                    <>
                                    <div className="text-5xl md:text-7xl font-black text-green-500 drop-shadow-md mb-2 pt-12">DRAW</div>
                                    <p className="text-3xl font-bold font-hakoniwa text-[#5d4037]">いい勝負だったね！</p>
                                    </>
                                )}

                                <div className="mt-8 bg-[#fff8e1] border-4 border-[#d4a373] rounded-2xl p-6 w-full max-w-xs text-center shadow-inner">
                                    <div className="text-3xl font-bold text-[#8d6e63] font-hakoniwa mb-2">連続勝利数 👑</div>
                                    <div className="text-6xl font-black text-[#d97706] drop-shadow-sm flex items-center justify-center gap-0">
                                        {winStreak}
                                    </div>
                                </div>

                                <div className="mt-4 flex justify-center items-center gap-8 w-full">
                                    <div className="text-center">
                                        <div className="text-xs font-bold text-green-800">YOU</div>
                                        <div className="text-6xl font-black text-green-600">{myScore}</div>
                                    </div>
                                    <div className="text-xl font-black text-[#5d4037] opacity-50">-</div>
                                    <div className="text-center">
                                        <div className="text-xs font-bold text-red-800">RIVAL</div>
                                        <div className="text-6xl font-black text-red-600">{opponentScore}</div>
                                    </div>
                                </div>

                                <div className="mt-6 mb-6 w-full flex justify-center">
                                    {isRetryReady ? (
                                        <div className="px-6 py-4 bg-gray-200 rounded-full font-bold text-gray-600 animate-pulse w-full text-center">相手の承認を待っています...</div>
                                    ) : (
                                        <button onClick={handleRetry} className="theme-leaf-btn py-3 rounded-xl font-black text-xl shadow-lg transform transition hover:scale-105 w-full max-w-xs">
                                            再戦する！
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 relative w-full md:w-auto min-h-[300px] md:min-h-0">
                          <div className="md:absolute md:inset-0 theme-wood-box p-5 flex flex-col shadow-2xl animate-fade-in-up delay-100 overflow-hidden h-full">
                              <h3 className="text-xl font-bold mb-4 border-b-4 border-[#8d6e63] pb-2 text-[#5d4037] font-hakoniwa">バトル分析</h3>
                              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                                  <div className="bg-[#fff8e1] p-4 rounded-xl border-4 border-[#d4a373] shadow-inner">
                                      <h4 className="text-sm font-bold text-[#5d4037] mb-3 text-center border-b border-[#d4a373] pb-1 mx-4">プレイ評価</h4>
                                      <div className="flex justify-around items-center">
                                          <div className="text-center">
                                              <div className="text-sm font-bold text-[#8d6e63] mb-1">暗記力</div>
                                              <div className="text-5xl font-black text-[#d97706] drop-shadow-sm">{getMemoryRank(myScore, missedProblems.length)}</div>
                                          </div>
                                          {!isMobile && (
                                            <>
                                                <div className="w-px h-12 bg-[#d4a373]"></div>
                                                <div className="text-center">
                                                    <div className="text-sm font-bold text-[#8d6e63] mb-1">タイピング</div>
                                                    <div className="text-5xl font-black text-[#d97706] drop-shadow-sm">{getTypingRank(myTypoCount, myScore)}</div>
                                                </div>
                                            </>
                                          )}
                                      </div>
                                  </div>

                                  {!isMobile && (
                                    <div className="bg-white/80 p-4 rounded-xl border-2 border-red-200 shadow-sm">
                                      <div className="text-sm font-bold text-red-800 mb-2">⌨️ 苦手なキー</div>
                                      <div className="flex gap-2 flex-wrap">
                                        {getSortedMissedKeys().length === 0 ? (
                                          <span className="text-xs text-gray-400">ミスなし！</span>
                                        ) : (
                                          getSortedMissedKeys().map(([key, count]) => (
                                            <div key={key} className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-lg font-bold border border-red-200">
                                              <span className="font-mono">{key}</span>
                                              <span className="text-sm opacity-60"> x{count}</span>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  <div className="bg-white/80 p-4 rounded-xl border-2 border-blue-200 shadow-sm min-h-[150px]">
                                      <div className="text-sm font-bold text-blue-800 mb-2">❌ ミスした問題 (Total: {missedProblems.length})</div>
                                      <div className="bg-white rounded border border-blue-100 max-h-[200px] overflow-y-auto">
                                          <ul className="divide-y divide-blue-50">
                                              {missedProblems.map((p, i) => (
                                                  <li key={i} className="p-2 flex justify-between items-center hover:bg-blue-50/50">
                                                      <span className="font-bold text-red-600 mr-2">{p.text}</span>
                                                      <span className="text-gray-500 text-xs">{p.kana}</span>
                                                  </li>
                                              ))}
                                          </ul>
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