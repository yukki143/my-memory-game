import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import GamePC from './GamePC';
import GameMobile from './GameMobile';
import ForestPath from './ForestPath';
import { DEFAULT_SETTINGS, type Problem } from '../types';
import { authFetch, getToken } from '../utils/auth';
import { useSound } from '../hooks/useSound';
import { useBgm } from '../context/BgmContext';

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
  const [correctOnFirstTry, setCorrectOnFirstTry] = useState(0); 
  
  const [startTime, setStartTime] = useState(0);
  const [fullClearTime, setFullClearTime] = useState(0); 
  const [playerName, setPlayerName] = useState("Player");
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [countdownValue, setCountdownValue] = useState(3);
  const [resetKey, setResetKey] = useState(0);
  
  const [myTypoCount, setMyTypoCount] = useState(0);
  const [missedKeyStats, setMissedKeyStats] = useState<{ [key: string]: number }>({});
  const [missedProblems, setMissedProblems] = useState<Problem[]>([]);
  const [wrongHistory, setWrongHistory] = useState<string[]>([]);

  // ★ 追加: 〇✕表示用のステート
  const [roundResult, setRoundResult] = useState<'correct' | 'wrong' | null>(null);
  
  const { playSE } = useSound();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  // ★ 追加: BGM制御
  const { setBgm } = useBgm();
  const CLICK_SE = '/sounds/se_click.mp3';
  const click = () => playSE(CLICK_SE);


  const MEMORIZE_TIME_SEC = settings.memorizeTime ?? 3;
  const POST_ANSWER_DELAY = 0.5; // この秒数だけ〇✕が表示されます

  // ★ 追加: Soloのゲーム状態に応じてBGMシーン/停止を更新
  useEffect(() => {
    // ready〜countdown は lobby BGM（カウントダウン中も lobby）
    if (gameState === 'ready') {
      setBgm('lobby', false);
      return;
    }

    if (gameState === 'countdown') {
      setBgm('lobby', true);  // ★スタート押下後は止める
      return;
    }

    // playing に入った瞬間に solo BGM
    if (gameState === 'playing') {
      setBgm('solo', false);
      return;
    }

    // finished（結果表示）ではBGM停止（曲種はsoloのままでOK）
    if (gameState === 'finished') {
      setBgm('solo', true);
      return;
    }
  }, [gameState, setBgm]);

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
    setFullClearTime(0);
    setRoundResult(null); // リセット
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

  const COUNT_SE = '/sounds/se_countdown.mp3';
  const countdownSePlayedRef = useRef(false);

  useEffect(() => {
  if (gameState === 'countdown') {
    if (!countdownSePlayedRef.current) {
      playSE(COUNT_SE);                 // ★ここで1回だけ鳴る
      countdownSePlayedRef.current = true;
    }
  } else {
    // countdown を抜けたら次回のためにリセット
    countdownSePlayedRef.current = false;
  }
}, [gameState, playSE]);

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

    // ★ 〇を表示
    setRoundResult('correct');

    if (problem) recordStat(problem.text, true);

    setTimeout(() => {
      if (gameState !== 'playing') return;
      
      // ★ 〇を消す
      setRoundResult(null);

      const isFinished = CONDITION_TYPE === 'score' ? newScore >= GOAL_SCORE : newTotal >= GOAL_SCORE;
      if (isFinished) finishGame();
      else setResetKey(prev => prev + 1);
    }, POST_ANSWER_DELAY * 1000);
  };

  const handleWrong = (problem: Problem) => {
    const newTotal = totalAttempted + 1;
    setMissedProblems(prev => [...prev, problem]);
    setWrongHistory(prev => [...prev, problem.text]);
    setTotalAttempted(newTotal);

    // ★ ✕を表示
    setRoundResult('wrong');

    recordStat(problem.text, false);

    setTimeout(() => {
      if (gameState !== 'playing') return;

      // ★ ✕を消す
      setRoundResult(null);

      const isFinished = CONDITION_TYPE === 'score' ? score >= GOAL_SCORE : newTotal >= GOAL_SCORE;
      if (isFinished) finishGame();
      else setResetKey(prev => prev + 1);
    }, POST_ANSWER_DELAY * 1000);
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
    setFullClearTime((Date.now() - startTime) / 1000);
    setGameState('finished');
    setRoundResult(null);
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

  const calculatePureStats = () => {
    const accuracy = totalAttempted > 0 ? (correctOnFirstTry / totalAttempted) * 100 : 0;
    const questions = totalAttempted;
    const pureTotalInputSec = Math.max(
      0,
      fullClearTime - (questions * (MEMORIZE_TIME_SEC + POST_ANSWER_DELAY))
    );
    const avgSpeed = questions > 0 ? pureTotalInputSec / questions : 0;
    return { accuracy, avgSpeed, pureTotalInputSec };
  };

  const submitScore = async () => {
    try {
        const { accuracy, avgSpeed } = calculatePureStats();
        const bodyData = {
            name: playerName,
            time: fullClearTime,
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

  const { accuracy: currentAccuracy, avgSpeed: pureAvgSpeed, pureTotalInputSec } = calculatePureStats();

  return (
    <div className={`relative w-screen flex flex-col items-center justify-center p-4 text-[#5D4037]
        ${isMobile && gameState === 'finished' ? 'min-h-screen overflow-y-auto' : 'h-screen overflow-hidden'}`}>

      <div className="absolute inset-0 bg-green-50 -z-20" />
      <div className="absolute inset-0 -z-10"><ForestPath overlayOpacity={0.2}/></div>

      <div className="absolute top-4 left-4 z-50">
        <button onClick={() => { click(); onBack();}} className="theme-wood-btn px-6 py-3 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2">
          <span>←</span> <span>もどる</span>
        </button>
      </div>

      {/* ★ 追加: 判定エフェクト（〇✕表示） */}
      {roundResult && gameState === 'playing' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none animate-pop-in">
              <div className={`text-[20rem] font-black drop-shadow-2xl ${roundResult === 'correct' ? 'text-green-500' : 'text-red-600'}`}>
                  {roundResult === 'correct' ? '〇' : '✕'}
              </div>
          </div>
      )}

      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4">
        
        {/* Ready / Countdown */}
        {gameState === 'ready' && (
          <div className="text-center animate-fade-in-up theme-wood-box p-10 max-w-2xl shadow-2xl">
            <h1 className="text-5xl md:text-7xl mb-4 text-battle-logo font-hakoniwa" data-text="TIME ATTACK!">TIME ATTACK!</h1>
            <p className="text-xl mb-8 font-bold font-hakoniwa text-[#5d4037]">
                {GOAL_SCORE}問 クリアまでのタイムを競おう！
            </p>
            <div className="flex flex-col items-center gap-6">
              <div className="bg-[#fff8e1]/50 p-4 rounded-xl border-2 border-[#8d6e63] min-w-[200px]">
                <p className="text-sm font-bold mb-1 opacity-70">Challenger</p>
                <p className="text-3xl font-black text-[#5d4037]">{playerName}</p>
              </div>
              <button onClick={() => { click();startCountdown();}} className="theme-leaf-btn text-2xl font-black py-4 px-16 rounded-full shadow-xl">スタート</button>
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

        {/* プレイ画面 */}
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

        {/* 結果画面セクション */}
        {gameState === 'finished' && (
          <div className={`relative z-50 w-full max-w-6xl flex flex-col md:flex-row gap-6 items-stretch justify-center p-2 ${isMobile ? 'h-auto mt-20 pb-10' : 'h-[85vh]'}`}>
            <div className="w-full md:w-[50%] h-full min-w-0">
              <div className="theme-wood-box p-5 flex flex-col items-center shadow-2xl animate-fade-in-up h-full">
                <h2 className="text-2xl font-black text-[#d97706] mb-2">🎉 クリア！</h2>
                
                <div className="grid grid-cols-2 gap-4 w-full mb-4">
                  <div className="text-center bg-[#fff8e1]/70 p-4 rounded-2xl border-2 border-[#d4a373] shadow-sm">
                    <div className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">平均入力速度</div>
                    <div className="text-3xl md:text-4xl font-black text-[#5d4037]">
                      {pureAvgSpeed.toFixed(2)}<span className="text-sm ml-1 opacity-70">秒</span>
                    </div>
                  </div>
                  <div className="text-center bg-[#fff8e1]/70 p-4 rounded-2xl border-2 border-[#d4a373] shadow-sm">
                    <div className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">正答率</div>
                    <div className="text-3xl md:text-4xl font-black text-[#5d4037]">
                      {currentAccuracy.toFixed(1)}<span className="text-sm ml-1 opacity-70">%</span>
                    </div>
                  </div>
                </div>

                <div className="text-center mb-6">
                  <div className="text-xs font-bold text-[#8d6e63] bg-[#fff8e1] px-4 py-1 rounded-full border border-[#d4a373] inline-block">
                    回答時間: {pureTotalInputSec.toFixed(2)}秒 / 全体: {fullClearTime.toFixed(2)}秒
                  </div>
                </div>

                <div className="mb-6 flex gap-4">
                  <button onClick={() => { click(); submitScore();}} className="theme-leaf-btn py-3 px-8 rounded-xl font-black shadow-lg">ランキング登録</button>
                  <button onClick={() => { click(); setGameState('ready')}} className="theme-wood-btn py-3 px-8 rounded-xl font-black shadow-lg">リトライ</button>
                </div>

                <div className="w-full flex-1 bg-[#fff8e1] rounded-xl p-3 overflow-y-auto border-4 border-[#d4a373]">
                  <h3 className="text-lg font-bold mb-3 border-b-2 border-[#8d6e63] pb-1 text-[#5d4037] font-hakoniwa flex justify-between items-center">
                    <span>🏆 TOP 10 </span>
                  </h3>
                  <table className="w-full text-xs md:text-sm">
                    <thead>
                      <tr className="text-left opacity-60 border-b border-[#ebdcb2]">
                        <th className="pb-2 w-8">#</th>
                        <th className="pb-2">NAME</th>
                        <th className="pb-2 text-right">平均入力速度</th>
                        <th className="pb-2 text-right">正答率</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ebdcb2]/50">
                    {ranking.map((rank, idx) => (
                        <tr key={idx} className="hover:bg-white/30">
                          <td className="py-2 text-[#d97706] font-black">{idx + 1}</td>
                          <td className="py-2 font-bold truncate max-w-[70px] md:max-w-[100px]">{rank.name}</td>
                          <td className="py-2 text-right font-mono font-bold text-[#5d4037]">
                            {rank.avg_speed?.toFixed(2)}秒
                          </td>
                          <td className="py-2 text-right font-mono text-gray-500">
                            {rank.accuracy?.toFixed(1)}%
                          </td>
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
                                    <div className="text-5xl font-black text-[#d97706]">
                                        {getMemoryRank(currentAccuracy)}
                                    </div>
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
                                    {getSortedMissedKeys().length === 0 && <span className="text-gray-400 text-sm">ミスなし！完璧です！</span>}
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
    </div>
  );
}

export default SoloMode;
