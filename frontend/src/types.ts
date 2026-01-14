// src/types.ts

export const FEEDBACK_DURATION = 500;

export type Problem = {
  text: string;
  kana: string;
};

export type MemorySet = {
  id: string | number;
  name?: string;
  title?: string;
  words?: Problem[];
  memorize_time?: number;
  answer_time?: number;
  questions_per_round?: number;
  win_score?: number;
  condition_type?: 'score' | 'total';
  order_type?: 'random' | 'sequential' | 'review';
  owner_id?: number | null; 
  is_public?: boolean;
  is_official?: boolean;
};

export type GameSettings = {
  memorizeTime?: number;
  questionsPerRound?: number;
  clearConditionValue?: number;
  conditionType?: 'score' | 'total';
  answerTime?: number;
};

export const DEFAULT_SETTINGS: GameSettings = {
  memorizeTime: 3,
  questionsPerRound: 1,
  clearConditionValue: 10,
  conditionType: 'score',
  answerTime: 10,
};

export type GlobalSettings = {
  bgmVolume: number;
  seVolume: number;
  enableBgm: boolean;
  enableEffects: boolean;
  isNightMode: boolean;
};

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  bgmVolume: 50,
  seVolume: 50,
  enableBgm: true,
  enableEffects: true,
  isNightMode: false,
};

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
  answerTime: number; // ★追加
  questionsPerRound: number;
  conditionType: 'score' | 'total';
};