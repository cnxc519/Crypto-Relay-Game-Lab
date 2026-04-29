"use strict";

const {
  INTERVAL_LABELS,
  STORAGE_KEYS,
  DEFAULT_DATA_URL,
  DEFAULT_BINARY_DATA_URL,
  BINARY_CANDLE_MAGIC,
  DAILY_CALENDAR_DAYS,
  DEFAULT_BRAND_AVATAR,
  LEVEL_MODE_START_TIME,
  LEVEL_MODE_INTERVAL_MS,
  LEVEL_MODE_CANDLES,
  LEVELS_PER_PAGE,
  BEIJING_OFFSET_MS,
  DAILY_FIXED_TASK_IDS,
  DAILY_LEVEL_TASK_IDS,
  DAILY_LEVEL_TASK_COUNT,
  DAILY_RANDOM_TASK_COUNT,
  DAILY_TASK_XP,
} = window.BtcReplay.constants;

const {
  LEVEL_TITLES,
  CHALLENGE_TYPES,
  CHARACTER_CONFIG,
} = window.BtcReplay.content;

const {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENTS,
  achievementCategory,
  achievementProgressSnapshot,
  unlockNewAchievements,
} = window.BtcReplay.achievements;

const { els, ctx } = window.BtcReplay.dom;
