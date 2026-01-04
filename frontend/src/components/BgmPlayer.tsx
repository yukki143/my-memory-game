// src/components/BgmPlayer.tsx
import { useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';

export const BgmPlayer = () => {
  const { settings } = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // 1. Audioオブジェクトの作成
    const audio = new Audio('/sounds/bgm_main.mp3');
    audio.loop = true;
    
    // インスタンス作成直後に、現在の設定音量を即座に反映
    audio.volume = settings.bgmVolume / 100;
    
    audioRef.current = audio;

    // クリーンアップ処理
    return () => {
      audio.pause();
      audioRef.current = null;
    };
    // 初回マウント時のみ実行
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // 2. 音量の連動
    audio.volume = settings.bgmVolume / 100;

    // 3. 再生・停止の制御（自動再生ブロック対策を追加）
    if (settings.enableBgm) {
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise.catch(() => {
          console.log("Autoplay blocked: ユーザー操作を待機します");
          
          // ブロックされた場合、ユーザーが何かアクションを起こしたら再生を再試行する
          const handleUserInteraction = () => {
            audio.play().then(() => {
              // 再生に成功したら、リスナーを削除して終了
              document.removeEventListener('click', handleUserInteraction);
              document.removeEventListener('keydown', handleUserInteraction);
              document.removeEventListener('touchstart', handleUserInteraction);
            }).catch(e => console.log("再試行失敗:", e));
          };

          // クリック、キー押し、タッチのいずれかで反応させる
          document.addEventListener('click', handleUserInteraction, { once: true });
          document.addEventListener('keydown', handleUserInteraction, { once: true });
          document.addEventListener('touchstart', handleUserInteraction, { once: true });
        });
      }
    } else {
      audio.pause();
    }
  }, [settings.enableBgm, settings.bgmVolume]);

  return null;
};