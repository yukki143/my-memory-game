import { useState, useEffect, useRef } from 'react';

// ★修正: 引数の型定義を変更
type GamePCProps = {
  onScore?: () => void;
  onWrong?: (problem: Problem) => void; // 間違えた問題を渡す
  onTypo?: (expectedChar: string) => void; // 打つべきだった文字を渡す
  resetKey: number;
  isSoloMode?: boolean;
};

type Problem = {
  text: string;
  kana: string;
};

function GamePC({ onScore, onWrong, onTypo, resetKey, isSoloMode = false }: GamePCProps) {
  const [gameState, setGameState] = useState<'memorize' | 'answer' | 'waiting'>('memorize');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [inputVal, setInputVal] = useState("");
  const [overlayMark, setOverlayMark] = useState<boolean | null>(null);
  const [isError, setIsError] = useState(false);

  // 通信の競合を防ぐためのID管理
  const latestRequestId = useRef(0);
  const isProcessing = useRef(false);
  // エラー表示タイマーのRef
  const errorTimeoutRef = useRef<number | null>(null);
  const isComposing = useRef(false);

  const loadProblem = async () => {
    isProcessing.current = false;

    // 新しいリクエストIDを発行
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    setOverlayMark(null);
    setInputVal("");
    setIsError(false); // エラー状態リセット
    setGameState('memorize');
    setProblem(null);

    try {
        const res = await fetch("http://127.0.0.1:8000/api/problem");
        const data = await res.json();
        
        // 通信完了時に、最新のリクエストIDか確認
        if (requestId !== latestRequestId.current) return;

        setProblem(data.correct);

        setTimeout(() => {
          // タイマー完了時も確認
          if (requestId === latestRequestId.current) {
             setGameState('answer');
          }
        }, 1000);
    } catch (e) {
        console.error(e);
        isProcessing.current = false;
    }
  };

  useEffect(() => { loadProblem(); }, []);
  useEffect(() => { if (resetKey > 0) loadProblem(); }, [resetKey]);

  // ★文字数に応じてフォントサイズを決定する関数
  const getFontSize = (text: string) => {
    const len = text.length;
    if (len <= 5) return "text-6xl";
    if (len <= 10) return "text-5xl";
    if (len <= 20) return "text-4xl";
    if (len <= 30) return "text-2xl";
    return "text-xl"; // 30文字以上
  };

  // ★追加: 入力変更時のバリデーション処理
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!problem || gameState === 'waiting') return;

    const newVal = e.target.value;

    // バックスペース（文字を消す場合）は常に許可
    if (newVal.length < inputVal.length) {
        setInputVal(newVal);
        return;
    }

    // ★修正: 日本語変換中(isComposingがtrue)なら、チェックせずに入力を許可する
    if (isComposing.current) {
        setInputVal(newVal);
        return;
    }

    // 通常入力（英数字や、変換確定後の文字）のチェック
    if (problem.text.startsWith(newVal)) {
        setInputVal(newVal);
        setIsError(false);
    } else {
        triggerErrorEffect();
        const expectedChar = problem.text.charAt(inputVal.length);
        if (onTypo && expectedChar) onTypo(expectedChar);
    }
  };

  // ★追加: エラー演出の発火
  const triggerErrorEffect = () => {
    setIsError(true);
    
    // 既存のタイマーがあればクリア
    if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
    }

    // 0.3秒後に赤色と揺れを解除
    errorTimeoutRef.current = setTimeout(() => {
        setIsError(false);
    }, 300);
  };

  const checkAnswer = () => {
    if (!problem || isProcessing.current) return;
    
    if (isComposing.current) return;

    isProcessing.current = true;
    
    if (inputVal === problem.text) {
      // ■ 正解 -----------------------
      setOverlayMark(true);
      if (onScore) onScore();

      if (isSoloMode) {
          setTimeout(() => loadProblem(), 400);
      } else {
      }
      
    } else {
      // ■ 不正解 ---------------------
      setOverlayMark(false);
      triggerErrorEffect();
      
      if (onWrong) onWrong(problem);

      if (isSoloMode) {
          // ソロモード：次へ進む
          setTimeout(() => loadProblem(), 400);
      } else {
          // バトルモード：待機状態へ
          setGameState('waiting');
          isProcessing.current = false;
      }
    }
  };

  return (
    <div className="relative p-10 bg-gray-100 h-full flex flex-col items-center justify-center w-full">
      {/* 揺れアニメーションの定義 */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 2; /* 0.2秒で2回振る */
        }
      `}</style>
      <h1 className="text-4xl font-bold mb-8 text-blue-600">Flash Typing</h1>

       {/* ★ オーバーレイ表示 (〇 / ✕) */}
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

      {/* 待機メッセージ */}
      {gameState === 'waiting' && (
          <div className="text-2xl font-bold text-gray-500 animate-pulse mt-4">
              相手の回答を待っています...
          </div>
      )}

      {/* 暗記タイム */}
      {gameState === 'memorize' && problem && (
        <div className="text-center animate-pulse">
          <p className="text-xl text-gray-500 mb-2">覚えてください！</p>
          {/* ★修正: 文字サイズ動的変更 & 改行対応 */}
          <div className={`font-black mb-4 break-words whitespace-normal leading-tight ${getFontSize(problem.text)}`}>
            {problem.text}
          </div>
          <p className="text-2xl text-gray-400">({problem.kana})</p>
        </div>
      )}

      {/* 回答タイム */}
      {(gameState === 'answer' || gameState === 'waiting') && (
        <div className="text-center relative z-10 w-full flex flex-col items-center px-4">
          <p className="text-xl text-gray-500 mb-4">さっきの単語を入力せよ！</p>
          {/* ★修正: input から textarea に変更 */}
          <textarea
            disabled={gameState === 'waiting' || !problem}
            className={`
                border-4 rounded-xl p-4 text-xl text-center w-full outline-none transition
                resize-none h-40 leading-relaxed
                ${(gameState === 'waiting' || !problem) 
                    ? 'bg-gray-200 border-gray-400 cursor-not-allowed' 
                    : isError 
                        ? 'bg-red-50 border-red-500 text-red-600 animate-shake' // エラー時のスタイル
                        : 'border-blue-300 focus:border-blue-600 bg-white text-gray-800'
                }
            `}
            placeholder="ここに入力..."
            value={inputVal}

            // ★追加: 日本語入力の開始・終了を検知
            onCompositionStart={() => { isComposing.current = true; }}
            onCompositionEnd={() => { isComposing.current = false; }}
            
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                  e.preventDefault();
                  // 変換中でないときのみ判定へ
                  if (!isComposing.current && gameState !== 'waiting') checkAnswer();
              }
            }}
            autoFocus
          />
          <button 
            onClick={checkAnswer}
            disabled={gameState === 'waiting'}
            className={`block mt-4 mx-auto text-white py-2 px-8 rounded text-xl font-bold
                ${gameState === 'waiting' ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'}
            `}
          >
            決定 (Enter)
          </button>
        </div>
      )}
    </div>
  );
}

export default GamePC;