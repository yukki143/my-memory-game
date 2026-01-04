import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
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

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE}/`)
      .catch(() => console.log("Server might be offline"));
  }, []);

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