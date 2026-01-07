// src/GamePC.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Problem } from '../types';
import type { GameSettings } from '../types';
import { useSound } from '../hooks/useSound';
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

type GamePCProps = {
  onScore?: () => void;
  onWrong?: (problem: Problem) => void;
  onTypo?: (expectedChar: string) => void;
  resetKey: number;
  settings?: GameSettings;
  roomId?: string;
  playerId?: string;
  setId?: string;
  seed?: string;
  wrongHistory?: string[];
  totalAttempted?: number;
  isSoloMode?: boolean;
};

type ApiResponse = {
  correct: Problem;
  options: Problem[];
};

export default function GamePC({ onScore, onWrong, onTypo, resetKey, settings, roomId, playerId, setId, seed, wrongHistory, totalAttempted, isSoloMode }: GamePCProps) {
  const splitCount = settings?.questionsPerRound || 1;
  const MEMORIZE_TIME = settings?.memorizeTime || 3;
  const ANSWER_TIME = settings?.answerTime || 10;

  // --- useEffectの中の接続処理 ---
  useEffect(() => {
    if (!roomId || !playerId) return;

    // ★ ここで WS_BASE を使って URL を組み立てる
    const wsUrl = `${WS_BASE}/ws/battle/${roomId}/${playerId}?setName=${setId}`;
    
    console.log("Connecting to:", wsUrl); // 確認用
    const socket = new WebSocket(wsUrl);

    // ... 以下の処理はそのまま
  }, [roomId, playerId, setId]);

  const [gameState, setGameState] = useState<'memorize' | 'answer' | 'waiting'>('memorize');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [inputVals, setInputVals] = useState<string[]>([]);
  const [results, setResults] = useState<(boolean | null)[]>([]);
  const [isError, setIsError] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(MEMORIZE_TIME);
  const [answerTimeLeft, setAnswerTimeLeft] = useState<number>(ANSWER_TIME);

  const latestRequestId = useRef(0);
  const isProcessing = useRef(false);
  const errorTimeoutRef = useRef<number | null>(null);
  const isComposing = useRef(false);
  const { playSE } = useSound();
  
  // ★追加: 最新の統計データを保持するRef（再ロードのトリガーにしないため）
  const totalAttemptedRef = useRef(totalAttempted);
  const wrongHistoryRef = useRef(wrongHistory);

  // Propsが更新されたらRefを最新にする
  useEffect(() => { totalAttemptedRef.current = totalAttempted; }, [totalAttempted]);
  useEffect(() => { wrongHistoryRef.current = wrongHistory; }, [wrongHistory]);

  const inputRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [showWrongMark, setShowWrongMark] = useState(false);

  // --- 問題ロード ---
  const loadProblem = useCallback(async () => {
    isProcessing.current = false;
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    // 演出リセット
    setResults(Array(splitCount).fill(null));
    setShowWrongMark(false);
    setIsError(false);
    
    // 状態初期化
    setProblems([]);
    setInputVals(Array(splitCount).fill(""));
    setTimeLeft(MEMORIZE_TIME);
    setAnswerTimeLeft(ANSWER_TIME);
    setGameState('waiting');

    try {
        const newProblems: Problem[] = [];
        for (let i = 0; i < splitCount; i++) {
            const params = new URLSearchParams();
            if (roomId) params.append("room_id", roomId);
            if (setId) params.append("set_id", setId);
            if (seed) params.append("seed", `${seed}-${i}`);
            
            // ★Refから最新値を取得して送信
            if (wrongHistoryRef.current && wrongHistoryRef.current.length > 0) {
                params.append("wrong_history", wrongHistoryRef.current.join(","));
            }
            if (totalAttemptedRef.current !== undefined) {
                params.append("current_index", String(totalAttemptedRef.current + i));
            }
            
            const url = `${API_BASE}/api/problem?${params.toString()}&t=${Date.now()}`;
            const res = await fetch(url, { cache: "no-store" });
            const data: ApiResponse = await res.json();
            newProblems.push(data.correct);
        }
        
        if (requestId !== latestRequestId.current) return;
        setProblems(newProblems);
        setTimeLeft(MEMORIZE_TIME);
        setGameState('memorize');

    } catch (e) {
        console.error(e);
        isProcessing.current = false;
    }
    // ★依存配列から totalAttempted と wrongHistory を削除
  }, [splitCount, roomId, setId, seed, MEMORIZE_TIME, ANSWER_TIME]);

  useEffect(() => { 
      if (resetKey >= 0) loadProblem(); 
  }, [resetKey, loadProblem]);

  useEffect(() => {
    if (gameState === 'memorize') {
        if (timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setGameState('answer');
        }
    }
  }, [gameState, timeLeft]);

  // ★追加: 解答フェーズのカウントダウンロジック
  useEffect(() => {
    if (gameState === 'answer' && !isProcessing.current) {
        if (answerTimeLeft > 0) {
            const timer = setTimeout(() => setAnswerTimeLeft(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            // 0秒になったら自動でEnterキー処理（判定）を実行
            handleEnterKey();
        }
    }
  }, [gameState, answerTimeLeft]);

  const getFontSize = (text: string) => {
    const len = text.length;
    if (splitCount >= 4) return len <= 5 ? "text-2xl" : "text-lg";
    return len <= 5 ? "text-5xl" : len <= 10 ? "text-4xl" : "text-2xl";
  };

  const getGridClass = () => {
    if (splitCount === 1) return "grid-cols-1";
    if (splitCount === 2 || splitCount <= 4) return "grid-cols-2";
    return "grid-cols-3";
  };

  const triggerErrorEffect = () => {
    setIsError(true);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = window.setTimeout(() => setIsError(false), 300);
  };

  const handleAllCorrect = () => {
      if (isProcessing.current || gameState === 'waiting') return; 

      // 1. まず音を鳴らす（最優先）
      playSE('/sounds/se_correct.mp3');

      // 2. 次に〇を表示する
      setResults(Array(splitCount).fill(true));
      
      // 3. 状態を更新
      isProcessing.current = true;
      setGameState('waiting');
      
      // 4. 親への報告（重い処理）は最後に行う
      if (onScore) onScore();
  };

  const handleEnterKey = () => {
      if (isComposing.current || gameState === 'waiting' || isProcessing.current) return;
      const isAllCorrect = problems.every((p, i) => inputVals[i] === p.text);

      if (isAllCorrect) {
          handleAllCorrect();
      } else {
          // 1. まず音を鳴らす
          playSE('/sounds/se_wrong.mp3');

          // 2. 次に✕を表示
          setShowWrongMark(true);
          triggerErrorEffect();

          // 3. 状態更新
          setGameState('waiting');
          isProcessing.current = true;
          
          // 4. 親への報告は最後
          if (onWrong && problems[0]) onWrong(problems[0]);
      }
  };

  const handleInputChange = (index: number, val: string) => {
    if (gameState === 'waiting') return;
    const newVals = [...inputVals];
    if (val.length < newVals[index].length) {
        newVals[index] = val;
        setInputVals(newVals);
        return;
    }
    if (isComposing.current) {
        newVals[index] = val;
        setInputVals(newVals);
        return;
    }
    const targetProblem = problems[index];
    if (targetProblem && targetProblem.text.startsWith(val)) {
        playSE('/sounds/se_type.mp3');
        newVals[index] = val;
        setInputVals(newVals);
        setIsError(false);
        const isAllCorrect = problems.every((p, i) => 
            (i === index ? val : newVals[i]) === p.text
        );
        if (isAllCorrect) handleAllCorrect();
    } else {
        triggerErrorEffect();
        playSE('/sounds/se_typo.mp3'); // ★即座にタイポ音を鳴らす
        if (onTypo && targetProblem) {
            const expected = targetProblem.text.charAt(newVals[index].length);
            onTypo(expected);
        }
    }
  };

  return (
    <div className="relative p-4 bg-gray-100 h-full flex flex-col items-center justify-center w-full rounded-2xl overflow-hidden">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 2; }
      `}</style>

      <style>{`
        @keyframes shrink-answer-bar {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>

      {/* 〇表示 */}
      {results.every(r => r === true) && results.length > 0 && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 pointer-events-none">
              <div className="text-9xl font-black text-green-500 drop-shadow-2xl animate-bounce-in">〇</div>
          </div>
      )}

      {/* ✕表示 */}
      {showWrongMark && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 pointer-events-none">
              <div className="text-9xl font-black text-red-600 drop-shadow-2xl animate-bounce-in">✕</div>
          </div>
      )}

      {/* 暗記フェーズ */}
      {gameState === 'memorize' && problems.length > 0 && (
        <div className="flex flex-col w-full h-full">
            <div className="w-full h-2 bg-gray-300 rounded-full mb-2 overflow-hidden relative">
                <style>{`
                  @keyframes shrink-width { from { width: 100%; } to { width: 0%; } }
                `}</style>
                <div 
                    key={resetKey}
                    className="h-full bg-orange-500"
                    style={{
                        width: '100%',
                        animation: `shrink-width ${MEMORIZE_TIME}s linear forwards`
                    }}
                />
            </div>
            <div className={`grid gap-6 w-full h-full items-center justify-center ${getGridClass()}`}>
                {problems.map((p, idx) => (
                    <div key={idx} className="flex flex-col items-center justify-center bg-white/80 p-6 rounded-2xl shadow-md border-4 border-[#d7ccc8] animate-pulse">
                        <div className={`font-black text-[#5d4037] mb-2 text-center ${getFontSize(p.text)}`}>
                            {p.text}
                        </div>
                        <div className="text-xl md:text-2xl font-bold text-gray-500 text-center">
                            {p.kana || "　"}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* ★修正: 解答フェーズ中の残り時間バー */}
      {gameState === 'answer' && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gray-200 z-50">
          <div 
            /* key に resetKey を含めることで、次の問題に進むたびにアニメーションがリセットされます */
            key={`answer-bar-${resetKey}`}
            className="h-full bg-red-500"
            style={{ 
                width: '100%',
                /* CSSアニメーションで滑らかに動かす（ANSWER_TIME秒かけて0%へ） */
                animation: `shrink-answer-bar ${ANSWER_TIME}s linear forwards` 
            }}
          />
        </div>
      )}

      {/* 回答フェーズ */}
      {(gameState === 'answer' || gameState === 'waiting') && (
        <div className={`grid gap-6 w-full h-full p-4 relative z-10 ${getGridClass()}`}>
           {problems.map((p, idx) => (
             <div key={idx} className="flex flex-col h-full bg-[#fff8e1] rounded-2xl p-1 border-4 border-[#d7ccc8] shadow-[0_4px_0_rgba(141,110,99,0.5)] relative overflow-hidden">
               <div className="absolute top-0 left-0 bg-[#d7ccc8] text-[#5d4037] text-xs font-black px-3 py-1 rounded-br-xl z-10">
                 No.{((resetKey) * splitCount) + idx + 1}
               </div>
               <textarea
                 ref={(el) => { inputRefs.current[idx] = el; }}
                 disabled={gameState === 'waiting'}
                 className={`flex-1 bg-transparent rounded-xl p-4 pt-8 text-center resize-none outline-none w-full font-black text-[#5d4037] ${getFontSize(problems[idx]?.text || "")} ${isError ? 'animate-shake text-red-500' : ''}`}
                 style={{ caretColor: '#8d6e63' }} 
                 placeholder="タイプ..."
                 value={inputVals[idx] || ""}
                 onCompositionStart={() => { isComposing.current = true; }}
                 onCompositionEnd={() => { isComposing.current = false; }}
                 onChange={(e) => handleInputChange(idx, e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleEnterKey(); } }}
               />
             </div>
           ))}
        </div>
      )}
      {(gameState === 'answer') && (
          <button onClick={handleEnterKey} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-8 py-2 rounded-full font-bold shadow-lg z-20">
            決定 (Enter)
          </button>
      )}
    </div>
  );
}