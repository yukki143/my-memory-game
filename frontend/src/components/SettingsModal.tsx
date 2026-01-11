// src/components/SettingsModal.tsx

import { useState, useRef } from 'react';
import { type GlobalSettings } from '../types';
import { useSettings } from '../context/SettingsContext';
import { useSound } from '../hooks/useSound';

type Props = {
  currentSettings: GlobalSettings;
  onClose: () => void;
  // Home.tsx 側での二重処理を避けるため、オプション扱いにします
  onSave?: (settings: GlobalSettings) => void;
};

export default function SettingsModal({ currentSettings, onClose, onSave }: Props) {
  const { updateSettings } = useSettings();

  const { playSE } = useSound();
  const CLICK_SE = '/sounds/se_click.mp3';
  const click = () => playSE(CLICK_SE);

  
  // 1. モーダルが開いた瞬間の設定を保持（キャンセル時に「差し戻す」ため）
  const initialSettings = useRef<GlobalSettings>({ ...currentSettings });

  // Modal内での表示・管理用ローカルステート
  const [settings, setSettings] = useState<GlobalSettings>(currentSettings);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // すでに handleChange で Context は更新されていますが、
    // 最終的な値を確定させ、localStorage に確実に保存するために実行します
    updateSettings(settings);
    
    if (onSave) {
      onSave(settings);
    }
    onClose();
  };

  const handleCancel = () => {
    // 2. キャンセル時は、Context の状態を「開く前の状態」に差し戻す
    updateSettings(initialSettings.current);
    onClose();
  };

  const handleChange = (key: keyof GlobalSettings, value: number | boolean) => {
    // ローカルステートを更新（UI表示用）
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    // 3. ★重要: 即座に Context を更新して BGM 等をリアルタイムに変化させる
    // updateSettings は Partial<GlobalSettings> を受け取るので、変更分だけ渡します
    updateSettings({ [key]: value });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 animate-fade-in">
      <div className="theme-white-wood-card p-8 max-w-md w-full relative shadow-2xl">
        <button 
          type="button" 
          onClick={() => { click();handleCancel();}} 
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold"
        >
          ✕
        </button>
        
        <h2 className="text-2xl font-black text-center mb-6 text-[#5d4037] border-b-4 border-[#8d6e63] pb-2">
          ⚙️ 環境設定
        </h2>

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* BGM設定 */}
          <div className="space-y-4 bg-white/50 p-4 rounded-xl border border-[#d7ccc8]">
            <div className="flex justify-between items-center">
              <label htmlFor="enableBgm" className="font-bold cursor-pointer flex items-center gap-2">
                <span>🎵 BGM再生</span>
              </label>
              <input 
                id="enableBgm" 
                type="checkbox" 
                checked={settings.enableBgm} 
                onChange={(e) => handleChange('enableBgm', e.target.checked)}
                className="w-6 h-6 accent-green-600 cursor-pointer" 
              />
            </div>

            <div className={settings.enableBgm ? 'opacity-100' : 'opacity-40 pointer-events-none transition-opacity'}>
              <div className="block font-bold mb-2 flex justify-between">
                <span>🎵 BGM音量</span>
                <span className="font-mono">{settings.bgmVolume}</span>
              </div>
              <input 
                type="range" 
                min="0" max="100" 
                value={settings.bgmVolume}
                onChange={(e) => handleChange('bgmVolume', Number(e.target.value))}
                className="w-full accent-[#8d6e63]" 
              />
            </div>
          </div>

          {/* SE音量 */}
          <div className="bg-white/50 p-4 rounded-xl border border-[#d7ccc8]">
            <label className="block font-bold mb-2 flex justify-between">
              <span>🔊 SE音量</span>
              <span className="font-mono">{settings.seVolume}</span>
            </label>
            <input 
              type="range" min="0" max="100" 
              value={settings.seVolume} 
              onChange={(e) => handleChange('seVolume', Number(e.target.value))}
              className="w-full accent-[#8d6e63]" 
            />
          </div>

          {/* 背景・モード設定 */}
          <div className="bg-[#fff8e1] p-4 rounded-xl space-y-4 border-2 border-[#d7ccc8]">
            <div className="flex justify-between items-center">
              <label htmlFor="effects" className="font-bold cursor-pointer">✨ 背景エフェクト</label>
              <input 
                id="effects" 
                type="checkbox" 
                checked={settings.enableEffects} 
                onChange={(e) => handleChange('enableEffects', e.target.checked)}
                className="w-6 h-6 accent-green-600 cursor-pointer" 
              />
            </div>
            
            <div className="flex justify-between items-center">
              <label htmlFor="night" className="font-bold cursor-pointer">🌙 常時夜モード</label>
              <input 
                id="night" 
                type="checkbox" 
                checked={settings.isNightMode} 
                onChange={(e) => handleChange('isNightMode', e.target.checked)}
                className="w-6 h-6 accent-blue-600 cursor-pointer" 
              />
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button 
              type="button" 
              onClick={() => { click();handleCancel();}} 
              className="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors"
            >
              キャンセル
            </button>
            <button 
              type="submit" 
              className="flex-1 py-3 theme-leaf-btn text-white font-bold rounded-xl shadow-md transition-transform active:scale-95"
            >
              設定を保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}