import { useState, useEffect } from 'react';
import BattleMode from './components/BattleMode';
import Home from './components/Home'; // ★さっき作ったHomeを読み込む
import SoloMode from './components/SoloMode';
import './App.css';

// 画面の種類を型定義（タイプミス防止）
type Screen = 'home' | 'battle' | 'solo';

function App() {
  // ★重要: 今どの画面を表示しているか管理する変数
  // 'home' ならホーム画面、'battle' なら対戦画面を表示します
  const [screen, setScreen] = useState<Screen>('home');
  
  // サーバーとの通信確認用（デバッグ用として残しておいてOK）
  const [serverMessage, setServerMessage] = useState("Checking...");

  useEffect(() => {
    // サーバーが生きてるか確認（挨拶）
    fetch("http://127.0.0.1:8000/")
      .then((res) => res.json())
      .then((data) => setServerMessage(data.message))
      .catch(() => setServerMessage("Offline"));
  }, []);

  return (
    <>
      {/* ■ ホーム画面 */}
      {screen === 'home' && (
        <Home 
          onGameStart={(mode) => setScreen(mode === 'online' ? 'battle' : 'solo')} // 「ボタンが押されたらbattleに切り替えて！」と伝える
        />
      )}

      {/* ■ 対戦画面 */}
      {screen === 'battle' && (
        <BattleMode />
      )}

      {/* ■ 個人戦画面 */}
      {screen === 'solo' && (
        // onBackでホームに戻れるようにする
        <SoloMode onBack={() => setScreen('home')} />
      )}
    </>
  );
}

export default App;