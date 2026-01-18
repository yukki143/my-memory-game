import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ForestPath from './ForestPath';
import { type RoomInfo } from '../types';
import { authFetch } from '../utils/auth';
import { useBgm } from '../context/BgmContext';
import { useSound } from '../hooks/useSound';

// APIの場所 (環境に合わせて変更してください)
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// カテゴリの型を定義
export type MemorySetCategory = 'private' | 'official' | 'public';

// MemorySetOption 型を拡張
type MemorySetOption = {
  id: string;
  name: string;
  category: MemorySetCategory; // カテゴリを追加
};

// --- 型定義の下、コンポーネントの外に配置 ---
const CATEGORY_PRIORITY: Record<string, number> = {
  private: 1,
  official: 2,
  public: 3,
};

export default function BattleLobby() {
  const navigate = useNavigate();
  const { setBgm } = useBgm();
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [playerName, setPlayerName] = useState("Loading...");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { playSE } = useSound();
  const CLICK_SE = '/sounds/se_click.mp3';
  const click = () => playSE(CLICK_SE);

  
  // ルーム作成フォーム用
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomPass, setNewRoomPass] = useState("");
  const [winCondition, setWinCondition] = useState(10);
  const [conditionType, setConditionType] = useState<'score' | 'total'>('score');
  
  // メモリーセット選択用
  const [memorySets, setMemorySets] = useState<MemorySetOption[]>([]);
  const [selectedSetId, setSelectedSetId] = useState("default");

  const [myOwnedRooms, setMyOwnedRooms] = useState<string[]>([]);

  // メモリーセットをカテゴリごとにグループ化
  const groupedSets = useMemo(() => {
    return {
      private: memorySets.filter(s => s.category === 'private'),
      official: memorySets.filter(s => s.category === 'official'),
      public: memorySets.filter(s => s.category === 'public'),
    };
  }, [memorySets]);

  // カテゴリに応じたアイコンを返すヘルパー
  const getCategoryIcon = (category: MemorySetCategory) => {
    switch (category) {
      case 'private': return '🔒';
      case 'official': return '⭐';
      case 'public': return '🌐';
      default: return '';
    }
  };

  // 初回ロード時にルーム一覧とセット一覧を取得
  useEffect(() => {
    setBgm('lobby', false); 
    fetchRooms();
    loadOwnedRooms();

    // ユーザー情報とセット情報を順番に取得・処理する関数
    const fetchInitialData = async () => {
      try {
        // 1. ユーザー情報を取得して自分のIDを特定
        const userRes = await authFetch("/api/users/me");
        let myId: number | null = null;
        if (userRes.ok) {
          const userData = await userRes.json();
          setPlayerName(userData.username);
          setCurrentUserId(userData.id);
          myId = userData.id;
        } else {
          setPlayerName("Guest");
        }

        // 2. メモリーセットを取得
        const setsRes = await authFetch("/api/sets");
        if (setsRes.ok) {
          const db_sets = await setsRes.json();

          // 3. カテゴリの割り当てとマッピング
          const processedSets: MemorySetOption[] = db_sets.map((s: any) => {
            let category: MemorySetCategory = 'public';
            
            if (myId !== null && s.owner_id === myId) {
              category = 'private';
            } else if (s.is_official) {
              category = 'official';
            }

            return {
              id: String(s.id),
              name: s.title || s.name,
              category: category
            };
          });

          // 4. ソートの実行 (優先度順、同じ優先度なら名前順)
          processedSets.sort((a, b) => {
            const priorityA = CATEGORY_PRIORITY[a.category];
            const priorityB = CATEGORY_PRIORITY[b.category];

            if (priorityA !== priorityB) {
              return priorityA - priorityB;
            }
            return a.name.localeCompare(b.name);
          });

          setMemorySets(processedSets);
          
          // 初期選択ロジック: リストが存在し、未選択なら先頭を選択
          if (processedSets.length > 0 && (selectedSetId === "default" || !selectedSetId)) {
            setSelectedSetId(processedSets[0].id);
          }
        }
      } catch (e) {
        console.error("Initial fetch error", e);
      }
    };

    fetchInitialData();
    
    // 3秒ごとにポーリング（自動更新）
    const interval = setInterval(fetchRooms, 3000); 
    return () => clearInterval(interval);
  }, [setBgm]); // selectedSetId は依存配列に入れない（無限ループ防止）

  const loadOwnedRooms = () => {
    const keys = Object.keys(localStorage);
    const owned = keys
        .filter(key => key.startsWith("room_token_"))
        .map(key => key.replace("room_token_", ""));
    setMyOwnedRooms(owned);
  };

  const fetchRooms = async () => {
    try {
      const res = await authFetch("/api/rooms");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setRooms(data);
        } else {
          setRooms([]);
        }
      }
    } catch (e) {
      console.error("Room fetch error:", e);
    }
  };

  const handleDeleteRoom = async (roomId: string, isGhost: boolean) => {
    const confirmMsg = isGhost 
      ? `誰もいないルーム「${roomId}」を掃除しますか？`
      : `ルーム「${roomId}」を削除してもよろしいですか？`;

    if (!window.confirm(confirmMsg)) return;

    const roomToken = localStorage.getItem(`room_token_${roomId}`);

    try {
      const path = roomToken 
        ? `/api/rooms/${roomId}?token=${roomToken}`
        : `/api/rooms/${roomId}`;

      const res = await authFetch(path, { method: "DELETE" });

      if (res.ok) {
        alert(isGhost ? "掃除しました 🧹" : "ルームを削除しました");
        localStorage.removeItem(`room_token_${roomId}`);
        loadOwnedRooms();
        fetchRooms();
      } else {
        const err = await res.json();
        alert("削除できませんでした: " + (err.detail || "権限がありません"));
      }
    } catch (e) {
      alert("通信エラーが発生しました");
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return alert("ルーム名を入力してください");

    const normalizedName = newRoomName.replace(/[！-～]/g, (s) => 
      String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    ).trim();

    if (!normalizedName) return alert("有効なルーム名を入力してください");
    if (normalizedName.length < 1) return alert("ルーム名が短すぎます");

    setIsLoading(true);

    const requestBody = {
      name: normalizedName,
      hostName: playerName,
      password: newRoomPass,
      winScore: winCondition,
      memorySetId: selectedSetId,
      conditionType: conditionType
    };
    
    try {
      const res = await authFetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const err = await res.json();
        setIsLoading(false);
        alert("作成エラー: " + (err.detail || "通信エラーです"));
        return;
      }

      const data = await res.json();
      const roomInfo = data.room;
      
      if (data.ownerToken) {
          localStorage.setItem(`room_token_${roomInfo.id}`, data.ownerToken);
          loadOwnedRooms();
      }

      navigate('/battle', { 
        state: { 
          roomId: roomInfo.id, 
          playerName, 
          playerId: generatePlayerId(playerName),
          isHost: true,
          settings: { 
             memorizeTime: roomInfo.memorizeTime,
             answerTime: roomInfo.answerTime,
             questionsPerRound: roomInfo.questionsPerRound,
             clearConditionValue: roomInfo.winScore,
             conditionType: roomInfo.conditionType
          },
          memorySetId: roomInfo.memorySetId 
        } 
      });

    } catch (e) {
      setIsLoading(false);
      alert("サーバーに接続できませんでした。");
    }
  };

  const joinGame = async (room: RoomInfo) => {
    if (room.isLocked) {
      const pass = prompt("パスワードを入力してください");
      if (pass === null) return;
      
      try {
        const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
        const res = await fetch(`${API_URL}/api/rooms/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId: room.id, password: pass })
        });
        if (!res.ok) {
            alert("パスワードが違います");
            return;
        }
      } catch(e) {
          alert("認証エラー");
          return;
      }
    }

    navigate('/battle', {
      state: { 
          roomId: room.id, 
          playerName, 
          playerId: generatePlayerId(playerName),
          isHost: false,
          settings: {
            memorizeTime: room.memorizeTime,
            answerTime: room.answerTime,
            questionsPerRound: room.questionsPerRound,
            clearConditionValue: room.winScore,
            conditionType: room.conditionType
          },
          memorySetId: room.memorySetId
      }
    });
  };

  const generatePlayerId = (name: string) => {
    return name + "_" + Math.random().toString(36).substr(2, 9);
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center overflow-hidden font-hakoniwa text-[#5d4037]">
      <div className="fixed inset-0 pointer-events-none"><ForestPath overlayOpacity={0.2} /></div>

      <header className="w-full p-4 flex justify-between items-center z-10 bg-white/80 shadow-md border-b-4 border-[#8d6e63]">
        <button onClick={() => { click(); navigate('/')}} className="font-bold underline hover:text-[#8d6e63]/70 text-xs md:text-base whitespace-nowrap">
          ← ホームに戻る
        </button>
        <h1 className="text-lg md:text-2xl font-black whitespace-nowrap text-center mx-2">
          バトルロビー
        </h1>
        <div className="w-10 md:w-20"></div>
      </header>

      <div className="flex-1 w-full max-w-4xl p-6 z-10 flex flex-col gap-6">
        
        <div className="bg-white/90 p-4 rounded-2xl shadow-md border-l-8 border-[#8d6e63] flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="font-bold">ログイン中:</span>
                <span className="text-xl font-black text-[#5d4037]">{playerName}</span>
            </div>
        </div>

        <button 
            onClick={() => { click(); setShowModal(true)}}
            className="w-full py-4 theme-flower-btn rounded-2xl font-black text-xl shadow-lg transform transition hover:scale-105"
        >
            ＋ 新しいルームを作る
        </button>

        <div>
            <div className="flex justify-between items-end mb-2 px-2">
                <h2 className="text-xl font-bold text-white drop-shadow-md">現在のルーム一覧</h2>
                <button 
                    onClick={() => { click(); fetchRooms();}} 
                    className="text-sm bg-white/80 px-3 py-1 rounded-full font-bold hover:bg-white transition flex items-center gap-1"
                >
                    🔄 更新
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[200px]">
                {rooms.length === 0 ? (
                    <div className="col-span-2 text-center py-10 bg-white/60 rounded-xl border-4 border-dashed border-[#d7ccc8] flex flex-col items-center justify-center">
                        <p className="font-bold text-gray-500 mb-2">現在ルームはありません</p>
                        <p className="text-sm text-gray-400">新しいルームを作って対戦者を待ちましょう！</p>
                    </div>
                ) : (
                    rooms.map(room => (
                        <div key={room.id} className="bg-white/95 p-5 rounded-2xl shadow-md border-2 border-[#d7ccc8] relative overflow-hidden group hover:border-[#8d6e63] transition">
                            <div className="absolute top-0 left-0 w-2 h-full bg-[#8d6e63]"></div>
                            <div className="pl-4">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-xl font-black mb-1 flex items-center gap-2 truncate">
                                        {room.name}
                                        {room.isLocked && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">🔑</span>}
                                    </h3>
                                    
                                    {(myOwnedRooms.includes(room.id) || room.playerCount === 0) && (
                                        <button 
                                            onClick={() => { click(); handleDeleteRoom(room.id, room.playerCount === 0)}}
                                            className="text-xs bg-red-100 text-red-600 border border-red-200 px-2 py-1 rounded font-bold hover:bg-red-200"
                                        >
                                            {room.playerCount === 0 ? "掃除 🧹" : "削除 🗑️"}
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2 mb-3">
                                    <span className="text-xs bg-[#fff8e1] text-[#5d4037] px-2 py-1 rounded border border-[#d7ccc8]">
                                        🏆 {room.winScore}
                                        {room.conditionType === 'total' ? '問プレイ' : '本先取'}
                                    </span>
                                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">
                                        👥 {room.playerCount} / 2
                                    </span>
                                </div>
                                
                                {room.status === 'playing' || room.playerCount >= 2 ? (
                                    <button disabled className="w-full py-2 bg-gray-300 text-gray-500 font-bold rounded-lg cursor-not-allowed">
                                        対戦中 / 満員
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => { click(); joinGame(room)}}
                                        className="w-full py-2 theme-leaf-btn font-bold rounded-lg shadow-sm transform group-hover:scale-105 transition"
                                    >
                                        参加する
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="theme-white-wood-card p-6 w-full max-w-md animate-pop-in relative">
                <h2 className="text-2xl font-black mb-6 text-center text-[#5d4037] border-b-4 border-[#d7ccc8] pb-2">
                    ルーム作成
                </h2>
                
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    <div>
                        <label className="block font-bold mb-1 text-sm">ルーム名 <span className="text-red-500">*</span></label>
                        <input className="w-full p-3 border-2 border-[#d7ccc8] rounded-lg font-bold focus:outline-none focus:border-[#8d6e63]"
                            value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="例: 初心者歓迎！" />
                    </div>
                    <div>
                        <label className="block font-bold mb-1 text-sm">パスワード (任意)</label>
                        <input className="w-full p-3 border-2 border-[#d7ccc8] rounded-lg font-bold focus:outline-none focus:border-[#8d6e63]"
                            type="password" value={newRoomPass} onChange={e => setNewRoomPass(e.target.value)} placeholder="空欄なら誰でも参加OK" />
                    </div>
                    
                    <div>
                      <label className="block font-bold mb-1 text-sm">使用するメモリーセット</label>
                      <select 
                          className="w-full p-3 border-2 border-[#d7ccc8] rounded-lg font-bold bg-white focus:outline-none focus:border-[#8d6e63]"
                          value={selectedSetId}
                          onChange={e => setSelectedSetId(e.target.value)}
                      >
                          {/* 自分のセット */}
                          {groupedSets.private.length > 0 && (
                              <optgroup label="マイメモリーセット">
                                  {groupedSets.private.map(set => (
                                      <option key={set.id} value={set.id}>
                                          {getCategoryIcon(set.category)} {set.name}
                                      </option>
                                  ))}
                              </optgroup>
                          )}

                          {/* 公式セット */}
                          {groupedSets.official.length > 0 && (
                              <optgroup label="公式テンプレート">
                                  {groupedSets.official.map(set => (
                                      <option key={set.id} value={set.id}>
                                          {getCategoryIcon(set.category)} {set.name}
                                      </option>
                                  ))}
                              </optgroup>
                          )}

                          {/* 公開セット */}
                          {groupedSets.public.length > 0 && (
                              <optgroup label="公開セット">
                                  {groupedSets.public.map(set => (
                                      <option key={set.id} value={set.id}>
                                          {getCategoryIcon(set.category)} {set.name}
                                      </option>
                                  ))}
                              </optgroup>
                          )}
                      </select>
                    </div>

                    <div>
                        <label className="block font-bold mb-1 text-sm">終了条件</label>
                        <div className="flex flex-col gap-3">
                            <div className="flex bg-white rounded-lg border-2 border-[#d7ccc8] overflow-hidden w-full">
                                <button 
                                    type="button"
                                    onClick={() => { click(); setConditionType('score')}}
                                    className={`flex-1 py-2 font-bold transition text-sm ${conditionType === 'score' ? 'bg-[#8d6e63] text-white' : 'text-gray-500'}`}
                                >
                                    正解数
                                </button>
                                <div className="w-[2px] bg-[#d7ccc8]"></div>
                                <button 
                                    type="button"
                                    onClick={() => { click(); setConditionType('total')}}
                                    className={`flex-1 py-2 font-bold transition text-sm ${conditionType === 'total' ? 'bg-[#8d6e63] text-white' : 'text-gray-500'}`}
                                >
                                    出題数
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" min="1" max="50"
                                    className="flex-1 p-2 border-2 border-[#d7ccc8] rounded-lg font-bold text-center bg-white"
                                    value={winCondition}
                                    onChange={e => setWinCondition(Number(e.target.value))}
                                />
                                <span className="text-sm font-bold whitespace-nowrap">
                                    {conditionType === 'score' ? '問正解' : '問プレイ'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-8 pt-4 border-t-2 border-[#d7ccc8]">
                    <button 
                        type="button"
                        onClick={() => { click(); setShowModal(false)}} 
                        className="flex-1 py-3 bg-gray-200 font-bold rounded-xl text-gray-600 hover:bg-gray-300 transition"
                    >
                        キャンセル
                    </button>
                    <button 
                        type="button"
                        onClick={() => { click(); handleCreateRoom();}} 
                        disabled={isLoading}
                        className="flex-1 py-3 theme-leaf-btn font-bold rounded-xl shadow-md transform active:scale-95 transition flex justify-center items-center"
                    >
                        {isLoading ? "作成中..." : "作成して入室"}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}