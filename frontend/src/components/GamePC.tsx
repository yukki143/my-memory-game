// src/GamePC.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Problem, GameSettings } from '../types';
import { useSound } from '../hooks/useSound';

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

type GamePCProps = {
  onScore?: () => void;
  onWrong?: (problem?: Problem) => void;
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
  isLocked?: boolean; 
};

type ApiResponse = {
  correct: Problem;
  options: Problem[];
};

export default function GamePC({ 
  onScore, onWrong, onTypo, resetKey, settings, 
  roomId, playerId, setId, seed, wrongHistory, 
  totalAttempted, isLocked 
}: GamePCProps) {
  const splitCount = settings?.questionsPerRound || 1;
  const MEMORIZE_TIME = settings?.memorizeTime || 3;
  const ANSWER_TIME = settings?.answerTime || 10;

  const [gameState, setGameState] = useState<'memorize' | 'answer' | 'waiting'>('waiting');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [inputVals, setInputVals] = useState<string[]>([]);
  const [isError, setIsError] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(MEMORIZE_TIME);
  const [answerTimeLeft, setAnswerTimeLeft] = useState<number>(ANSWER_TIME);
  const [isFetching, setIsFetching] = useState(false);

  const latestRequestId = useRef(0);
  const isProcessing = useRef(false);
  const { playSE } = useSound();
  
  const totalAttemptedRef = useRef(totalAttempted);
  const wrongHistoryRef = useRef(wrongHistory);
  const inputRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  useEffect(() => {
    if (gameState === 'answer' && inputRefs.current[0] && !isLocked) {
      inputRefs.current[0].focus();
    }
  }, [gameState, isLocked]);

  useEffect(() => {
    isProcessing.current = true;
  }, [resetKey]);

  const loadProblem = useCallback(async () => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    
    setIsFetching(true);
    isProcessing.current = true;

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
        setInputVals(Array(splitCount).fill(""));
        setIsError(false);
        setTimeLeft(MEMORIZE_TIME);
        setAnswerTimeLeft(ANSWER_TIME);
        
        setGameState('memorize');
        setIsFetching(false);
        isProcessing.current = false;

    } catch (e) {
        console.error(e);
        setIsFetching(false);
    }
  }, [splitCount, roomId, setId, seed, MEMORIZE_TIME, ANSWER_TIME]);

  useEffect(() => { 
      if (resetKey >= 0) loadProblem(); 
  }, [resetKey, loadProblem]);

  useEffect(() => {
    if (gameState === 'memorize' && !isFetching && !isLocked) {
        if (timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setGameState('answer');
        }
    }
  }, [gameState, timeLeft, isFetching, isLocked]);

  useEffect(() => {
    if (gameState === 'answer' && !isProcessing.current && !isFetching && !isLocked) {
        if (answerTimeLeft > 0) {
            const timer = setTimeout(() => setAnswerTimeLeft(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            handleEnterKey(true);
        }
    }
  }, [gameState, answerTimeLeft, isFetching, isLocked]);

  const handleAllCorrect = () => {
      if (isProcessing.current || gameState === 'waiting' || isLocked) return; 
      playSE('/sounds/se_correct.mp3');
      isProcessing.current = true;
      setGameState('waiting');
      if (onScore) onScore();
  };

  const handleEnterKey = (isTimeout = false) => {
      if (gameState === 'waiting' || isProcessing.current || isLocked) return;
      const isAllCorrect = problems.every((p, i) => inputVals[i] === p.text);

      if (isAllCorrect && !isTimeout) {
          handleAllCorrect();
      } else {
          playSE('/sounds/se_wrong.mp3');
          setGameState('waiting');
          isProcessing.current = true;
          if (onWrong) onWrong(problems[0]);
      }
  };

  const handleInputChange = (index: number, val: string) => {
    if (gameState === 'waiting' || isProcessing.current || isLocked) return;
    const newVals = [...inputVals];

    // 文字を消した場合は許可する
    if (val.length < newVals[index].length) {
        newVals[index] = val;
        setInputVals(newVals);
        return;
    }

    const targetProblem = problems[index];
    if (targetProblem && targetProblem.text.startsWith(val)) {
        // 正解入力
        playSE('/sounds/se_type.mp3');
        newVals[index] = val;
        setInputVals(newVals);
        setIsError(false);

        const isAllCorrect = problems.every((p, i) => (i === index ? val : newVals[i]) === p.text);
        if (isAllCorrect) {
          handleAllCorrect();
        } else if (val === targetProblem.text) {
          const nextInput = inputRefs.current[index + 1];
          if (nextInput) nextInput.focus();
        }
    } else {
        // タイポ発生
        setIsError(true);
        setTimeout(() => setIsError(false), 300);

        // 打つべきだった正しい文字を特定して通知
        if (targetProblem && onTypo) {
            const expectedChar = targetProblem.text[inputVals[index].length];
            if (expectedChar) {
                onTypo(expectedChar);
            } else {
                // 文字列を超えている場合などは汎用SEのみ
                playSE('/sounds/se_typo.mp3');
            }
        } else {
            playSE('/sounds/se_typo.mp3');
        }
    }
  };

  return (
    <div className="relative p-4 bg-gray-100 h-full flex flex-col items-center justify-center w-full rounded-2xl overflow-hidden">
      {isFetching && (
        <div className="absolute inset-0 z-[100] bg-white/40 backdrop-blur-[2px] flex items-center justify-center animate-fade-in">
           <div className="bg-[#8d6e63] text-white px-6 py-3 rounded-full font-black shadow-lg animate-bounce">Preparing Garden...</div>
        </div>
      )}

      <div className={`w-full h-full flex flex-col transition-opacity duration-300 ${isFetching ? 'opacity-20' : 'opacity-100'}`}>
        {gameState === 'memorize' && problems.length > 0 && (
          <div className="flex flex-col w-full h-full">
              <div className="w-full h-2 bg-gray-300 rounded-full mb-2 overflow-hidden relative">
                  <style>{`@keyframes shrink-width { from { width: 100%; } to { width: 0%; } }`}</style>
                  <div key={resetKey} className="h-full bg-orange-500" 
                    style={{ 
                      animation: `shrink-width ${MEMORIZE_TIME}s linear forwards`,
                      animationPlayState: isLocked ? 'paused' : 'running'
                    }} 
                  />
              </div>
              <div className={`grid gap-6 w-full h-full items-center justify-center ${splitCount === 1 ? "grid-cols-1" : splitCount <= 4 ? "grid-cols-2" : "grid-cols-3"}`}>
                  {problems.map((p, idx) => (
                      <div key={idx} className="flex flex-col items-center justify-center bg-white/80 p-6 rounded-2xl shadow-md border-4 border-[#d7ccc8] animate-pulse">
                          <div className={`font-black text-[#5d4037] mb-2 text-center text-4xl`}>{p.text}</div>
                          <div className="text-xl md:text-2xl font-bold text-gray-500 text-center">{p.kana || "　"}</div>
                      </div>
                  ))}
              </div>
          </div>
        )}

        {gameState === 'answer' && (
          <div className="absolute top-0 left-0 w-full h-1 bg-gray-200 z-50">
            <style>{`@keyframes shrink-answer-bar { from { width: 100%; } to { width: 0%; } }`}</style>
            <div key={`answer-bar-${resetKey}`} className="h-full bg-red-500" 
              style={{ 
                animation: `shrink-answer-bar ${ANSWER_TIME}s linear forwards`,
                animationPlayState: isLocked ? 'paused' : 'running'
              }} 
            />
          </div>
        )}

        {(gameState === 'answer' || gameState === 'waiting') && (
          <div className={`grid gap-6 w-full h-full p-4 relative z-10 ${splitCount === 1 ? "grid-cols-1" : splitCount <= 4 ? "grid-cols-2" : "grid-cols-3"}`}>
            {problems.map((p, idx) => (
              <div key={idx} className="flex flex-col h-full bg-[#fff8e1] rounded-2xl p-1 border-4 border-[#d7ccc8] shadow-[0_4px_0_rgba(141,110,99,0.5)] relative overflow-hidden">
                <textarea
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  disabled={gameState === 'waiting' || isFetching || isLocked}
                  className={`flex-1 bg-transparent rounded-xl p-4 pt-8 text-center resize-none outline-none w-full font-black text-[#5d4037] text-4xl ${isError ? 'animate-shake text-red-500' : ''}`}
                  style={{ caretColor: '#8d6e63' }} 
                  placeholder={isLocked ? "判定中..." : "タイプ..."}
                  value={inputVals[idx] || ""}
                  onChange={(e) => handleInputChange(idx, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleEnterKey(); } }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}