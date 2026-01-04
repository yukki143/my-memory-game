import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginRequest, setToken } from '../utils/auth';
import ForestPath from './ForestPath';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      const res = await loginRequest(username, password);
      if (!res.ok) throw new Error("ログイン失敗: ユーザー名かパスワードが違います");
      
      const data = await res.json();
      setToken(data.access_token, rememberMe); // トークン保存
      navigate('/');
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-hakoniwa text-[#5d4037] relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none"><ForestPath overlayOpacity={0.4} /></div>
      
      <div className="relative z-10 theme-wood-box p-8 max-w-md w-full shadow-2xl bg-white/90">
        <h2 className="text-3xl font-bold mb-6 text-center border-b-4 border-[#8d6e63] pb-2">ログイン</h2>
        
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

          {/* ★追加: ログイン保持チェックボックス */}
          <div className="flex items-center gap-2 pt-2">
            <input 
              type="checkbox" 
              id="rememberMe" 
              className="w-5 h-5 accent-[#8d6e63] cursor-pointer"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label htmlFor="rememberMe" className="font-bold cursor-pointer select-none text-sm">
              ログインしたままにする
            </label>
          </div>
        </div>

        <button onClick={handleLogin} className="w-full mt-6 theme-leaf-btn py-3 rounded-xl font-black text-xl shadow-lg transform transition hover:scale-105">
          ログイン
        </button>

        <div className="mt-4 text-center">
          <button onClick={() => navigate('/register')} className="text-sm underline hover:text-blue-600 font-bold">
            アカウントをお持ちでない方はこちら (登録)
          </button>
        </div>
        <div className="mt-2 text-center">
          <button onClick={() => navigate('/')} className="text-sm underline hover:text-gray-600">ホームに戻る</button>
        </div>
      </div>
    </div>
  );
}