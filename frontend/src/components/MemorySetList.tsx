// frontend/src/components/MemorySetList.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/auth';
import ForestPath from './ForestPath';
import { type MemorySet } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { useSound } from '../hooks/useSound';

// 公式テンプレート (固定データ)
const OFFICIAL_SETS: MemorySet[] = [
  { id: "default", name: "基本セット (フルーツ)", title: "基本セット (フルーツ)", words: new Array(11) },
  { id: "programming", name: "プログラミング用語", title: "プログラミング用語", words: new Array(6) },
  { id: "animals", name: "動物の名前", title: "動物の名前", words: new Array(5) },
  { id: "english_hard", name: "超難問英単語", title: "超難問英単語", words: new Array(3) }, 
];

export default function MemorySetList() {
  const navigate = useNavigate();
  const { playSE } = useSound();
  const CLICK_SE = '/sounds/se_click.mp3';

  // ステートの定義
  const [allSets, setAllSets] = useState<MemorySet[]>([]); // すべてのセットを保持
  const [currentUserId, setCurrentUserId] = useState<number | null>(null); // 自分のID
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // キーワードに一致するか判定するヘルパー関数
  const matchesSearch = (set: MemorySet) => {
    const term = searchTerm.toLowerCase();
    return (
      set.title?.toLowerCase().includes(term) || 
      set.name?.toLowerCase().includes(term)
    );
  };

  // フィルタリングされたリストの作成
  const mySets = allSets.filter(s => s.owner_id === currentUserId && !s.is_official && matchesSearch(s));
  const publicSets = allSets.filter(s => s.is_public && s.owner_id !== currentUserId && !s.is_official && matchesSearch(s));
  const filteredOfficialSets = OFFICIAL_SETS.filter(s => matchesSearch(s));
  

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      // ユーザー情報とセット一覧を並行して取得
      await Promise.all([fetchUser(), fetchAllSets()]);
      setLoading(false);
    };
    init();
  }, []);

  // 自分のユーザー情報を取得してIDを保存
  const fetchUser = async () => {
    try {
      const res = await authFetch("/api/users/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentUserId(data.id); // データベース上のユーザーIDをセット
      }
    } catch (e) {
      console.error("User fetch failed", e);
    }
  };

  // 自分のセット＋公開セットをまとめて取得
  const fetchAllSets = async () => {
    try {
      const res = await authFetch("/api/my-sets");
      if (res.ok) {
        const data = await res.json();
        setAllSets(data); // バックエンドから返ってきたリストを保存
      }
    } catch (e) {
      console.error("Sets fetch failed", e);
    }
  };

  // 編集画面へ遷移
  const handleEdit = (id: string | number) => {
    playSE(CLICK_SE);
    navigate(`/edit-set/${id}`);
  };

  // ソロプレイ開始処理
  const handlePlaySolo = (set: MemorySet) => {
    playSE(CLICK_SE);
    // セットに含まれる設定を取り出し、なければデフォルトを使う
    const settings = {
        ...DEFAULT_SETTINGS,
        memorizeTime: set.memorize_time || 3,
        answerTime: set.answer_time || 10, // ★追加: セットに保存された回答時間を反映
        questionsPerRound: set.questions_per_round || 1,
        clearConditionValue: set.win_score || 10,
        conditionType: set.condition_type || 'score',
    };

    navigate('/solo', { 
        state: { 
            settings: settings,
            setId: String(set.id) // セットIDを文字列として渡す
        } 
    });
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center overflow-hidden font-hakoniwa text-[#5d4037]">
      <div className="fixed inset-0 pointer-events-none"><ForestPath overlayOpacity={0.2} /></div>

      <header className="w-full p-4 flex justify-between items-center z-10 bg-white/80 shadow-md border-b-4 border-[#8d6e63]">
        <button onClick={() => {playSE(CLICK_SE); navigate('/')}} className="font-bold underline hover:text-[#8d6e63]/70 text-xs md:text-base whitespace-nowrap">
          ← ホームに戻る
        </button>
        
        <h1 className="text-lg md:text-2xl font-black whitespace-nowrap text-center mx-2">
          メモリーセット一覧
        </h1>
        
        <div className="w-10 md:w-20"></div>
      </header>

      <div className="flex-1 w-full max-w-3xl p-4 z-10 overflow-y-auto pb-24 space-y-8">
        
        {/* 新規作成ボタン */}
        <button 
          onClick={() => {playSE(CLICK_SE); navigate('/create-set')}}
          className="w-full py-4 theme-leaf-btn rounded-2xl font-black text-xl shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2"
        >
          <span>＋</span><span>新しいメモリーセットを作る</span>
        </button>

        {/* ★追加：検索バー */}
        <div className="relative w-full mt-4">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <span className="text-xl">🔍</span>
          </div>
          <input
            type="text"
            placeholder="セット名で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[#d7ccc8] rounded-2xl font-bold focus:border-[#8d6e63] outline-none shadow-inner transition-all"
          />
          {searchTerm && (
            <button 
              onClick={() => { playSE(CLICK_SE); setSearchTerm(""); }}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* 自分のメモリーセット */}
        <section>
          <h2 className="text-xl font-bold mb-4 px-2 flex items-center gap-2">
            <span>🔒</span> マイメモリーセット
          </h2>
          <div className="grid gap-3">
              {mySets.length === 0 && !loading && (
                <div className="text-center py-10 bg-white/60 rounded-2xl border-2 border-dashed border-gray-300">
                  <p className="text-sm opacity-60">まだセットがありません</p>
                </div>
              )}
              {mySets.map((set) => (
                <div key={set.id} className="bg-white/90 p-4 rounded-2xl shadow-md border-l-8 border-[#8d6e63] flex justify-between items-center hover:bg-[#fff8e1] transition">
                  <div className="flex-1 cursor-pointer" onClick={() => handleEdit(set.id)}>
                    <h3 className="text-lg font-bold mb-1">{set.title}</h3>
                    <div className="text-sm opacity-70 font-mono flex flex-wrap gap-x-3 gap-y-1">
                       <span>📚 {set.words ? set.words.length : 0}語</span>
                       <span>⏱️ {set.memorize_time || 3}秒</span>
                       <span>⏰ {set.answer_time || 10}秒</span> {/* ★回答時間を表示 */}
                       <span>📝 {set.questions_per_round || 1}問/回</span>
                       <span className="font-bold text-[#d97706]">
                         🏆 {set.win_score || 10}
                         {set.condition_type === 'total' ? '問プレイ' : '問正解'}
                       </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                      <button 
                        onClick={() => handlePlaySolo(set)}
                        className="bg-green-500 text-white px-4 py-2 rounded-xl font-black shadow-sm hover:bg-green-600 hover:scale-105 transition"
                      >
                        ▶ PLAY
                      </button>
                      <button 
                        onClick={() => handleEdit(set.id)}
                        className="bg-gray-100 text-[#5d4037] px-3 py-2 rounded-xl font-bold text-xs hover:bg-gray-200"
                      >
                        編集
                      </button>
                  </div>
                </div>
              ))}
          </div>
        </section>

        {/* 公式テンプレート */}
        <section>
          <h2 className="text-xl font-bold mb-4 px-2 flex items-center gap-2">
            <span>✨</span> 公式テンプレート
          </h2>
          <div className="grid gap-3 opacity-90">
            {filteredOfficialSets.map((set) => (
              <div key={set.id} className="bg-green-50/90 p-4 rounded-xl shadow-sm border-2 border-green-200 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-green-900">{set.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">公式</span>
                      <span className="text-xs opacity-60">📚 {set.words?.length}語</span>
                    </div>
                </div>
                <button 
                    onClick={() => handlePlaySolo(set)}
                    className="bg-green-600 text-white px-4 py-2 rounded-xl font-black shadow-sm hover:bg-green-700 hover:scale-105 transition"
                >
                    ▶ PLAY
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ★追加：パブリックメモリーセットのセクション */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4 px-2 flex items-center gap-2 text-[#5d4037]">
            <span>🌐</span> みんなの公開セット
          </h2>
          <div className="grid gap-3">
            {publicSets.length > 0 ? (
              publicSets.map((set) => (
                <div key={set.id} className="bg-white/90 p-4 rounded-xl shadow-sm border-2 border-blue-100 flex justify-between items-center hover:border-blue-300 transition-colors">
                  <div>
                    <h3 className="font-bold text-[#5d4037]">{set.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">PUBLIC</span>
                      <span className="text-xs opacity-60 text-[#8d6e63]">📚 {set.words?.length}語</span>
                      {/* 作成者名を表示したい場合は backend/app/routers/memory_sets.py で owner 名を返すように修正が必要です */}
                    </div>
                  </div>
                  <button 
                    onClick={() => handlePlaySolo(set)}
                    className="bg-blue-500 text-white px-4 py-2 rounded-xl font-black shadow-sm hover:bg-blue-600 hover:scale-105 transition"
                  >
                    ▶ PLAY
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-8 bg-white/50 rounded-xl border-2 border-dashed border-gray-300">
                <p className="text-gray-400 font-bold">公開されているセットはまだありません</p>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}