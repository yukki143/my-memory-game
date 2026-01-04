import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom'; // ★ useParams追加
import { authFetch } from '../utils/auth';
import ForestPath from './ForestPath';

type WordItem = {
  text: string;
  kana: string;
};

export default function CreateMemorySet() {
  const navigate = useNavigate();
  const { id } = useParams(); // URLパラメータからIDを取得
  const isEditMode = Boolean(id); // IDがあれば編集モード

  const [title, setTitle] = useState("");
  const [memorizeTime, setMemorizeTime] = useState(3);
  const [questionsPerRound, setQuestionsPerRound] = useState(1);
  const [winScore, setWinScore] = useState(10);
  const [conditionType, setConditionType] = useState<'score' | 'total'>('score');
  const [orderType, setOrderType] = useState('random');
  const [words, setWords] = useState<WordItem[]>([
    { text: "", kana: "" },
    { text: "", kana: "" },
    { text: "", kana: "" }
  ]);

  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // ★追加: 編集モードの場合、初期データをロード
  useEffect(() => {
    if (isEditMode) {
      loadSetData();
    }
  }, [id]);

  const loadSetData = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/my-sets/${id}`);
      if (!res.ok) throw new Error("データの取得に失敗しました");
      const data = await res.json();
      setTitle(data.title);
      setWords(data.words);
      if (data.memorize_time) setMemorizeTime(data.memorize_time);
      if (data.questions_per_round) setQuestionsPerRound(data.questions_per_round);
      if (data.win_score) setWinScore(data.win_score);
      if (data.condition_type) setConditionType(data.condition_type as 'score' | 'total'); // ★追加
      if (data.order_type) setOrderType(data.order_type);
    } catch (e) {
      alert("読み込みエラー");
      navigate('/memory-sets');
    } finally {
      setLoading(false);
    }
  };

  const addRow = () => {
    setWords([...words, { text: "", kana: "" }]);
  };

  const handleChange = (index: number, field: 'text' | 'kana', value: string) => {
    const newWords = [...words];
    newWords[index][field] = value;
    setWords(newWords);
  };

  const removeRow = (index: number) => {
    const newWords = words.filter((_, i) => i !== index);
    setWords(newWords);
  };

  // ★修正: 送信処理 (作成/更新の分岐 & モーダル表示)
  const handleSubmit = async () => {
    if (!title.trim()) return alert("タイトルを入力してください");
    
    const validWords = words.filter(w => w.text.trim() !== "");
    if (validWords.length < 3) return alert("最低3単語は登録してください");

    try {
      const url = isEditMode ? `/api/my-sets/${id}` : "/api/my-sets";
      const method = isEditMode ? "PUT" : "POST";

      const res = await authFetch(url, {
        method: method,
        body: JSON.stringify({ 
            title, 
            words: validWords,
            memorize_time: memorizeTime,
            questions_per_round: questionsPerRound,
            win_score: winScore,
            condition_type: conditionType,
            order_type: orderType
        })
      });

      if (!res.ok) throw new Error("Save failed");
      setShowSuccessModal(true);
    } catch (e) { alert("エラーが発生しました"); }
  };

  // 削除処理
  const handleDelete = async () => {
    if (!window.confirm("本当に削除しますか？\nこの操作は取り消せません。")) return;
    
    try {
      const res = await authFetch(`/api/my-sets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除失敗");
      alert("削除しました");
      navigate('/memory-sets');
    } catch (e) {
      alert("削除できませんでした");
    }
  };

  // ★追加: モーダルで「続けて作成」を選んだ時のリセット処理
  const handleReset = () => {
    if (isEditMode) {
      // 編集モードでリセットしたら新規作成モードへ移行
      navigate('/create-set');
    }
    setTitle("");
    setWords([{ text: "", kana: "" }, { text: "", kana: "" }, { text: "", kana: "" }]);
    setShowSuccessModal(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold">読み込み中...</div>;

  return (
    <div className="min-h-screen relative flex flex-col items-center overflow-hidden font-hakoniwa text-[#5d4037]">
      <div className="fixed inset-0 pointer-events-none"><ForestPath overlayOpacity={0.2} /></div>

      <header className="w-full p-4 flex justify-between items-center z-10 bg-white/80 backdrop-blur-md shadow-md border-b-4 border-[#8d6e63]">
        <button onClick={() => navigate('/memory-sets')} className="font-bold underline">← 一覧に戻る</button>
        <h1 className="text-2xl font-black">{isEditMode ? "編集" : "新規作成"}</h1>
        {isEditMode ? <button onClick={handleDelete} className="bg-red-100 text-red-600 px-3 py-1 rounded font-bold hover:bg-red-200">削除 🗑️</button> : <div className="w-10"></div>}
      </header>

      <div className="flex-1 w-full max-w-7xl p-4 z-10 overflow-y-auto pb-24">
  
        {/* タイトル入力（これは上部に全幅で配置） */}
        <div className="bg-white/90 p-6 rounded-3xl shadow-xl border-4 border-[#d7ccc8] mb-6">
          <label className="block font-bold mb-2 text-lg">タイトル</label>
          <input 
            className="w-full p-4 border-4 border-[#8d6e63] rounded-xl font-bold text-xl bg-[#fff8e1] focus:outline-none" 
            placeholder="例: 中学英単語 Level 1" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
          />
        </div>

        {/* ▼ PC版で2カラム、スマホで1カラムにするグリッドレイアウト ▼ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* 左カラム：設定エリア (全体の4割程度を使用) */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-4">
            <div className="bg-[#fff8e1] p-6 rounded-3xl shadow-xl border-4 border-[#8d6e63] relative overflow-hidden">
              <div className="absolute -right-4 -top-4 text-6xl opacity-10">⚙️</div>
              <h3 className="font-black text-lg mb-4 flex items-center gap-2">ゲームルール設定</h3>
              
              <div className="space-y-6">
                {/* 暗記時間 */}
                <div>
                  <label className="block font-bold mb-1 text-sm">暗記時間 (秒)</label>
                  <div className="flex items-center gap-2">
                    <input type="range" min="1" max="10" step="1" 
                      className="w-full accent-[#8d6e63]"
                      value={memorizeTime} onChange={e => setMemorizeTime(Number(e.target.value))} />
                    <span className="font-black text-2xl w-10 text-right">{memorizeTime}</span>
                  </div>
                </div>

                {/* 問題数 */}
                <div>
                  <label className="block font-bold mb-1 text-sm">1問あたり出題数</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map(num => (
                      <button key={num} 
                        onClick={() => setQuestionsPerRound(num)}
                        className={`py-2 rounded-lg font-bold border-2 transition ${questionsPerRound === num ? 'bg-[#8d6e63] text-white border-[#5d4037]' : 'bg-white text-gray-500 border-gray-300'}`}>
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 出題順序 */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-black text-[#5d4037] flex items-center gap-2">
                    出題順序
                  </label>
                  <div className="relative">
                    <select
                      value={orderType}
                      onChange={(e) => setOrderType(e.target.value)}
                      className="w-full p-3 pr-10 rounded-xl border-2 border-[#d7ccc8] font-bold text-[#5d4037] outline-none focus:border-[#8d6e63] transition-colors bg-white/90 appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%238d6e63' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.75rem center',
                        backgroundSize: '1.5em 1.5em'
                      }}
                    >
                      <option value="random">ランダム (標準)</option>
                      <option value="review">苦手優先 (ミス重視)</option>
                      <option value="sequential">順番通り (網羅重視)</option>
                    </select>
                  </div>
                </div>

                {/* 終了条件 */}
                <div className="border-t-2 border-[#d7ccc8] pt-4">
                  <label className="block font-bold mb-2 text-sm">ゲーム終了条件</label>
                  <div className="flex bg-white rounded-lg border-2 border-[#d7ccc8] overflow-hidden mb-3">
                    <button onClick={() => setConditionType('score')} className={`flex-1 py-2 font-bold transition ${conditionType === 'score' ? 'bg-[#8d6e63] text-white' : 'text-gray-500'}`}>正解数</button>
                    <button onClick={() => setConditionType('total')} className={`flex-1 py-2 font-bold transition ${conditionType === 'total' ? 'bg-[#8d6e63] text-white' : 'text-gray-500'}`}>出題数</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" className="w-full p-2 border-2 border-[#d7ccc8] rounded-lg font-bold text-center" value={winScore} onChange={(e) => setWinScore(Number(e.target.value))} />
                    <span className="text-xs font-bold shrink-0">{conditionType === 'score' ? '問正解' : '問プレイ'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右カラム：単語リストエリア (残りのスペースを使用) */}
          <div className="lg:col-span-7 space-y-4">
            <h3 className="font-black text-lg px-2 flex items-center gap-2">メモリーリスト</h3>
            {words.map((word, i) => (
              <div key={i} className="flex gap-2 items-center bg-white/80 p-3 rounded-xl shadow-sm border-2 border-[#d7ccc8] animate-fade-in">
                <span className="font-bold text-gray-400 w-6">{i + 1}.</span>
                <input className="flex-1 p-2 border-2 border-[#d7ccc8] rounded-lg font-bold" placeholder="単語" value={word.text} onChange={e => handleChange(i, 'text', e.target.value)} />
                <input className="flex-1 p-2 border-2 border-[#d7ccc8] rounded-lg font-bold" placeholder="よみがな/意味" value={word.kana} onChange={e => handleChange(i, 'kana', e.target.value)} />
                <button onClick={() => removeRow(i)} className="bg-red-200 text-red-600 w-10 h-10 rounded-full font-bold hover:bg-red-300 shrink-0">×</button>
              </div>
            ))}
            <button onClick={addRow} className="w-full py-4 border-4 border-dashed border-[#8d6e63] text-[#8d6e63] rounded-2xl font-black hover:bg-white/50 transition">＋ 行を追加</button>
          </div>

        </div>
      </div>

      <div className="fixed bottom-0 w-full bg-white/90 p-4 border-t-4 border-[#8d6e63] z-20 flex justify-center">
        <button onClick={handleSubmit} className="theme-leaf-btn px-12 py-3 rounded-full font-black text-2xl shadow-xl transform transition hover:scale-105">{isEditMode ? "更新して完了" : "保存して完了"}</button>
      </div>

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
          <div className="theme-white-wood-card p-8 max-w-md w-full text-center shadow-2xl transform scale-105">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-black text-[#556b2f] mb-2">完了！</h2>
            <p className="text-gray-600 font-bold mb-8">「{title}」を保存しました。</p>
            <div className="space-y-4">
              <button onClick={handleReset} className="w-full theme-leaf-btn py-4 rounded-xl font-black text-lg shadow-md">{isEditMode ? "新規で別のセットを作る" : "続けて新規登録する"}</button>
              <button onClick={() => navigate('/memory-sets')} className="w-full bg-gray-100 text-[#5d4037] border-2 border-[#d7ccc8] py-4 rounded-xl font-bold text-lg shadow-sm hover:bg-gray-200">一覧に戻る</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}