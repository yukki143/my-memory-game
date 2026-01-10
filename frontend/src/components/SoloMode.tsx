// src/SoloMode.tsx
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import GamePC from './GamePC';
import GameMobile from './GameMobile';
import ForestPath from './ForestPath';
import { DEFAULT_SETTINGS, type Problem } from '../types';
import { authFetch, getToken } from '../utils/auth';
import { useSound } from '../hooks/useSound';

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

type RankEntry = {
  name: string;
  time: number;
  accuracy: number;
  avg_speed: number;
};

function SoloMode({ onBack }: { onBack: () => void }) {
  const location = useLocation();
  const stateSettings = location.state?.settings;
  const setId = location.state?.setId;
  const settings = stateSettings || DEFAULT_SETTINGS;

  const [gameState, setGameState] = useState<'ready' | 'countdown' | 'playing' | 'finished'>('ready');
  const [score, setScore] = useState(0);
  const [totalAttempted, setTotalAttempted] = useState(0);
  const [correctOnFirstTry, setCorrectOnFirstTry] = useState(0); // 一発正解のカウント
  
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
    setCorrectOnFirstTry(0);
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

  // 単語統計の記録 (ログイン時のみ)
  const recordStat = async (wordText: string, isCorrect: boolean) => {
    if (!getToken()) return;
    try {
      await authFetch(`/api/word_stats?word_text=${encodeURIComponent(wordText)}&is_correct=${isCorrect}`, {
        method: 'POST'
      });
    } catch (e) {
      console.error("Stat recording failed", e);
    }
  };

  const handleScore = (problem?: Problem) => {
    const newScore = score + 1;
    const newTotal = totalAttempted + 1;
    const newFirstTry = correctOnFirstTry + 1;
    
    setScore(newScore);
    setTotalAttempted(newTotal);
    setCorrectOnFirstTry(newFirstTry);

    if (problem) recordStat(problem.text, true);

    setTimeout(() => {
      if (gameState !== 'playing') return;
      const isFinished = CONDITION_TYPE === 'score' ? newScore >= GOAL_SCORE : newTotal >= GOAL_SCORE;
      if (isFinished) finishGame();
      else setResetKey(prev => prev + 1);
    }, 500);
  };

  const handleWrong = (problem: Problem) => {
    const newTotal = totalAttempted + 1;
    setMissedProblems(prev => [...prev, problem]);
    setWrongHistory(prev => [...prev, problem.text]);
    setTotalAttempted(newTotal);

    recordStat(problem.text, false);

    setTimeout(() => {
      if (gameState !== 'playing') return;
      const isFinished = CONDITION_TYPE === 'score' ? score >= GOAL_SCORE : newTotal >= GOAL_SCORE;
      if (isFinished) finishGame();
      else setResetKey(prev => prev + 1);
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
    setClearTime((Date.now() - startTime) / 1000);
    setGameState('finished');
  };

  const fetchRanking = async () => {
    try {
        const query = new URLSearchParams({
            set_id: CURRENT_SET_ID,
            win_score: String(GOAL_SCORE),
            condition_type: CONDITION_TYPE
        });
        const res = await fetch(`${API_BASE}/api/ranking?${query.toString()}`);
        if (res.ok) setRanking(await res.json());
    } catch (e) { console.error("Ranking fetch error", e); }
  };

  const submitScore = async () => {
    try {
        const accuracy = (correctOnFirstTry / totalAttempted) * 100;
        const avgSpeed = (Date.now() - startTime) / 1000 / (score || 1);

        const bodyData = {
            name: playerName,
            time: clearTime,
            set_id: CURRENT_SET_ID,
            win_score: GOAL_SCORE,
            condition_type: CONDITION_TYPE,
            accuracy: accuracy,
            avg_speed: avgSpeed
        };
        await fetch(`${API_BASE}/api/ranking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyData),
        });
        fetchRanking();
        alert("ランキングに登録しました！");
    } catch (e) { alert("送信に失敗しました..."); }
  };

  useEffect(() => { if (gameState === 'finished') fetchRanking(); }, [gameState]);

  return (
    <div className={`relative w-screen flex flex-col items-center justify-center p-4 text-[#5D4037]
        ${isMobile && gameState === 'finished' ? 'min-h-screen overflow-y-auto' : 'h-screen overflow-hidden'}`}>

      <div className="absolute inset-0 bg-green-50 -z-20" />
      <div className="absolute inset-0 -z-10"><ForestPath overlayOpacity={0.2}/></div>

      <div className="absolute top-4 left-4 z-50">
        <button onClick={onBack} className="theme-wood-btn px-6 py-3 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2">
          <span>←</span> <span>もどる</span>
        </button>
      </div>

      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4">
        
        {gameState === 'ready' && (
          <div className="text-center animate-fade-in-up theme-wood-box p-10 max-w-2xl shadow-2xl">
            <h1 className="text-5xl md:text-7xl mb-4 text-battle-logo font-hakoniwa" data-text="TIME ATTACK!">TIME ATTACK!</h1>
            <p className="text-xl mb-8 font-bold font-hakoniwa text-[#5d4037]">
                {GOAL_SCORE}問 {CONDITION_TYPE === 'score' ? 'クリア(正解)までのタイム' : 'プレイでの正答率'}を競おう！
            </p>
            
            {/* 縦並びにするためのコンテナを追加 */}
            <div className="flex flex-col items-center gap-6">
              <div className="bg-[#fff8e1]/50 p-4 rounded-xl border-2 border-[#8d6e63] min-w-[200px]">
                <p className="text-sm font-bold mb-1 opacity-70">Challenger</p>
                <p className="text-3xl font-black text-[#5d4037]">{playerName}</p>
              </div>

              <button 
                onClick={startCountdown} 
                className="theme-leaf-btn text-2xl font-black py-4 px-16 rounded-full shadow-xl"
              >
                スタート！
              </button>
            </div>
          </div>
        )}

        {gameState === 'countdown' && (
          <div className="flex flex-col items-center justify-center">
            <div className="text-3xl md:text-4xl font-bold text-white drop-shadow-md font-hakoniwa mb-4">READY?</div>
            <div className="text-5xl md:text-5xl font-black text-[#ffca28] drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] scale-150 pt-2">
                {countdownValue > 0 ? countdownValue : "START!"}
            </div>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="w-full flex flex-col items-center">
            <div className="w-full max-w-[400px] md:max-w-2xl mb-6 px-4 mt-16 md:mt-0">
              <div className="flex items-baseline gap-1 mb-2 px-2 text-[#FEF3C7] drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]">
                <span className="text-4xl font-black">{CONDITION_TYPE === 'score' ? score : totalAttempted}</span>
                <span className="text-xl font-bold opacity-80">/</span>
                <span className="text-xl font-bold opacity-80">{GOAL_SCORE}</span>
              </div>
              <div className="w-full h-6 bg-[#064e3b]/20 rounded-full border-4 border-[#059669] overflow-hidden">
                <div className="h-full bg-[#34d399] transition-all duration-500 ease-out"
                  style={{ width: `${((CONDITION_TYPE === 'score' ? score : totalAttempted) / GOAL_SCORE) * 100}%` }} />
              </div>
            </div>
            <div className="bg-white/95 rounded-3xl overflow-hidden shadow-2xl border-8 border-[#d4a373]
                            w-[85vw] max-w-[400px] h-[60vh] min-h-[450px] md:w-auto md:max-w-none md:h-[65vh] md:aspect-[16/9]">
              {isMobile ? (
                <GameMobile onScore={handleScore} onWrong={handleWrong} resetKey={resetKey} 
                    isSoloMode setId={setId} settings={settings} wrongHistory={wrongHistory} totalAttempted={totalAttempted} />
              ) : (
                <GamePC onScore={handleScore} onWrong={handleWrong} onTypo={handleTypo} resetKey={resetKey}
                    isSoloMode settings={settings} setId={setId} wrongHistory={wrongHistory} totalAttempted={totalAttempted} />
              )}
            </div>
          </div>
        )}

        {gameState === 'finished' && (
          <div className={`relative z-50 w-full max-w-6xl flex flex-col md:flex-row gap-6 items-stretch justify-center p-2 ${isMobile ? 'h-auto mt-20 pb-10' : 'h-[85vh]'}`}>
            <div className="w-full md:w-[50%] h-full min-w-0">
              <div className="theme-wood-box p-5 flex flex-col items-center shadow-2xl animate-fade-in-up h-full">
                <h2 className="text-2xl font-black text-[#d97706] mb-2">🎉 クリア！</h2>
                <div className="text-center mb-6">
                  {CONDITION_TYPE === 'score' ? (
                    <>
                      <div className="text-sm font-bold text-gray-500">平均回答速度</div>
                      <div className="text-6xl font-black text-[#5d4037]">{(clearTime / score).toFixed(2)} <span className="text-2xl">秒/問</span></div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-bold text-gray-500">暗記正答率</div>
                      <div className="text-6xl font-black text-[#5d4037]">{((correctOnFirstTry / totalAttempted) * 100).toFixed(1)} <span className="text-2xl">%</span></div>
                    </>
                  )}
                  <div className="text-xl font-bold text-gray-400 mt-2">Total Time: {clearTime.toFixed(2)}s</div>
                </div>
                <div className="mb-8 flex gap-4">
                  <button onClick={submitScore} className="theme-leaf-btn py-3 px-8 rounded-xl font-black">ランキング登録</button>
                  <button onClick={() => setGameState('ready')} className="theme-wood-btn py-3 px-8 rounded-xl font-black">リトライ</button>
                </div>
                <div className="w-full flex-1 bg-[#fff8e1] rounded-xl p-3 overflow-y-auto border-4 border-[#d4a373]">
                  <h3 className="text-xl font-bold mb-4 border-b-4 border-[#8d6e63] pb-2 text-[#5d4037] font-hakoniwa">
                    🏆 TOP 10 ({CONDITION_TYPE === 'score' ? '速さ順' : '正答率順'})
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left opacity-60">
                        <th className="pb-2">順位</th><th className="pb-2">名前</th>
                        <th className="pb-2 text-right">{CONDITION_TYPE === 'score' ? '秒/問' : '正答率'}</th>
                      </tr>
                    </thead>
                    <tbody>
                    {ranking.map((rank, idx) => (
                        <tr key={idx} className="border-b border-[#ebdcb2]">
                          <td className="py-2 text-[#d97706] font-black">#{idx + 1}</td>
                          <td className="py-2 font-bold truncate max-w-[100px]">{rank.name}</td>
                          <td className="py-2 text-right font-mono font-bold">
                            {CONDITION_TYPE === 'score' ? rank.avg_speed?.toFixed(2) : rank.accuracy?.toFixed(1) + '%'}
                          </td>
                        </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="flex-1 theme-wood-box p-5 flex flex-col shadow-2xl overflow-hidden">
                <h3 className="text-xl font-bold mb-4 border-b-4 border-[#8d6e63] pb-2 text-[#5d4037] font-hakoniwa">詳細分析</h3>
                <div className="flex-1 overflow-y-auto space-y-4">
                    <div className="bg-[#fff8e1] p-4 rounded-xl border-4 border-[#d4a373] flex justify-around">
                        <div className="text-center">
                            <div className="text-xs font-bold text-[#8d6e63]">正確性</div>
                            <div className="text-4xl font-black text-[#d97706]">{((correctOnFirstTry / totalAttempted) * 100).toFixed(0)}%</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs font-bold text-[#8d6e63]">タイピングミス</div>
                            <div className="text-4xl font-black text-[#d97706]">{myTypoCount}</div>
                        </div>
                    </div>
                    <div className="bg-white/80 p-4 rounded-xl border-2 border-blue-200">
                        <div className="text-sm font-bold text-blue-800 mb-2">❌ ミスした単語 ({missedProblems.length})</div>
                        <ul className="divide-y divide-blue-50 text-sm">
                            {missedProblems.map((p, i) => (
                                <li key={i} className="py-1 flex justify-between">
                                    <span className="font-bold text-red-600">{p.text}</span>
                                    <span className="text-gray-400">{p.kana}</span>
                                </li>
                            ))}
                        </ul>
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