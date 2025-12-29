import { useState } from 'react';

type GamePCProps = {
  onScore?: () => void; // 「正解したときに呼ぶ関数」を受け取る（?は無くてもいいという意味）
};

// 問題のデータ型を定義
type Problem = {
  text: string;
  kana: string;
};

function GamePC({ onScore }: GamePCProps) {
  // ゲームの状態管理: 'idle'(待機) -> 'memorize'(暗記) -> 'answer'(回答) -> 'result'(結果)
  const [gameState, setGameState] = useState<'idle' | 'memorize' | 'answer' | 'result'>('idle');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [inputVal, setInputVal] = useState("");
  const [resultMessage, setResultMessage] = useState("");

  // ゲーム開始！
  const startGame = async () => {
    // 1. サーバーから問題を取得
    const res = await fetch("http://127.0.0.1:8000/api/problem");
    const data = await res.json();
    setProblem(data.correct);
    setInputVal("");
    
    // 2. 暗記タイムスタート
    setGameState('memorize');

    // 3. 3秒後に回答モードへ切り替え
    setTimeout(() => {
      setGameState('answer');
    }, 3000); // 3000ミリ秒 = 3秒
  };

  // 答え合わせ
  const checkAnswer = () => {
    if (problem && inputVal === problem.text) {
      setResultMessage("🎉 大正解！！");
      if (onScore) {
        onScore();
      }

      // 即座に次の問題へ！（暗記モードに切り替わる）
      startGame();

      // 下にある setGameState('result') が動かないようにするためです。
      return;
    } 
    else {
      setResultMessage(`😢 残念... 正解は ${problem?.text}`);
    }
    // 不正解のときだけ、結果画面（リトライボタンがある画面）に行きます
    setGameState('result');
  };

  return (
    <div className="p-10 bg-gray-100 h-full flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-8 text-blue-600">Flash Typing (PC)</h1>

      {/* 待機中または結果画面ならスタートボタンを表示 */}
      {(gameState === 'idle' || gameState === 'result') && (
        <div className="text-center">
          {gameState === 'result' && (
            <p className="text-2xl font-bold mb-4 text-red-500">{resultMessage}</p>
          )}
          <button 
            onClick={startGame}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl"
          >
            {gameState === 'idle' ? "ゲームスタート！" : "もう一度遊ぶ"}
          </button>
        </div>
      )}

      {/* 暗記タイム: 問題を表示 */}
      {gameState === 'memorize' && problem && (
        <div className="text-center animate-pulse">
          <p className="text-xl text-gray-500 mb-2">覚えてください！</p>
          <div className="text-6xl font-black mb-4">{problem.text}</div>
          <p className="text-2xl text-gray-400">({problem.kana})</p>
        </div>
      )}

      {/* 回答タイム: 入力フォームを表示 */}
      {gameState === 'answer' && (
        <div className="text-center">
          <p className="text-xl text-gray-500 mb-4">さっきの単語を入力せよ！</p>
          <input
            type="text"
            className="border-4 border-blue-300 rounded p-4 text-3xl text-center w-full max-w-md outline-none focus:border-blue-600"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') checkAnswer();
            }}
            autoFocus
          />
          <button 
            onClick={checkAnswer}
            className="block mt-4 mx-auto bg-green-500 text-white py-2 px-4 rounded"
          >
            決定 (Enter)
          </button>
        </div>
      )}
    </div>
  );
}

export default GamePC;