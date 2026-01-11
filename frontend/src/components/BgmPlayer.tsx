// src/components/BgmPlayer.tsx
import { useEffect, useMemo, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useBgm } from '../context/BgmContext';

function sceneToSrc(scene: 'home' | 'lobby' | 'solo' | 'battle') {
  switch (scene) {
    case 'lobby':
      return '/sounds/bgm_lobby.mp3';
    case 'solo':
      return '/sounds/bgm_solo.mp3';
    case 'battle':
      return '/sounds/bgm_battle.mp3';
    case 'home':
    default:
      return '/sounds/bgm_main.mp3';
  }
}

export const BgmPlayer = () => {
  const { settings } = useSettings();
  const { bgmScene, paused } = useBgm();

  const desiredSrc = useMemo(() => sceneToSrc(bgmScene), [bgmScene]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSrcRef = useRef<string>('');
  const playTokenRef = useRef(0);
  const mountedRef = useRef(true);

  const waitingInteractionRef = useRef(false);
  const interactionHandlerRef = useRef<((e?: Event) => void) | null>(null);

  const detachInteractionListeners = () => {
    const handler = interactionHandlerRef.current;
    if (!handler) return;

    document.removeEventListener('click', handler);
    document.removeEventListener('keydown', handler);
    document.removeEventListener('touchstart', handler);

    interactionHandlerRef.current = null;
    waitingInteractionRef.current = false;
  };

  const tryPlay = (audio: HTMLAudioElement) => {
    const token = ++playTokenRef.current; // ★このtryPlayを“最新”として記録

    // paused/disable の時は絶対に再生させない（待機リスナーも残さない）
    if (!settings.enableBgm || paused) {
      detachInteractionListeners();
      audio.pause();
      return;
    }

    const playPromise = audio.play();
    if (playPromise === undefined) return;

    playPromise.catch(() => {
      // ★古いtryPlayのcatchなら何もしない（遷移後にmainが復活するのを防ぐ）
      if (!mountedRef.current) return;
      if (playTokenRef.current !== token) return;
      if (audioRef.current !== audio) return;

      if (waitingInteractionRef.current) return;
      detachInteractionListeners();

      waitingInteractionRef.current = true;

      const handler = () => {
        // ★ここも同様にガード
        if (!mountedRef.current) return;
        if (playTokenRef.current !== token) {
          detachInteractionListeners();
          return;
        }

        if (!settings.enableBgm || paused) {
          detachInteractionListeners();
          return;
        }

        audio.play().finally(() => detachInteractionListeners());
      };

      interactionHandlerRef.current = handler;
      document.addEventListener('click', handler, { once: true });
      document.addEventListener('keydown', handler, { once: true });
      document.addEventListener('touchstart', handler, { once: true });
    });
  };

  // 1) Audioは初回マウント時に1回だけ作る
  useEffect(() => {
    mountedRef.current = true;

    const audio = new Audio(desiredSrc);
    audio.loop = true;
    audio.volume = settings.bgmVolume / 100;

    audioRef.current = audio;
    currentSrcRef.current = desiredSrc;

    return () => {
      mountedRef.current = false;
      playTokenRef.current++; // ★以降のcatch/クリックを無効化

      detachInteractionListeners();
      audio.pause();

      // ★念のため完全停止（任意だけど効くことがある）
      audio.src = '';
      audio.load();

      audioRef.current = null;
      currentSrcRef.current = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) bgmScene変化時だけ src 差し替え
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentSrcRef.current !== desiredSrc) {
      playTokenRef.current++; // ★古い曲のplay試行/クリック待ちを無効化
      detachInteractionListeners();

      audio.pause();

      // 任意：完全停止を強めたいなら
      audio.src = '';
      audio.load();

      audio.src = desiredSrc;
      audio.currentTime = 0;
      audio.load();
      currentSrcRef.current = desiredSrc;
    }

    audio.volume = settings.bgmVolume / 100;

    if (!settings.enableBgm || paused) {
      // ★止める時も待機リスナーを剥がす
      detachInteractionListeners();
      audio.pause();
      return;
    }

    tryPlay(audio);
  }, [desiredSrc, paused, settings.enableBgm, settings.bgmVolume]);

  // 3) 設定追従（ON/OFF・音量）＋ paused
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = settings.bgmVolume / 100;

    if (!settings.enableBgm || paused) {
      // ★ここでも同様
      detachInteractionListeners();
      audio.pause();
      return;
    }

    tryPlay(audio);
  }, [settings.enableBgm, settings.bgmVolume, paused]);

  return null;
};
