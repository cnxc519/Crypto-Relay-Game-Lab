"use strict";

window.BtcReplay = window.BtcReplay || {};

(() => {
const INTERVAL_LABELS = new Map([
  [60_000, "1m"],
  [300_000, "5m"],
  [900_000, "15m"],
  [3_600_000, "1h"],
  [14_400_000, "4h"],
  [86_400_000, "1d"],
  [604_800_000, "1w"],
]);

const STORAGE_KEYS = {
  sessions: "btcReplayLab.sessions.v2",
  settings: "btcReplayLab.settings.v2",
  profile: "btcReplayLab.gameProfile.v1",
  chats: "btcReplayLab.characterChats.v1",
};

const DEFAULT_DATA_URL = "./data/BTCUSDT-15m.csv";
const DEFAULT_BINARY_DATA_URL = "./data/BTCUSDT-15m.bin";
const BINARY_CANDLE_MAGIC = "BTCR";
const DAILY_CALENDAR_DAYS = 28;
const DEFAULT_BRAND_AVATAR = "icon";
const LEVEL_MODE_START_TIME = Date.UTC(2020, 0, 1);
const LEVEL_MODE_INTERVAL_MS = 900_000;
const LEVEL_MODE_CANDLES = 96;
const LEVELS_PER_PAGE = 20;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAILY_FIXED_TASK_IDS = ["play_one", "review_one"];
const DAILY_LEVEL_TASK_IDS = [
  "level_one",
  "level_two",
  "level_star_one",
  "level_stars_three",
  "level_three_star",
  "level_clear_one",
  "level_best_improve",
];
const DAILY_LEVEL_TASK_COUNT = 1;
const DAILY_RANDOM_TASK_COUNT = 2;
const DAILY_TASK_XP = 20;

  window.BtcReplay.constants = {
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
  };
})();