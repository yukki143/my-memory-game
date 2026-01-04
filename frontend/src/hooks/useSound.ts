// frontend/src/hooks/useSound.ts
import { useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';

// インスタンスをキャッシュしてラグをゼロにする
const seCache: Record<string, HTMLAudioElement> = {};

export const useSound = () => {
  const { settings } = useSettings();

  const playSE = useCallback((path: string) => {
    // 音量0なら再生しない
    if (settings.seVolume === 0) return;

    if (!seCache[path]) {
      seCache[path] = new Audio(path);
      seCache[path].preload = 'auto';
    }

    const ad = seCache[path];
    ad.volume = settings.seVolume / 100; // 最新設定を反映
    ad.currentTime = 0; // 頭出しすることで遅延なく再生
    ad.play().catch(e => console.warn("SE play blocked", e));
  }, [settings.seVolume]);

  return { playSE };
};