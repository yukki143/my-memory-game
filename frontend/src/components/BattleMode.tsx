// src/BattleMode.tsx 全文修正
import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GamePC from './GamePC';
import GameMobile from './GameMobile';
import ForestPath from './ForestPath';
import { DEFAULT_SETTINGS, type Problem } from '../types';
import { useSound } from '../hooks/useSound';
import { authFetch, getToken } from '../utils/auth';
import { useBgm } from '../context/BgmContext';

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
  const COUNT_SE = '/sounds/se_countdown.mp3';
  const countdownSePlayedRef = useRef(false);
  const CLICK_SE = '/sounds/se_click.mp3';
  const click = () => playSE(CLICK_SE);

  // ★ 追加: BGM制御
  const { setBgm } = useBgm();

  const [isConnected, setIsConnected] = useState(false);
  const [gameStatus, setGameStatus] = useState<'waiting' | 'countdown' | 'playing' | 'finished'>('waiting');
  const [countdownValue, setCountdownValue] = useState(3);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [roundNumber, setRoundNumber] = useState(0);
  const [serverSeed, setServerSeed] = useState<string>(""); 
  
  const [roundResult, setRoundResult] = useState<'correct' | 'wrong' | null>(null);
  const [roundWinnerId, setRoundWinnerId] = useState<string | null>(null);
  const [iMissed, setIMissed] = useState(false);
  const [opponentMissed, setOpponentMissed] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [clearTime, setClearTime] = useState(0); 
  const [isRetryReady, setIsRetryReady] = useState(false);
  const [opponentRetryReady, setOpponentRetryReady] = useState(false);
  const [isOpponentPresent, setIsOpponentPresent] = useState(false); 
  const [winStreak, setWinStreak] = useState(0); 
  
  const [missedProblems, setMissedProblems] = useState<Problem[]>([]);
  const [myTypoCount, setMyTypoCount] = useState(0);
  const [missedKeyStats, setMissedKeyStats] = useState<{ [key: string]: number }>({});
  const [opponentName, setOpponentName] = useState("Rival");

  const [correctOnFirstTry, setCorrectOnFirstTry] = useState(0);
  const [totalRoundsPlayed, setTotalRoundsPlayed] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const roundNumberRef = useRef(0); 
  const retryRequestedRef = useRef(false);

  // ★ 追加: Battleの状態に応じてBGMシーン/停止を更新
  useEffect(() => {
    // waiting〜countdown は lobby BGM
    if (gameStatus === 'waiting') {
      setBgm('lobby', false);
      return;
    }

    if (gameStatus === 'countdown') {
      setBgm('lobby', true);  // ★スタート押下後は止める
      return;
    }

    // playing は battle BGM
    if (gameStatus === 'playing') {
      setBgm('battle', false);
      return;
    }

    // finished はBGM停止（battleのまま止める）
    if (gameStatus === 'finished') {
      setBgm('battle', true);
      return;
    }
  }, [gameStatus, setBgm]);


  useEffect(() => {
    roundNumberRef.current = roundNumber;
  }, [roundNumber]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const wsSend = (cmd: string) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(`${playerId}:${cmd}`);
          return true;
      }
      return false;
  };

  useEffect(() => {
    let ws: WebSocket | null = null;
    let isMounted = true;
    let reconnectTimeout: any = null;

    const joinRoom = () => {
      if (!isMounted) return;
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const WS_BASE = API_BASE.replace(/^http/, 'ws');
      const setParam = memorySetId ? `?setName=${memorySetId}` : "";
      
      ws = new WebSocket(`${WS_BASE}/ws/battle/${roomId}/${playerId}${setParam}`);
      socketRef.current = ws;
      
      ws.onopen = () => { 
        if (!isMounted) return;
        setIsConnected(true);
        wsSend("NAME:" + playerName);
        if (retryRequestedRef.current) wsSend("RETRY");
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        const msg = event.data as string;
        
        if (msg.startsWith("SERVER:")) {
          const command = msg.substring(7);
          if (command.startsWith("SYNC:")) {
            try {
              const syncData = JSON.parse(command.substring(5));
              if (syncData.names) {
                const rivalId = Object.keys(syncData.names).find(id => id !== playerId);
                if (rivalId) {
                  setOpponentName(syncData.names[rivalId]);
                  setIsOpponentPresent(true);
                }
              }
              if (syncData.scores) {
                setMyScore(syncData.scores[playerId] || 0);
                const rivalId = Object.keys(syncData.scores).find(id => id !== playerId);
                if (rivalId) setOpponentScore(syncData.scores[rivalId] || 0);
              }
              if (syncData.status === 'playing') {
                setGameStatus('playing');
                if (syncData.currentRound > roundNumberRef.current) {
                  setRoundNumber(syncData.currentRound);
                  setServerSeed(syncData.seed);
                  setRoundResult(null);
                  setRoundWinnerId(null);
                  setIMissed(false);
                  setOpponentMissed(false);
                }
              }
            } catch (e) {}
            return;
          }
          if (command === "MATCHED") {
            roundNumberRef.current = 0; 
            prepareNextGame();
            startCountdown();
            setIsOpponentPresent(true);
            retryRequestedRef.current = false;
          } 
          else if (command === "OPPONENT_LEFT") { setIsOpponentPresent(false); }
          else if (command.startsWith("NEXT_ROUND:")) {
            try {
              const data = JSON.parse(command.substring(11));
              if (data.round <= roundNumberRef.current && roundNumberRef.current !== 0) return;
              setRoundNumber(data.round);
              roundNumberRef.current = data.round;
              setRoundResult(null);
              setRoundWinnerId(null);
              setIMissed(false);
              setOpponentMissed(false);
              setServerSeed(data.seed);
            } catch (e) {}
          }
          return;
        }

        if (msg.includes(":")) {
          const parts = msg.split(":");
          const senderId = parts[0];
          const command = parts.slice(1).join(":");

          if (command.startsWith("NAME:")) {
            if (senderId !== playerId) {
              setOpponentName(command.substring(5));
              setIsOpponentPresent(true);
            }
          }
          else if (command.startsWith("SCORE_UP")) {
            setRoundWinnerId(senderId);
            if (senderId === playerId) { 
              setRoundResult('correct'); 
              setMyScore(prev => prev + 1);
            } 
            else { setOpponentScore(prev => prev + 1); }
          } 
          else if (command.startsWith("MISS")) {
            if (senderId === playerId) { setRoundResult('wrong'); setIMissed(true); } 
            else { setOpponentMissed(true); }
          } 
          else if (command === "RETRY") {
            if (senderId !== playerId) { setOpponentRetryReady(true); }
          }
        }
      };

      ws.onclose = () => { 
        if (!isMounted) return;
        setIsConnected(false);
        // ★ 依存配列から削った代わりに、ここで現在の状態を見て再接続を判断
        reconnectTimeout = setTimeout(joinRoom, 1500);
      };
    };

    joinRoom();

    return () => {
      isMounted = false;
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      socketRef.current = null;
    };
    // ★重要: ここに gameStatus や isRetryReady を入れてはいけない
  }, [roomId, playerId, playerName, memorySetId]);

  const startCountdown = () => { countdownSePlayedRef.current = false; setGameStatus('countdown'); setCountdownValue(3); };

  const recordStat = async (wordText: string, isCorrect: boolean) => {
    if (!getToken()) return;
    try { await authFetch(`/api/word_stats?word_text=${encodeURIComponent(wordText)}&is_correct=${isCorrect}`, { method: 'POST' }); } catch (e) {}
  };

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
    setMyScore(0); setOpponentScore(0); setIMissed(false); setOpponentMissed(false);
    setRoundResult(null); setRoundWinnerId(null); setIsRetryReady(false); setOpponentRetryReady(false);
    setMissedProblems([]); setMyTypoCount(0); setMissedKeyStats({}); 
    setClearTime(0); setRoundNumber(0); setCorrectOnFirstTry(0); setTotalRoundsPlayed(0);
    retryRequestedRef.current = false;
  };

  const handleRetry = () => {
    if (isRetryReady || !isOpponentPresent) return;
    setIsRetryReady(true);
    retryRequestedRef.current = true;
    wsSend("RETRY");
  };

  const addScore = (problem?: Problem) => {
    if (gameStatus !== 'playing' || iMissed || roundResult === 'correct' || roundWinnerId) return;
    setTotalRoundsPlayed(prev => prev + 1);
    setCorrectOnFirstTry(prev => prev + 1);
    if (problem) recordStat(problem.text, true);
    wsSend(`SCORE_UP:round${roundNumber}`); 
  };

  const sendMiss = (problem?: Problem) => {
    if (gameStatus !== 'playing' || iMissed || roundResult === 'correct' || roundWinnerId) return;
    setTotalRoundsPlayed(prev => prev + 1);
    if (problem) { setMissedProblems(prev => [...prev, problem]); recordStat(problem.text, false); }
    wsSend(`MISS:round${roundNumber}`);
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

    const getTypingRank = (count: number, score: number) => {
      if (count === 0 && score === 0) return '-';
      if (count === 0) return 'S';
      if (count <= 3) return 'A';
      if (count <= 8) return 'B';
      if (count <= 12) return 'C';
      if (count <= 15) return 'D';
      return 'E';
  };

  const getMemoryRank = (accuracy: number) => {
      if (accuracy >= 100) return 'S';
      if (accuracy >= 90) return 'A';
      if (accuracy >= 80) return 'B';
      if (accuracy >= 70) return 'C';
      if (accuracy >= 60) return 'D';
      return 'E';
  };

  const getSortedMissedKeys = () => {
      return Object.entries(missedKeyStats)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);
  };

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

  useEffect(() => {
    if (gameStatus === 'countdown') {
      if (!countdownSePlayedRef.current) {
        playSE(COUNT_SE);                 // ★ここで1回だけ鳴る
        countdownSePlayedRef.current = true;
      }
    } else {
      // countdown を抜けたら次回のためにリセット
      countdownSePlayedRef.current = false;
    }
  }, [gameStatus, playSE]);

  const showHUD = gameStatus === 'countdown' || gameStatus === 'playing';
  const isInputLocked = iMissed || roundResult === 'correct' || !!roundWinnerId;

  const attempted = myScore + missedProblems.length;
  const currentAccuracy = attempted === 0 ? 0 : (myScore / attempted) * 100;


  return (
    <div className={`relative w-screen flex flex-col items-center justify-center p-4 overflow-x-hidden
        ${isMobile && gameStatus === 'finished' ? 'min-h-screen overflow-y-auto' : 'h-screen overflow-hidden'}`}>
      <div className="fixed inset-0 bg-green-100 -z-20" />
      <div className="fixed inset-0 -z-10"><ForestPath overlayOpacity={0.2} /></div>
      <button onClick={() => { click(); navigate('/')}} className="fixed top-4 left-4 z-[100] theme-wood-btn px-6 py-3 flex items-center gap-2 font-bold text-sm md:text-base cursor-pointer">
        <span>←</span> <span>もどる</span>
      </button>

      {isMobile && showHUD && (
        <MobileScoreBoard myScore={myScore} opponentScore={opponentScore} winningScore={WINNING_SCORE} myName={playerName} opponentName={opponentName} />
      )}

      {roundResult && gameStatus === 'playing' && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none animate-pop-in">
              <div className={`text-[20rem] font-black drop-shadow-2xl ${roundResult === 'correct' ? 'text-green-500' : 'text-red-600'}`}>
                  {roundResult === 'correct' ? '〇' : '✕'}
              </div>
          </div>
      )}

      {iMissed && !roundWinnerId && gameStatus === 'playing' && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex flex-col items-center justify-center animate-fade-in">
              <div className="text-xl font-bold text-white animate-pulse">判定中...</div>
          </div>
      )}

      <div className={`relative z-10 w-full flex flex-col items-center justify-center ${isMobile && gameStatus === 'finished' ? 'my-10' : 'h-full'}`}>
        {!isConnected ? (
            <div className="text-4xl md:text-6xl font-black text-white drop-shadow-lg animate-pulse uppercase">Connecting...</div>
        ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
                {gameStatus === 'waiting' && (
                    <div className="text-center animate-pulse">
                        <h2 className="text-4xl md:text-6xl font-black text-white drop-shadow-lg mb-4 font-hakoniwa">対戦相手を待っています...</h2>
                        <div className="theme-wood-box px-4 py-2 font-bold text-xs inline-block">Room ID: {displayRoomId}</div>
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
                                    <GameMobile onScore={addScore} onWrong={sendMiss} resetKey={roundNumber} roomId={roomId} playerId={playerId} setId={memorySetId} seed={serverSeed} settings={settings} wrongHistory={missedProblems.map(p => p.text)} totalAttempted={roundNumber} isLocked={isInputLocked} /> 
                                ) : (
                                    <GamePC onScore={addScore} onWrong={sendMiss} onTypo={handleTypo} isSoloMode resetKey={roundNumber} roomId={roomId} playerId={playerId} setId={memorySetId} settings={settings} seed={serverSeed} wrongHistory={missedProblems.map(p => p.text)} totalAttempted={roundNumber} isLocked={isInputLocked} />
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
                    <div className={`relative z-50 w-full max-w-6xl flex flex-col md:flex-row gap-6 items-stretch justify-center p-2 ${isMobile ? 'h-auto mt-20 pb-10' : 'h-[75vh]'}`}>
                        <div className="w-full md:w-[45%] h-full min-w-0">
                            <div className="theme-wood-box p-6 h-full flex flex-col items-center shadow-2xl animate-fade-in-up">
                                {myScore > opponentScore ? ( <div className="text-5xl md:text-7xl font-black text-yellow-500 mb-2 pt-10 animate-bounce">YOU WIN!!</div> ) : myScore < opponentScore ? ( <div className="text-5xl md:text-7xl font-black text-blue-500 mb-2 pt-10">YOU LOSE...</div> ) : ( <div className="text-5xl md:text-7xl font-black text-green-500 mb-2 pt-4">DRAW</div> )}

                                {/* スコア表示エリア */}
                                <div className="flex items-end justify-center w-full mt-8 mb-8 select-none">
  
                                  {/* 自分サイド */}
                                  <div className="flex flex-col items-center">
                                    <span className="text-xl md:text-2xl font-black text-green-800 font-hakoniwa truncate max-w-[140px]">
                                      {playerName}
                                    </span>
                                    <span className="text-emerald-600 text-6xl md:text-7xl font-black leading-none">
                                      {myScore}
                                    </span>
                                  </div>

                                  {/* 中央のハイフン：スコアの高さに合わせて配置 */}
                                  <div className="mx-6 md:mx-2 self-end pb-2 md:pb-4">
                                    <span className="text-[#8d6e63] text-6xl md:text-7xl font-black inline-block transform translate-y-5">
                                      ー
                                    </span>
                                  </div>

                                  {/* 相手サイド */}
                                  <div className="flex flex-col items-center">
                                    <span className="text-xl md:text-2xl font-black text-red-800 font-hakoniwa truncate max-w-[140px]">
                                      {opponentName}
                                    </span>
                                    <span className="text-rose-500 text-6xl md:text-7xl font-black leading-none">
                                      {opponentScore}
                                    </span>
                                  </div>
                                </div>

                                <div className="mb-8 bg-[#fff8e1] border-4 border-[#d4a373] rounded-2xl p-6 w-full max-w-xs text-center shadow-inner">
                                    <div className="text-2xl font-bold text-[#8d6e63] mb-2 font-hakoniwa">連続勝利数 👑</div><div className="text-6xl font-black text-[#d97706]">{winStreak}</div>
                                </div>
                                <div className="mt-6 mb-6 w-full flex justify-center">
                                    {!isOpponentPresent ? ( <div className="px-6 py-4 bg-gray-100 rounded-xl font-bold text-gray-400 border-2 border-dashed border-gray-300 w-full text-center">対戦相手が退出しました</div> ) : isRetryReady && !opponentRetryReady ? ( <div className="px-6 py-4 bg-gray-200 rounded-full font-bold text-gray-600 animate-pulse w-full text-center">相手を待っています...</div> ) : ( <button onClick={() => { click(); handleRetry();}} className="theme-leaf-btn py-4 rounded-xl font-black text-xl shadow-lg w-full max-w-xs transition transform hover:scale-105">再戦する！</button> )}
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 relative w-full md:w-auto">
                            <div className={`${isMobile ? '' : 'md:absolute md:inset-0 h-full'} theme-wood-box p-6 flex flex-col shadow-2xl animate-fade-in-up overflow-hidden`}>
                                <h3 className="text-2xl font-bold mb-4 border-b-4 border-[#8d6e63] pb-2 text-[#5d4037] font-hakoniwa">プレイ分析</h3>
                                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                                    
                                    <div className="bg-[#fff8e1] p-4 rounded-xl border-4 border-[#d4a373] shadow-inner">
                                        <h4 className="text-sm font-bold text-[#5d4037] mb-3 text-center border-b border-[#d4a373] pb-1 mx-4">総合評価</h4>
                                        <div className="flex justify-around items-center">
                                            <div className="text-center">
                                                <div className="text-sm font-bold text-[#8d6e63] mb-1">暗記力</div>
                                                <div className="text-5xl font-black text-[#d97706]">{getMemoryRank(currentAccuracy)}</div>
                                            </div>
                                            {!isMobile && (
                                                <>
                                                    <div className="w-px h-12 bg-[#d4a373]"></div>
                                                    <div className="text-center">
                                                        <div className="text-sm font-bold text-[#8d6e63] mb-1">タイピング</div>
                                                        <div className="text-5xl font-black text-[#d97706]">{getTypingRank(myTypoCount, myScore)}</div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {!isMobile && (
                                        <div className="bg-white/80 p-4 rounded-xl border-2 border-red-200 shadow-sm">
                                            <div className="text-sm font-bold text-red-800 mb-2">⌨️ 苦手なキー (Total: {myTypoCount})</div>
                                            <div className="flex gap-2 flex-wrap">
                                                {getSortedMissedKeys().map(([key, count]) => (
                                                    <div key={key} className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-lg font-bold border border-red-200 flex items-center gap-2"><span className="font-mono text-2xl">{key}</span><span className="text-sm opacity-60">x{count}</span></div>
                                                ))}
                                                {getSortedMissedKeys().length === 0 && <span className="text-gray-400 text-sm italic">ミスなし！完璧です！</span>}
                                            </div>
                                        </div>
                                    )}
                                    <div className="bg-white/80 p-4 rounded-xl border-2 border-blue-200 shadow-sm min-h-[150px]">
                                        <div className="text-sm font-bold text-blue-800 mb-2">❌ ミスした問題 (Total: {missedProblems.length})</div>
                                        <div className="bg-white rounded border border-blue-100 max-h-[250px] overflow-y-auto">
                                            <ul className="divide-y divide-blue-50">
                                                {missedProblems.map((p, i) => (
                                                    <li key={i} className="p-3 flex justify-between items-center hover:bg-blue-50/50"><span className="font-bold text-red-600 mr-2">{p.text}</span><span className="text-gray-500 text-xs">{p.kana}</span></li>
                                                ))}
                                                {missedProblems.length === 0 && <li className="p-3 text-center text-gray-400 text-sm">全問正解です！素晴らしい！</li>}
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
