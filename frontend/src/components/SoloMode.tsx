// src/SoloMode.tsx
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import GamePC from './GamePC';
import GameMobile from './GameMobile';
import ForestPath from './ForestPath';
import { DEFAULT_SETTINGS } from '../types';
import { authFetch } from '../utils/auth';
import { useSound } from '../hooks/useSound';

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

type RankEntry = {
  name: string;
  time: number;
};

type Problem = {
  text: string;
  kana: string;
};

type SoloModeProps = {
  onBack: () => void;
};

function SoloMode({ onBack }: SoloModeProps) {
  const location = useLocation();
  const stateSettings = location.state?.settings;
  const setId = location.state?.setId;
  const settings = stateSettings || DEFAULT_SETTINGS;

  const [gameState, setGameState] = useState<'ready' | 'countdown' | 'playing' | 'finished'>('ready');
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [clearTime, setClearTime] = useState(0);
  const [playerName, setPlayerName] = useState("Player");
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [countdownValue, setCountdownValue] = useState(3);
  const [resetKey, setResetKey] = useState(0);
  
  const [myTypoCount, setMyTypoCount] = useState(0);
  const [missedKeyStats, setMissedKeyStats] = useState<{ [key: string]: number }>({});
  const [missedProblems, setMissedProblems] = useState<Problem[]>([]);
  const [wrongHistory, setWrongHistory] = useState<string[]>([]);
  const [totalAttempted, setTotalAttempted] = useState(0);
  const { playSE } = useSound();

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await authFetch("/api/users/me");
        if (res.ok) {
          const data = await res.json();
          setPlayerName(data.username);
        }
      } catch (e) {
        console.error("User fetch failed", e);
      }
    };
    fetchUser();
  }, []);

  const GOAL_SCORE = settings.clearConditionValue || 10;
  const CONDITION_TYPE = settings.conditionType || 'score';
  const CURRENT_SET_ID = setId ? String(setId) : "default";

  const startCountdown = () => {
    setScore(0);
    setTotalAttempted(0);
    setWrongHistory([]);
    setMyTypoCount(0);
    setMissedKeyStats({});
    setMissedProblems([]);
    setGameState('countdown');
    setCountdownValue(3);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (gameState === 'ready' && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            startCountdown();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'countdown') {
      if (countdownValue > 0) {
        const timer = setTimeout(() => setCountdownValue((prev) => prev - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setGameState('playing');
        setStartTime(Date.now());
        setResetKey(1); 
      }
    }
  }, [gameState, countdownValue]);

  // ■ 正解したときの処理
  const handleScore = () => {
    const newScore = score + 1;
    const newTotal = totalAttempted + 1;
    
    setScore(newScore);
    setTotalAttempted(newTotal);

    // ★修正: 0.5秒待ってから判定と次への遷移を行う
    setTimeout(() => {
      if (gameState !== 'playing') return;

      const isFinished = CONDITION_TYPE === 'score' 
        ? newScore >= GOAL_SCORE 
        : newTotal >= GOAL_SCORE;

      if (isFinished) {
        finishGame();
      } else {
        setResetKey(prev => prev + 1);
      }
    }, 500);
  };

  // ■ 不正解だったときの処理
  const handleWrong = (problem: Problem) => {
    const newTotal = totalAttempted + 1;

    setMissedProblems(prev => [...prev, problem]);
    setWrongHistory(prev => [...prev, problem.text]);
    setTotalAttempted(newTotal);

    // ★修正: 0.5秒待ってから判定と次への遷移を行う
    setTimeout(() => {
      if (gameState !== 'playing') return;

      const isFinished = CONDITION_TYPE === 'score' 
        ? score >= GOAL_SCORE 
        : newTotal >= GOAL_SCORE;

      if (isFinished) {
        finishGame();
      } else {
        setResetKey(prev => prev + 1);
      }
    }, 500);
  };

  const handleTypo = (expectedChar: string) => {
      playSE('/sounds/se_typo.mp3');
      setMyTypoCount(prev => prev + 1);
      setMissedKeyStats(prev => {
          const char = expectedChar.toUpperCase();
          return { ...prev, [char]: (prev[char] || 0) + 1 };
      });
  };

  const finishGame = () => {
    playSE('/sounds/se_win.mp3');
    const time = (Date.now() - startTime) / 1000;
    setClearTime(time);
    setGameState('finished');
  };

  const handleRetry = () => {
      setScore(0);
      setGameState('ready');
  };

  const fetchRanking = async () => {
    try {
        const query = new URLSearchParams({
            set_id: CURRENT_SET_ID,
            win_score: String(GOAL_SCORE),
            condition_type: CONDITION_TYPE
        });
        const res = await fetch(`${API_BASE}/api/ranking?${query.toString()}`);
        if (res.ok) {
            const data = await res.json();
            setRanking(data);
        }
    } catch (e) {
        console.error("ランキング取得失敗", e);
    }
  };

  const submitScore = async () => {
    try {
        const bodyData = {
            name: playerName,
            time: clearTime,
            set_id: CURRENT_SET_ID,
            win_score: GOAL_SCORE,
            condition_type: CONDITION_TYPE
        };
        await fetch(`${API_BASE}/api/ranking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyData),
        });
        fetchRanking();
        alert("ランキングに登録しました！");
    } catch (e) {
        alert("送信に失敗しました...");
    }
  };

  useEffect(() => {
    if (gameState === 'finished') {
        fetchRanking();
    }
  }, [gameState]);

  const getTypingRank = (count: number, score: number) => {
      if (count === 0 && score === 0) return '-';
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

  return (
    <div className={`relative w-screen flex flex-col items-center justify-center p-4 text-[#5D4037]
        ${isMobile && gameState === 'finished' ? 'min-h-screen overflow-y-auto' : 'h-screen overflow-hidden'}`}>

      <div className="absolute inset-0 bg-green-50 -z-20" />
      <div className="absolute inset-0 -z-10">
        <ForestPath overlayOpacity={0.2}/>
      </div>

      <div className="absolute top-4 left-4 z-50">
        <button onClick={onBack} className="theme-wood-btn px-6 py-3 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2">
          <span>←</span> <span>もどる</span>
        </button>
      </div>

      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4">
        
        {/* READY */}
        {gameState === 'ready' && (
          <div className="text-center animate-fade-in-up theme-wood-box p-10 max-w-2xl shadow-2xl">
            <h1 className="text-5xl md:text-7xl mb-4 text-battle-logo font-hakoniwa" data-text="TIME ATTACK!">
              TIME ATTACK!
            </h1>
            <p className="text-xl mb-8 font-bold font-hakoniwa text-[#5d4037]">
                {GOAL_SCORE}問
                {CONDITION_TYPE === 'score' ? 'クリア(正解)' : 'プレイ'}
                までのタイムを競おう！
            </p>
            <div className="mb-8 bg-[#fff8e1]/50 p-4 rounded-xl border-2 border-[#8d6e63] inline-block">
              <p className="text-sm font-bold mb-1 opacity-70">Challenger</p>
              <p className="text-3xl font-black text-[#5d4037]">{playerName}</p>
            </div>
            <div>
              <button onClick={startCountdown} className="theme-leaf-btn text-2xl font-black py-4 px-16 rounded-full shadow-xl">
                スタート！
              </button>
            </div>
          </div>
        )}

        {/* COUNTDOWN */}
        {gameState === 'countdown' && (
              <div className="flex flex-col items-center justify-center">
                <div className="text-3xl md:text-4xl font-bold text-white drop-shadow-md font-hakoniwa mb-4">READY?</div>
                <div className="text-5xl md:text-5xl font-black text-[#ffca28] drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] scale-150 pt-2">
                    {countdownValue > 0 ? countdownValue : "START!"}
                </div>
            </div>
        )}

        {/* PLAYING */}
        {gameState === 'playing' && (
          <div className="w-full flex flex-col items-center">
            <div className="w-full max-w-[400px] md:max-w-2xl mb-6 px-4">
              <div className="flex items-baseline gap-1 mb-2 px-2 text-[#FEF3C7] drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]">
                <span className="text-4xl font-black">
                  {CONDITION_TYPE === 'score' ? score : totalAttempted}
                </span>
                <span className="text-xl font-bold opacity-80">/</span>
                <span className="text-xl font-bold opacity-80">{GOAL_SCORE}</span>
                <span className="text-base ml-1 font-bold opacity-70">
                  {CONDITION_TYPE === 'score' ? 'CLEAR' : 'TOTAL'}
                </span>
              </div>
              <div className="w-full h-6 bg-[#064e3b]/20 rounded-full border-4 border-[#059669] overflow-hidden relative">
                <div 
                  className="h-full bg-[#34d399] transition-all duration-500 ease-out"
                  style={{ width: `${((CONDITION_TYPE === 'score' ? score : totalAttempted) / GOAL_SCORE) * 100}%` }}
                />
              </div>
            </div>

            <div className="bg-white/95 rounded-3xl overflow-hidden shadow-2xl text-black border-8 border-[#d4a373]
                            w-[85vw] max-w-[400px] aspect-[9/16] md:w-auto md:max-w-none md:h-[65vh] md:aspect-[16/9]">
              {isMobile ? (
                <GameMobile 
                    onScore={handleScore} 
                    onWrong={handleWrong} 
                    resetKey={resetKey} 
                    isSoloMode={true}
                    setId={setId}
                    settings={settings}
                    wrongHistory={wrongHistory}
                    totalAttempted={totalAttempted}
                />
              ) : (
                <GamePC 
                    onScore={handleScore} 
                    onWrong={handleWrong}
                    onTypo={handleTypo}
                    resetKey={resetKey}
                    isSoloMode={true}
                    settings={settings}
                    setId={setId}
                    wrongHistory={wrongHistory}
                    totalAttempted={totalAttempted}
                />
              )}
            </div>
          </div>
        )}

        {/* FINISHED */}
        {gameState === 'finished' && (
          <div className={`relative z-50 w-full max-w-6xl flex flex-col md:flex-row gap-6 items-stretch justify-center p-2 
              ${isMobile ? 'h-auto mt-20 pb-10' : 'h-[85vh]'}`}>
            <div className="w-full md:w-[50%] h-full min-w-0">
              <div className="theme-wood-box p-5 flex flex-col items-center shadow-2xl animate-fade-in-up h-full">
                <h2 className="text-2xl font-black text-[#d97706] mb-2 drop-shadow-sm">🎉 クリアおめでとう！</h2>
                <div className="text-7xl font-black mt-2 mb-6 text-[#5d4037] drop-shadow-md">{clearTime.toFixed(2)} <span className="text-3xl font-hakoniwa">秒</span></div>
                <div className="mb-8 flex flex-col md:flex-row justify-center gap-4">
                  <button onClick={submitScore} className="theme-leaf-btn py-3 px-8 rounded-xl font-black text-lg">ランキング登録</button>
                  <button onClick={handleRetry} className="theme-wood-btn py-3 px-8 rounded-xl font-black text-lg">リトライ</button>
                </div>
                <div className={`w-full flex-1 bg-[#fff8e1] rounded-xl p-3 overflow-y-auto border-4 border-[#d4a373] shadow-inner ${isMobile ? 'min-h-[200px]' : ''}`}>
                  <h3 className="text-xl font-bold mb-4 border-b-4 border-[#8d6e63] pb-2 text-[#5d4037] flex items-center gap-2 font-hakoniwa">
                    🏆 ランキング
                    <span className="text-xs bg-[#d97706] text-white px-2 py-1 rounded ml-2">
                        {GOAL_SCORE}問 {CONDITION_TYPE === 'score' ? '先取' : 'プレイ'}
                    </span>
                  </h3>
                  <table className="w-full">
                    <tbody>
                    {ranking.map((rank, index) => (
                        <tr key={index} className="border-b border-[#ebdcb2] text-base text-[#5d4037]">
                          <td className="py-1 text-[#d97706] font-black w-10">#{index + 1}</td>
                          <td className="py-1 font-bold truncate max-w-[120px]">{rank.name}</td>
                          <td className="py-1 text-right font-mono font-bold text-[#8d6e63]">{rank.time.toFixed(2)}s</td>
                        </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className={`flex-1 relative w-full md:w-auto`}>
                <div className={`${isMobile ? '' : 'md:absolute md:inset-0 h-full'} theme-wood-box p-5 flex flex-col shadow-2xl animate-fade-in-up overflow-hidden`}>
                    <h3 className="text-xl font-bold mb-4 border-b-4 border-[#8d6e63] pb-2 text-[#5d4037] font-hakoniwa">プレイ分析</h3>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                        <div className="bg-[#fff8e1] p-4 rounded-xl border-4 border-[#d4a373] shadow-inner">
                            <h4 className="text-sm font-bold text-[#5d4037] mb-3 text-center border-b border-[#d4a373] pb-1 mx-4">総合評価</h4>
                            <div className="flex justify-around items-center">
                                <div className="text-center">
                                    <div className="text-sm font-bold text-[#8d6e63] mb-1">暗記力</div>
                                    <div className="text-5xl font-black text-[#d97706]">{getMemoryRank(score, missedProblems.length)}</div>
                                </div>
                                {!isMobile && (
                                    <>
                                        <div className="w-px h-12 bg-[#d4a373]"></div>
                                        <div className="text-center">
                                            <div className="text-sm font-bold text-[#8d6e63] mb-1">タイピング</div>
                                            <div className="text-5xl font-black text-[#d97706]">{getTypingRank(myTypoCount, score)}</div>
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
                                        <div key={key} className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-lg font-bold border border-red-200 flex items-center gap-2">
                                            <span className="font-mono text-2xl">{key}</span>
                                            <span className="text-sm opacity-60">x{count}</span>
                                        </div>
                                    ))}
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
    </div>
  );
}

export default SoloMode;