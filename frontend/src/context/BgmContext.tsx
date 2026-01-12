// frontend/src/context/BgmContext.tsx
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

// ★変更: create シーンを追加
export type BgmScene = 'home' | 'lobby' | 'solo' | 'battle' | 'create';

type BgmContextType = {
  bgmScene: BgmScene;
  paused: boolean;

  /**
   * BGMの「シーン」を切り替える（曲種の決定に使う）
   */
  setBgmScene: (scene: BgmScene) => void;

  /**
   * 一時停止フラグ（結果表示中など「BGMを止めたい」時に使う）
   */
  setPaused: (paused: boolean) => void;

  /**
   * まとめて更新したい場合のユーティリティ
   * paused を省略した場合は現状維持
   */
  setBgm: (scene: BgmScene, paused?: boolean) => void;

  /**
   * 初期状態へ戻す（画面離脱時の片付け用）
   */
  resetBgm: () => void;
};

const BgmContext = createContext<BgmContextType | undefined>(undefined);

export const BgmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 初期値は home（必要なら後で変えられます）
  const [bgmScene, setBgmSceneState] = useState<BgmScene>('home');
  const [paused, setPausedState] = useState<boolean>(false);

  const setBgmScene = useCallback((scene: BgmScene) => {
    setBgmSceneState(scene);
  }, []);

  const setPaused = useCallback((p: boolean) => {
    setPausedState(p);
  }, []);

  const setBgm = useCallback((scene: BgmScene, p?: boolean) => {
    setBgmSceneState(scene);
    if (typeof p === 'boolean') {
      setPausedState(p);
    }
  }, []);

  const resetBgm = useCallback(() => {
    setBgmSceneState('home');
    setPausedState(false);
  }, []);

  const value = useMemo<BgmContextType>(() => {
    return {
      bgmScene,
      paused,
      setBgmScene,
      setPaused,
      setBgm,
      resetBgm,
    };
  }, [bgmScene, paused, setBgmScene, setPaused, setBgm, resetBgm]);

  return <BgmContext.Provider value={value}>{children}</BgmContext.Provider>;
};

export const useBgm = (): BgmContextType => {
  const ctx = useContext(BgmContext);
  if (!ctx) {
    throw new Error('useBgm must be used within a BgmProvider');
  }
  return ctx;
};
