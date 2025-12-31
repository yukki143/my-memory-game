import { useMemo } from 'react';
import './ForestPath.css';
import bgImage from '../assets/bg-forest.png';

type ForestPathProps = {
  overlayOpacity?: number;
};

const PASTEL_COLORS = [
  '#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', 
  '#C7CEEA', '#FFF7B2', '#FFFFFF',
];

export default function ForestPath({ }: ForestPathProps) {
  // 星のデータを生成
  const stars = useMemo(() => {
    // 星の数を200個に設定
    return Array.from({ length: 200 }).map((_, i) => {
      
      // ★修正ポイント: 「奥の白い部分」に合わせて出現位置を絞り込みます
      // 画像の構図に合わせて数値を微調整しました
      
      // 縦の位置: 上から 0% 〜 100% の範囲（空が見えている高さを狙う）
      const top = Math.random() * 100; 
      
      // 横の位置: 左から 0% 〜 100% の範囲（画面中央に寄せる）
      const left = Math.random() * 100;
      
      // サイズ: 1px ~ 3px（奥にあるので小さくして遠近感を出す）
      const size = 1 + Math.random() * 3;
      
      const color = PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];
      const delay = Math.random() * 3;

      return {
        id: i,
        style: {
          top: `${top}%`,
          left: `${left}%`,
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: color,
          // 小さい星なので、光の広がり（boxShadow）も控えめに
          boxShadow: `0 0 ${size + 1}px ${color}`, 
          animationDelay: `${delay}s`,
        }
      };
    });
  }, []);

  return (
    <div className="forest-path-container">
        <img src={bgImage} alt="Forest Background" className="forest-bg-image" />
        <div className="atmosphere-overlay"></div>

        {/* 星専用コンテナ（夜だけ出現） */}
        <div className="stars-container">
            {stars.map(star => (
              <div 
                key={star.id} 
                className="twinkle-star" 
                style={star.style} 
              />
            ))}
        </div>

        <div className="bottom-green-line"></div>
    </div>
  );
}