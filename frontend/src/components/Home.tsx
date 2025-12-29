// frontend/src/components/Home.tsx
import { useState, useMemo, useEffect } from 'react';

// 木のアイコン (SVG)
const TreeIcon = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C9 2 7 4 7 7C7 7.78 7.18 8.5 7.5 9.15C5.8 9.68 4.5 11.2 4.5 13C4.5 15.06 6.06 16.76 8.06 16.97C8.03 17.15 8 17.33 8 17.5C8 19.98 10.01 22 12.5 22C14.99 22 17 19.98 17 17.5H19V16.5C19 14.5 17.85 12.8 16.14 12.16C16.68 11.53 17 10.69 17 9.8C17 7.7 15.3 6 13.2 6C13.06 3.75 11.19 2 9 2H12Z" fill="#4ade80"/>
    <path d="M11 18H13V22H11V18Z" fill="#8B4513"/>
  </svg>
);

// 雲アイコン
const CloudIcon = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.5,19c-3.037,0-5.5-2.463-5.5-5.5c0-0.41,0.046-0.811,0.133-1.199C11.586,12.118,11.055,12,10.5,12 c-2.485,0-4.5,2.015-4.5,4.5s2.015,4.5,4.5,4.5h7c2.485,0,4.5-2.015,4.5-4.5S19.985,12,17.5,12c-0.23,0-0.453,0.038-0.668,0.103 C16.915,11.758,16.999,11.386,16.999,11c0-2.761-2.239-5-5-5c-2.31,0-4.256,1.571-4.839,3.699C6.883,9.227,6.452,9,6,9 c-3.314,0-6,2.686-6,6c0,3.314,2.686,6,6,6h11.5c3.037,0,5.5-2.463,5.5-5.5S20.537,19,17.5,19z" />
  </svg>
);

// --- 流れ星コンポーネント (ここが抜けていました！) ---
const ShootingStars = () => {
  const stars = useMemo(() => {
    return Array.from({ length: 5 }).map((_, i) => ({
      id: i,
      top: Math.random() * 50 + '%',       // 上半分
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

// --- 転がる積み木コンポーネント ---
type KeyType = 'normal' | 'enter' | 'space' | 'wide';

type BouncingKeyProps = {
  char: string;
  type: KeyType;
  delay: number;
  duration: number;
  jumpHeight: number;
  bounceScale: number;
  rotation: number; // 回転角度を追加
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
    '--rot-angle': `${rotation}deg`, // 頂点で少し傾く
    animation: `jump-physics ${jumpDuration}s ease-out infinite alternate`,
  } as React.CSSProperties;

  // クラス切り替え
  let keyClass = 'key-wood-block';
  if (type === 'enter') keyClass = 'key-wood-enter';
  if (type === 'space') keyClass = 'key-wood-space';

  return (
    <div style={moveStyle} className="z-10 pointer-events-none">
      <div style={bounceStyle}>
        {/* 積み木なので、少し傾けたまま固定表示したり、ゆっくり回したり */}
        <div className={`${keyClass} transform hover:scale-110 transition-transform`}>
          {char}
        </div>
      </div>
    </div>
  );
};

// --- Homeコンポーネント本体 ---
type HomeProps = {
  onGameStart: (mode: 'online' | 'solo') => void;
};

function Home({ onGameStart }: HomeProps) {
  const [showModeSelect, setShowModeSelect] = useState(false);
  // 夜モード管理
  const [isNight, setIsNight] = useState(false);

  // ★修正: 夜モードをCSSのアニメーション(60秒周期)に合わせてループさせる
  useEffect(() => {
    const runCycle = () => {
      // 30秒後 (50%) に夜開始
      const timerStart = setTimeout(() => setIsNight(true), 30000);
      
      // 60秒後 (100%) に夜終了
      const timerEnd = setTimeout(() => setIsNight(false), 60000);
      
      return [timerStart, timerEnd];
    };

    // 初回の実行
    let timers = runCycle();

    // 以降、60秒ごとにループ実行
    const interval = setInterval(() => {
      timers = runCycle();
    }, 60000);

    // クリーンアップ（画面を閉じた時にタイマーを止める）
    return () => {
      clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, []);

  // ランダムな積み木生成
  const backgroundKeys = useMemo(() => {
    const MAX_JUMP = 800;
    const MIN_JUMP = 100;
    const items = [];
    
    // 生成したい文字セット
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ?!@";
    
    for (let i = 0; i < 18; i++) {
      const isEnter = Math.random() > 0.9;
      const isSpace = Math.random() > 0.9;
      let type: KeyType = 'normal';
      let char = chars[Math.floor(Math.random() * chars.length)];

      if (isEnter) { type = 'enter'; char = 'Enter'; }
      else if (isSpace) { type = 'space'; char = 'Space'; }

      items.push({
        id: i,
        char,
        type,
        delay: Math.random() * 20,
        duration: 10 + Math.random() * 15, 
        jumpHeight: MIN_JUMP + Math.random() * (MAX_JUMP - MIN_JUMP),
        bounceScale: 0.1 + Math.random() * 0.4,
        rotation: (Math.random() - 0.5) * 720, // ランダムに回転
      });
    }
    return items;
  }, []);

  return (
    // theme-garden-bg に変更
    <div className="min-h-screen theme-garden-animate text-[#5D4037] p-8 flex flex-col items-center justify-center relative overflow-hidden font-hakoniwa">
      
      {/* --- 背景デコレーション --- */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        
        {/* ★夜だけ流れ星を表示 */}
        {isNight && <ShootingStars />}

        {/* 雲（白くてふわふわ） */}
        <div className={`absolute top-10 left-0 animate-cloud-slow w-48 ${isNight ? 'opacity-10 text-white' : 'text-white/60'}`}>
           <CloudIcon className="w-full h-full" />
        </div>
        <div className="absolute top-10 left-0 text-white/60 animate-cloud-slow w-48"><CloudIcon className="w-full h-full" /></div>
        <div className="absolute top-32 left-1/3 text-white/40 animate-cloud-medium w-32"><CloudIcon className="w-full h-full" /></div>
        
        {/* 地面の木（背景） */}
        <div className="absolute bottom-16 right-10 w-24 h-24 text-green-300 opacity-50"><TreeIcon className="w-full h-full"/></div>
        <div className="absolute bottom-20 left-10 w-32 h-32 text-green-400 opacity-40"><TreeIcon className="w-full h-full"/></div>

        {/* 転がる積み木 */}
        {backgroundKeys.map((item) => (
          <BouncingKey 
            key={item.id}
            {...item}
          />
        ))}
      </div> 

      {/* --- メインコンテンツ --- */}
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center z-10">
        
        {/* 左側エリア */}
        <div className="space-y-10 text-center md:text-center">
          <header className="relative">
            {/* タイトルロゴ */}
            <h1 className="text-6xl md:text-8xl font-black text-green-500 mb-2 drop-shadow-md text-stroke-garden tracking-tight">
              BRAIN<br/>GARDEN
            </h1>
            <p className={`text-xl font-bold tracking-widest mt-6 ivy-border-bottom ${isNight ? 'text-black-500' : 'text-[#556b2f]'}`}>
               知識を育てるメモリースポーツ × タイピングゲーム
            </p>
          </header>

          <div className="grid grid-cols-2 gap-4">
            <MenuButton text="遊び方" sub="How to Play"/>
            <MenuButton text="暗記法" sub="Method"/>
            <MenuButton text="練習" sub="Training"/>
            <MenuButton text="クリエイト" sub="Make Stage"/>
          </div>
        </div>

        {/* 右側エリア (白い木の板) */}
        <div className="theme-white-wood-card p-10 relative">
          
          {/* 上部の飾り: 葉っぱアイコン */}
          <div className="absolute -top-6 -right-6 text-6xl animate-bounce"></div>

          <h2 className="text-3xl font-bold mb-8 text-[#556b2f] flex items-center justify-center gap-3">
            <span className="text-4xl animate-sparkle-spin-y-reverse">⭐</span> 
            
            <div className="pt-2">
              <span 
                className="text-5xl ml-2 inline-block leading-none transform text-garden-logo"
                data-text="メインモード">
                メインモード
              </span>
            </div>
            <span className="text-4xl animate-sparkle-spin-y-reverse">⭐</span> 
          </h2>
          
          <div className="space-y-4">
            {/* メインスタートボタン（緑の葉っぱ風） */}
            <button 
              onClick={() => setShowModeSelect(true)}
              className="w-full theme-leaf-btn p-2 group"
            >
              <div className="w-full h-full p-4 flex justify-between items-center">
                <div className="text-left">
                  <div className="text-xl md:text-2xl font-black group-hover:text-white transition-colors duration-75">
                    1. フラッシュタイピング
                  </div>
                  <div className="text-sm opacity-80 font-bold pt-1">まずはここから育てよう！</div>
                </div>
                <div className="text-4xl group-hover:scale-125 transition-transform"></div>
              </div>
            </button>
            
            <MenuButtonList text="2. 早押し画像クイズ" />
            <MenuButtonList text="3. 画像メモリー" />
            <MenuButtonList text="4. 単語メモリー" />
            <MenuButtonList text="5. 瞬間記憶" />
          </div>
        </div>
      </div>

      {/* 地面 (芝生) */}
      <div className="absolute bottom-0 left-0 w-full h-16 theme-garden-ground z-20"></div>

      {/* モード選択モーダル */}
      {showModeSelect && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="theme-white-wood-card p-8 max-w-lg w-full">
            
            <h3 className="text-3xl font-black mb-8 text-center text-[#FFFFFF]">
              プレイスタイルを選択
            </h3>
            
            <div className="grid gap-6">
              <button 
                onClick={() => onGameStart('solo')}
                className="theme-leaf-btn py-6 rounded-2xl font-black text-2xl flex items-center justify-center gap-4"
              >
                <span>ソロプレイ</span>
              </button>

              <button 
                onClick={() => onGameStart('online')}
                className="theme-flower-btn py-6 rounded-2xl font-black text-2xl flex items-center justify-center gap-4"
              >
                <span>マルチプレイ</span>
              </button>
            </div>

            <button 
              onClick={() => setShowModeSelect(false)}
              className="mt-8 text-[#8d6e63] font-bold hover:bg-[#efebe9] w-full py-3 rounded-xl transition border-2 border-transparent hover:border-[#d7ccc8]"
            >
              やめる
            </button>
          </div>
        </div>
      )}

      <footer className="absolute bottom-2 text-[#14532d] font-bold text-sm z-30 opacity-80">
        © 2025 Brain Garden Project
      </footer>
    </div>
  );
}

// 木の看板ボタン
function MenuButton({ text, sub }: { text: string; sub: string }) {
  return (
    <button className="theme-wood-btn p-4 flex flex-col items-center justify-center text-center">
      <div className="font-bold text-lg">{text}</div>
      <div className="text-xs opacity-70 font-mono">{sub}</div>
    </button>
  );
}

// ロックされたボタン (紙っぽい質感)
function MenuButtonList({ text }: { text: string }) {
  return (
    <button className="w-full bg-[#f3f4f6] text-gray-400 font-bold py-4 px-6 rounded-xl text-left border-2 border-dashed border-gray-300 flex justify-between items-center cursor-not-allowed">
      <span>{text}</span>
      <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-500">LOCK</span>
    </button>
  );
}

export default Home;