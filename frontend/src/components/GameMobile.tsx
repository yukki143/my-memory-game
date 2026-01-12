// src/GameMobile.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameSettings, Problem } from '../types';
import { useSound } from '../hooks/useSound';

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

type ApiResponse = {
  correct: Problem;
  options: Problem[];
};

type Props = {
  onScore: () => void;
  onWrong: (problem?: Problem) => void;
  resetKey: number;
  isSoloMode?: boolean;
  roomId?: string;
  playerId?: string;
  setId?: string;
  seed?: string;
  settings?: GameSettings; 
  wrongHistory?: string[];
  totalAttempted?: number;
  isLocked?: boolean; 
};

type SlotItem = { text: string; sourceId: number; } | null;
type ChoiceItem = { id: number; text: string; isUsed: boolean; };
type GameState = 'memorize' | 'quiz' | 'waiting' | 'loading';

function GameMobile({ 
  onScore, onWrong, resetKey, roomId, setId, seed, settings, 
  wrongHistory, totalAttempted, isLocked 
}: Props) {

  const { playSE } = useSound();
  const CLICK_SE = '/sounds/se_click.mp3';
  const SET_SE = '/sounds/se_set.mp3';
  const PICK_SE = '/sounds/se_pick.mp3';
  const splitCount = settings?.questionsPerRound || 1;
  const MEMORIZE_TIME = settings?.memorizeTime || 3;
  const ANSWER_TIME = settings?.answerTime || 10;

  const [gameState, setGameState] = useState<GameState>('loading');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [choices, setChoices] = useState<ChoiceItem[]>([]);
  const [selectedChoiceId, setSelectedChoiceId] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(MEMORIZE_TIME);
  const [answerTimeLeft, setAnswerTimeLeft] = useState<number>(ANSWER_TIME);
  const [isFetching, setIsFetching] = useState(false);

  const latestRequestId = useRef(0);
  const isProcessing = useRef(false);
  const totalAttemptedRef = useRef(totalAttempted);
  const wrongHistoryRef = useRef(wrongHistory);

  useEffect(() => { totalAttemptedRef.current = totalAttempted; }, [totalAttempted]);
  useEffect(() => { wrongHistoryRef.current = wrongHistory; }, [wrongHistory]);

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
          let accumulatedOptions: Problem[] = [];

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
              accumulatedOptions = [...accumulatedOptions, ...data.options];
          }

          if (requestId !== latestRequestId.current) return;

          setProblems(newProblems);
          setSlots(Array(splitCount).fill(null));
          setSelectedChoiceId(null);
          setTimeLeft(MEMORIZE_TIME);
          setAnswerTimeLeft(ANSWER_TIME);

          const correctWords = newProblems.map(p => p.text);
          const dummyWords = accumulatedOptions
              .map(p => p.text)
              .filter(text => !correctWords.includes(text));
          
          const finalChoiceTexts = [...correctWords, ...dummyWords.slice(0, splitCount + 2)];
          const shuffled = finalChoiceTexts
              .sort(() => Math.random() - 0.5)
              .map((text, idx) => ({ id: idx, text, isUsed: false }));
          
          setChoices(shuffled);
          setGameState('memorize');
          setIsFetching(false);
          isProcessing.current = false;

      } catch (e) {
          console.error(e);
          setIsFetching(false);
      }
  }, [roomId, setId, seed, MEMORIZE_TIME, ANSWER_TIME, splitCount]);

  useEffect(() => { 
    if (resetKey >= 0) loadProblem(); 
  }, [resetKey, loadProblem]);

  useEffect(() => {
    if (gameState === 'memorize' && !isFetching && !isLocked) {
        if (timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setGameState('quiz');
        }
    }
  }, [gameState, timeLeft, isFetching, isLocked]);

  useEffect(() => {
    if (gameState === 'quiz' && !isProcessing.current && !isFetching && !isLocked) {
        if (answerTimeLeft > 0) {
            const timer = setTimeout(() => setAnswerTimeLeft(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            if (!isProcessing.current) {
                isProcessing.current = true;
                setGameState('waiting');
                playSE('/sounds/se_wrong.mp3');
                onWrong(problems[0]);
            }
        }
    }
  }, [gameState, answerTimeLeft, isFetching, isLocked]);

  const handleSelectChoice = (choiceId: number) => {
      if (isProcessing.current || isFetching || isLocked) return;
      const choice = choices.find(c => c.id === choiceId);
      if (choice && choice.isUsed) return;
      setSelectedChoiceId(selectedChoiceId === choiceId ? null : choiceId);
  };

  const handleTapSlot = (slotIndex: number) => {
      if (isProcessing.current || isFetching || isLocked) return;
      if (selectedChoiceId !== null) {
          const choice = choices.find(c => c.id === selectedChoiceId);
          if (!choice) return;
          const newSlots = [...slots];
          const oldSlotItem = newSlots[slotIndex];
          const newChoices = choices.map(c => {
              if (c.id === selectedChoiceId) return { ...c, isUsed: true };
              if (oldSlotItem && c.id === oldSlotItem.sourceId) return { ...c, isUsed: false };
              return c;
          });
          newSlots[slotIndex] = { text: choice.text, sourceId: choice.id };
          setSlots(newSlots);
          setChoices(newChoices);
          setSelectedChoiceId(null);
      } else {
          const item = slots[slotIndex];
          if (item) {
              const newSlots = [...slots];
              newSlots[slotIndex] = null;
              const newChoices = choices.map(c => c.id === item.sourceId ? { ...c, isUsed: false } : c);
              setSlots(newSlots);
              setChoices(newChoices);
          }
      }
  };

  const handleSubmit = () => {
      if (slots.some(s => s === null) || isProcessing.current || isFetching || isLocked) return; 
      isProcessing.current = true;
      setGameState('waiting');
      const isCorrect = slots.every((s, i) => s?.text === problems[i].text);

      if (isCorrect) {
          playSE('/sounds/se_correct.mp3');
          onScore();
      } else {
          playSE('/sounds/se_wrong.mp3');
          onWrong(problems[0]);
      }
  };

  return (
    <div className="relative p-2 bg-orange-50 h-full flex flex-col items-center w-full overflow-hidden">
      {isFetching && (
        <div className="absolute inset-0 z-[100] bg-white/40 backdrop-blur-[2px] flex flex-col items-center justify-center animate-fade-in">
            <div className="text-xl font-black text-[#8d6e63] animate-pulse">Wait a Moment...</div>
        </div>
      )}

      <div className={`w-full h-full flex flex-col transition-opacity duration-300 ${isFetching ? 'opacity-10' : 'opacity-100'}`}>
          {gameState === 'memorize' && (
            <div className="w-full h-2 bg-gray-300 rounded-full mb-2 shrink-0 overflow-hidden relative">
              <style>{`@keyframes shrink-mobile { from { width: 100%; } to { width: 0%; } }`}</style>
              <div 
                key={`memorize-${resetKey}`}
                className="h-full bg-orange-500" 
                style={{ 
                    animation: `shrink-mobile ${MEMORIZE_TIME}s linear forwards`,
                    animationPlayState: isLocked ? 'paused' : 'running'
                }}
              />
            </div>
          )}

          {gameState === 'quiz' && (
            <div className="absolute top-0 left-0 w-full h-1 bg-gray-200 z-50">
              <style>{`@keyframes shrink-answer-bar { from { width: 100%; } to { width: 0%; } }`}</style>
              <div 
                key={`answer-bar-${resetKey}`}
                className="h-full bg-red-500"
                style={{ 
                    animation: `shrink-answer-bar ${ANSWER_TIME}s linear forwards`,
                    animationPlayState: isLocked ? 'paused' : 'running'
                }}
              />
            </div>
          )}

          {gameState === 'memorize' && (
            <div className="flex-1 flex flex-col justify-center items-center w-full gap-4 overflow-y-auto">
              {problems.map((p, i) => (
                 <div key={i} className="bg-white p-4 rounded-xl shadow-md border-4 border-[#d7ccc8] w-full max-w-xs text-center">
                    <div className="text-3xl font-black text-[#5d4037] mb-1">{p.text}</div>
                    <div className="text-lg font-bold text-gray-400">{p.kana}</div>
                 </div>
              ))}
            </div>
          )}

          {(gameState === 'quiz' || gameState === 'waiting') && (
            <div className="flex-1 flex flex-col w-full max-w-sm h-full overflow-hidden">
                <div className="flex-1 w-full overflow-y-auto min-h-0 relative">
                    <div className="flex flex-col gap-2 justify-center items-center min-h-full py-4">
                        {slots.map((slot, i) => (
                            <button 
                                key={i} 
                                onClick={() => {playSE(SET_SE); handleTapSlot(i)}} 
                                disabled={gameState === 'waiting' || isFetching || isLocked} 
                                className={`relative w-full p-3 rounded-xl border-4 font-bold text-xl min-h-[60px] transition-all 
                                    ${slot ? 'bg-white border-[#8d6e63] text-[#5d4037]' : 'bg-black/5 border-dashed border-gray-400 text-gray-400'}`}
                            >
                                {slot ? slot.text : <span className="text-sm opacity-50">{isLocked ? "判定中" : "タップして配置"}</span>}
                                <div className="absolute top-0 left-0 text-[10px] bg-[#d7ccc8] px-1 text-[#5d4037]">{i + 1}</div>
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="h-16 flex items-center justify-center shrink-0 my-2">
                    {slots.every(s => s !== null) && gameState !== 'waiting' && !isFetching && !isLocked && (
                        <button 
                            onClick={() => {playSE(CLICK_SE); handleSubmit();}} 
                            className="theme-leaf-btn px-10 py-3 rounded-full text-xl font-black shadow-lg transform active:scale-95 transition"
                        >
                            決定
                        </button>
                    )}
                </div>

                <div className="bg-[#d7ccc8]/30 p-3 rounded-t-2xl border-t-4 border-[#d7ccc8] h-[40%] shrink-0 flex flex-col">
                    <div className="text-xs font-bold text-[#5d4037] mb-2 text-center">▼ 単語を選んで上の枠をタップ</div>
                    <div className="flex-1 overflow-y-auto pb-4">
                        <div className="flex flex-wrap gap-2 justify-center">
                            {choices.map((choice) => (
                                <button 
                                    key={choice.id} 
                                    onClick={() => {playSE(PICK_SE);handleSelectChoice(choice.id)}} 
                                    disabled={choice.isUsed || gameState === 'waiting' || isFetching || isLocked} 
                                    className={`px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all
                                        ${choice.isUsed ? 'bg-gray-300 text-gray-500 scale-90 opacity-50' : 
                                          selectedChoiceId === choice.id ? 'bg-[#8d6e63] text-white ring-4 ring-orange-200' : 'bg-white text-[#5d4037] active:bg-gray-100'}`}
                                >
                                    {choice.text}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
          )}
      </div>
    </div>
  );
}

export default GameMobile;