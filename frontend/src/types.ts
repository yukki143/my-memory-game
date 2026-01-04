// src/types.ts

// 正誤表示などの演出継続時間 (ミリ秒)
// SoloMode や BattleMode での setTimeout に使用します
export const FEEDBACK_DURATION = 500;

export type Problem = {
  text: string;
  kana: string;
};

// メモリーセットの型
export type MemorySet = {
  id: string | number;
  name?: string;       // ルーム作成時のプルダウン用
  title?: string;      // APIからのレスポンス用
  words?: Problem[];   // 単語リスト
  memorize_time?: number;
  questions_per_round?: number;
  win_score?: number;
  condition_type?: 'score' | 'total';
  order_type?: 'random' | 'sequential' | 'review';
};

// ゲームの基本ルール設定
export type GameSettings = {
  memorizeTime?: number;        // 暗記時間 (秒)
  questionsPerRound?: number;   // 1ラウンドあたりの出題数
  clearConditionValue?: number; // クリアに必要な正解数、または合計出題数
  conditionType?: 'score' | 'total'; // 'score'(正解数先取) か 'total'(出題数消化) か
};

// デフォルト設定
export const DEFAULT_SETTINGS: GameSettings = {
  memorizeTime: 3,
  questionsPerRound: 1,
  clearConditionValue: 10,
  conditionType: 'score',
};

export type GlobalSettings = {
  bgmVolume: number;
  seVolume: number;
  enableBgm: boolean;     // ★追加
  enableEffects: boolean;
  isNightMode: boolean;
};

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  bgmVolume: 50,
  seVolume: 50,
  enableBgm: true,        // ★追加
  enableEffects: true,
  isNightMode: false,
};

// ルーム情報 (マルチプレイ用)
export type RoomInfo = {
  id: string;
  name: string;
  hostName: string;
  isLocked: boolean;
  winScore: number;
  status: 'waiting' | 'playing' | 'finished';
  playerCount: number;
  memorySetId: string;
  memorizeTime: number;
  questionsPerRound: number;
  conditionType: 'score' | 'total';
};