import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ForestPath from './ForestPath';

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "登録に失敗しました");
      }
      
      alert("登録完了！ログインしてください。");
      navigate('/login');
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-hakoniwa text-[#5d4037] relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none"><ForestPath overlayOpacity={0.4} /></div>
      
      <div className="relative z-10 theme-wood-box p-8 max-w-md w-full shadow-2xl bg-white/90">
        <h2 className="text-3xl font-bold mb-6 text-center border-b-4 border-[#8d6e63] pb-2">新規登録</h2>
        
        {error && <div className="bg-red-100 text-red-600 p-2 rounded mb-4 font-bold text-center">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block font-bold mb-1">ユーザー名</label>
            <input className="w-full p-3 border-4 border-[#d7ccc8] rounded-xl font-bold bg-[#fff8e1]" 
              value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="block font-bold mb-1">パスワード</label>
            <input type="password" className="w-full p-3 border-4 border-[#d7ccc8] rounded-xl font-bold bg-[#fff8e1]" 
              value={password} onChange={e => setPassword(e.target.value)} />
          </div>
        </div>

        <button onClick={handleRegister} className="w-full mt-8 bg-blue-500 text-white border-b-4 border-blue-700 py-3 rounded-xl font-black text-xl shadow-lg transform transition hover:scale-105 active:border-b-0 active:translate-y-1">
          登録する
        </button>

        <div className="mt-4 text-center">
          <button onClick={() => navigate('/login')} className="text-sm underline hover:text-blue-600 font-bold">
            ログイン画面に戻る
          </button>
        </div>
      </div>
    </div>
  );
}