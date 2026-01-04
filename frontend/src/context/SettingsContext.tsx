// frontend/src/context/SettingsContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { type GlobalSettings, DEFAULT_GLOBAL_SETTINGS } from '../types';

// Contextの型定義
type SettingsContextType = {
  settings: GlobalSettings;
  updateSettings: (newSettings: Partial<GlobalSettings>) => void;
};

// Contextの作成
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Providerコンポーネント
export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 初期値のロード: localStorageにあればそれを使い、なければデフォルトを使う
  const [settings, setSettings] = useState<GlobalSettings>(() => {
    const saved = localStorage.getItem('app-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 新しく追加した enableBgm などが古い保存データにない場合に備えて
        // デフォルト値とマージする
        return { ...DEFAULT_GLOBAL_SETTINGS, ...parsed };
      } catch (e) {
        console.error("Settings parse error", e);
        return DEFAULT_GLOBAL_SETTINGS;
      }
    }
    return DEFAULT_GLOBAL_SETTINGS;
  });

  // 設定を更新し、localStorageに保存する関数
  const updateSettings = (newSettings: Partial<GlobalSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('app-settings', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

// カスタムフック: 他のコンポーネントから簡単に設定を呼べるようにする
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};