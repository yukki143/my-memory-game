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
      settings = DEFAULT_SETTINGS,
      memorySetId 
  } = location.state || {};

  const displayRoomId = decodeURIComponent(roomId);
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
  const [serverSeed, setServerSeed] = useState<string>(""); 
  
  // 演出・同期用ステート
  const [roundResult, setRoundResult] = useState<'correct' | 'wrong' | null>(null);
  const [iMissed, setIMissed] = useState(false);
  const [opponentMissed, setOpponentMissed] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [clearTime, setClearTime] = useState(0); 
  const [isRetryReady, setIsRetryReady] = useState(false);
  const [opponentRetryReady, setOpponentRetryReady] = useState(false);
  const [winStreak, setWinStreak] = useState(0); 
  const [missedProblems, setMissedProblems] = useState<Problem[]>([]);
  const [opponentName, setOpponentName] = useState("Rival");

  const socketRef = useRef<WebSocket | null>(null);
  const roundNumberRef = useRef(0); 

  useEffect(() => {
    roundNumberRef.current = roundNumber;
  }, [roundNumber]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let isMounted = true;

    const joinRoom = () => {
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const WS_BASE = API_BASE.replace(/^http/, 'ws');
      const setParam = memorySetId ? `?setName=${memorySetId}` : "";
      
      ws = new WebSocket(`${WS_BASE}/ws/battle/${roomId}/${playerId}${setParam}`);
      socketRef.current = ws;
      
      ws.onopen = () => { if (isMounted) setIsConnected(true); };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        const msg = event.data as string;
        
        // SERVER: コマンドの処理
        if (msg.startsWith("SERVER:")) {
          const command = msg.substring(7);
          
          if (command === "MATCHED") {
            prepareNextGame();
            startCountdown();
            wsSend("NAME:" + playerName);
          } 
          else if (command.startsWith("NEXT_ROUND:")) {
            try {
              const data = JSON.parse(command.substring(11));
              if (data.round <= roundNumberRef.current && roundNumberRef.current !== 0) return;
              
              setRoundNumber(data.round);
              setServerSeed(data.seed);
              // ラウンド開始時に演出とミス状態をリセット
              setRoundResult(null);
              setIMissed(false);
              setOpponentMissed(false);
            } catch (e) { console.error("NEXT_ROUND parse error", e); }
          }
          return;
        }

        // プレイヤー間メッセージの処理 (senderId:command)
        if (msg.includes(":")) {
          const parts = msg.split(":");
          const senderId = parts[0];
          const command = parts.slice(1).join(":");

          if (command.startsWith("NAME:")) {
            if (senderId !== playerId) setOpponentName(command.substring(5));
          }
          else if (command.startsWith("SCORE_UP")) {
            if (senderId === playerId) {
              setRoundResult('correct');
            } else {
              setOpponentScore(prev => prev + 1);
            }
          } 
          else if (command.startsWith("MISS")) {
            if (senderId === playerId) {
              setRoundResult('wrong');
              setIMissed(true);
            } else {
              setOpponentMissed(true);
            }
          } 
          else if (command === "RETRY") {
            if (senderId !== playerId) setOpponentRetryReady(true);
          }
        }
      };

      ws.onclose = () => { if (isMounted) setIsConnected(false); };
    };

    joinRoom();

    return () => {
      isMounted = false;
      if (ws) ws.close();
      socketRef.current = null;
    };
  }, [roomId, playerId, playerName, memorySetId]);

  const startCountdown = () => {
      setGameStatus('countdown');
      setCountdownValue(3);
  };

  const wsSend = (cmd: string) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(`${playerId}:${cmd}`);
      }
  };

  // 終了判定
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    if (CONDITION_TYPE === 'score') {
      if (myScore >= WINNING_SCORE) finishGame(true);
      else if (opponentScore >= WINNING_SCORE) finishGame(false);
    } else if (CONDITION_TYPE === 'total') {
      if (roundNumber > WINNING_SCORE) finishGame(myScore > opponentScore);
    }
  }, [myScore, opponentScore, roundNumber, gameStatus, CONDITION_TYPE, WINNING_SCORE]);

  const finishGame = (isWin: boolean) => {
    if (gameStatus === 'finished') return;
    setGameStatus('finished');
    setClearTime((Date.now() - startTime) / 1000);
    if (isWin) { playSE('/sounds/se_win.mp3'); setWinStreak(prev => prev + 1); } 
    else { playSE('/sounds/se_lose.mp3'); setWinStreak(0); }
  };

  const prepareNextGame = () => {
    setMyScore(0);
    setOpponentScore(0);
    setIMissed(false);
    setOpponentMissed(false);
    setRoundResult(null);
    setIsRetryReady(false);
    setOpponentRetryReady(false);
    setMissedProblems([]);
    setClearTime(0);
    setRoundNumber(0);
  };

  const handleRetry = () => {
    if (isRetryReady) return;
    setIsRetryReady(true);
    wsSend("RETRY");
  };

  const addScore = () => {
    if (gameStatus !== 'playing' || iMissed || roundResult === 'correct') return;
    setMyScore(prev => prev + 1);
    wsSend(`SCORE_UP:round${roundNumber}`); 
  };

  const sendMiss = (problem?: Problem) => {
    if (gameStatus !== 'playing' || iMissed || roundResult === 'correct') return;
    if (problem) setMissedProblems(prev => [...prev, problem]);
    wsSend(`MISS:round${roundNumber}`);
  };

  const handleTypo = () => {
      if (gameStatus === 'playing') playSE('/sounds/se_typo.mp3');
  };

  // カウントダウン処理
  useEffect(() => {
    if (gameStatus === 'countdown') {
        const interval = setInterval(() => {
            setCountdownValue(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setGameStatus('playing');
                    setStartTime(Date.now());
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }
  }, [gameStatus]);

  const showHUD = gameStatus === 'countdown' || gameStatus === 'playing';

  return (
    <div className={`relative w-screen flex flex-col items-center justify-center p-4 overflow-x-hidden
        ${isMobile && gameStatus === 'finished' ? 'min-h-screen overflow-y-auto' : 'h-screen overflow-hidden'}`}>
      
      <div className="fixed inset-0 bg-green-100 -z-20" />
      <div className="fixed inset-0 -z-10"><ForestPath overlayOpacity={0.2} /></div>

      <button onClick={() => navigate('/')} className="fixed top-4 left-4 z-[100] theme-wood-btn px-6 py-3 flex items-center gap-2 font-bold text-sm md:text-base cursor-pointer">
        <span>←</span> <span>もどる</span>
      </button>

      <div className="fixed top-4 right-4 z-[100] theme-wood-box px-4 py-2 font-bold text-xs">
         Room: {displayRoomId}
      </div>

      {isMobile && showHUD && (
        <MobileScoreBoard 
          myScore={myScore} opponentScore={opponentScore} winningScore={WINNING_SCORE}
          myName={playerName} opponentName={opponentName}
        />
      )}

      {/* ラウンドごとの〇✕演出 */}
      {roundResult && gameStatus === 'playing' && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none animate-pop-in">
              <div className={`text-[20rem] font-black drop-shadow-2xl ${roundResult === 'correct' ? 'text-green-500' : 'text-red-600'}`}>
                  {roundResult === 'correct' ? '〇' : '✕'}
              </div>
          </div>
      )}

      {/* 待機用オーバーレイ */}
      {iMissed && !opponentMissed && gameStatus === 'playing' && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex flex-col items-center justify-center animate-fade-in">
              <div className="text-xl font-bold text-white animate-pulse">相手の回答を待っています...</div>
          </div>
      )}

      <div className={`relative z-10 w-full flex flex-col items-center justify-center ${isMobile && gameStatus === 'finished' ? 'my-10' : 'h-full'}`}>
        {!isConnected ? (
            <div className="text-4xl md:text-6xl font-black text-white drop-shadow-lg animate-pulse">CONNECTING...</div>
        ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
                {gameStatus === 'waiting' && (
                    <div className="text-center animate-pulse">
                        <h2 className="text-4xl md:text-6xl font-black text-white drop-shadow-lg mb-4">WAITING FOR<br/>CHALLENGER...</h2>
                    </div>
                )}

                {gameStatus === 'countdown' && (
                    <div className="flex flex-col items-center justify-center">
                        <div className="text-2xl md:text-4xl font-bold text-white drop-shadow-md mb-4 animate-bounce">MATCHED!</div>
                        <div className="text-5xl md:text-5xl font-black text-[#ffca28] scale-150 animate-pop-in">{countdownValue > 0 ? countdownValue : "START!"}</div>
                    </div>
                )}

                {gameStatus === 'playing' && (
                    <div className="w-full h-full flex flex-row justify-center items-center gap-4 md:gap-12 pb-4">
                        {!isMobile && (
                            <div className="w-64 theme-leaf-box p-6 text-center shrink-0 shadow-xl border-4 border-green-800 bg-green-100">
                                <div className="text-xl font-bold mb-2 text-green-900">YOU</div>
                                <div className="text-3xl font-black mb-4 truncate text-green-800">{playerName}</div>
                                <div className="text-7xl font-black mb-4 text-green-600">{myScore}</div>
                                <div className="w-full bg-green-900/20 rounded-full h-5 overflow-hidden border-2 border-green-700/50">
                                    <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${(myScore / WINNING_SCORE) * 100}%` }}></div>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col items-center justify-center flex-1 min-w-0">
                            <div className={`overflow-hidden animate-pop-in relative ${isMobile ? 'w-[90vw] h-[70vh] min-h-[550px] mt-4 bg-[#fff8e1] rounded-3xl border-4 border-[#d4a373] shadow-xl flex flex-col' : 'bg-white/90 rounded-3xl shadow-2xl border-8 border-[#d4a373] w-full max-w-5xl h-[70vh] min-h-[500px]'}`}>
                                {isMobile ? (
                                    <GameMobile 
                                      onScore={addScore} onWrong={sendMiss} resetKey={roundNumber}
                                      roomId={roomId} playerId={playerId} setId={memorySetId}
                                      seed={serverSeed} settings={settings} wrongHistory={missedProblems.map(p => p.text)}
                                      totalAttempted={roundNumber}
                                      isLocked={iMissed || roundResult === 'correct'} // 入力ロックを渡す
                                    /> 
                                ) : (
                                    <GamePC 
                                        onScore={addScore} onWrong={sendMiss} onTypo={handleTypo} resetKey={roundNumber}
                                        roomId={roomId} playerId={playerId} setId={memorySetId}
                                        settings={settings} seed={serverSeed} wrongHistory={missedProblems.map(p => p.text)}
                                        totalAttempted={roundNumber}
                                        isLocked={iMissed || roundResult === 'correct'} // 入力ロックを渡す
                                    />
                                )}
                            </div>
                        </div>

                        {!isMobile && (
                            <div className="w-64 theme-wood-box p-6 text-center shrink-0 shadow-xl border-4 border-[#8d6e63] bg-[#fff8e1]">
                                <div className="text-xl font-bold mb-2 text-[#5d4037]">RIVAL</div>
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
                    <div className={`relative z-50 w-full max-w-6xl flex flex-col md:flex-row gap-6 items-stretch justify-center p-2 ${isMobile ? 'h-auto mt-20 pb-10' : 'h-[85vh]'}`}>
                        <div className="flex-1 h-full min-w-0">
                            <div className="theme-wood-box p-6 h-full flex flex-col items-center shadow-2xl animate-fade-in-up">
                                {myScore > opponentScore ? (
                                    <div className="text-5xl md:text-7xl font-black text-yellow-500 mb-2 pt-12 animate-bounce">YOU WIN!</div>
                                ) : myScore < opponentScore ? (
                                    <div className="text-5xl md:text-7xl font-black text-blue-500 mb-2 pt-12">YOU LOSE...</div>
                                ) : (
                                    <div className="text-5xl md:text-7xl font-black text-green-500 mb-2 pt-12">DRAW</div>
                                )}
                                <div className="mt-8 bg-[#fff8e1] border-4 border-[#d4a373] rounded-2xl p-6 w-full max-w-xs text-center shadow-inner">
                                    <div className="text-3xl font-bold text-[#8d6e63] mb-2">連続勝利数 👑</div>
                                    <div className="text-6xl font-black text-[#d97706]">{winStreak}</div>
                                </div>
                                <div className="mt-6 w-full flex justify-center">
                                    {isRetryReady && !opponentRetryReady ? (
                                        <div className="px-6 py-4 bg-gray-200 rounded-full font-bold text-gray-600 animate-pulse w-full text-center">相手を待っています...</div>
                                    ) : (
                                        <button onClick={handleRetry} className="theme-leaf-btn py-3 rounded-xl font-black text-xl shadow-lg w-full max-w-xs">再戦する！</button>
                                    )}
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