// frontend/src/components/MemorySetList.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/auth';
import ForestPath from './ForestPath';
import { type MemorySet } from '../types';
import { DEFAULT_SETTINGS } from '../types';

// 公式テンプレート (固定データ)
// ★修正: IDをバックエンドの DEFAULT_MEMORY_SETS と一致させる
const OFFICIAL_SETS: MemorySet[] = [
  { id: "default", name: "基本セット (フルーツ)", title: "基本セット (フルーツ)", words: new Array(11) },
  { id: "programming", name: "プログラミング用語", title: "プログラミング用語", words: new Array(6) },
  { id: "animals", name: "動物の名前", title: "動物の名前", words: new Array(5) },
  { id: "english_hard", name: "超難問英単語", title: "超難問英単語", words: new Array(3) }, // hardmodeから修正
];

export default function MemorySetList() {
  const navigate = useNavigate();
  const [mySets, setMySets] = useState<MemorySet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMySets();
  }, []);

  const fetchMySets = async () => {
    try {
      const res = await authFetch("/api/my-sets");
      if (res.ok) {
        const data = await res.json();
        setMySets(data);
      } else {
        console.error("Failed to fetch sets");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // 編集画面へ遷移
  const handleEdit = (id: string | number) => {
    navigate(`/edit-set/${id}`);
  };

  // ソロプレイ開始処理
  const handlePlaySolo = (set: MemorySet) => {
    // セットに含まれる設定を取り出し、なければデフォルトを使う
    const settings = {
        ...DEFAULT_SETTINGS,
        memorizeTime: set.memorize_time || 3,
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
        <button onClick={() => navigate('/')} className="font-bold underline hover:text-[#8d6e63]/70 text-xs md:text-base whitespace-nowrap">
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
          onClick={() => navigate('/create-set')}
          className="w-full py-4 theme-leaf-btn rounded-2xl font-black text-xl shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2"
        >
          <span>＋</span><span>新しいメモリーセットを作る</span>
        </button>

        {/* 自分のメモリーセット */}
        <section>
          <h2 className="text-xl font-bold mb-4 px-2 flex items-center gap-2">
            <span>🌾</span> 自分のガーデン
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
            {OFFICIAL_SETS.map((set) => (
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

      </div>
    </div>
  );
}