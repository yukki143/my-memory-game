import { useState, useEffect } from 'react';
import GamePC from './GamePC';
import GameMobile from './GameMobile';
import ForestPath from './ForestPath';

type RankEntry = {
  name: string;
  time: number;
};

// 問題の型
type Problem = {
  text: string;
  kana: string;
};

type SoloModeProps = {
  onBack: () => void; // 「戻る」ボタン用
};

function SoloMode({ onBack }: SoloModeProps) {
  // 画面管理: ready(待機) -> countdown(カウントダウン) -> playing(ゲーム中) -> finished(結果)
  const [gameState, setGameState] = useState<'ready' | 'countdown' | 'playing' | 'finished'>('ready');
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [clearTime, setClearTime] = useState(0);
  const [playerName, setPlayerName] = useState("Player");
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [countdownValue, setCountdownValue] = useState(3);
  const [resetKey, setResetKey] = useState(0);

  // ★追加: 詳細リザルト用ステート
  const [myTypoCount, setMyTypoCount] = useState(0);     // PC用
  // ★追加: ミスキーの内訳 { "a": 5, "k": 2 }
  const [missedKeyStats, setMissedKeyStats] = useState<{ [key: string]: number }>({});
  // ★追加: ミスした問題リスト
  const [missedProblems, setMissedProblems] = useState<Problem[]>([]);

  // スマホ判定
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const GOAL_SCORE = 10; // 10問正解でクリア

  // ■ 1. スタート処理（カウントダウン開始）
  const startCountdown = () => {
    if (playerName.trim() === "") {
        alert("おなまえを入力してね！");
        return;
    }
    setScore(0);
    setMyTypoCount(0);
    setMissedKeyStats({});
    setMissedProblems([]);
    setGameState('countdown');
    setCountdownValue(3);
  };

  // ■ 2. キーボード操作（Enter/Spaceでスタート）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (gameState === 'ready') {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); // スクロール等を防ぐ
                startCountdown();
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, playerName]); // playerNameが変わるたびにリスナー更新

  // ■ 3. カウントダウンロジック
  useEffect(() => {
    if (gameState === 'countdown' && countdownValue > 0) {
      const timer = setTimeout(() => {
        setCountdownValue((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (gameState === 'countdown' && countdownValue === 0) {
      // 0になったらゲーム開始 & 計測開始
      setGameState('playing');
      setStartTime(Date.now());
      setResetKey(prev => prev + 1); // ゲームコンポーネントをリセット
    }
  }, [gameState, countdownValue]);

  // ■ 4. 正解したとき
  const handleScore = () => {
    const newScore = score + 1;
    setScore(newScore);
    if (newScore >= GOAL_SCORE) {
      finishGame();
    }
  };

// ★ミス時の処理 (GamePC/GameMobileから問題を受け取る)
  const handleWrong = (problem: Problem) => {
      setMissedProblems(prev => [...prev, problem]);
  };

  // ★タイポ時の処理 (GamePCから「打つべきだった文字」を受け取る)
  const handleTypo = (expectedChar: string) => {
      setMyTypoCount(prev => prev + 1);
      
      // キーごとのミス数をカウント
      setMissedKeyStats(prev => {
          const char = expectedChar.toUpperCase(); // 大文字で統一
          return {
              ...prev,
              [char]: (prev[char] || 0) + 1
          };
      });
  };

  // ■ 5. ゲーム終了
  const finishGame = async () => {
    const time = (Date.now() - startTime) / 1000; // 秒に変換
    setClearTime(time);
    setGameState('finished');
    // ランキング取得
    fetchRanking();
  };

  // ■ 6. リトライ
  const handleRetry = () => {
      setScore(0);
      setGameState('ready'); // 名前入力画面に戻る（あるいは直接startCountdownでも可）
  };

  // ランキングを取得
  const fetchRanking = async () => {
    try {
        const res = await fetch("http://127.0.0.1:8000/api/ranking");
        const data = await res.json();
        setRanking(data);
    } catch (e) {
        console.error("ランキング取得失敗", e);
    }
  };

  // スコア送信
  const submitScore = async () => {
    try {
        await fetch("http://127.0.0.1:8000/api/ranking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: playerName, time: clearTime }),
        });
        fetchRanking();
        alert("ランキングに登録しました！");
    } catch (e) {
        alert("送信に失敗しました...");
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

  // ★ミスキーを集計してソートする関数
  const getSortedMissedKeys = () => {
      return Object.entries(missedKeyStats)
          .sort(([, a], [, b]) => b - a) // 多い順にソート
          .slice(0, 5); // トップ5を表示
  };

  const isResultScrollable = isMobile && gameState === 'finished';

  return (
    // 外枠: relative にして中身を重ねられるようにする
    <div className={`relative w-screen flex flex-col items-center justify-center p-4 text-[#5D4037]
        ${isResultScrollable ? 'min-h-screen overflow-y-auto' : 'h-screen overflow-hidden'}`}>

      {/* ★追加: 背景色レイヤー（一番奥） */}
      <div className="absolute inset-0 bg-green-50 -z-20" />
      
      {/* ★背景: 森の道アニメーション (一番奥に配置) */}
      <ForestPath overlayOpacity={0.2}/>

      {/* ヘッダー: 戻るボタン */}
      <div className="absolute top-4 left-4 z-50">
        <button onClick={onBack} className="theme-wood-btn px-6 py-3 rounded-xl text-sm font-bold shadow-lg font-pop flex items-center gap-2">
          <span>←</span> <span>もどる</span>
        </button>
      </div>

      {/* メインコンテンツ: z-10 で背景より手前に表示 */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4">
        
        {/* --- 待機画面 (READY) --- */}
        {gameState === 'ready' && (
          <div className="text-center animate-fade-in-up theme-wood-box p-10 max-w-2xl shadow-2xl">
            <h1 className="text-5xl md:text-7xl mb-4 text-battle-logo font-hakoniwa" data-text="TIME ATTACK!">
              TIME ATTACK!
            </h1>
            <p className="text-xl mb-8 font-bold font-hakoniwa text-[#5d4037]">10問クリアまでのタイムを競おう！</p>
            
            <div className="mb-8">
              <label className="block text-sm mb-2 font-bold font-hakoniwa">おなまえ</label>
              <input 
                value={playerName} 
                onChange={(e) => setPlayerName(e.target.value)}
                className="bg-[#fff8e1] border-4 border-[#8d6e63] rounded-xl px-4 py-3 text-center text-2xl font-black w-64 focus:outline-none focus:border-[#5d4037] text-[#5d4037] font-pop"
              />
            </div>

            <button 
              onClick={startCountdown}
              className="theme-leaf-btn text-2xl font-black py-4 px-16 rounded-full shadow-xl font-pop"
            >
              スタート！
            </button>
          </div>
        )}

        {/* --- カウントダウン (COUNTDOWN) --- */}
        {gameState === 'countdown' && (
             <div className="flex flex-col items-center justify-center">
                <div className="text-3xl md:text-4xl font-bold text-white drop-shadow-md font-hakoniwa mb-4">READY?</div>
                <div className="text-5xl md:text-5xl font-black text-[#ffca28] drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] font-pop scale-150 pt-2">
                    {countdownValue > 0 ? countdownValue : "START!"}
                </div>
            </div>
        )}

        {/* --- ゲーム中 (PLAYING) --- */}
        {gameState === 'playing' && (
          <div className="w-full flex flex-col items-center">
            {/* スコア表示 */}
            <div className="flex justify-between w-full max-w-[400px] md:max-w-2xl mb-4 px-6 bg-[#a7f3d0] rounded-full p-2 border-4 border-[#059669] shadow-lg text-[#064e3b]">
              <div className="text-xl font-bold flex items-center font-pop"><span className="text-2xl mr-2">🚩</span>ゴール: {GOAL_SCORE}</div>
              <div className="text-3xl font-black font-pop">{score} <span className="text-xl">/ {GOAL_SCORE}</span></div>
            </div>

            {/* ゲーム画面コンポーネント */}
            <div className="bg-white/95 rounded-3xl overflow-hidden shadow-2xl text-black 
                                  border-8 border-[#d4a373]
                                  w-[85vw] max-w-[400px] aspect-[9/16] 
                                  md:w-auto md:max-w-none md:h-[65vh] md:aspect-[16/9]">
              {isMobile ? (
                <GameMobile 
                    onScore={handleScore} 
                    onWrong={handleWrong} // ソロでは何もしないが型定義のため渡す
                    resetKey={resetKey} 
                    isSoloMode={true}
                />
              ) : (
                <GamePC 
                    onScore={handleScore} 
                    onWrong={handleWrong}
                    onTypo={handleTypo} // ★追加: タイポ検知
                    resetKey={resetKey}
                    isSoloMode={true}
                />
              )}
            </div>
          </div>
        )}

        {/* --- 結果 & ランキング (FINISHED) --- */}
        {gameState === 'finished' && (
          <div className={`relative z-50 w-full max-w-6xl flex flex-col md:flex-row gap-6 items-stretch justify-center p-2 
              ${isMobile ? 'h-auto mt-20 pb-10' : 'h-[85vh]'}`}>
            {/* --- 左カード: メイン結果 & ランキング --- */}
            <div className="w-full md:w-[50%] h-full min-w-0">
              <div className="theme-wood-box p-5 flex flex-col items-center shadow-2xl animate-fade-in-up h-full">
                <h2 className="text-2xl font-black text-[#d97706] mb-2 drop-shadow-sm font-pop">🎉 クリアおめでとう！</h2>
                <div className="text-7xl font-black mt-2 mb-6 text-[#5d4037] drop-shadow-md font-pop">{clearTime.toFixed(2)} <span className="text-3xl font-hakoniwa">秒</span></div>
                <div className="mb-8 flex flex-col md:flex-row justify-center gap-4">
                  <button onClick={submitScore} className="theme-leaf-btn py-3 px-8 rounded-xl font-black text-lg font-pop">
                    ランキングに登録する
                  </button>
                  <button onClick={handleRetry} className="theme-wood-btn py-3 px-8 rounded-xl font-black text-lg font-pop">
                    リトライ
                  </button>
                </div>
              {/* 左カラム: ランキング */}
              <div className={`w-full flex-1 bg-[#fff8e1] rounded-xl p-3 overflow-y-auto border-4 border-[#d4a373] shadow-inner text-left ${isMobile ? 'min-h-[200px]' : 'min-h-0'}`}>
                <h3 className="text-xl font-bold mb-4 border-b-4 border-[#8d6e63] pb-2 text-[#5d4037] flex items-center gap-2 font-hakoniwa shrink-0">
                  🏆 トップランキング
                </h3>

                <table className="w-full">
                    <tbody>
                    {ranking.map((rank, index) => (
                        <tr key={index} className="border-b border-[#ebdcb2] text-base text-[#5d4037]">
                        <td className="py-1 text-[#d97706] font-black w-10 font-pop">#{index + 1}</td>
                        <td className="py-1 font-bold truncate max-w-[120px] font-hakoniwa">{rank.name}</td>
                        <td className="py-1 text-right font-mono font-bold text-[#8d6e63]">{rank.time.toFixed(2)}s</td>
                        </tr>
                    ))}
                    {ranking.length === 0 && (
                        <tr><td colSpan={3} className="text-center text-[#8d6e63] py-4 font-bold font-hakoniwa">まだデータがないよ！</td></tr>
                    )}
                    </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* --- 右カード: 詳細分析データ --- */}
          <div className={`flex-1 relative w-full md:w-auto ${isMobile ? '' : 'min-h-0'}`}>
                <div className={`${isMobile ? '' : 'md:absolute md:inset-0 h-full'} theme-wood-box p-5 flex flex-col shadow-2xl animate-fade-in-up delay-100 overflow-hidden`}>
                    <h3 className="text-xl font-bold mb-4 border-b-4 border-[#8d6e63] pb-2 text-[#5d4037] flex items-center gap-2 font-hakoniwa shrink-0">
                        プレイ分析
                    </h3>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                        {/* ランクスコア */}
                        <div className="bg-[#fff8e1] p-4 rounded-xl border-4 border-[#d4a373] shadow-inner">
                            <h4 className="text-sm font-bold text-[#5d4037] mb-3 text-center border-b border-[#d4a373] pb-1 mx-4">総合評価</h4>
                            <div className="flex justify-around items-center">
                                <div className="text-center">
                                    <div className="text-sm font-bold text-[#8d6e63] mb-1">暗記力</div>
                                    <div className="text-5xl font-black font-pop text-[#d97706] drop-shadow-sm">{getMemoryRank(GOAL_SCORE, missedProblems.length)}</div>
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
    </div>
  );
}

export default SoloMode;