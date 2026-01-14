// frontend/src/components/Home.tsx
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsModal from './SettingsModal'; 
import { 
  type GameSettings, 
} from '../types';
import { useSettings } from '../context/SettingsContext'; // Contextを使用
import { getToken, authFetch } from '../utils/auth';
import { logout } from '../utils/auth';
import { useSound } from '../hooks/useSound';

type HomeProps = {
  onGameStart: (mode: 'online' | 'solo', settings?: GameSettings) => void;
};

// --- アイコン・デコレーションコンポーネント (変更なし) ---
const TreeIcon = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C9 2 7 4 7 7C7 7.78 7.18 8.5 7.5 9.15C5.8 9.68 4.5 11.2 4.5 13C4.5 15.06 6.06 16.76 8.06 16.97C8.03 17.15 8 17.33 8 17.5C8 19.98 10.01 22 12.5 22C14.99 22 17 19.98 17 17.5H19V16.5C19 14.5 17.85 12.8 16.14 12.16C16.68 11.53 17 10.69 17 9.8C17 7.7 15.3 6 13.2 6C13.06 3.75 11.19 2 9 2H12Z" fill="#4ade80"/>
    <path d="M11 18H13V22H11V18Z" fill="#8B4513"/>
  </svg>
);

const CloudIcon = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.5,19c-3.037,0-5.5-2.463-5.5-5.5c0-0.41,0.046-0.811,0.133-1.199C11.586,12.118,11.055,12,10.5,12 c-2.485,0-4.5,2.015-4.5,4.5s2.015,4.5,4.5,4.5h7c2.485,0,4.5-2.015,4.5-4.5S19.985,12,17.5,12c-0.23,0-0.453,0.038-0.668,0.103 C16.915,11.758,16.999,11.386,16.999,11c0-2.761-2.239-5-5-5c-2.31,0-4.256,1.571-4.839,3.699C6.883,9.227,6.452,9,6,9 c-3.314,0-6,2.686-6,6c0,3.314,2.686,6,6,6h11.5c3.037,0,5.5-2.463,5.5-5.5S20.537,19,17.5,19z" />
  </svg>
);

const ShootingStars = () => {
  const stars = useMemo(() => {
    return Array.from({ length: 5 }).map((_, i) => ({
      id: i,
      top: Math.random() * 50 + '%',
      left: Math.random() * 100 + '%',
      delay: Math.random() * 5 + 's',
      duration: 2 + Math.random() * 3 + 's'
    }));
  }, []);

  return (
    <>
      {stars.map(s => (
        <div 
          key={s.id} 
          className="shooting-star"
          style={{ 
            top: s.top, 
            left: s.left, 
            animationDelay: s.delay,
            animationDuration: s.duration
          }} 
        />
      ))}
    </>
  );
};

type KeyType = 'normal' | 'enter' | 'space' | 'wide';
type BouncingKeyProps = {
  char: string;
  type: KeyType;
  delay: number;
  duration: number;
  jumpHeight: number;
  bounceScale: number;
  rotation: number;
};

const BouncingKey = ({ char, type, delay, duration, jumpHeight, bounceScale, rotation }: BouncingKeyProps) => {
  const moveStyle = {
    animation: `flow-left ${duration}s linear infinite`,
    animationDelay: `${delay}s`,
    position: 'absolute' as const,
    bottom: '60px',
    left: '110%',
  };
  const jumpDuration = (duration * bounceScale) / 2;
  const bounceStyle = {
    '--jump-height': `-${jumpHeight}px`,
    '--rot-angle': `${rotation}deg`,
    animation: `jump-physics ${jumpDuration}s ease-out infinite alternate`,
  } as React.CSSProperties;

  let keyClass = 'key-wood-block';
  if (type === 'enter') keyClass = 'key-wood-enter';
  if (type === 'space') keyClass = 'key-wood-space';

  return (
    <div style={moveStyle} className="z-10 pointer-events-none">
      <div style={bounceStyle}>
        <div className={`${keyClass} transform hover:scale-110 transition-transform`}>
          {char}
        </div>
      </div>
    </div>
  );
};

// --- Homeコンポーネント本体 ---
function Home({ onGameStart }: HomeProps) {
  const navigate = useNavigate();
  const { settings, updateSettings } = useSettings(); // Contextから取得
  
  const [isMobileModeSelection, setIsMobileModeSelection] = useState(false);
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [isNight, setIsNight] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await authFetch("/api/users/me");
        if (res.ok) {
          const data = await res.json();
          setUsername(data.username);
        }
      } catch (e) {
        console.error("User fetch error", e);
      }
    };
    fetchUser();
  }, []);

  // 夜モードのサイクル管理
  useEffect(() => {
    if (settings.isNightMode) {
      setIsNight(true);
      return;
    }

    if (!settings.enableEffects) {
      setIsNight(false);
      return;
    }

    const startCycle = () => {
      setIsNight(false);
      return setTimeout(() => setIsNight(true), 30000);
    };

    let nightTimeout = startCycle();
    const interval = setInterval(() => {
      nightTimeout = startCycle();
    }, 60000);

    return () => {
      clearTimeout(nightTimeout);
      clearInterval(interval);
    };
  }, [settings.isNightMode, settings.enableEffects]);

  const backgroundKeys = useMemo(() => {
    const MAX_JUMP = 800;
    const MIN_JUMP = 100;
    const items = [];
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ?!@";
    for (let i = 0; i < 18; i++) {
      const isEnter = Math.random() > 0.9;
      const isSpace = Math.random() > 0.9;
      let type: KeyType = 'normal';
      let char = chars[Math.floor(Math.random() * chars.length)];
      if (isEnter) { type = 'enter'; char = 'Enter'; }
      else if (isSpace) { type = 'space'; char = 'Space'; }
      items.push({
        id: i, char, type,
        delay: Math.random() * 20,
        duration: 10 + Math.random() * 15, 
        jumpHeight: MIN_JUMP + Math.random() * (MAX_JUMP - MIN_JUMP),
        bounceScale: 0.1 + Math.random() * 0.4,
        rotation: (Math.random() - 0.5) * 720,
      });
    }
    return items;
  }, []);

  const handleSaveSettings = (newSettings: any) => {
    updateSettings(newSettings); 
    setShowSettings(false);
  };

  const handleCreateClick = () => {
    const token = getToken();
    if (token) {
      navigate('/memory-sets');
    } else {
      navigate('/login');
    }
  };

  const handleLogout = () => {
    logout();
    alert("ログアウトしました");
    window.location.reload();
  };
  
  const { playSE } = useSound();
  const CLICK_SE = '/sounds/se_click.mp3';
  const click = () => playSE(CLICK_SE);


  return (
    <div className={`min-h-screen text-[#5D4037] p-8 flex flex-col items-center justify-center relative overflow-hidden font-hakoniwa transition-colors duration-1000 
      ${settings.isNightMode ? 'theme-garden-cute-night' : 'theme-garden-animate'}`}>
      
      {/* 背景演出 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {settings.enableEffects && (
          <>
            {isNight && <ShootingStars />}
            <div className={`absolute top-10 left-0 animate-cloud-slow w-48 ${isNight ? 'opacity-10 text-white' : 'text-white/60'}`}>
                <CloudIcon className="w-full h-full" />
            </div>
            <div className="absolute top-32 left-1/3 text-white/40 animate-cloud-medium w-32">
              <CloudIcon className="w-full h-full" />
            </div>
            <div className="absolute bottom-16 right-10 w-24 h-24 text-green-300 opacity-50">
              <TreeIcon className="w-full h-full"/>
            </div>
            <div className="absolute bottom-20 left-10 w-32 h-32 text-green-400 opacity-40">
              <TreeIcon className="w-full h-full"/>
            </div>
            {backgroundKeys.map((item) => (
              <BouncingKey key={item.id} {...item} />
            ))}
          </>
        )}
      </div> 

      {/* ログインバッジ / ログインボタン */}
      {username ? (
        <div 
          onClick={() => {click(); setShowLogoutModal(true)}}
          className="absolute top-4 left-4 z-30 bg-white/90 px-4 py-2 rounded-full shadow-md border-2 border-[#8B4513] flex items-center gap-2 animate-fade-in-down cursor-pointer hover:bg-gray-100 hover:scale-105 transition"
        >
          <span className="text-xl">🧑‍🌾</span>
          <div>
            <div className="text-xs text-gray-500 font-bold leading-none">Player</div>
            <div className="text-lg font-black text-[#556b2f] leading-none">{username}</div>
          </div>
          <div className="ml-2 text-gray-400 text-xs">▼</div>
        </div>
      ) : (
        <button 
          onClick={() => {click(); handleCreateClick();}}
          className="absolute top-4 left-4 z-30 bg-white/90 px-6 py-2 rounded-full shadow-md border-2 border-[#8B4513] flex items-center gap-2 animate-fade-in-down cursor-pointer hover:bg-gray-100 hover:scale-105 transition font-bold"
        >
          <span className="text-xl">🔑</span>
          <span className="text-[#8B4513]">ログイン / 登録</span>
        </button>
      )}

      {/* メインコンテンツ */}
      {/* 既存: isMobileModeSelectionがtrueのときはhiddenになる */}
      <div className={`w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center z-10 transition-opacity duration-300 ${isMobileModeSelection ? 'hidden md:grid' : 'grid'}`}>
        <div className="space-y-10 text-center md:text-center">
          <header className="relative">
            <h1 className="text-6xl md:text-8xl font-black text-green-500 mb-2 drop-shadow-md text-stroke-garden tracking-tight">
              BRAIN<br/>GARDEN
            </h1>
            <p className={`text-xl font-bold tracking-widest mt-6 ivy-border-bottom ${isNight ? 'text-black-500' : 'text-[#556b2f]'}`}>
              知識を育てる脳トレ × タイピングゲーム
            </p>
          </header>
          <div className="grid grid-cols-2 gap-4 h-full">
            <MenuButton text="設定" sub="Customize" onClick={() => {click(); setShowSettings(true)}} />
            <MenuButton text="クリエイト" sub="Make Stage" onClick={() => { click(); handleCreateClick();}} />
            <MenuButton text="ランキング" sub="Ranking" onClick={() => { click(); navigate('/ranking')}} />
            <MenuButton text="成績" sub="Stats" onClick={() => { click(); navigate('/stats')}} />
          </div>
        </div>

        <div className="hidden md:block theme-white-wood-card p-10 relative">
          <h2 className="text-3xl font-bold mb-8 text-[#556b2f] items-center justify-center gap-3 flex">
            <span className="text-4xl animate-sparkle-spin-y-reverse">⭐</span> 
            <div className="pt-2">
              <span className="text-5xl ml-2 inline-block leading-none transform text-garden-logo">メインモード</span>
            </div>
            <span className="text-4xl animate-sparkle-spin-y-reverse">⭐</span> 
          </h2>
          <div className="space-y-4">
            <button onClick={() => {click(); setShowModeSelect(true)}} className="w-full theme-leaf-btn p-2 group">
              <div className="w-full h-full p-4 flex justify-between items-center">
                <div className="text-left">
                  <div className="text-xl md:text-2xl font-black group-hover:text-white transition-colors duration-75">フラッシュタイピング</div>
                  <div className="text-sm opacity-80 font-bold pt-1">まずはここから育てよう！</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="md:hidden flex justify-center w-full">
          <button onClick={() => {click(); setIsMobileModeSelection(true)}} className="w-80 bg-white/90 border-4 border-[#8B4513]/20 rounded-full py-5 shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-3 group">
            <span className="text-xl animate-sparkle-spin-y-reverse">⭐</span>
            <span className="text-xl font-black text-[#556b2f] tracking-wider">メインモード</span>
            <span className="text-xl animate-sparkle-spin-y-reverse">⭐</span>
          </button>
        </div>
      </div>

      {/* ★追加: モバイル用モード選択メニュー */}
      {isMobileModeSelection && (
        <div className="w-full max-w-sm flex flex-col gap-6 z-20 animate-fade-in md:hidden p-4">
          <h2 className="text-4xl font-black text-center text-[#556b2f] text-stroke-white drop-shadow-md mb-4">
            SELECT MODE
          </h2>
          <button 
            onClick={() => {click(); navigate('/memory-sets')}} 
            className="theme-leaf-btn py-6 rounded-2xl font-black text-2xl shadow-xl flex items-center justify-center gap-2"
          >
            <span>ソロモード</span>
          </button>
          <button 
            onClick={() => {click(); navigate('/lobby')}} 
            className="theme-flower-btn py-6 rounded-2xl font-black text-2xl shadow-xl flex items-center justify-center gap-2"
          >
            <span>バトルモード</span>
          </button>
          <button 
            onClick={() => {click(); setIsMobileModeSelection(false)}} 
            className="mt-4 bg-white/80 text-[#8d6e63] font-bold py-4 rounded-xl border-2 border-[#d7ccc8] shadow-sm hover:bg-[#efebe9]"
          >
            戻る
          </button>
        </div>
      )}

      {/* モーダル類 (PC用) */}
      {showModeSelect && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="theme-white-wood-card p-8 max-w-lg w-full">
                  <h3 className="text-2xl font-black mb-8 text-center text-[#FFFFFF]">プレイスタイルを選択</h3>
                  <div className="grid gap-6">
                      <button onClick={() => {click(); navigate('/memory-sets')}} className="theme-leaf-btn py-6 rounded-2xl font-black text-2xl flex items-center justify-center gap-4"><span>ソロモード</span></button>
                      <button onClick={() => {click(); navigate('/lobby')}} className="theme-flower-btn py-6 rounded-2xl font-black text-2xl flex items-center justify-center gap-4"><span>バトルモード</span></button>
                  </div>
                  <button onClick={() => {click(); setShowModeSelect(false)}} className="mt-8 bg-white text-[#8d6e63] font-bold w-full py-3 rounded-xl border-2 border-[#d7ccc8] hover:bg-[#efebe9] transition-all">やめる</button>
              </div>
          </div>
      )}

      {showSettings && (
        <SettingsModal 
          currentSettings={settings} 
          onClose={() => {click(); setShowSettings(false)}} 
          onSave={handleSaveSettings} 
        />
      )}

      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in">
            <div className="bg-white p-8 rounded-2xl shadow-2xl border-4 border-[#8d6e63] max-w-sm w-full text-center relative">
                <div className="text-5xl mb-4">👋</div>
                <h3 className="text-xl font-black text-[#5d4037] mb-2">ログアウトしますか？</h3>
                <div className="flex gap-4 justify-center mt-6">
                    <button onClick={() => {click(); setShowLogoutModal(false)}} className="flex-1 py-3 bg-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-300 transition">キャンセル</button>
                    <button onClick={() => {click(); handleLogout();}} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold shadow-md hover:bg-red-600 transition">ログアウト</button>
                </div>
            </div>
        </div>
      )}

      <footer className="fixed bottom-2 w-full text-center text-[#14532d] font-bold text-sm z-30 opacity-80 pointer-events-none">
        <div className="pointer-events-auto">
          <p>© 2025 Brain Garden Project</p>
          <p className="mt-1">
            効果音提供 オトロジック（
            <a 
              href="https://otologic.jp" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:underline"
            >
              https://otologic.jp
            </a>
            ）
          </p>
        </div>
      </footer>
      <div className="absolute bottom-0 left-0 w-full h-16 theme-garden-ground z-20"></div>
    </div>
  );
};

function MenuButton({ text, sub, onClick }: { text: string; sub: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="theme-wood-btn p-4 flex flex-col items-center justify-center text-center hover:scale-105 transition-transform active:scale-95">
      <div className="font-bold text-lg">{text}</div>
      <div className="text-xs opacity-70 font-mono">{sub}</div>
    </button>
  );
}

export default Home;