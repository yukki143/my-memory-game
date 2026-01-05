// src/components/ForestPath.tsx
import { useMemo } from 'react';
import './ForestPath.css';
import bgImage from '../assets/bg-forest.png';
import { useSettings } from '../context/SettingsContext'; // ★ インポートを忘れずに

type ForestPathProps = {
  overlayOpacity?: number;
};

const PASTEL_COLORS = [
  '#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', 
  '#C7CEEA', '#FFF7B2', '#FFFFFF',
];

export default function ForestPath({ }: ForestPathProps) {
  // contextから設定を取得
  const { settings } = useSettings();

  /**
   * 背景色の条件分岐 (ここが最重要ポイントです)
   * 1. 常時夜モードON なら -> 固定の紫パステル
   * 2. エフェクトON なら -> アニメーション(skyCycle)
   * 3. それ以外(エフェクトOFF) なら -> 固定のクリーム色
   */
  const atmosphereClass = settings.isNightMode 
    ? 'atmosphere-night-static'   // 常時夜モード
    : settings.enableEffects 
      ? 'atmosphere-overlay'      // アニメーションあり
      : 'atmosphere-cream-static'; // ★ エフェクトOFF時のクリーム色固定

  // 星を表示するかどうかの判定
  // エフェクトがONの時だけ表示し、常時夜モードならアニメーションなしで表示
  const showStars = settings.enableEffects;

  // 星のデータ生成 (現在のロジックを維持)
  const stars = useMemo(() => {
    return Array.from({ length: 150 }).map((_, i) => {
      const top = Math.random() * 100; 
      const left = Math.random() * 100;
      const size = 1 + Math.random() * 2;
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
          boxShadow: `0 0 ${size + 1}px ${color}`, 
          animationDelay: `${delay}s`,
          willChange: 'opacity',
        }
      };
    });
  }, []);

  return (
    <div className="forest-path-container">
        <img src={bgImage} alt="Forest Background" className="forest-bg-image" />
        
        {/* 背景色の層： atmosphereClass によってアニメーションの有無が切り替わります */}
        <div className={atmosphereClass}></div>

        {/* 星の層 */}
        {showStars && (
          <div 
            className="stars-container"
            style={settings.isNightMode ? { opacity: 1, animation: 'none' } : {}}
          >
              {stars.map(star => (
                <div key={star.id} className="twinkle-star" style={star.style} />
              ))}
          </div>
        )}

        <div className="bottom-green-line"></div>
    </div>
  );
}