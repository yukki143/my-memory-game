// src/GameMobile.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameSettings, Problem } from '../types';
import { useSound } from '../hooks/useSound';

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

type ApiResponse = {
  correct: Problem;
  options: Problem[];
};

type Props = {
  onScore: () => void;
  onWrong: (problem: Problem) => void;
  resetKey: number;
  isSoloMode?: boolean;
  roomId?: string;
  playerId?: string;
  setId?: string;
  seed?: string;
  settings?: GameSettings; 
  wrongHistory?: string[];
  totalAttempted?: number;
};

type SlotItem = { text: string; sourceId: number; } | null;
type ChoiceItem = { id: number; text: string; isUsed: boolean; };


// --- ここからコンポーネント ---
function GameMobile({ 
  onScore, onWrong, resetKey, isSoloMode = false, 
  roomId, setId, playerId, // ★ Propsから受け取る
  seed, settings, wrongHistory, totalAttempted 
}: Props) {

  const { playSE } = useSound();
  const splitCount = settings?.questionsPerRound || 1;
  const MEMORIZE_TIME = settings?.memorizeTime || 3;

  // ★ WebSocketの接続処理はコンポーネントの「中」に移動
  useEffect(() => {
    // ソロモードの時は接続不要
    if (isSoloMode || !roomId || !playerId) return;

    const wsUrl = `${WS_BASE}/ws/battle/${roomId}/${playerId}?setName=${setId}`;
    console.log("Connecting to:", wsUrl);
    
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => console.log("WS Connected in GameMobile");
    socket.onclose = () => console.log("WS Closed in GameMobile");

    return () => {
      socket.close();
    };
  }, [roomId, playerId, setId, isSoloMode]); // 依存配列に Props を指定

  const [gameState, setGameState] = useState<'memorize' | 'quiz' | 'waiting'>('memorize');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [choices, setChoices] = useState<ChoiceItem[]>([]);
  const [selectedChoiceId, setSelectedChoiceId] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(MEMORIZE_TIME);
  const [overlayMark, setOverlayMark] = useState<boolean | null>(null);
  
  const latestRequestId = useRef(0);

  // ★追加: 最新の統計データを保持するRef
  const totalAttemptedRef = useRef(totalAttempted);
  const wrongHistoryRef = useRef(wrongHistory);
  useEffect(() => { totalAttemptedRef.current = totalAttempted; }, [totalAttempted]);
  useEffect(() => { wrongHistoryRef.current = wrongHistory; }, [wrongHistory]);

  const loadProblem = useCallback(async () => {
      const requestId = latestRequestId.current + 1;
      latestRequestId.current = requestId;

      // 演出とステートのリセット
      setGameState('waiting');
      setOverlayMark(null);
      setProblems([]);
      setSlots(Array(splitCount).fill(null));
      setChoices([]);
      setSelectedChoiceId(null);
      setTimeLeft(MEMORIZE_TIME);

      try {
          const newProblems: Problem[] = [];
          let accumulatedOptions: Problem[] = [];

          for (let i = 0; i < splitCount; i++) {
              const params = new URLSearchParams();
              if (roomId) params.append("room_id", roomId);
              if (setId) params.append("set_id", setId);
              if (seed) params.append("seed", `${seed}-${i}`);
              
              // ★Refから最新値を取得
              if (wrongHistoryRef.current && wrongHistoryRef.current.length > 0) {
                  params.append("wrong_history", wrongHistoryRef.current.join(","));
              }
              if (totalAttemptedRef.current !== undefined) {
                  params.append("current_index", String(totalAttemptedRef.current + i));
              }
              params.append("t", Date.now().toString()); 

              const url = `${API_BASE}/api/problem?${params.toString()}`;
              const res = await fetch(url, { cache: "no-store" });
              const data: ApiResponse = await res.json();
              
              newProblems.push(data.correct);
              accumulatedOptions = [...accumulatedOptions, ...data.options];
          }

          if (requestId !== latestRequestId.current) return;

          setProblems(newProblems);
          const correctWords = newProblems.map(p => p.text);
          const dummyWords = accumulatedOptions
              .map(p => p.text)
              .filter(text => !correctWords.includes(text));
          
          const finalChoiceTexts = [...correctWords, ...dummyWords.slice(0, splitCount + 2)];
          const shuffled = finalChoiceTexts
              .sort(() => Math.random() - 0.5)
              .map((text, idx) => ({ id: idx, text, isUsed: false }));
          
          setChoices(shuffled);
          setTimeLeft(MEMORIZE_TIME);
          setGameState('memorize');

      } catch (e) {
          console.error("Fetch error:", e);
      }
      // ★依存配列から統計データを削除
  }, [roomId, setId, seed, MEMORIZE_TIME, splitCount]);

  useEffect(() => { 
    if (resetKey >= 0) loadProblem(); 
  }, [resetKey, loadProblem]);

  useEffect(() => {
    if (gameState === 'memorize') {
        if (timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setGameState('quiz');
        }
    }
  }, [gameState, timeLeft]);

  const handleSelectChoice = (choiceId: number) => {
      const choice = choices.find(c => c.id === choiceId);
      if (choice && choice.isUsed) return;
      setSelectedChoiceId(selectedChoiceId === choiceId ? null : choiceId);
  };

  const handleTapSlot = (slotIndex: number) => {
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

  // ★ 決定ボタンを押した時の判定処理
  const handleSubmit = () => {
      if (slots.some(s => s === null) || gameState === 'waiting') return; 
      setGameState('waiting');
      
      const isCorrect = slots.every((s, i) => s?.text === problems[i].text);
      setOverlayMark(isCorrect);

      if (isCorrect) {
          // ★ 正解音
          playSE('/sounds/se_correct.mp3');
          onScore();
      } else {
          // ★ 不正解音
          playSE('/sounds/se_wrong.mp3');
          onWrong(problems[0]);
      }
  };

  const isAllFilled = slots.length > 0 && slots.every(s => s !== null);

  return (
    <div className="relative p-2 bg-orange-50 h-full flex flex-col items-center w-full overflow-hidden">
      {gameState === 'memorize' && (
        <div className="w-full h-2 bg-gray-300 rounded-full mb-2 shrink-0 overflow-hidden relative">
          <style>{`@keyframes shrink-mobile { from { width: 100%; } to { width: 0%; } }`}</style>
          <div 
            key={resetKey}
            className="h-full bg-orange-500" 
            style={{ animation: `shrink-mobile ${MEMORIZE_TIME}s linear forwards` }}
          />
        </div>
      )}

      {overlayMark !== null && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/10">
              <div className="text-9xl font-black drop-shadow-2xl animate-bounce-in">
                  {overlayMark ? <span className="text-green-500">〇</span> : <span className="text-red-600">✕</span>}
              </div>
          </div>
      )}

      {gameState === 'memorize' && (
        <div className="flex-1 flex flex-col justify-center items-center w-full gap-4 overflow-y-auto">
          {problems.map((p, i) => (
             <div key={i} className="bg-white p-4 rounded-xl shadow-md border-4 border-[#d7ccc8] w-full max-w-xs text-center">
                <div className="text-3xl font-black text-[#5d4037] mb-1">{p.text}</div>
             </div>
          ))}
        </div>
      )}

      {(gameState === 'quiz' || gameState === 'waiting') && (
        <div className="flex-1 flex flex-col w-full max-w-sm h-full overflow-hidden">
            <div className="flex-1 w-full overflow-y-auto min-h-0 relative">
                <div className="flex flex-col gap-2 justify-center items-center min-h-full py-4">
                    {slots.map((slot, i) => (
                        <button key={i} onClick={() => handleTapSlot(i)} disabled={gameState === 'waiting'} className={`relative w-full p-3 rounded-xl border-4 font-bold text-xl min-h-[60px] ${slot ? 'bg-white border-[#8d6e63]' : 'bg-black/5 border-dashed border-gray-400'}`}>
                            {slot ? slot.text : <span className="text-sm opacity-50">配置</span>}
                        </button>
                    ))}
                </div>
            </div>
            <div className="h-16 flex items-center justify-center shrink-0 my-2">
                {isAllFilled && gameState !== 'waiting' && (
                    <button onClick={handleSubmit} className="theme-leaf-btn px-8 py-3 rounded-full text-xl font-black shadow-lg">決定！</button>
                )}
            </div>
            <div className="bg-[#d7ccc8]/30 p-3 rounded-t-2xl border-t-4 border-[#d7ccc8] h-[35%] shrink-0 flex flex-col">
                <div className="flex-1 overflow-y-auto">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {choices.map((choice) => (
                            <button key={choice.id} onClick={() => handleSelectChoice(choice.id)} disabled={choice.isUsed || gameState === 'waiting'} className={`px-4 py-2 rounded-lg font-bold ${choice.isUsed ? 'bg-gray-200' : selectedChoiceId === choice.id ? 'bg-[#8d6e63] text-white' : 'bg-white'}`}>
                                {choice.text}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

export default GameMobile;