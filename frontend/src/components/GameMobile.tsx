import { useState } from 'react';

// データ型の定義
type Problem = {
  text: string;
  kana: string;
};

// APIから返ってくるデータの形
type ApiResponse = {
  correct: Problem;
  options: Problem[];
};

function GameMobile() {
  const [gameState, setGameState] = useState<'idle' | 'memorize' | 'quiz' | 'result'>('idle');
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
  const [options, setOptions] = useState<Problem[]>([]);
  const [resultMessage, setResultMessage] = useState("");

  const startGame = async () => {
    // 1. APIからクイズデータを取得
    const res = await fetch("http://127.0.0.1:8000/api/problem");
    const data: ApiResponse = await res.json();
    
    setCurrentProblem(data.correct);
    setOptions(data.options);
    
    // 2. 暗記タイム
    setGameState('memorize');

    // 3. 3秒後にクイズモードへ
    setTimeout(() => {
      setGameState('quiz');
    }, 3000);
  };

  const handleAnswer = (selectedText: string) => {
    if (!currentProblem) return;

    if (selectedText === currentProblem.text) {
      setResultMessage("🎉 正解！");
    } else {
      setResultMessage("😱 はずれ...");
    }
    setGameState('result');
  };

  return (
    <div className="p-4 bg-orange-50 h-full flex flex-col items-center justify-center">
      <h1 className="text-2xl font-bold mb-6 text-orange-600">Memory Quiz (Mobile)</h1>

      {/* スタート画面 / 結果画面 */}
      {(gameState === 'idle' || gameState === 'result') && (
        <div className="text-center mt-10">
          <p className="text-3xl font-bold mb-6">{resultMessage}</p>
          <button 
            onClick={startGame}
            className="bg-orange-500 text-white font-bold py-4 px-10 rounded-full shadow-lg active:scale-95 transition"
          >
            {gameState === 'idle' ? "TAP TO START" : "NEXT QUIZ"}
          </button>
        </div>
      )}

      {/* 暗記画面 */}
      {gameState === 'memorize' && currentProblem && (
        <div className="flex-1 flex flex-col justify-center items-center">
          <p className="text-gray-500 mb-2">覚えて！</p>
          <div className="text-5xl font-black text-gray-800">{currentProblem.text}</div>
          <p className="text-xl text-gray-400 mt-2">{currentProblem.kana}</p>
        </div>
      )}

      {/* クイズ画面（4択ボタン） */}
      {gameState === 'quiz' && (
        <div className="w-full max-w-sm mt-10 grid grid-cols-2 gap-4">
          <div className="col-span-2 text-center mb-4 text-gray-500">
            さっきの単語はどれ？
          </div>
          {options.map((opt, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(opt.text)}
              className="bg-white border-2 border-orange-200 text-xl font-bold py-6 rounded-xl shadow-sm hover:bg-orange-100 active:bg-orange-300 transition"
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