import { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Home from './components/Home';
import SoloMode from './components/SoloMode';
import BattleLobby from './components/BattleLobby';
import BattleMode from './components/BattleMode';
import Login from './components/Login';           
import Register from './components/Register';     
import CreateMemorySet from './components/CreateMemorySet'; 
import MemorySetList from './components/MemorySetList';
import { BgmPlayer } from './components/BgmPlayer';
import { type GameSettings } from './types';
import { useBgm } from './context/BgmContext';

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setBgm } = useBgm();

    // ★非ゲーム画面のBGMはルートで確実にセット（solo/battleは各画面のstateで制御）
  useEffect(() => {
    const path = location.pathname;

    if (path === '/') {
      setBgm('home', false);
      return;
    }
    if (path === '/lobby') {
      setBgm('lobby', false);
      return;
    }

    // Create（一覧・新規作成・編集）
    if (
      path === '/memory-sets' ||
      path === '/create-set' ||
      path.startsWith('/edit-set/')
    ) {
      setBgm('create', false);
      return;
    }

    // Auth（曲は home 扱い）
    if (path === '/login' || path === '/register') {
      setBgm('home', false);
      return;
    }

    // それ以外はとりあえず home（必要なら増やす）
    setBgm('home', false);
  }, [location.pathname, setBgm]);


  const handleGameStart = (mode: 'online' | 'solo', settings?: GameSettings) => {
    if (mode === 'solo') {
      navigate('/solo', { state: { settings } });
    } else {
      navigate('/lobby');
    }
  };

  return (
    <>
      {/* BgmPlayer は Routes の外に配置。
         URLが変化しても音楽が途切れることなく再生され続けます。
      */}
      <BgmPlayer />

      <Routes>
        <Route path="/" element={<Home onGameStart={handleGameStart} />} />
        <Route path="/solo" element={<SoloMode onBack={() => navigate('/')} />} />
        
        {/* アカウント・作成関連 */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/memory-sets" element={<MemorySetList />} />
        <Route path="/create-set" element={<CreateMemorySet />} />
        <Route path="/edit-set/:id" element={<CreateMemorySet />} />

        {/* バトル関連 */}
        <Route path="/lobby" element={<BattleLobby />} />
        <Route path="/battle" element={<BattleMode />} />
      </Routes>
    </>
  );
}

export default App;