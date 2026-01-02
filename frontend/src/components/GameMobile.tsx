import { useState, useEffect, useRef } from 'react';

type Problem = {
  text: string;
  kana: string;
};

type ApiResponse = {
  correct: Problem;
  options: Problem[];
};

// ★修正: onWrong の型定義を変更
type Props = {
  onScore: () => void;
  onWrong: (problem: Problem) => void;
  resetKey: number;
  isSoloMode?: boolean;
};

function GameMobile({ onScore, onWrong, resetKey, isSoloMode = false }: Props) {
  // result状態をなくし、isWaiting(相手待ち)を追加
  const [gameState, setGameState] = useState<'memorize' | 'quiz' | 'waiting'>('memorize');
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
  const [options, setOptions] = useState<Problem[]>([]);
  
  // 表示用: null=なし, true=〇, false=✕
  const [overlayMark, setOverlayMark] = useState<boolean | null>(null);

  // ★修正1: 通信の競合を防ぐためのID管理
  const latestRequestId = useRef(0);

  const loadProblem = async () => {
    // リクエストIDを更新（これで「このID以外は古い」と判断できる）
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    setOverlayMark(null);
    setGameState('memorize');
    
    try {
        const res = await fetch("http://127.0.0.1:8000/api/problem");
        const data: ApiResponse = await res.json();

        // ★修正2: もし通信中に次のリクエストが始まっていたら、この結果は捨てる
        if (requestId !== latestRequestId.current) return;

        setCurrentProblem(data.correct);
        setOptions(data.options);

        // 暗記時間タイマー
        setTimeout(() => {
            // タイマー発火時も、まだこの問題が最新か確認する
            if (requestId === latestRequestId.current) {
                setGameState('quiz');
            }
        }, 1000);

    } catch (e) {
        console.error("Fetch error:", e);
    }
  };

  useEffect(() => { loadProblem(); }, []);
  useEffect(() => { if (resetKey > 0) loadProblem(); }, [resetKey]);

  // ★文字数に応じてフォントサイズを決定（スマホ用調整）
  const getFontSize = (text: string) => {
    const len = text.length;
    if (len <= 5) return "text-5xl"; // PCより少し小さく
    if (len <= 10) return "text-4xl";
    if (len <= 20) return "text-2xl";
    if (len <= 30) return "text-xl";
    return "text-sm"; 
  };

  // ★選択肢ボタン用のフォントサイズ
  const getButtonFontSize = (text: string) => {
    const len = text.length;
    if (len <= 8) return "text-lg";
    if (len <= 15) return "text-sm";
    return "text-xs";
  };

  const handleAnswer = (selectedText: string) => {
    if (!currentProblem) return;

    if (selectedText === currentProblem.text) {
      // ■ 正解！
      setOverlayMark(true); // 〇を表示
      onScore();            // スコア加算 & 親に通知
      if (isSoloMode) {
          setTimeout(() => loadProblem(), 400);
      }
    } else {
      // ■ 不正解...
      setOverlayMark(false); // ✕を表示
      onWrong(currentProblem);             // 親に「間違えた」と通知
      if (isSoloMode) {
          setTimeout(() => loadProblem(), 400);
      } else {
          // ★バトルモードの場合: 待機状態にする
          setGameState('waiting');
      }
    }
  };

  return (
    // relative をつけて、オーバーレイの基準点にする
    <div className="relative p-4 bg-orange-50 h-full flex flex-col items-center justify-center w-full">
      <h1 className="text-xl font-bold mb-4 text-orange-600">Memory Quiz</h1>

      {/* ★ オーバーレイ表示 (〇 / ✕) : 問題の上に重なる */}
      {overlayMark !== null && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/10">
              <div className="text-9xl font-black drop-shadow-2xl animate-bounce-in">
                  {overlayMark ? (
                      <span className="text-green-500 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]">〇</span>
                  ) : (
                      <span className="text-red-600 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]">✕</span>
                  )}
              </div>
          </div>
      )}

      {/* 待機中のメッセージ */}
      {gameState === 'waiting' && overlayMark === false && (
          <div className="absolute bottom-10 z-40 bg-black/70 text-white px-6 py-2 rounded-full animate-pulse">
              相手の回答を待っています...
          </div>
      )}

      {/* 暗記画面 */}
      {gameState === 'memorize' && currentProblem && (
        <div className="flex-1 flex flex-col justify-center items-center animate-pulse">
          <p className="text-gray-500 mb-2">覚えて！</p>
          {/* ★修正: 文字サイズ動的変更 & 改行対応 */}
          <div className={`font-black text-gray-800 break-words whitespace-normal text-center leading-tight ${getFontSize(currentProblem.text)}`}>
            {currentProblem.text}
          </div>
          <p className="text-xl text-gray-400 mt-2">{currentProblem.kana}</p>
        </div>
      )}

      {/* クイズ画面 */}
      {(gameState === 'quiz' || gameState === 'waiting') && (
        <div className="w-full max-w-sm mt-4 grid grid-cols-2 gap-3 h-full max-h-[60%]">
          {options.map((opt, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(opt.text)}
              disabled={gameState === 'waiting'} // 待機中は押せない
              className={`h-32 w-full
                font-bold rounded-xl shadow-sm transition transform active:scale-95 flex items-center justify-center p-2 break-words leading-tight
                ${gameState === 'waiting' ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-white border-2 border-orange-200 hover:bg-orange-100 active:bg-orange-300'}
                ${getButtonFontSize(opt.text)} 
              `}
            >
              {opt.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default GameMobile;