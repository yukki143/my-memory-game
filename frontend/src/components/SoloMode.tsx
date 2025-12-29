import { useState, useEffect } from 'react';
import GamePC from './GamePC';
import GameMobile from './GameMobile';

type RankEntry = {
  name: string;
  time: number;
};

type SoloModeProps = {
  onBack: () => void; // 「戻る」ボタン用
};

function SoloMode({ onBack }: SoloModeProps) {
  // 画面管理: ready(待機) -> playing(ゲーム中) -> finished(結果/ランキング)
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [clearTime, setClearTime] = useState(0);
  const [playerName, setPlayerName] = useState("Player");
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  
  // スマホ判定
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const GOAL_SCORE = 10; // 10問正解でクリア

  // ゲーム開始
  const handleStart = () => {
    setScore(0);
    setGameState('playing');
    setStartTime(Date.now());
  };

  // 正解したとき
  const handleScore = () => {
    const newScore = score + 1;
    setScore(newScore);

    if (newScore >= GOAL_SCORE) {
      finishGame();
    }
  };

  // ゲーム終了
  const finishGame = async () => {
    const time = (Date.now() - startTime) / 1000; // 秒に変換
    setClearTime(time);
    setGameState('finished');
    
    // ランキング取得
    fetchRanking();
  };

  // ランキングを取得
  const fetchRanking = async () => {
    const res = await fetch("http://127.0.0.1:8000/api/ranking");
    const data = await res.json();
    setRanking(data);
  };

  // スコア送信
  const submitScore = async () => {
    await fetch("http://127.0.0.1:8000/api/ranking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: playerName, time: clearTime }),
    });
    // 送信後に最新ランキングを再取得
    fetchRanking();
    alert("ランキングに登録しました！");
  };

  return (
    // 背景を青空に
    <div className="w-full h-screen theme-mario-sky text-slate-800 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* ヘッダー: 戻るボタンをポップに */}
      <div className="absolute top-4 left-4 z-20">
        <button onClick={onBack} className="theme-mario-brown-btn px-6 py-3 rounded-full text-sm font-bold shadow-lg">
          ← もどる
        </button>
      </div>

      <div className="z-10 w-full flex flex-col items-center">
      {/* --- 待機画面 (READY) --- */}
      {gameState === 'ready' && (
        <div className="text-center animate-fade-in-up theme-mario-card p-10 max-w-2xl">
          <h1 className="text-5xl md:text-7xl font-black text-green-500 mb-4 drop-shadow-[0_3px_0_white]">
            TIME ATTACK!
          </h1>
          <p className="text-xl mb-8 text-blue-600 font-bold">10問クリアまでのタイムを競おう！</p>
          
          <div className="mb-8">
            <label className="block text-sm mb-2 text-blue-600 font-bold">おなまえ</label>
            <input 
              value={playerName} 
              onChange={(e) => setPlayerName(e.target.value)}
              className="bg-blue-50 border-4 border-blue-200 rounded-xl px-4 py-3 text-center text-2xl font-black w-64 focus:outline-none focus:border-green-400 text-slate-800"
            />
          </div>

          <button 
            onClick={handleStart}
            className="theme-mario-green-btn text-2xl font-black py-4 px-16 rounded-full shadow-xl animate-pulse"
          >
            スタート！
          </button>
        </div>
      )}

      {/* --- ゲーム中 (PLAYING) --- */}
      {gameState === 'playing' && (
        <div className="w-full flex flex-col items-center">
          {/* スコア表示 (ポップなデザイン) */}
          <div className="flex justify-between w-full max-w-[400px] md:max-w-2xl mb-4 px-4 bg-white/70 rounded-full p-2 border-4 border-white shadow-sm">
            <div className="text-xl font-bold text-blue-600 flex items-center"><span className="text-2xl mr-2">🚩</span>ゴール: {GOAL_SCORE}</div>
            <div className="text-3xl font-black text-orange-500">{score} <span className="text-xl text-blue-600">/ {GOAL_SCORE}</span></div>
          </div>

          {/* ゲーム画面コンポーネント (黄色い枠) */}
          <div className="bg-white rounded-3xl overflow-hidden shadow-[0_10px_0_rgba(0,0,0,0.2)] text-black 
                                border-8 border-yellow-400
                                w-[85vw] max-w-[400px] aspect-[9/16] 
                                md:w-auto md:max-w-none md:h-[65vh] md:aspect-[16/9]">
            {isMobile ? (
              <GameMobile onScore={handleScore} />
            ) : (
              <GamePC onScore={handleScore} />
            )}
          </div>
        </div>
      )}

      {/* --- 結果 & ランキング (FINISHED) --- */}
      {gameState === 'finished' && (
        <div className="theme-mario-card p-8 w-full max-w-2xl text-center animate-bounce-in">
          <h2 className="text-3xl font-black text-orange-500 mb-2 drop-shadow-sm">🎉 クリアおめでとう！</h2>
          <div className="text-7xl font-black mb-6 text-blue-600 drop-shadow-[0_3px_0_rgba(0,0,0,0.1)]">{clearTime.toFixed(2)} <span className="text-3xl">びょう</span></div>

          {/* スコア送信ボタン */}
          <div className="mb-8 flex flex-col md:flex-row justify-center gap-4">
            <button onClick={submitScore} className="theme-mario-green-btn py-3 px-8 rounded-xl font-black text-lg">
              ランキングに登録する！
            </button>
            <button onClick={() => setGameState('ready')} className="theme-mario-brown-btn py-3 px-8 rounded-xl font-black text-lg">
              もう一度あそぶ
            </button>
          </div>

          {/* ランキング表 (白い紙風) */}
          <div className="text-left bg-blue-50 rounded-xl p-4 max-h-60 overflow-y-auto border-4 border-blue-100 shadow-inner">
            <h3 className="text-xl font-bold mb-4 border-b-2 border-blue-200 pb-2 text-blue-600 flex items-center">🏆 トップランキング</h3>
            <table className="w-full">
              <tbody>
                {ranking.map((rank, index) => (
                  <tr key={index} className="border-b border-blue-100 text-lg text-slate-700">
                    <td className="py-2 text-orange-500 font-black w-14 text-xl">#{index + 1}</td>
                    <td className="py-2 font-bold truncate max-w-[150px]">{rank.name}</td>
                    <td className="py-2 text-right font-mono font-bold text-blue-600">{rank.time.toFixed(2)}s</td>
                  </tr>
                ))}
                {ranking.length === 0 && (
                  <tr><td colSpan={3} className="text-center text-blue-400 py-4 font-bold">まだデータがないよ！</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
      {/* 地面 */}
      <div className="absolute bottom-0 left-0 w-full h-12 theme-mario-ground-bar z-0"></div>
    </div>
  );
}

export default SoloMode;