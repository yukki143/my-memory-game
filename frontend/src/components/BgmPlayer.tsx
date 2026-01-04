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
    
    // ★重要: インスタンス作成直後に、現在の設定音量を即座に反映
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
    if (!audioRef.current) return;

    // 2. 音量の連動 (0.0 - 1.0)
    // 設定が変更されるたびにここが実行され、音量が滑らかに変わります
    audioRef.current.volume = settings.bgmVolume / 100;

    // 3. ON/OFF切り替えの連動
    if (settings.enableBgm) {
      // play() は Promise を返すため、ブラウザの自動再生ブロックを考慮して catch を入れる
      audioRef.current.play().catch(() => {
        console.log("Autoplay blocked: ユーザーの操作（クリック等）を待機中");
      });
    } else {
      audioRef.current.pause();
    }
  }, [settings.enableBgm, settings.bgmVolume]);

  return null; // 画面には何も表示しない「機能のみ」のコンポーネント
};