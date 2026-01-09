// src/GamePC.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Problem } from '../types';
import type { GameSettings } from '../types';
import { useSound } from '../hooks/useSound';

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

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

  // ★修正: 二重接続を防ぐため、子コンポーネント内での WebSocket 作成を削除しました。
  // 通信は親の BattleMode.tsx が一括して行います。

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
  
  const totalAttemptedRef = useRef(totalAttempted);
  const wrongHistoryRef = useRef(wrongHistory);

  useEffect(() => { totalAttemptedRef.current = totalAttempted; }, [totalAttempted]);
  useEffect(() => { wrongHistoryRef.current = wrongHistory; }, [wrongHistory]);

  const inputRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [showWrongMark, setShowWrongMark] = useState(false);

  useEffect(() => {
    if (gameState === 'answer') {
      const firstInput = inputRefs.current[0];
      if (firstInput) {
        firstInput.focus();
      }
    }
  }, [gameState, resetKey]);

  const loadProblem = useCallback(async () => {
    isProcessing.current = false;
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    setResults(Array(splitCount).fill(null));
    setShowWrongMark(false);
    setIsError(false);
    
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

  useEffect(() => {
    if (gameState === 'answer' && !isProcessing.current) {
        if (answerTimeLeft > 0) {
            const timer = setTimeout(() => setAnswerTimeLeft(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        } else {
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
      playSE('/sounds/se_correct.mp3');
      setResults(Array(splitCount).fill(true));
      isProcessing.current = true;
      setGameState('waiting');
      if (onScore) onScore();
  };

  const handleEnterKey = () => {
      if (isComposing.current || gameState === 'waiting' || isProcessing.current) return;
      const isAllCorrect = problems.every((p, i) => inputVals[i] === p.text);

      if (isAllCorrect) {
          handleAllCorrect();
      } else {
          playSE('/sounds/se_wrong.mp3');
          setShowWrongMark(true);
          triggerErrorEffect();
          setGameState('waiting');
          isProcessing.current = true;
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

        const isCurrentDone = val === targetProblem.text;
        const isAllCorrect = problems.every((p, i) => (i === index ? val : newVals[i]) === p.text);

        if (isAllCorrect) {
          handleAllCorrect();
        } else if (isCurrentDone) {
          const nextInput = inputRefs.current[index + 1];
          if (nextInput) {
            nextInput.focus();
          }
        }
    } else {
        triggerErrorEffect();
        playSE('/sounds/se_typo.mp3');
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
        @keyframes shrink-answer-bar { from { width: 100%; } to { width: 0%; } }
      `}</style>

      {results.every(r => r === true) && results.length > 0 && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 pointer-events-none">
              <div className="text-9xl font-black text-green-500 drop-shadow-2xl animate-bounce-in">〇</div>
          </div>
      )}

      {showWrongMark && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 pointer-events-none">
              <div className="text-9xl font-black text-red-600 drop-shadow-2xl animate-bounce-in">✕</div>
          </div>
      )}

      {gameState === 'memorize' && problems.length > 0 && (
        <div className="flex flex-col w-full h-full">
            <div className="w-full h-2 bg-gray-300 rounded-full mb-2 overflow-hidden relative">
                <style>{`@keyframes shrink-width { from { width: 100%; } to { width: 0%; } }`}</style>
                <div 
                    key={resetKey}
                    className="h-full bg-orange-500"
                    style={{ animation: `shrink-width ${MEMORIZE_TIME}s linear forwards` }}
                />
            </div>
            <div className={`grid gap-6 w-full h-full items-center justify-center ${getGridClass()}`}>
                {problems.map((p, idx) => (
                    <div key={idx} className="flex flex-col items-center justify-center bg-white/80 p-6 rounded-2xl shadow-md border-4 border-[#d7ccc8] animate-pulse">
                        <div className={`font-black text-[#5d4037] mb-2 text-center ${getFontSize(p.text)}`}>{p.text}</div>
                        <div className="text-xl md:text-2xl font-bold text-gray-500 text-center">{p.kana || "　"}</div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {gameState === 'answer' && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gray-200 z-50">
          <div 
            key={`answer-bar-${resetKey}`}
            className="h-full bg-red-500"
            style={{ animation: `shrink-answer-bar ${ANSWER_TIME}s linear forwards` }}
          />
        </div>
      )}

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