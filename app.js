"use strict";

const $ = (id) => document.getElementById(id);

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

const LEVEL_TITLES = [
  "新手观察员",
  "K线侦察兵",
  "趋势学徒",
  "区间猎手",
  "风控执行者",
  "回撤幸存者",
  "结构识别师",
  "盘面节奏师",
  "冷静交易员",
  "历史回放大师",
];

const CHALLENGE_TYPES = {
  blind: {
    name: "盲测快局",
    text: "隐藏日期，先判断接下来一段更可能向哪边走。",
    context: 150,
    horizon: 48,
    xp: 80,
  },
  trend: {
    name: "趋势猎人",
    text: "寻找顺势机会，别在离结构太远的位置乱追。",
    context: 220,
    horizon: 96,
    xp: 110,
  },
  trap: {
    name: "假突破审判",
    text: "重点观察前高前低附近，判断突破是否值得相信。",
    context: 180,
    horizon: 64,
    xp: 100,
  },
  survival: {
    name: "暴跌生存",
    text: "目标不是赚最多，而是在剧烈波动里控制回撤。",
    context: 160,
    horizon: 72,
    xp: 120,
  },
  revenge: {
    name: "错题复仇",
    text: "系统给你一局综合题，用来修正最近最容易犯的错。",
    context: 180,
    horizon: 72,
    xp: 120,
  },
  level: {
    name: "历史闯关",
    text: "从 2020 年开始，每一天 96 根 15m K 线是一关，目标是稳定拿星。",
    context: 96,
    horizon: LEVEL_MODE_CANDLES - 1,
    xp: 100,
  },
};

const ACHIEVEMENTS = [
  { id: "first_run", name: "第一局开打", desc: "完成 1 个训练关卡", test: (p) => p.stats.completed >= 1 },
  { id: "three_runs", name: "开始上瘾", desc: "累计完成 3 局", test: (p) => p.stats.completed >= 3 },
  { id: "ten_runs", name: "历史回放常客", desc: "累计完成 10 局", test: (p) => p.stats.completed >= 10 },
  { id: "twenty_runs", name: "盘感打磨中", desc: "累计完成 20 局", test: (p) => p.stats.completed >= 20 },
  { id: "fifty_runs", name: "回放长跑者", desc: "累计完成 50 局", test: (p) => p.stats.completed >= 50 },
  { id: "score_80", name: "冷静的一局", desc: "任意关卡达到 80 分", test: (p) => p.stats.bestScore >= 80 },
  { id: "score_90", name: "神清气定", desc: "任意关卡达到 90 分", test: (p) => p.stats.bestScore >= 90 },
  { id: "score_95", name: "几乎无噪音", desc: "任意关卡达到 95 分", test: (p) => p.stats.bestScore >= 95 },
  { id: "observer", name: "观望也是操作", desc: "用观望拿到一次高分", test: (p) => p.stats.goodFlat >= 1 },
  { id: "observer_5", name: "不动如山", desc: "用观望拿到 5 次高分", test: (p) => p.stats.goodFlat >= 5 },
  { id: "seatbelt", name: "先系安全带", desc: "带止损完成 5 局", test: (p) => p.stats.stopUsed >= 5 },
  { id: "seatbelt_15", name: "风控成习惯", desc: "带止损完成 15 局", test: (p) => p.stats.stopUsed >= 15 },
  { id: "reviewer", name: "诚实复盘者", desc: "带复盘完成 5 局", test: (p) => p.stats.reviewed >= 5 },
  { id: "reviewer_15", name: "错题会发光", desc: "带复盘完成 15 局", test: (p) => p.stats.reviewed >= 15 },
  { id: "blind_10", name: "盲区行者", desc: "累计完成 10 局盲测快局", test: (p) => p.stats.blind >= 10 },
  { id: "trend_10", name: "顺势雷达", desc: "累计完成 10 局趋势猎人", test: (p) => p.stats.trend >= 10 },
  { id: "trap_10", name: "假突破拆解员", desc: "累计完成 10 局假突破", test: (p) => p.stats.trap >= 10 },
  { id: "survival_10", name: "波动防线", desc: "累计完成 10 局暴跌生存", test: (p) => p.stats.survival >= 10 },
  { id: "revenge_10", name: "复仇清单", desc: "累计完成 10 局错题复仇", test: (p) => p.stats.revenge >= 10 },
  { id: "streak_3", name: "三天不断线", desc: "连续训练 3 天", test: (p) => p.streak >= 3 },
  { id: "streak_7", name: "七日训练舱", desc: "连续训练 7 天", test: (p) => p.streak >= 7 },
  { id: "streak_14", name: "两周手感", desc: "连续训练 14 天", test: (p) => p.streak >= 14 },
  { id: "character_lv5", name: "开始培养", desc: "任意角色达到 Lv.5", test: (p) => Object.values(p.characters || {}).some((c) => characterLevelFromXp(c.xp, c.stage) >= 5) },
  { id: "character_lv10", name: "默契成形", desc: "任意角色达到 Lv.10", test: (p) => Object.values(p.characters || {}).some((c) => characterLevelFromXp(c.xp, c.stage) >= 10) },
  { id: "ascended_once", name: "第一次进阶", desc: "任意角色升到二阶", test: (p) => Object.values(p.characters || {}).some((c) => c.stage >= 2) },
  { id: "materials_5", name: "材料收藏家", desc: "任意角色持有 5 个进阶材料", test: (p) => Object.values(p.characters || {}).some((c) => c.materials >= 5) },
  { id: "level_clear_1", name: "第一关通过", desc: "历史闯关通过 1 关", test: (p) => levelModeStats(p).cleared >= 1 },
  { id: "level_clear_10", name: "十日远征", desc: "历史闯关通过 10 关", test: (p) => levelModeStats(p).cleared >= 10 },
  { id: "level_clear_50", name: "五十关巡礼", desc: "历史闯关通过 50 关", test: (p) => levelModeStats(p).cleared >= 50 },
  { id: "level_stars_25", name: "星光初聚", desc: "历史闯关累计获得 25 星", test: (p) => levelModeStats(p).stars >= 25 },
  { id: "level_stars_100", name: "百星图鉴", desc: "历史闯关累计获得 100 星", test: (p) => levelModeStats(p).stars >= 100 },
  { id: "level_five_star", name: "五星日线", desc: "任意历史关卡获得 5 星", test: (p) => levelModeStats(p).fiveStars >= 1 },
  { id: "level_retry_5", name: "不服再来", desc: "同一历史关卡累计挑战 5 次", test: (p) => levelModeStats(p).maxAttempts >= 5 },
];

const CHARACTER_CONFIG = [
  {
    id: "btc_hime",
    name: "朝野晴",
    file: "乐观女孩.png",
    title: "BTC姬 · 朝阳派",
    quotes: [
      "今天也先看结构，再相信上涨。",
      "别急着追，先问趋势有没有给你位置。",
      "真正的顺风，是价格和计划一起走。",
      "一根阳线不代表信仰，连续结构才算证据。",
      "如果要看多，就把理由写得比情绪更清楚。",
    ],
    style: "做多正确、趋势顺风、牛市耐心",
    rule: "只允许主动做多，不允许开空；开多前必须写交易理由。",
    material: "朝阳碎片",
    challengeType: "trend",
    success: (r) => r.bias === "long" && r.expected === "long" && r.score >= 70,
  },
  {
    id: "ember_keeper",
    name: "棠小暖",
    file: "暖色调萝莉.png",
    title: "小火炉 · 日课守护",
    quotes: [
      "不需要一口气变强，今天打一局也算数。",
      "复利不是只给资金，也给耐心。",
      "轻一点，稳一点，今天先把手感找回来。",
      "完成一局就很好，盘感会慢慢长出来。",
      "别把训练变成压力，先把节奏点亮。",
    ],
    style: "参与局数、连续训练、轻量日课",
    rule: "每局最多 2 次主动开仓，单次开仓不能超过账户权益的 50%。",
    material: "暖炉火种",
    challengeType: "blind",
    success: (r) => r.score >= 50,
  },
  {
    id: "white_saint",
    name: "白羽誓",
    file: "洁白神圣.png",
    title: "风控圣女 · 止损誓约",
    quotes: [
      "先保护本金，再谈漂亮的胜利。",
      "没有止损的单子，先别让它进场。",
      "小亏是训练费，大亏才是坏习惯。",
      "风控不是悲观，是给下一次机会留门。",
      "你可以判断错，但不该失控。",
    ],
    style: "止损纪律、暴跌生存、小亏执行",
    rule: "任何主动开仓都必须设置有效止损：多单止损低于现价，空单止损高于现价。",
    material: "圣白羽片",
    challengeType: "survival",
    success: (r) => r.hasStop && r.score >= 65,
  },
  {
    id: "gentle_queen",
    name: "绫濑澄夜",
    file: "温柔皇感.png",
    title: "温柔女皇 · 空头审判",
    quotes: [
      "下跌不是敌人，失控才是。",
      "做空也要优雅，别把报复当判断。",
      "顶部常常很热闹，冷静的人才听得到裂缝。",
      "反弹可以看，裸奔不行。",
      "空头不是诅咒，只是另一种顺势。",
    ],
    style: "做空正确、熊市反弹、顶部陷阱",
    rule: "只允许主动开空，不允许开多；空单必须先设置低于现价的止盈。",
    material: "王冠残片",
    challengeType: "trap",
    success: (r) => r.bias === "short" && r.expected === "short" && r.score >= 70,
  },
  {
    id: "clear_eye",
    name: "观月澈",
    file: "眼神清澈女孩.png",
    title: "清澈观察者 · 不确定之眼",
    quotes: [
      "看不懂的时候，观望就是高级操作。",
      "少做一笔，常常等于少犯一个错。",
      "不确定不是失败，它是提醒你缩小动作。",
      "行情不欠你机会，别用焦虑付手续费。",
      "清楚地说不知道，也是一种能力。",
    ],
    style: "观望正确、少交易、识别震荡",
    rule: "必须先选择方向；观望时禁止开仓；每局最多 1 次主动开仓且方向必须一致。",
    material: "清澈晶片",
    challengeType: "blind",
    success: (r) => r.bias === "flat" && r.expected === "flat" && r.score >= 70,
  },
  {
    id: "kind_saint",
    name: "祈原音",
    file: "神圣却可爱亲切.png",
    title: "复盘修女 · 错题祈愿",
    quotes: [
      "每个错误都可以变成下一次升级材料。",
      "写下来，市场才会真的教过你。",
      "别急着忘掉亏损，先把原因拆开。",
      "复盘不是责怪自己，是给未来递纸条。",
      "你愿意承认的错，才有机会被修正。",
    ],
    style: "复盘局数、错题复仇、错误标签",
    rule: "主动开仓前必须写理由，并至少勾选 1 个复盘标签。",
    material: "祈愿书签",
    challengeType: "revenge",
    success: (r) => r.reviewed && r.score >= 60,
  },
  {
    id: "green_eth",
    name: "绿川璃奈",
    file: "绿色基调辣妹.png",
    title: "ETH姬 · 波动舞者",
    quotes: [
      "波动很吵，但节奏会说真话。",
      "快行情里，慢半拍的计划最值钱。",
      "别被大蜡烛晃眼，先看它站在哪里。",
      "速度可以快，止损不能忘。",
      "高波动不是许可，它只是提醒你把仓位放轻。",
    ],
    style: "高波动行情、超额收益、快速判断",
    rule: "主动开仓必须同时设置有效止损和止盈，多空都要让价格被风控区间夹住。",
    material: "绿焰筹码",
    challengeType: "trap",
    success: (r) => Math.abs(r.movePct) >= 0.012 && r.score >= 75,
  },
];

const els = {
  brandAvatar: $("brandAvatar"),
  brandAvatarSelect: $("brandAvatarSelect"),
  fileInput: $("fileInput"),
  timeframeSelect: $("timeframeSelect"),
  hideFutureToggle: $("hideFutureToggle"),
  blindModeToggle: $("blindModeToggle"),
  logScaleToggle: $("logScaleToggle"),
  ma20Toggle: $("ma20Toggle"),
  ma60Toggle: $("ma60Toggle"),
  datasetInfo: $("datasetInfo"),
  cursorInfo: $("cursorInfo"),
  chartFrame: $("chartFrame"),
  canvas: $("chartCanvas"),
  placeholder: $("placeholder"),
  toast: $("toast"),
  tooltip: $("tooltip"),
  timeline: $("timeline"),
  firstBtn: $("firstBtn"),
  backBtn: $("backBtn"),
  playBtn: $("playBtn"),
  forwardBtn: $("forwardBtn"),
  plusTenBtn: $("plusTenBtn"),
  latestBtn: $("latestBtn"),
  randomBtn: $("randomBtn"),
  blindRandomBtn: $("blindRandomBtn"),
  revealDateBtn: $("revealDateBtn"),
  speedSelect: $("speedSelect"),
  jumpInput: $("jumpInput"),
  jumpBtn: $("jumpBtn"),
  initialCashInput: $("initialCashInput"),
  feeInput: $("feeInput"),
  resetAccountBtn: $("resetAccountBtn"),
  equityValue: $("equityValue"),
  pnlValue: $("pnlValue"),
  cashValue: $("cashValue"),
  btcValue: $("btcValue"),
  winRateValue: $("winRateValue"),
  drawdownValue: $("drawdownValue"),
  tradeCountValue: $("tradeCountValue"),
  rValue: $("rValue"),
  currentPrice: $("currentPrice"),
  stopLossInput: $("stopLossInput"),
  takeProfitInput: $("takeProfitInput"),
  riskPctInput: $("riskPctInput"),
  tradeReasonInput: $("tradeReasonInput"),
  riskBuyBtn: $("riskBuyBtn"),
  closePositionBtn: $("closePositionBtn"),
  attachStopsBtn: $("attachStopsBtn"),
  clearStopsBtn: $("clearStopsBtn"),
  sessionNameInput: $("sessionNameInput"),
  bookmarkInput: $("bookmarkInput"),
  addBookmarkBtn: $("addBookmarkBtn"),
  addHlineBtn: $("addHlineBtn"),
  clearLinesBtn: $("clearLinesBtn"),
  sessionNotesInput: $("sessionNotesInput"),
  bookmarkList: $("bookmarkList"),
  sessionSelect: $("sessionSelect"),
  saveSessionBtn: $("saveSessionBtn"),
  loadSessionBtn: $("loadSessionBtn"),
  deleteSessionBtn: $("deleteSessionBtn"),
  exportTradesBtn: $("exportTradesBtn"),
  exportReportBtn: $("exportReportBtn"),
  screenshotBtn: $("screenshotBtn"),
  tradeRows: $("tradeRows"),
  streakValue: $("streakValue"),
  levelTitle: $("levelTitle"),
  levelValue: $("levelValue"),
  xpFill: $("xpFill"),
  xpText: $("xpText"),
  challengeCard: $("challengeCard"),
  challengeTitle: $("challengeTitle"),
  challengeText: $("challengeText"),
  biasLongBtn: $("biasLongBtn"),
  biasShortBtn: $("biasShortBtn"),
  biasFlatBtn: $("biasFlatBtn"),
  quickGameBtn: $("quickGameBtn"),
  trendGameBtn: $("trendGameBtn"),
  trapGameBtn: $("trapGameBtn"),
  survivalGameBtn: $("survivalGameBtn"),
  revengeGameBtn: $("revengeGameBtn"),
  settleGameBtn: $("settleGameBtn"),
  levelGameBtn: $("levelGameBtn"),
  levelListBtn: $("levelListBtn"),
  levelModal: $("levelModal"),
  closeLevelModalBtn: $("closeLevelModalBtn"),
  levelSummary: $("levelSummary"),
  prevLevelPageBtn: $("prevLevelPageBtn"),
  nextLevelPageBtn: $("nextLevelPageBtn"),
  levelPageSelect: $("levelPageSelect"),
  levelRows: $("levelRows"),
  dailyTaskHudBtn: $("dailyTaskHudBtn"),
  dailyTaskDot: $("dailyTaskDot"),
  dailyTaskModal: $("dailyTaskModal"),
  closeDailyTaskBtn: $("closeDailyTaskBtn"),
  dailyTaskList: $("dailyTaskList"),
  dailyRewardText: $("dailyRewardText"),
  claimDailyRewardBtn: $("claimDailyRewardBtn"),
  prevCalendarMonthBtn: $("prevCalendarMonthBtn"),
  nextCalendarMonthBtn: $("nextCalendarMonthBtn"),
  dailyCalendarYearSelect: $("dailyCalendarYearSelect"),
  dailyCalendarMonthSelect: $("dailyCalendarMonthSelect"),
  dailyCalendar: $("dailyCalendar"),
  achievementList: $("achievementList"),
  achievementAllBtn: $("achievementAllBtn"),
  achievementDot: $("achievementDot"),
  achievementModal: $("achievementModal"),
  achievementAllList: $("achievementAllList"),
  closeAchievementBtn: $("closeAchievementBtn"),
  characterChatHudBtn: $("characterChatHudBtn"),
  characterChatModal: $("characterChatModal"),
  closeCharacterChatBtn: $("closeCharacterChatBtn"),
  chatCharacterSelect: $("chatCharacterSelect"),
  chatStatus: $("chatStatus"),
  chatPortrait: $("chatPortrait"),
  chatLog: $("chatLog"),
  chatSpeaker: $("chatSpeaker"),
  chatStreamingText: $("chatStreamingText"),
  chatForm: $("chatForm"),
  chatInput: $("chatInput"),
  chatSendBtn: $("chatSendBtn"),
  chatClearBtn: $("chatClearBtn"),
  settlementModal: $("settlementModal"),
  settlementTitle: $("settlementTitle"),
  settlementScore: $("settlementScore"),
  settlementBreakdown: $("settlementBreakdown"),
  settlementRewards: $("settlementRewards"),
  settlementReviewPortrait: $("settlementReviewPortrait"),
  settlementReviewTitle: $("settlementReviewTitle"),
  settlementReviewStatus: $("settlementReviewStatus"),
  settlementReviewText: $("settlementReviewText"),
  nextChallengeBtn: $("nextChallengeBtn"),
  reviewMistakeBtn: $("reviewMistakeBtn"),
  closeSettlementBtn: $("closeSettlementBtn"),
  characterPortrait: $("characterPortrait"),
  characterTitle: $("characterTitle"),
  characterName: $("characterName"),
  characterLevel: $("characterLevel"),
  characterXpFill: $("characterXpFill"),
  characterText: $("characterText"),
  characterRuleCard: $("characterRuleCard"),
  characterGrid: $("characterGrid"),
  characterMaterialList: $("characterMaterialList"),
  characterQuestBtn: $("characterQuestBtn"),
  ascensionTrialBtn: $("ascensionTrialBtn"),
};

const ctx = els.canvas.getContext("2d");

const state = {
  sourceCandles: [],
  sourceIntervalMs: 0,
  sourceGaps: 0,
  candles: [],
  fileName: "",
  timeframeMs: 0,
  currentIndex: 0,
  viewStart: 0,
  viewEnd: 0,
  hideFuture: true,
  blindMode: false,
  dateRevealed: false,
  logScale: true,
  showMA20: true,
  showMA60: false,
  brandAvatarChoice: DEFAULT_BRAND_AVATAR,
  followCurrent: true,
  isPlaying: false,
  timer: null,
  hover: null,
  drag: null,
  lastClickAt: 0,
  bookmarks: [],
  annotations: [],
  account: createAccount(10_000),
  game: {
    profile: createGameProfile(),
    active: null,
    lastType: "blind",
    lastSettlement: null,
    externalAccount: null,
    lastGameAccount: null,
    lastCharacterGain: null,
    lastLevelRecord: null,
    settlementReview: {
      settlementId: "",
      isStreaming: false,
      text: "",
    },
    activeQuoteCharacterId: null,
    activeQuote: "",
    calendarYear: null,
    calendarMonth: null,
    settling: false,
  },
  chat: {
    histories: {},
    activeCharacterId: "btc_hime",
    isStreaming: false,
  },
};

const money = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const priceFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const btcFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 8,
});

const POSITION_EPSILON = 0.00000001;

function createAccount(initialCash) {
  return {
    initialCash,
    cash: initialCash,
    btc: 0,
    positionCost: 0,
    positionRisk: 0,
    stopPrice: null,
    takePrice: null,
    trades: [],
  };
}

function cloneAccount(account) {
  return JSON.parse(JSON.stringify(account));
}

function positionSide(account = state.account) {
  if (account.btc > POSITION_EPSILON) return "long";
  if (account.btc < -POSITION_EPSILON) return "short";
  return "flat";
}

function positionSideLabel(side = positionSide()) {
  return { long: "多", short: "空", flat: "空仓" }[side] || "空仓";
}

function clearAccountRiskLines() {
  state.account.stopPrice = null;
  state.account.takePrice = null;
  els.stopLossInput.value = "";
  els.takeProfitInput.value = "";
}

function todayKey() {
  return beijingDateKey();
}

function beijingDateKey(date = new Date()) {
  return new Date(date.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

function offsetDateKey(dateKey, deltaDays) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return date.toISOString().slice(0, 10);
}

function seededDailyRandom(seed) {
  let value = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    value ^= seed.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function dailyTaskDefinitions() {
  return {
    play_one: { id: "play_one", text: "完成 1 局训练", done: (d) => d.completed >= 1, progress: (d) => `${d.completed || 0}/1` },
    review_one: { id: "review_one", text: "写一次理由或复盘", done: (d) => d.reviewed >= 1, progress: (d) => `${d.reviewed || 0}/1` },
    play_three: { id: "play_three", text: "完成 3 局训练", done: (d) => d.completed >= 3, progress: (d) => `${d.completed || 0}/3` },
    blind_one: { id: "blind_one", text: "完成 1 局盲测快局", done: (d) => d.blind >= 1, progress: (d) => `${d.blind || 0}/1` },
    blind_three: { id: "blind_three", text: "完成 3 局盲测快局", done: (d) => d.blind >= 3, progress: (d) => `${d.blind || 0}/3` },
    trend_one: { id: "trend_one", text: "完成 1 局趋势猎人", done: (d) => d.trend >= 1, progress: (d) => `${d.trend || 0}/1` },
    trap_one: { id: "trap_one", text: "完成 1 局假突破", done: (d) => d.trap >= 1, progress: (d) => `${d.trap || 0}/1` },
    survival_one: { id: "survival_one", text: "完成 1 局暴跌生存", done: (d) => d.survival >= 1, progress: (d) => `${d.survival || 0}/1` },
    revenge_one: { id: "revenge_one", text: "完成 1 局错题复仇", done: (d) => d.revenge >= 1, progress: (d) => `${d.revenge || 0}/1` },
    level_one: { id: "level_one", text: "完成 1 局历史闯关", done: (d) => d.level >= 1, progress: (d) => `${d.level || 0}/1` },
    level_two: { id: "level_two", text: "完成 2 局历史闯关", done: (d) => d.level >= 2, progress: (d) => `${d.level || 0}/2` },
    level_star_one: { id: "level_star_one", text: "历史闯关获得至少 1 星", done: (d) => d.levelStars >= 1, progress: (d) => `${d.levelStars || 0}/1` },
    level_stars_three: { id: "level_stars_three", text: "历史闯关累计获得 3 星", done: (d) => d.levelStars >= 3, progress: (d) => `${d.levelStars || 0}/3` },
    level_three_star: { id: "level_three_star", text: "单局历史闯关达到 3 星", done: (d) => d.levelBestStars >= 3, progress: (d) => `${d.levelBestStars || 0}/3` },
    level_clear_one: { id: "level_clear_one", text: "通过 1 个未通关历史关卡", done: (d) => d.levelClears >= 1, progress: (d) => `${d.levelClears || 0}/1` },
    level_best_improve: { id: "level_best_improve", text: "刷新 1 个历史关卡最佳星级", done: (d) => d.levelBestImproved >= 1, progress: (d) => `${d.levelBestImproved || 0}/1` },
    use_stop: { id: "use_stop", text: "带止损完成 1 局", done: (d) => d.stopUsed >= 1, progress: (d) => `${d.stopUsed || 0}/1` },
    score_70: { id: "score_70", text: "任意一局达到 70 分", done: (d) => d.highScore >= 70, progress: (d) => `${d.highScore || 0}/70` },
    score_75: { id: "score_75", text: "任意一局达到 75 分", done: (d) => d.highScore >= 75, progress: (d) => `${d.highScore || 0}/75` },
    score_80: { id: "score_80", text: "任意一局达到 80 分", done: (d) => d.highScore >= 80, progress: (d) => `${d.highScore || 0}/80` },
    good_flat: { id: "good_flat", text: "用观望拿到 70 分以上", done: (d) => d.goodFlat >= 1, progress: (d) => `${d.goodFlat || 0}/1` },
  };
}

function dailyTaskIdsForDate(dateKey) {
  const definitions = dailyTaskDefinitions();
  const random = seededDailyRandom(`daily-${dateKey}`);
  const pickedLevel = [];
  const levelCandidates = DAILY_LEVEL_TASK_IDS.filter((id) => definitions[id]);
  while (pickedLevel.length < DAILY_LEVEL_TASK_COUNT && levelCandidates.length) {
    const index = Math.floor(random() * levelCandidates.length);
    pickedLevel.push(levelCandidates.splice(index, 1)[0]);
  }

  const pickedRandom = [];
  const candidates = Object.keys(definitions).filter((id) => !DAILY_FIXED_TASK_IDS.includes(id) && !DAILY_LEVEL_TASK_IDS.includes(id));
  while (pickedRandom.length < DAILY_RANDOM_TASK_COUNT && candidates.length) {
    const index = Math.floor(random() * candidates.length);
    pickedRandom.push(candidates.splice(index, 1)[0]);
  }
  return [...DAILY_FIXED_TASK_IDS, ...pickedLevel, ...pickedRandom];
}

function hasDailyLevelTask(taskIds) {
  return Array.isArray(taskIds) && taskIds.some((id) => DAILY_LEVEL_TASK_IDS.includes(id));
}

function createDailyProgress(date = todayKey()) {
  return {
    date,
    completed: 0,
    blind: 0,
    trend: 0,
    trap: 0,
    survival: 0,
    revenge: 0,
    level: 0,
    levelStars: 0,
    levelBestStars: 0,
    levelClears: 0,
    levelBestImproved: 0,
    stopUsed: 0,
    reviewed: 0,
    goodFlat: 0,
    highScore: 0,
    taskIds: dailyTaskIdsForDate(date),
    completedTasks: [],
    taskRewards: {},
    rewardClaimed: false,
    rewardCharacterId: "",
    rewardXp: 0,
    rewardMaterialCharacterId: "",
    rewardMaterialName: "",
  };
}

function createCharacterState() {
  return {
    xp: 0,
    stage: 1,
    materials: 0,
    runs: 0,
    successes: 0,
    trialWindow: [],
    lastGain: "",
  };
}

function createGameProfile() {
  return {
    xp: 0,
    level: 1,
    streak: 0,
    lastPlayedDate: "",
    achievements: [],
    achievementSeenCount: 0,
    recentAchievements: [],
    activeCharacter: "btc_hime",
    characters: Object.fromEntries(CHARACTER_CONFIG.map((character) => [character.id, createCharacterState()])),
    daily: createDailyProgress(),
    dailyHistory: {},
    levelMode: {
      records: {},
      datasets: {},
      lastLevelId: "",
      page: 0,
    },
    stats: {
      completed: 0,
      blind: 0,
      trend: 0,
      trap: 0,
      survival: 0,
      revenge: 0,
      level: 0,
      bestScore: 0,
      goodFlat: 0,
      stopUsed: 0,
      reviewed: 0,
      totalScore: 0,
      dailyRewards: 0,
    },
  };
}

function dailyTasksFor(daily) {
  const definitions = dailyTaskDefinitions();
  const ids = Array.isArray(daily.taskIds) && daily.taskIds.length ? daily.taskIds : dailyTaskIdsForDate(daily.date || todayKey());
  return ids
    .map((id) => definitions[id])
    .filter(Boolean)
    .map((task) => ({
      id: task.id,
      text: task.text,
      done: Boolean(task.done(daily)),
      progress: task.progress(daily),
    }));
}

function snapshotDailyProgress(daily) {
  const tasks = dailyTasksFor(daily);
  return {
    date: daily.date,
    completed: daily.completed || 0,
    blind: daily.blind || 0,
    trend: daily.trend || 0,
    trap: daily.trap || 0,
    survival: daily.survival || 0,
    revenge: daily.revenge || 0,
    level: daily.level || 0,
    levelStars: daily.levelStars || 0,
    levelBestStars: daily.levelBestStars || 0,
    levelClears: daily.levelClears || 0,
    levelBestImproved: daily.levelBestImproved || 0,
    stopUsed: daily.stopUsed || 0,
    reviewed: daily.reviewed || 0,
    goodFlat: daily.goodFlat || 0,
    highScore: daily.highScore || 0,
    doneCount: tasks.filter((task) => task.done).length,
    totalCount: tasks.length,
    taskIds: tasks.map((task) => task.id),
    completedTasks: tasks.filter((task) => task.done).map((task) => task.id),
    taskRewards: daily.taskRewards || {},
    rewardClaimed: Boolean(daily.rewardClaimed),
    rewardCharacterId: daily.rewardCharacterId || "",
    rewardMaterialCharacterId: daily.rewardMaterialCharacterId || "",
    rewardMaterialName: daily.rewardMaterialName || "",
  };
}

function ensureTodayDailyProgress() {
  const profile = state.game.profile;
  const today = todayKey();
  if (profile.daily.date !== today) {
    profile.dailyHistory[profile.daily.date] = snapshotDailyProgress(profile.daily);
    const yesterdayKey = offsetDateKey(today, -1);
    profile.streak = profile.lastPlayedDate === yesterdayKey ? profile.streak : 0;
    profile.daily = createDailyProgress(today);
    profile.dailyHistory[profile.daily.date] = snapshotDailyProgress(profile.daily);
    saveGameProfile();
  } else if (!Array.isArray(profile.daily.taskIds) || !profile.daily.taskIds.length || !hasDailyLevelTask(profile.daily.taskIds)) {
    profile.daily.taskIds = dailyTaskIdsForDate(profile.daily.date);
    profile.dailyHistory[profile.daily.date] = snapshotDailyProgress(profile.daily);
    saveGameProfile();
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function uniqueId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatInterval(ms) {
  if (!ms) return "-";
  if (INTERVAL_LABELS.has(ms)) return INTERVAL_LABELS.get(ms);
  const minutes = ms / 60_000;
  if (minutes < 60) return `${minutes.toFixed(0)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1).replace(/\.0$/, "")}h`;
  const days = hours / 24;
  return `${days.toFixed(1).replace(/\.0$/, "")}d`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortTime(ts) {
  return new Date(ts).toLocaleDateString("zh-CN", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatVisibleTime(ts, index = state.currentIndex) {
  if (state.blindMode && !state.dateRevealed) return `盲测 #${index + 1}`;
  return formatTime(ts);
}

function formatAxisTime(ts, index) {
  if (state.blindMode && !state.dateRevealed) return `#${index + 1}`;
  return formatShortTime(ts);
}

function toLocalInputValue(ts) {
  if (!Number.isFinite(ts)) return "";
  const offset = new Date(ts).getTimezoneOffset() * 60_000;
  return new Date(ts - offset).toISOString().slice(0, 16);
}

function parseNumber(raw) {
  if (raw == null) return NaN;
  const cleaned = String(raw).trim().replace(/^"|"$/g, "").replace(/,/g, "");
  if (!cleaned) return NaN;
  return Number(cleaned);
}

function parseTime(raw) {
  if (raw == null) return NaN;
  const value = String(raw).trim().replace(/^"|"$/g, "");
  if (!value) return NaN;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric > 10_000_000_000_000) return Math.floor(numeric / 1000);
    if (numeric > 10_000_000_000) return Math.floor(numeric);
    return Math.floor(numeric * 1000);
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function splitCsvLine(line, delimiter) {
  const cells = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

function detectDelimiter(line) {
  const candidates = [",", "\t", ";"];
  let best = ",";
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = splitCsvLine(line, candidate).length;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function normalizeHeader(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, "")
    .replace(/[\s-]+/g, "_");
}

function findHeaderIndex(headers, names) {
  return headers.findIndex((header) => names.includes(header));
}

function parseCsv(text) {
  const normalizedText = text.replace(/^\ufeff/, "");
  const lines = normalizedText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return [];

  const delimiter = detectDelimiter(lines[0]);
  const first = splitCsvLine(lines[0], delimiter);
  const headers = first.map(normalizeHeader);
  const hasHeader =
    findHeaderIndex(headers, ["open", "o"]) >= 0 &&
    findHeaderIndex(headers, ["high", "h"]) >= 0 &&
    findHeaderIndex(headers, ["low", "l"]) >= 0 &&
    findHeaderIndex(headers, ["close", "c"]) >= 0;

  let startLine = 0;
  let timeIndex = 0;
  let openIndex = 1;
  let highIndex = 2;
  let lowIndex = 3;
  let closeIndex = 4;
  let volumeIndex = 5;

  if (hasHeader) {
    startLine = 1;
    timeIndex = findHeaderIndex(headers, [
      "timestamp",
      "time",
      "date",
      "datetime",
      "open_time",
      "opentime",
      "open_time_ms",
    ]);
    openIndex = findHeaderIndex(headers, ["open", "o"]);
    highIndex = findHeaderIndex(headers, ["high", "h"]);
    lowIndex = findHeaderIndex(headers, ["low", "l"]);
    closeIndex = findHeaderIndex(headers, ["close", "c"]);
    volumeIndex = findHeaderIndex(headers, ["volume", "vol", "v"]);
  }

  if (timeIndex < 0 || openIndex < 0 || highIndex < 0 || lowIndex < 0 || closeIndex < 0) {
    throw new Error("CSV 需要包含 time/open/high/low/close 列。");
  }

  const byTime = new Map();
  for (let i = startLine; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i], delimiter);
    const time = parseTime(cells[timeIndex]);
    const open = parseNumber(cells[openIndex]);
    const high = parseNumber(cells[highIndex]);
    const low = parseNumber(cells[lowIndex]);
    const close = parseNumber(cells[closeIndex]);
    const volume = volumeIndex >= 0 ? parseNumber(cells[volumeIndex]) : 0;

    if (
      Number.isFinite(time) &&
      Number.isFinite(open) &&
      Number.isFinite(high) &&
      Number.isFinite(low) &&
      Number.isFinite(close)
    ) {
      byTime.set(time, {
        time,
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) ? volume : 0,
      });
    }
  }

  return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

function parseBinaryCandles(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 16) {
    throw new Error("二进制 K线缓存无效。");
  }
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const version = view.getUint32(4, true);
  const count = view.getUint32(8, true);
  const columns = view.getUint32(12, true);
  if (magic !== BINARY_CANDLE_MAGIC || version !== 1 || columns !== 6) {
    throw new Error("二进制 K线缓存格式不兼容。");
  }
  const expectedBytes = 16 + count * columns * Float64Array.BYTES_PER_ELEMENT;
  if (buffer.byteLength < expectedBytes) {
    throw new Error("二进制 K线缓存不完整。");
  }

  const values = new Float64Array(buffer, 16, count * columns);
  const candles = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const base = i * columns;
    candles[i] = {
      time: values[base],
      open: values[base + 1],
      high: values[base + 2],
      low: values[base + 3],
      close: values[base + 4],
      volume: values[base + 5],
    };
  }
  return candles;
}

function detectSourceInterval(candles) {
  const diffs = [];
  const limit = Math.min(candles.length - 1, 5000);
  for (let i = 1; i <= limit; i += 1) {
    const diff = candles[i].time - candles[i - 1].time;
    if (diff > 0) diffs.push(diff);
  }
  if (!diffs.length) return 0;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}

function countGaps(candles, intervalMs) {
  if (!intervalMs) return 0;
  let gaps = 0;
  for (let i = 1; i < candles.length; i += 1) {
    if (candles[i].time - candles[i - 1].time > intervalMs * 1.5) gaps += 1;
  }
  return gaps;
}

function aggregateCandles(source, targetMs) {
  if (!source.length) return [];
  if (!targetMs || targetMs <= 0) return source.slice();
  const sourceMs = state.sourceIntervalMs || detectSourceInterval(source);
  if (sourceMs && targetMs <= sourceMs * 1.05) return source.slice();

  const aggregated = [];
  let bucket = null;
  for (const candle of source) {
    const bucketTime = Math.floor(candle.time / targetMs) * targetMs;
    if (!bucket || bucket.time !== bucketTime) {
      bucket = {
        time: bucketTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      };
      aggregated.push(bucket);
    } else {
      bucket.high = Math.max(bucket.high, candle.high);
      bucket.low = Math.min(bucket.low, candle.low);
      bucket.close = candle.close;
      bucket.volume += candle.volume;
    }
  }
  return aggregated;
}

function findIndexAtOrBefore(candles, time) {
  let lo = 0;
  let hi = candles.length - 1;
  let answer = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (candles[mid].time <= time) {
      answer = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return answer;
}

function findIndexAtOrAfter(candles, time) {
  let lo = 0;
  let hi = candles.length - 1;
  let answer = candles.length;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (candles[mid].time >= time) {
      answer = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return answer;
}

function selectedTags() {
  return Array.from(document.querySelectorAll(".tag-grid input:checked")).map((input) => input.value);
}

function setSelectedTags(tags) {
  document.querySelectorAll(".tag-grid input").forEach((input) => {
    input.checked = tags.includes(input.value);
  });
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.style.display = "block";
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.style.display = "none";
  }, 2400);
}

function saveSettings() {
  const settings = {
    timeframe: els.timeframeSelect.value,
    hideFuture: state.hideFuture,
    blindMode: state.blindMode,
    logScale: state.logScale,
    showMA20: state.showMA20,
    showMA60: state.showMA60,
    brandAvatarChoice: state.brandAvatarChoice,
    initialCash: Number(els.initialCashInput.value) || 10_000,
    fee: Number(els.feeInput.value) || 0,
    riskPct: Number(els.riskPctInput.value) || 1,
  };
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  } catch {
    // Local files can occasionally be opened with storage disabled.
  }
}

function normalizeGameProfile(profile) {
  const base = createGameProfile();
  const merged = {
    ...base,
    ...(profile || {}),
    stats: { ...base.stats, ...(profile?.stats || {}) },
    daily: { ...base.daily, ...(profile?.daily || {}) },
    dailyHistory: { ...base.dailyHistory, ...(profile?.dailyHistory || {}) },
    levelMode: { ...base.levelMode, ...(profile?.levelMode || {}) },
    characters: { ...base.characters, ...(profile?.characters || {}) },
  };
  if (!merged.dailyHistory || typeof merged.dailyHistory !== "object" || Array.isArray(merged.dailyHistory)) {
    merged.dailyHistory = {};
  }
  if (!merged.levelMode || typeof merged.levelMode !== "object" || Array.isArray(merged.levelMode)) {
    merged.levelMode = createGameProfile().levelMode;
  }
  if (!merged.levelMode.records || typeof merged.levelMode.records !== "object" || Array.isArray(merged.levelMode.records)) {
    merged.levelMode.records = {};
  }
  if (!merged.levelMode.datasets || typeof merged.levelMode.datasets !== "object" || Array.isArray(merged.levelMode.datasets)) {
    merged.levelMode.datasets = {};
  }
  for (const [key, bucket] of Object.entries(merged.levelMode.datasets)) {
    merged.levelMode.datasets[key] = normalizeLevelModeBucket(bucket, key);
  }
  if (merged.daily.date !== todayKey()) {
    merged.dailyHistory[merged.daily.date] = snapshotDailyProgress(merged.daily);
    const yesterdayKey = offsetDateKey(todayKey(), -1);
    merged.streak = merged.lastPlayedDate === yesterdayKey ? merged.streak : 0;
    merged.daily = createDailyProgress();
  }
  merged.daily = { ...createDailyProgress(merged.daily.date), ...merged.daily };
  if (!Array.isArray(merged.daily.taskIds) || !merged.daily.taskIds.length || !hasDailyLevelTask(merged.daily.taskIds)) {
    merged.daily.taskIds = dailyTaskIdsForDate(merged.daily.date);
  }
  if (!merged.daily.taskRewards || typeof merged.daily.taskRewards !== "object" || Array.isArray(merged.daily.taskRewards)) {
    merged.daily.taskRewards = {};
  }
  merged.dailyHistory[merged.daily.date] = snapshotDailyProgress(merged.daily);
  merged.achievementSeenCount = Number.isFinite(merged.achievementSeenCount) ? merged.achievementSeenCount : 0;
  merged.achievements = Array.isArray(merged.achievements) ? merged.achievements : [];
  merged.recentAchievements = Array.isArray(merged.recentAchievements) ? merged.recentAchievements : [];
  if (!CHARACTER_CONFIG.some((character) => character.id === merged.activeCharacter)) {
    merged.activeCharacter = CHARACTER_CONFIG[0].id;
  }
  for (const character of CHARACTER_CONFIG) {
    merged.characters[character.id] = {
      ...createCharacterState(),
      ...(merged.characters[character.id] || {}),
    };
    if (!Array.isArray(merged.characters[character.id].trialWindow)) {
      merged.characters[character.id].trialWindow = [];
    }
  }
  merged.level = levelFromXp(merged.xp);
  return merged;
}

function loadGameProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.profile);
    state.game.profile = normalizeGameProfile(raw ? JSON.parse(raw) : null);
  } catch {
    state.game.profile = createGameProfile();
  }
}

function saveGameProfile() {
  try {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(state.game.profile));
  } catch {
    // Ignore storage failures in private browsing or restricted local contexts.
  }
}

function loadChatHistories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.chats);
    const histories = raw ? JSON.parse(raw) : {};
    state.chat.histories = histories && typeof histories === "object" && !Array.isArray(histories) ? histories : {};
  } catch {
    state.chat.histories = {};
  }
}

function saveChatHistories() {
  try {
    localStorage.setItem(STORAGE_KEYS.chats, JSON.stringify(state.chat.histories));
  } catch {
    // Chat history is nice-to-have; ignore storage failures.
  }
}

function levelFromXp(xp) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 120)) + 1);
}

function xpForLevel(level) {
  return Math.pow(Math.max(0, level - 1), 2) * 120;
}

function characterById(id) {
  return CHARACTER_CONFIG.find((character) => character.id === id) || CHARACTER_CONFIG[0];
}

function activeCharacter() {
  return characterById(state.game.profile.activeCharacter);
}

function characterLevelFromXp(xp, stage) {
  const rawLevel = Math.floor(Math.sqrt(Math.max(0, xp) / 55)) + 1;
  return clamp(rawLevel, 1, stage * 20);
}

function characterXpForLevel(level) {
  return Math.pow(Math.max(0, level - 1), 2) * 55;
}

function stageName(stage) {
  return ["一阶", "二阶", "三阶", "四阶", "终阶"][clamp(stage, 1, 5) - 1];
}

function characterImagePath(character) {
  return `./character/${encodeURIComponent(character.file)}`;
}

function brandAvatarSrc(choice = state.brandAvatarChoice) {
  if (choice === "icon") return "./icon/icon2.png";
  const character = choice === "active" ? activeCharacter() : characterById(choice);
  return characterImagePath(character);
}

function pickCharacterQuote(character) {
  const quotes = character.quotes?.length ? character.quotes : [character.quote || ""];
  return quotes[Math.floor(Math.random() * quotes.length)] || "";
}

function activeCharacterQuote(character) {
  if (state.game.activeQuoteCharacterId !== character.id || !state.game.activeQuote) {
    state.game.activeQuoteCharacterId = character.id;
    state.game.activeQuote = pickCharacterQuote(character);
  }
  return state.game.activeQuote;
}

function cleanDatasetFileName(fileName = state.fileName) {
  return String(fileName || "")
    .replace(/（.*?）/g, "")
    .replace(/\s*\(.*?\)\s*/g, "")
    .split(/[\\/]/)
    .pop()
    .trim();
}

function currentLevelDatasetInfo() {
  const fileName = cleanDatasetFileName();
  const upperName = fileName.toUpperCase();
  const matched = upperName.match(/([A-Z0-9]{3,24})[-_ ]?(\d+[MHDW])/);
  if (matched) {
    const symbol = matched[1];
    const interval = matched[2].toLowerCase();
    return {
      key: `csv:${symbol.toLowerCase()}-${interval}`,
      label: `${symbol} ${interval}`,
    };
  }

  const interval = formatInterval(state.sourceIntervalMs || state.timeframeMs || LEVEL_MODE_INTERVAL_MS);
  const baseName = (fileName || "未命名 CSV").replace(/\.[^.]+$/, "");
  const keyName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return {
    key: `csv:${keyName || "unnamed"}-${interval.toLowerCase()}`,
    label: `${baseName || "未命名 CSV"} ${interval}`,
  };
}

function normalizeLevelModeBucket(bucket = {}, key = "", label = "") {
  const records = bucket.records && typeof bucket.records === "object" && !Array.isArray(bucket.records) ? bucket.records : {};
  const page = Number(bucket.page);
  return {
    key: bucket.key || key,
    label: bucket.label || label || key || "未命名数据",
    records,
    lastLevelId: bucket.lastLevelId || "",
    page: Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0,
    createdAt: bucket.createdAt || Date.now(),
    updatedAt: bucket.updatedAt || bucket.createdAt || Date.now(),
  };
}

function hasLevelRecords(records) {
  return Boolean(records && typeof records === "object" && !Array.isArray(records) && Object.keys(records).length);
}

function levelModeForDataset(key = currentLevelDatasetInfo().key, label = currentLevelDatasetInfo().label) {
  const levelMode = state.game.profile.levelMode;
  if (!levelMode.datasets || typeof levelMode.datasets !== "object" || Array.isArray(levelMode.datasets)) {
    levelMode.datasets = {};
  }

  if (!levelMode.datasets[key]) {
    const shouldAttachLegacyRecords =
      key === "csv:btcusdt-15m" &&
      !levelMode.legacyDatasetKey &&
      hasLevelRecords(levelMode.records);
    levelMode.datasets[key] = normalizeLevelModeBucket(
      {
        key,
        label,
        records: shouldAttachLegacyRecords ? { ...levelMode.records } : {},
        lastLevelId: shouldAttachLegacyRecords ? levelMode.lastLevelId || "" : "",
        page: shouldAttachLegacyRecords ? levelMode.page || 0 : 0,
      },
      key,
      label,
    );
    if (shouldAttachLegacyRecords) levelMode.legacyDatasetKey = key;
  }

  levelMode.datasets[key] = normalizeLevelModeBucket(levelMode.datasets[key], key, label);
  levelMode.datasets[key].label = label;
  return levelMode.datasets[key];
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return;
    const settings = JSON.parse(raw);
    if (settings.timeframe) els.timeframeSelect.value = settings.timeframe;
    state.hideFuture = settings.hideFuture ?? state.hideFuture;
    state.blindMode = settings.blindMode ?? state.blindMode;
    state.logScale = settings.logScale ?? state.logScale;
    state.showMA20 = settings.showMA20 ?? state.showMA20;
    state.showMA60 = settings.showMA60 ?? state.showMA60;
    state.brandAvatarChoice = settings.brandAvatarChoice ?? state.brandAvatarChoice;
    els.initialCashInput.value = settings.initialCash ?? 10_000;
    els.feeInput.value = settings.fee ?? 0.0004;
    els.riskPctInput.value = settings.riskPct ?? 1;
  } catch {
    // Ignore invalid saved settings.
  }
}

function syncSettingControls() {
  if (els.brandAvatarSelect.options.length <= 2) {
    els.brandAvatarSelect.insertAdjacentHTML(
      "beforeend",
      CHARACTER_CONFIG.map((character) => `<option value="${character.id}">${escapeHtml(character.name)}</option>`).join(""),
    );
  }
  els.hideFutureToggle.checked = state.hideFuture;
  els.blindModeToggle.checked = state.blindMode;
  els.logScaleToggle.checked = state.logScale;
  els.ma20Toggle.checked = state.showMA20;
  els.ma60Toggle.checked = state.showMA60;
  els.brandAvatarSelect.value = state.brandAvatarChoice;
  els.brandAvatar.src = brandAvatarSrc();
}

function readSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.sessions);
    const sessions = raw ? JSON.parse(raw) : [];
    return Array.isArray(sessions) ? sessions : [];
  } catch {
    return [];
  }
}

function writeSessions(sessions) {
  localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));
}

function refreshSessionSelect() {
  const sessions = readSessions().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  els.sessionSelect.innerHTML =
    sessions
      .map((session) => {
        const name = session.name || "未命名训练";
        const saved = session.savedAt ? formatTime(session.savedAt) : "";
        return `<option value="${session.id}">${escapeHtml(name)} - ${escapeHtml(saved)}</option>`;
      })
      .join("") || '<option value="">暂无已保存会话</option>';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyTimeframe(keepTime, forcedTime = null) {
  if (!state.sourceCandles.length) return;
  const selected = els.timeframeSelect.value;
  let targetMs = selected === "source" ? state.sourceIntervalMs : Number(selected);
  if (state.sourceIntervalMs && targetMs < state.sourceIntervalMs * 0.95) {
    targetMs = state.sourceIntervalMs;
    els.timeframeSelect.value = "source";
  }

  const currentTime =
    forcedTime ??
    (keepTime && state.candles[state.currentIndex]
      ? state.candles[state.currentIndex].time
      : state.sourceCandles[Math.min(300, state.sourceCandles.length - 1)].time);

  state.timeframeMs = targetMs;
  state.candles = aggregateCandles(state.sourceCandles, targetMs);
  state.currentIndex = clamp(findIndexAtOrBefore(state.candles, currentTime), 0, state.candles.length - 1);
  if (!keepTime && forcedTime == null) {
    state.currentIndex = Math.min(300, state.candles.length - 1);
  }
  centerOnCurrent(220);
  syncTimeline();
  saveSettings();
  render();
}

function loadCandles(candles, fileName) {
  if (!candles.length) {
    setStatus("没有解析到有效 K线。");
    return;
  }
  stopPlayback();
  state.sourceCandles = candles;
  state.sourceIntervalMs = detectSourceInterval(candles);
  state.sourceGaps = countGaps(candles, state.sourceIntervalMs);
  state.fileName = fileName;
  state.account = createAccount(Number(els.initialCashInput.value) || 10_000);
  state.bookmarks = [];
  state.annotations = [];
  state.game.active = null;
  state.game.externalAccount = null;
  state.game.settling = false;
  els.sessionNotesInput.value = "";
  els.bookmarkInput.value = "";
  els.tradeReasonInput.value = "";
  els.stopLossInput.value = "";
  els.takeProfitInput.value = "";
  state.dateRevealed = false;

  if (state.sourceIntervalMs && state.sourceIntervalMs <= 900_000) {
    els.timeframeSelect.value = "900000";
  } else {
    els.timeframeSelect.value = "source";
  }

  els.placeholder.style.display = "none";
  applyTimeframe(false);
  showToast(`已导入 ${candles.length.toLocaleString("en-US")} 根 K线`);
}

async function autoLoadDefaultCsv() {
  if (state.sourceCandles.length) return;
  if (window.location.protocol === "file:") {
    setStatus("双击 HTML 时浏览器不能自动读取本地 CSV；用 start_app.py 打开可自动导入。");
    return;
  }

  try {
    setStatus("正在快速导入 data/BTCUSDT-15m.bin ...");
    const binaryResponse = await fetch(DEFAULT_BINARY_DATA_URL, { cache: "no-store" });
    if (binaryResponse.ok) {
      const buffer = await binaryResponse.arrayBuffer();
      const candles = parseBinaryCandles(buffer);
      loadCandles(candles, "BTCUSDT-15m.csv（快速缓存）");
      return;
    }
  } catch (error) {
    console.warn("Default binary cache auto-load failed:", error);
  }

  try {
    setStatus("正在自动导入 data/BTCUSDT-15m.csv ...");
    const response = await fetch(DEFAULT_DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const candles = parseCsv(text);
    loadCandles(candles, "BTCUSDT-15m.csv（自动导入）");
  } catch (error) {
    setStatus("自动导入失败，可以手动选择 CSV。");
    console.warn("Default CSV auto-load failed:", error);
  }
}

function setStatus(message) {
  els.datasetInfo.textContent = message;
}

function syncTimeline() {
  const max = Math.max(0, state.candles.length - 1);
  els.timeline.max = String(max);
  els.timeline.value = String(clamp(state.currentIndex, 0, max));
  const candle = state.candles[state.currentIndex];
  if (candle && (!state.blindMode || state.dateRevealed)) {
    els.jumpInput.value = toLocalInputValue(candle.time);
    els.jumpInput.disabled = false;
    els.jumpBtn.disabled = false;
  } else {
    els.jumpInput.value = "";
    els.jumpInput.disabled = state.blindMode && !state.dateRevealed;
    els.jumpBtn.disabled = state.blindMode && !state.dateRevealed;
  }
}

function maxChartIndex() {
  if (!state.candles.length) return 0;
  return state.hideFuture ? state.currentIndex : state.candles.length - 1;
}

function clampView(start, end) {
  const count = state.candles.length;
  if (!count) {
    state.viewStart = 0;
    state.viewEnd = 0;
    return;
  }
  const maxEnd = maxChartIndex() + 1;
  const minWidth = Math.min(20, maxEnd);
  const maxWidth = Math.max(minWidth, maxEnd);
  let width = clamp(Math.round(end - start), minWidth, maxWidth);
  let nextStart = Math.round(start);
  let nextEnd = nextStart + width;

  if (nextEnd > maxEnd) {
    nextEnd = maxEnd;
    nextStart = nextEnd - width;
  }
  if (nextStart < 0) {
    nextStart = 0;
    nextEnd = Math.min(maxEnd, nextStart + width);
  }
  if (nextEnd <= nextStart) nextEnd = Math.min(maxEnd, nextStart + 1);

  state.viewStart = nextStart;
  state.viewEnd = nextEnd;
}

function centerOnCurrent(width = 220) {
  if (!state.candles.length) return;
  const actualWidth = Math.min(width, maxChartIndex() + 1);
  const end = state.currentIndex + 1;
  clampView(end - actualWidth, end);
}

function ensureCurrentVisible() {
  if (!state.candles.length) return;
  const width = Math.max(20, state.viewEnd - state.viewStart || 220);
  if (state.currentIndex < state.viewStart + 4 || state.currentIndex >= state.viewEnd - 4) {
    clampView(state.currentIndex + 1 - width, state.currentIndex + 1);
  } else if (state.hideFuture && state.viewEnd > state.currentIndex + 1) {
    clampView(state.viewStart, state.currentIndex + 1);
  }
}

function revealTo(index, recenter = false) {
  if (!state.candles.length) return;
  const previous = state.currentIndex;
  const target = clamp(index, 0, state.candles.length - 1);
  state.currentIndex = target;
  if (target > previous) {
    const triggerIndex = checkAutoExit(previous + 1, target);
    if (triggerIndex != null) state.currentIndex = triggerIndex;
  }
  if (recenter) {
    state.followCurrent = true;
    centerOnCurrent(state.viewEnd - state.viewStart || 220);
  } else if (state.followCurrent || state.hideFuture) {
    ensureCurrentVisible();
  }
  syncTimeline();
  render();
  if (state.game.active && !state.game.settling && state.currentIndex >= state.game.active.endIndex) {
    finishChallenge("auto");
    return;
  }
}

function stepBy(delta) {
  revealTo(state.currentIndex + delta, false);
}

function startPlayback() {
  if (!state.candles.length || state.isPlaying) return;
  state.isPlaying = true;
  state.followCurrent = true;
  els.playBtn.textContent = "暂停";
  const tick = () => {
    if (state.currentIndex >= state.candles.length - 1) {
      stopPlayback();
      return;
    }
    stepBy(1);
  };
  state.timer = window.setInterval(tick, Math.max(20, 1000 / Number(els.speedSelect.value || 1)));
}

function stopPlayback() {
  if (state.timer) window.clearInterval(state.timer);
  state.timer = null;
  state.isPlaying = false;
  els.playBtn.textContent = "播放";
}

function togglePlayback() {
  if (state.isPlaying) stopPlayback();
  else startPlayback();
}

function resetPlaybackTimer() {
  if (!state.isPlaying) return;
  stopPlayback();
  startPlayback();
}

function resetAccount(shouldRender = true) {
  const initial = Number(els.initialCashInput.value);
  state.account = createAccount(Number.isFinite(initial) && initial > 0 ? initial : 10_000);
  els.stopLossInput.value = "";
  els.takeProfitInput.value = "";
  saveSettings();
  if (shouldRender) render();
}

function feeRate() {
  const value = Number(els.feeInput.value);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function currentCandle() {
  return state.candles[state.currentIndex] || null;
}

function accountEquity(price) {
  return state.account.cash + state.account.btc * price;
}

function activeStopFromInput() {
  const value = Number(els.stopLossInput.value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function activeTakeFromInput() {
  const value = Number(els.takeProfitInput.value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function setStopsFromInputs() {
  state.account.stopPrice = activeStopFromInput();
  state.account.takePrice = activeTakeFromInput();
  render();
  showToast("已更新止损止盈线");
}

function clearStops() {
  state.account.stopPrice = null;
  state.account.takePrice = null;
  els.stopLossInput.value = "";
  els.takeProfitInput.value = "";
  render();
  showToast("已清除风控线");
}

function tradeCommon(extra = {}) {
  const candle = currentCandle();
  return {
    id: uniqueId("trade"),
    time: extra.time ?? candle?.time ?? Date.now(),
    reason: extra.reason ?? els.tradeReasonInput.value.trim(),
    tags: extra.tags ?? selectedTags(),
    stopPrice: extra.stopPrice ?? state.account.stopPrice,
    takePrice: extra.takePrice ?? state.account.takePrice,
    auto: Boolean(extra.auto),
  };
}

function activeChallengeTrades() {
  const startTime = state.game.active?.startTime ?? -Infinity;
  return state.account.trades.filter((trade) => trade.time >= startTime);
}

function hasTradeReason() {
  return Boolean(els.tradeReasonInput.value.trim() || els.sessionNotesInput.value.trim() || els.bookmarkInput.value.trim());
}

function isOpeningTrade(side) {
  return side === "buy" || side === "short";
}

function validStopForSide(side, price, stopPrice) {
  if (!stopPrice || !Number.isFinite(price)) return false;
  if (side === "buy") return stopPrice < price;
  if (side === "short") return stopPrice > price;
  return false;
}

function validTakeForSide(side, price, takePrice) {
  if (!takePrice || !Number.isFinite(price)) return false;
  if (side === "buy") return takePrice > price;
  if (side === "short") return takePrice < price;
  return false;
}

function plannedEntryFraction(side, options, price) {
  const equity = accountEquity(price);
  if (!Number.isFinite(equity) || equity <= 0) return 0;
  if (side === "buy") {
    const spend = options.spend ?? state.account.cash * (options.pct ?? 0);
    return spend / equity;
  }
  if (side === "short") {
    const notional = options.notional ?? equity * (options.pct ?? 0);
    return notional / equity;
  }
  return 0;
}

function validateCharacterTrade(side, options = {}) {
  if (options.auto || options.skipCharacterRules) return true;
  if (!state.game.active) return true;

  const character = activeCharacter();
  const price = options.price ?? currentCandle()?.close;
  const stopPrice = options.stopPrice ?? activeStopFromInput() ?? state.account.stopPrice;
  const takePrice = options.takePrice ?? activeTakeFromInput() ?? state.account.takePrice;
  const opening = isOpeningTrade(side);
  const stopOk = opening && validStopForSide(side, price, stopPrice);
  const takeOk = opening && validTakeForSide(side, price, takePrice);
  const reasonOk = hasTradeReason();
  const trades = activeChallengeTrades();
  const activeEntries = trades.filter((trade) => isOpeningTrade(trade.side) && !trade.auto);

  if (character.id === "btc_hime") {
    if (side === "short") {
      showToast(`${character.name}：这局只练多头，不开空。`);
      return false;
    }
    if (side === "buy" && !reasonOk) {
      showToast(`${character.name}：看多前先写一句理由。`);
      return false;
    }
  }

  if (character.id === "ember_keeper" && opening) {
    if (activeEntries.length >= 2) {
      showToast(`${character.name}：今天轻量训练，这局最多两次主动开仓。`);
      return false;
    }
    if (plannedEntryFraction(side, options, price) > 0.5) {
      showToast(`${character.name}：别一口气冲满，单次开仓最多 50% 权益。`);
      return false;
    }
  }

  if (character.id === "white_saint" && opening && !stopOk) {
    showToast(`${character.name}：没有有效止损，不准入场。多单止损低于现价，空单止损高于现价。`);
    return false;
  }

  if (character.id === "gentle_queen") {
    if (side === "buy") {
      showToast(`${character.name}：这局只审判空头机会，不开多。`);
      return false;
    }
    if (side === "short" && !takeOk) {
      showToast(`${character.name}：空单先写好低于现价的止盈目标。`);
      return false;
    }
  }

  if (character.id === "clear_eye" && opening) {
    if (!state.game.active.bias) {
      showToast(`${character.name}：先选看多、看空或观望，再决定要不要动手。`);
      return false;
    }
    if (state.game.active.bias === "flat") {
      showToast(`${character.name}：你选了观望，这局就练不出手。`);
      return false;
    }
    if ((state.game.active.bias === "long" && side !== "buy") || (state.game.active.bias === "short" && side !== "short")) {
      showToast(`${character.name}：开仓方向必须和你先选的判断一致。`);
      return false;
    }
    if (activeEntries.length >= 1) {
      showToast(`${character.name}：这局只允许一次主动开仓，练少交易。`);
      return false;
    }
  }

  if (character.id === "kind_saint" && opening) {
    if (!reasonOk) {
      showToast(`${character.name}：先写理由，交易才有复盘价值。`);
      return false;
    }
    if (!selectedTags().length) {
      showToast(`${character.name}：至少勾选一个复盘标签，再开仓。`);
      return false;
    }
  }

  if (character.id === "green_eth" && opening && (!stopOk || !takeOk)) {
    showToast(`${character.name}：高波动局必须同时设置有效止损和止盈。`);
    return false;
  }
  return true;
}

function executeTrade(side, pct, options = {}) {
  const candle = currentCandle();
  if (!candle && options.price == null) return null;
  const price = options.price ?? candle.close;
  const fee = feeRate();
  const currentSide = positionSide();
  let action = side;
  if (side === "buy" && currentSide === "short") action = "cover";
  if (side === "sell" && currentSide !== "long") {
    if (!options.auto) showToast("当前没有多头仓位可卖，开空请用空单按钮。");
    return null;
  }
  if (side === "short" && currentSide === "long") {
    if (!options.auto) showToast("先平多仓，再开空。");
    return null;
  }
  if (!validateCharacterTrade(action, { ...options, pct, price })) return null;
  const common = tradeCommon(options);

  if (action === "buy") {
    const requestedSpend = options.spend ?? state.account.cash * pct;
    const spend = clamp(requestedSpend, 0, state.account.cash);
    if (spend <= 0 || price <= 0) return null;
    const feeCost = spend * fee;
    const qty = (spend - feeCost) / price;
    const stopPrice = options.stopPrice ?? activeStopFromInput() ?? state.account.stopPrice;
    const takePrice = options.takePrice ?? activeTakeFromInput() ?? state.account.takePrice;
    const riskAmount = stopPrice && stopPrice < price ? qty * (price - stopPrice) : 0;

    state.account.cash -= spend;
    state.account.btc += qty;
    state.account.positionCost += spend;
    state.account.positionRisk += riskAmount;
    state.account.stopPrice = stopPrice;
    state.account.takePrice = takePrice;

    const trade = {
      ...common,
      side: action,
      price,
      qty,
      fee: feeCost,
      spend,
      stopPrice,
      takePrice,
      riskAmount,
      realizedPnl: null,
      r: null,
      cash: state.account.cash,
      btc: state.account.btc,
      equity: accountEquity(price),
    };
    state.account.trades.push(trade);
    if (!options.skipRender) render();
    return trade;
  }

  if (action === "short") {
    const equity = Math.max(0, accountEquity(price));
    const gross = options.notional ?? equity * pct;
    if (gross <= 0 || price <= 0) return null;
    const qty = gross / price;
    const feeCost = gross * fee;
    const proceeds = gross - feeCost;
    const stopPrice = options.stopPrice ?? activeStopFromInput() ?? state.account.stopPrice;
    const takePrice = options.takePrice ?? activeTakeFromInput() ?? state.account.takePrice;
    const riskAmount = stopPrice && stopPrice > price ? qty * (stopPrice - price) : 0;

    state.account.cash += proceeds;
    state.account.btc -= qty;
    state.account.positionCost += proceeds;
    state.account.positionRisk += riskAmount;
    state.account.stopPrice = stopPrice;
    state.account.takePrice = takePrice;

    const trade = {
      ...common,
      side: action,
      price,
      qty,
      fee: feeCost,
      gross,
      proceeds,
      stopPrice,
      takePrice,
      riskAmount,
      realizedPnl: null,
      r: null,
      cash: state.account.cash,
      btc: state.account.btc,
      equity: accountEquity(price),
    };
    state.account.trades.push(trade);
    if (!options.skipRender) render();
    return trade;
  }

  if (action === "sell") {
    const qty = clamp(options.qty ?? state.account.btc * pct, 0, state.account.btc);
    if (qty <= 0 || price <= 0) return null;
    const btcBefore = state.account.btc;
    const gross = qty * price;
    const feeCost = gross * fee;
    const proceeds = gross - feeCost;
    const fraction = btcBefore > 0 ? qty / btcBefore : 1;
    const costBasis = state.account.positionCost * fraction;
    const riskBasis = state.account.positionRisk * fraction;
    const realizedPnl = proceeds - costBasis;

    state.account.cash += proceeds;
    state.account.btc -= qty;
    state.account.positionCost = Math.max(0, state.account.positionCost - costBasis);
    state.account.positionRisk = Math.max(0, state.account.positionRisk - riskBasis);
    if (state.account.btc < POSITION_EPSILON) {
      state.account.btc = 0;
      state.account.positionCost = 0;
      state.account.positionRisk = 0;
      clearAccountRiskLines();
    }

    const trade = {
      ...common,
      side: action,
      price,
      qty,
      fee: feeCost,
      gross,
      proceeds,
      costBasis,
      riskAmount: riskBasis,
      realizedPnl,
      r: riskBasis > 0 ? realizedPnl / riskBasis : null,
      cash: state.account.cash,
      btc: state.account.btc,
      equity: accountEquity(price),
    };
    state.account.trades.push(trade);
    if (!options.skipRender) render();
    return trade;
  }

  if (action === "cover") {
    if (positionSide() !== "short") return null;
    const shortQty = Math.abs(state.account.btc);
    const qty = clamp(options.qty ?? shortQty * pct, 0, shortQty);
    if (qty <= 0 || price <= 0) return null;
    const gross = qty * price;
    const feeCost = gross * fee;
    const coverCost = gross + feeCost;
    const fraction = shortQty > 0 ? qty / shortQty : 1;
    const costBasis = state.account.positionCost * fraction;
    const riskBasis = state.account.positionRisk * fraction;
    const realizedPnl = costBasis - coverCost;

    state.account.cash -= coverCost;
    state.account.btc += qty;
    state.account.positionCost = Math.max(0, state.account.positionCost - costBasis);
    state.account.positionRisk = Math.max(0, state.account.positionRisk - riskBasis);
    if (Math.abs(state.account.btc) < POSITION_EPSILON) {
      state.account.btc = 0;
      state.account.positionCost = 0;
      state.account.positionRisk = 0;
      clearAccountRiskLines();
    }

    const trade = {
      ...common,
      side: action,
      price,
      qty,
      fee: feeCost,
      gross,
      coverCost,
      costBasis,
      riskAmount: riskBasis,
      realizedPnl,
      r: riskBasis > 0 ? realizedPnl / riskBasis : null,
      cash: state.account.cash,
      btc: state.account.btc,
      equity: accountEquity(price),
    };
    state.account.trades.push(trade);
    if (!options.skipRender) render();
    return trade;
  }

  return null;
}

function closePosition(options = {}) {
  const side = positionSide();
  if (side === "flat") {
    showToast("当前没有持仓。");
    return null;
  }
  const trade =
    side === "long"
      ? executeTrade("sell", 1, { reason: options.reason ?? "手动平仓", skipCharacterRules: true })
      : executeTrade("cover", 1, { reason: options.reason ?? "手动平空", skipCharacterRules: true });
  if (trade) showToast(`已平${positionSideLabel(side)}仓`);
  return trade;
}

function executeRiskBuy() {
  const candle = currentCandle();
  if (!candle) return;
  if (positionSide() === "short") {
    showToast("先平空仓，再按风险买入。");
    return;
  }
  const stopPrice = activeStopFromInput();
  if (!stopPrice || stopPrice >= candle.close) {
    showToast("按风险买入需要填写低于当前价的止损价");
    return;
  }
  const takePrice = activeTakeFromInput();
  const riskPct = Number(els.riskPctInput.value);
  const equity = accountEquity(candle.close);
  const riskAmount = equity * (Number.isFinite(riskPct) ? riskPct : 1) / 100;
  const qty = riskAmount / (candle.close - stopPrice);
  const spend = qty * candle.close / Math.max(0.000001, 1 - feeRate());
  const trade = executeTrade("buy", 0, {
    spend,
    stopPrice,
    takePrice,
    reason: els.tradeReasonInput.value.trim() || `按 ${riskPct || 1}% 风险买入`,
  });
  if (trade) showToast(`已按风险买入，理论风险约 $${money.format(trade.riskAmount)}`);
}

function checkAutoExit(fromIndex, toIndex) {
  const side = positionSide();
  if (side === "flat") return null;
  const stopPrice = state.account.stopPrice;
  const takePrice = state.account.takePrice;
  if (!stopPrice && !takePrice) return null;

  for (let i = fromIndex; i <= toIndex; i += 1) {
    const candle = state.candles[i];
    if (!candle) continue;
    if (side === "long" && stopPrice && candle.low <= stopPrice) {
      executeTrade("sell", 1, {
        price: stopPrice,
        time: candle.time,
        reason: "止损触发",
        tags: selectedTags(),
        auto: true,
        skipRender: true,
      });
      showToast(`止损触发：$${priceFmt.format(stopPrice)}`);
      return i;
    }
    if (side === "long" && takePrice && candle.high >= takePrice) {
      executeTrade("sell", 1, {
        price: takePrice,
        time: candle.time,
        reason: "止盈触发",
        tags: selectedTags(),
        auto: true,
        skipRender: true,
      });
      showToast(`止盈触发：$${priceFmt.format(takePrice)}`);
      return i;
    }
    if (side === "short" && stopPrice && candle.high >= stopPrice) {
      executeTrade("cover", 1, {
        price: stopPrice,
        time: candle.time,
        reason: "空单止损触发",
        tags: selectedTags(),
        auto: true,
        skipRender: true,
      });
      showToast(`空单止损触发：$${priceFmt.format(stopPrice)}`);
      return i;
    }
    if (side === "short" && takePrice && candle.low <= takePrice) {
      executeTrade("cover", 1, {
        price: takePrice,
        time: candle.time,
        reason: "空单止盈触发",
        tags: selectedTags(),
        auto: true,
        skipRender: true,
      });
      showToast(`空单止盈触发：$${priceFmt.format(takePrice)}`);
      return i;
    }
  }
  return null;
}

function generateDemoCandles() {
  const candles = [];
  const start = Date.UTC(2017, 0, 1, 0, 0, 0);
  const end = Date.now();
  const interval = 14_400_000;
  let price = 960;
  let seed = 42;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let time = start; time <= end; time += interval) {
    const years = (time - start) / (365 * 24 * 60 * 60 * 1000);
    const cycle = Math.sin(years * Math.PI * 1.45) * 0.018 + Math.sin(years * Math.PI * 4.1) * 0.008;
    const drift = 0.00034;
    const shock = (random() - 0.5) * 0.045;
    const open = price;
    price = Math.max(120, price * (1 + drift + cycle + shock));
    const close = price;
    const spread = Math.abs(close - open) + open * (0.01 + random() * 0.028);
    const high = Math.max(open, close) + spread * random();
    const low = Math.max(1, Math.min(open, close) - spread * random());
    const volume = 400 + random() * 4200;
    candles.push({ time, open, high, low, close, volume });
  }
  return candles;
}

function chartMetrics() {
  const rect = els.canvas.getBoundingClientRect();
  const width = rect.width || 1;
  const height = rect.height || 1;
  const pad = { left: 12, right: 88, top: 18, bottom: 28 };
  const volumeTop = Math.floor(height * 0.78);
  const priceBottom = volumeTop - 12;
  return {
    width,
    height,
    pad,
    plotLeft: pad.left,
    plotRight: width - pad.right,
    plotTop: pad.top,
    priceBottom,
    volumeTop,
    volumeBottom: height - pad.bottom,
    plotWidth: width - pad.left - pad.right,
    priceHeight: priceBottom - pad.top,
    volumeHeight: height - pad.bottom - volumeTop,
  };
}

function visibleBounds(start, end) {
  let min = Infinity;
  let max = -Infinity;
  let maxVolume = 0;
  for (let i = start; i < end; i += 1) {
    const candle = state.candles[i];
    if (!candle) continue;
    min = Math.min(min, candle.low);
    max = Math.max(max, candle.high);
    maxVolume = Math.max(maxVolume, candle.volume || 0);
  }
  for (const line of state.annotations) {
    min = Math.min(min, line.price);
    max = Math.max(max, line.price);
  }
  for (const price of [state.account.stopPrice, state.account.takePrice]) {
    if (price) {
      min = Math.min(min, price);
      max = Math.max(max, price);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    min = 1;
    max = 2;
  }
  const padding = (max - min) * 0.08;
  return {
    min: Math.max(0.00000001, min - padding),
    max: max + padding,
    maxVolume: Math.max(1, maxVolume),
  };
}

function createScale(bounds, metrics) {
  const minValue = state.logScale ? Math.log(Math.max(bounds.min, 0.00000001)) : bounds.min;
  const maxValue = state.logScale ? Math.log(Math.max(bounds.max, 0.00000001)) : bounds.max;
  const span = Math.max(0.00000001, maxValue - minValue);
  return {
    y(price) {
      const value = state.logScale ? Math.log(Math.max(price, 0.00000001)) : price;
      return metrics.priceBottom - ((value - minValue) / span) * metrics.priceHeight;
    },
    price(y) {
      const value = minValue + ((metrics.priceBottom - y) / metrics.priceHeight) * span;
      return state.logScale ? Math.exp(value) : value;
    },
    priceAt(t) {
      const value = minValue + t * span;
      return state.logScale ? Math.exp(value) : value;
    },
  };
}

function drawGrid(metrics, scale, start, end) {
  ctx.strokeStyle = "rgba(255,255,255,0.075)";
  ctx.fillStyle = "#8b98a8";
  ctx.lineWidth = 1;
  ctx.font = "12px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= 5; i += 1) {
    const t = i / 5;
    const y = metrics.plotTop + t * metrics.priceHeight;
    ctx.beginPath();
    ctx.moveTo(metrics.plotLeft, y);
    ctx.lineTo(metrics.plotRight, y);
    ctx.stroke();
    const price = scale.priceAt(1 - t);
    ctx.fillText(priceFmt.format(price), metrics.plotRight + 8, y);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const count = Math.max(1, end - start);
  for (let i = 0; i <= 6; i += 1) {
    const x = metrics.plotLeft + (i / 6) * metrics.plotWidth;
    const index = clamp(Math.floor(start + (i / 6) * count), start, end - 1);
    const candle = state.candles[index];
    ctx.beginPath();
    ctx.moveTo(x, metrics.plotTop);
    ctx.lineTo(x, metrics.volumeBottom);
    ctx.stroke();
    if (candle) ctx.fillText(formatAxisTime(candle.time, index), x, metrics.volumeBottom + 8);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.11)";
  ctx.beginPath();
  ctx.moveTo(metrics.plotLeft, metrics.volumeTop);
  ctx.lineTo(metrics.plotRight, metrics.volumeTop);
  ctx.stroke();
}

function drawCandles(metrics, scale, bounds, start, end) {
  const count = Math.max(1, end - start);
  const step = metrics.plotWidth / count;

  if (count > 2600) {
    drawCondensedCandles(metrics, scale, bounds, start, end, count);
    return;
  }

  const bodyWidth = clamp(step * 0.64, 1, 14);
  for (let i = start; i < end; i += 1) {
    const candle = state.candles[i];
    if (!candle) continue;
    const x = metrics.plotLeft + (i - start + 0.5) * step;
    drawOneCandle(candle, x, bodyWidth, metrics, scale, bounds, i);
  }
}

function drawCondensedCandles(metrics, scale, bounds, start, end, count) {
  const pixels = Math.max(1, Math.floor(metrics.plotWidth));
  const buckets = new Array(pixels);
  for (let i = start; i < end; i += 1) {
    const candle = state.candles[i];
    const px = clamp(Math.floor(((i - start) / count) * pixels), 0, pixels - 1);
    let bucket = buckets[px];
    if (!bucket) {
      bucket = {
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        index: i,
      };
      buckets[px] = bucket;
    } else {
      bucket.high = Math.max(bucket.high, candle.high);
      bucket.low = Math.min(bucket.low, candle.low);
      bucket.close = candle.close;
      bucket.volume += candle.volume;
      bucket.index = i;
    }
  }

  for (let px = 0; px < buckets.length; px += 1) {
    const bucket = buckets[px];
    if (!bucket) continue;
    const x = metrics.plotLeft + px + 0.5;
    drawOneCandle(bucket, x, 1, metrics, scale, bounds, bucket.index);
  }
}

function drawOneCandle(candle, x, bodyWidth, metrics, scale, bounds, index) {
  const rising = candle.close >= candle.open;
  const color = rising ? "#18b982" : "#ef5350";
  const future = !state.hideFuture && index > state.currentIndex;
  ctx.globalAlpha = future ? 0.26 : 1;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  const highY = scale.y(candle.high);
  const lowY = scale.y(candle.low);
  const openY = scale.y(candle.open);
  const closeY = scale.y(candle.close);
  ctx.beginPath();
  ctx.moveTo(x, highY);
  ctx.lineTo(x, lowY);
  ctx.stroke();

  const top = Math.min(openY, closeY);
  const height = Math.max(1, Math.abs(openY - closeY));
  ctx.fillRect(x - bodyWidth / 2, top, bodyWidth, height);

  const volHeight = ((candle.volume || 0) / bounds.maxVolume) * metrics.volumeHeight;
  ctx.globalAlpha = future ? 0.12 : 0.34;
  ctx.fillRect(x - bodyWidth / 2, metrics.volumeBottom - volHeight, bodyWidth, volHeight);
  ctx.globalAlpha = 1;
}

function movingAverageAt(index, period) {
  if (index < period - 1) return NaN;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i += 1) {
    sum += state.candles[i].close;
  }
  return sum / period;
}

function drawMA(metrics, scale, start, end, period, color) {
  if (end - start > 3000 || start + period >= end) return;
  const count = Math.max(1, end - start);
  const step = metrics.plotWidth / count;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  let hasPoint = false;
  for (let i = start; i < end; i += 1) {
    const value = movingAverageAt(i, period);
    if (!Number.isFinite(value)) continue;
    const x = metrics.plotLeft + (i - start + 0.5) * step;
    const y = scale.y(value);
    if (!hasPoint) {
      ctx.moveTo(x, y);
      hasPoint = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  if (hasPoint) ctx.stroke();
}

function drawCurrentLine(metrics, start, end) {
  if (state.currentIndex < start || state.currentIndex >= end) return;
  const count = Math.max(1, end - start);
  const x = metrics.plotLeft + (state.currentIndex - start + 0.5) * (metrics.plotWidth / count);
  ctx.strokeStyle = "#f0b90b";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(x, metrics.plotTop);
  ctx.lineTo(x, metrics.volumeBottom);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawTrades(metrics, scale, start, end) {
  if (!state.account.trades.length) return;
  const count = Math.max(1, end - start);
  const step = metrics.plotWidth / count;
  for (const trade of state.account.trades) {
    const index = findIndexAtOrBefore(state.candles, trade.time);
    if (index < start || index >= end) continue;
    const x = metrics.plotLeft + (index - start + 0.5) * step;
    const y = scale.y(trade.price);
    const upward = trade.side === "buy" || trade.side === "cover";
    ctx.fillStyle =
      trade.side === "buy"
        ? "#38bdf8"
        : trade.side === "cover"
          ? "#18b982"
          : trade.side === "short"
            ? "#a78bfa"
            : "#ef5350";
    ctx.beginPath();
    if (upward) {
      ctx.moveTo(x, y - 12);
      ctx.lineTo(x - 6, y - 2);
      ctx.lineTo(x + 6, y - 2);
    } else {
      ctx.moveTo(x, y + 12);
      ctx.lineTo(x - 6, y + 2);
      ctx.lineTo(x + 6, y + 2);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function drawPriceLine(metrics, scale, price, color, label) {
  if (!price) return;
  const y = scale.y(price);
  if (y < metrics.plotTop - 20 || y > metrics.priceBottom + 20) return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(metrics.plotLeft, y);
  ctx.lineTo(metrics.plotRight, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "12px Inter, sans-serif";
  ctx.fillText(`${label} ${priceFmt.format(price)}`, metrics.plotLeft + 8, y - 10);
}

function drawAnnotations(metrics, scale, start, end) {
  for (const line of state.annotations) {
    drawPriceLine(metrics, scale, line.price, line.color || "#f0b90b", line.label || "水平线");
  }

  const count = Math.max(1, end - start);
  const step = metrics.plotWidth / count;
  for (const mark of state.bookmarks) {
    const index = findIndexAtOrBefore(state.candles, mark.time);
    if (index < start || index >= end) continue;
    const candle = state.candles[index];
    const x = metrics.plotLeft + (index - start + 0.5) * step;
    const y = scale.y(mark.price || candle.close);
    ctx.fillStyle = "#f0b90b";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPriceLine(metrics, scale, state.account.stopPrice, "#ef5350", "SL");
  drawPriceLine(metrics, scale, state.account.takePrice, "#18b982", "TP");
}

function drawHover(metrics, scale, start, end) {
  if (!state.hover) return;
  const { x, y } = state.hover;
  if (x < metrics.plotLeft || x > metrics.plotRight || y < metrics.plotTop || y > metrics.volumeBottom) {
    els.tooltip.style.display = "none";
    return;
  }

  ctx.strokeStyle = "rgba(237,242,247,0.42)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(x, metrics.plotTop);
  ctx.lineTo(x, metrics.volumeBottom);
  ctx.moveTo(metrics.plotLeft, y);
  ctx.lineTo(metrics.plotRight, y);
  ctx.stroke();
  ctx.setLineDash([]);

  const count = Math.max(1, end - start);
  const index = clamp(Math.floor(start + ((x - metrics.plotLeft) / metrics.plotWidth) * count), start, end - 1);
  const candle = state.candles[index];
  if (!candle) return;
  const cursorPrice = y <= metrics.priceBottom ? scale.price(y) : candle.close;
  els.cursorInfo.textContent = `${formatVisibleTime(candle.time, index)}  O ${priceFmt.format(candle.open)}  H ${priceFmt.format(candle.high)}  L ${priceFmt.format(candle.low)}  C ${priceFmt.format(candle.close)}`;
  els.tooltip.innerHTML = `
    <strong>${formatVisibleTime(candle.time, index)}</strong><br>
    O ${priceFmt.format(candle.open)}<br>
    H ${priceFmt.format(candle.high)}<br>
    L ${priceFmt.format(candle.low)}<br>
    C ${priceFmt.format(candle.close)}<br>
    光标 ${priceFmt.format(cursorPrice)}
  `;
  const rect = els.chartFrame.getBoundingClientRect();
  const tooltipX = x + 16 > rect.width - 230 ? x - 232 : x + 16;
  const tooltipY = y + 16 > rect.height - 160 ? y - 150 : y + 16;
  els.tooltip.style.display = "block";
  els.tooltip.style.left = `${Math.max(8, tooltipX)}px`;
  els.tooltip.style.top = `${Math.max(8, tooltipY)}px`;
}

function renderChart() {
  const metrics = chartMetrics();
  ctx.clearRect(0, 0, metrics.width, metrics.height);
  ctx.fillStyle = "#080d13";
  ctx.fillRect(0, 0, metrics.width, metrics.height);

  if (!state.candles.length) {
    els.tooltip.style.display = "none";
    return;
  }

  clampView(state.viewStart, state.viewEnd);
  const start = state.viewStart;
  const end = state.viewEnd;
  const bounds = visibleBounds(start, end);
  const scale = createScale(bounds, metrics);

  drawGrid(metrics, scale, start, end);
  drawCandles(metrics, scale, bounds, start, end);
  if (state.showMA20) drawMA(metrics, scale, start, end, 20, "#38bdf8");
  if (state.showMA60) drawMA(metrics, scale, start, end, 60, "#f0b90b");
  drawAnnotations(metrics, scale, start, end);
  drawCurrentLine(metrics, start, end);
  drawTrades(metrics, scale, start, end);
  drawHover(metrics, scale, start, end);
}

function accountStats(currentPriceValue) {
  const equity = state.account.cash + state.account.btc * currentPriceValue;
  const pnl = equity - state.account.initialCash;
  const closedTrades = state.account.trades.filter((trade) => Number.isFinite(trade.realizedPnl));
  const wins = closedTrades.filter((trade) => trade.realizedPnl > 0).length;
  const winRate = closedTrades.length ? (wins / closedTrades.length) * 100 : null;
  const sumR = closedTrades.reduce((sum, trade) => sum + (Number.isFinite(trade.r) ? trade.r : 0), 0);

  let peak = state.account.initialCash;
  let maxDrawdown = 0;
  for (const trade of state.account.trades) {
    if (!Number.isFinite(trade.equity)) continue;
    peak = Math.max(peak, trade.equity);
    maxDrawdown = Math.max(maxDrawdown, peak > 0 ? (peak - trade.equity) / peak : 0);
  }
  peak = Math.max(peak, equity);
  maxDrawdown = Math.max(maxDrawdown, peak > 0 ? (peak - equity) / peak : 0);

  return { equity, pnl, winRate, maxDrawdown, sumR, sells: closedTrades, closedTrades };
}

function tradeSideLabel(trade) {
  if (trade.side === "buy") return "买";
  if (trade.side === "sell") return trade.auto ? "自动卖" : "卖";
  if (trade.side === "short") return "开空";
  if (trade.side === "cover") return trade.auto ? "自动平空" : "平空";
  return trade.side || "-";
}

function tradeSideClass(side) {
  if (side === "buy" || side === "cover") return "positive";
  if (side === "sell" || side === "short") return "negative";
  return "neutral";
}

function renderAccount() {
  const candle = currentCandle();
  const price = candle ? candle.close : 0;
  const stats = accountStats(price);

  els.currentPrice.textContent = candle ? `$${priceFmt.format(price)}` : "-";
  els.equityValue.textContent = candle ? `$${money.format(stats.equity)}` : "-";
  els.pnlValue.textContent = candle ? `${stats.pnl >= 0 ? "+" : ""}$${money.format(stats.pnl)}` : "-";
  els.pnlValue.className = stats.pnl >= 0 ? "positive" : "negative";
  els.cashValue.textContent = `$${money.format(state.account.cash)}`;
  const side = positionSide();
  els.btcValue.textContent = side === "flat" ? "0 空仓" : `${state.account.btc > 0 ? "+" : ""}${btcFmt.format(state.account.btc)} ${positionSideLabel(side)}`;
  els.btcValue.className = side === "long" ? "positive" : side === "short" ? "negative" : "neutral";
  els.closePositionBtn.disabled = side === "flat";
  els.winRateValue.textContent = stats.winRate == null ? "-" : `${stats.winRate.toFixed(1)}%`;
  els.drawdownValue.textContent = `${(stats.maxDrawdown * 100).toFixed(1)}%`;
  els.tradeCountValue.textContent = String(state.account.trades.length);
  els.rValue.textContent = stats.sells.length ? `${stats.sumR.toFixed(2)}R` : "-";

  const rows = state.account.trades
    .slice()
    .reverse()
    .slice(0, 80)
    .map((trade) => {
      const sideText = tradeSideLabel(trade);
      const note = [trade.reason, ...(trade.tags || [])].filter(Boolean).join(" / ");
      return `
        <tr>
          <td>${formatVisibleTime(trade.time, findIndexAtOrBefore(state.candles, trade.time))}</td>
          <td class="${tradeSideClass(trade.side)}">${sideText}</td>
          <td>${priceFmt.format(trade.price)}</td>
          <td>${btcFmt.format(trade.qty)}</td>
          <td>${escapeHtml(note || "-")}</td>
        </tr>
      `;
    })
    .join("");
  els.tradeRows.innerHTML = rows || '<tr><td colspan="5">暂无交易</td></tr>';
}

function renderBookmarks() {
  if (!state.bookmarks.length) {
    els.bookmarkList.innerHTML = "暂无标注";
    return;
  }
  els.bookmarkList.innerHTML = state.bookmarks
    .slice()
    .reverse()
    .map((mark) => {
      const index = findIndexAtOrBefore(state.candles, mark.time);
      return `
        <div class="list-item">
          <strong>${formatVisibleTime(mark.time, index)} / $${priceFmt.format(mark.price)}</strong>
          <span>${escapeHtml(mark.text || "无文字标注")}</span>
          ${(mark.tags || []).length ? `<div class="tagline">${escapeHtml(mark.tags.join(" / "))}</div>` : ""}
        </div>
      `;
    })
    .join("");
}

function renderStatus() {
  if (!state.candles.length) {
    setStatus("等待导入 BTC K线 CSV");
    els.cursorInfo.textContent = "-";
    return;
  }
  const first = state.candles[0];
  const last = state.candles[state.candles.length - 1];
  const current = state.candles[state.currentIndex];
  const gapText = state.sourceGaps ? ` | 缺口 ${state.sourceGaps}` : "";
  const rangeText =
    state.blindMode && !state.dateRevealed
      ? "盲测区间已隐藏"
      : `${formatShortTime(first.time)} - ${formatShortTime(last.time)}`;
  setStatus(
    `${state.fileName} | ${formatInterval(state.timeframeMs)} | ${state.candles.length.toLocaleString("en-US")} 根 | ${rangeText}${gapText}`,
  );
  els.cursorInfo.textContent = current
    ? `当前 ${formatVisibleTime(current.time, state.currentIndex)} | 已揭示 ${(state.currentIndex + 1).toLocaleString("en-US")} 根`
    : "-";
}

function render() {
  syncSettingControls();
  syncTimeline();
  renderStatus();
  renderAccount();
  renderBookmarks();
  renderGame();
  resizeCanvas();
  renderChart();
}

function resizeCanvas() {
  const rect = els.canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (els.canvas.width !== width || els.canvas.height !== height) {
    els.canvas.width = width;
    els.canvas.height = height;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function canvasPoint(event) {
  const rect = els.canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function pointInChart(point, metrics = chartMetrics()) {
  return (
    point.x >= metrics.plotLeft &&
    point.x <= metrics.plotRight &&
    point.y >= metrics.plotTop &&
    point.y <= metrics.volumeBottom
  );
}

function indexFromChartX(x, metrics = chartMetrics()) {
  const start = state.viewStart;
  const end = state.viewEnd;
  const count = Math.max(1, end - start);
  const ratio = clamp((x - metrics.plotLeft) / Math.max(1, metrics.plotWidth), 0, 0.999999);
  return clamp(Math.floor(start + ratio * count), start, Math.max(start, end - 1));
}

function currentLineX(metrics = chartMetrics()) {
  if (!state.candles.length || state.currentIndex < state.viewStart || state.currentIndex >= state.viewEnd) {
    return null;
  }
  const count = Math.max(1, state.viewEnd - state.viewStart);
  return metrics.plotLeft + (state.currentIndex - state.viewStart + 0.5) * (metrics.plotWidth / count);
}

function isNearCurrentLine(point, metrics = chartMetrics()) {
  const x = currentLineX(metrics);
  return x != null && pointInChart(point, metrics) && Math.abs(point.x - x) <= 12;
}

function scrubPixelsPerCandle(event) {
  if (event.altKey) return 18;
  if (event.shiftKey) return 3;
  return 8;
}

function levelModeRecordsForStats(profileOrLevelMode = state.game.profile) {
  const levelMode = profileOrLevelMode.levelMode || profileOrLevelMode || {};
  const datasets =
    levelMode.datasets && typeof levelMode.datasets === "object" && !Array.isArray(levelMode.datasets)
      ? Object.values(levelMode.datasets)
      : [];
  const legacyRecords = Object.values(levelMode.records || {});
  if (datasets.length) {
    const datasetRecords = datasets.flatMap((bucket) => Object.values(bucket.records || {}));
    return levelMode.legacyDatasetKey ? datasetRecords : [...datasetRecords, ...legacyRecords];
  }
  return legacyRecords;
}

function levelModeStats(profileOrLevelMode = state.game.profile) {
  const records = levelModeRecordsForStats(profileOrLevelMode);
  const cleared = records.filter((record) => (record.bestStars || 0) > 0).length;
  const stars = records.reduce((sum, record) => sum + (record.bestStars || 0), 0);
  const attempts = records.reduce((sum, record) => sum + (record.attempts || 0), 0);
  const fiveStars = records.filter((record) => (record.bestStars || 0) >= 5).length;
  const maxAttempts = records.reduce((max, record) => Math.max(max, record.attempts || 0), 0);
  const bestReturn = records.reduce((max, record) => Math.max(max, record.bestReturnPct ?? -Infinity), -Infinity);
  return { cleared, stars, attempts, fiveStars, maxAttempts, bestReturn: Number.isFinite(bestReturn) ? bestReturn : 0 };
}

function ensureLevelTimeframe() {
  if (!state.sourceCandles.length) {
    showToast("先导入 15m 历史 K线，才能生成关卡。");
    return false;
  }
  if (state.sourceIntervalMs && state.sourceIntervalMs > LEVEL_MODE_INTERVAL_MS * 1.05) {
    showToast("历史闯关需要 15m 或更小周期的数据。");
    return false;
  }
  if (els.timeframeSelect.value !== String(LEVEL_MODE_INTERVAL_MS) && state.sourceIntervalMs < LEVEL_MODE_INTERVAL_MS * 0.95) {
    els.timeframeSelect.value = String(LEVEL_MODE_INTERVAL_MS);
    applyTimeframe(true);
  } else if (state.sourceIntervalMs && Math.abs(state.sourceIntervalMs - LEVEL_MODE_INTERVAL_MS) < LEVEL_MODE_INTERVAL_MS * 0.1) {
    els.timeframeSelect.value = "source";
    applyTimeframe(true);
  }
  return true;
}

function levelDateKey(time) {
  return new Date(time).toISOString().slice(0, 10);
}

function generateLevelList() {
  if (!state.candles.length) return [];
  const levels = [];
  const lastTime = state.candles[state.candles.length - 1].time;
  for (let dayStart = LEVEL_MODE_START_TIME; dayStart + 86_400_000 <= lastTime; dayStart += 86_400_000) {
    const dayEnd = dayStart + 86_400_000;
    const startIndex = findIndexAtOrAfter(state.candles, dayStart);
    const endIndex = startIndex + LEVEL_MODE_CANDLES - 1;
    if (!state.candles[startIndex] || !state.candles[endIndex]) continue;
    if (state.candles[startIndex].time >= dayEnd || state.candles[endIndex].time >= dayEnd) continue;
    const id = levelDateKey(dayStart);
    levels.push({
      id,
      index: levels.length,
      title: `${id} 第 ${levels.length + 1} 关`,
      startIndex,
      endIndex,
      startTime: state.candles[startIndex].time,
      endTime: state.candles[endIndex].time,
    });
  }
  return levels;
}

function levelStarsFromResult(score, returnPct) {
  if (returnPct >= 0.05 && score >= 80) return 5;
  if (returnPct >= 0.025 && score >= 65) return 4;
  if (returnPct >= 0.01 && score >= 50) return 3;
  if (returnPct >= 0) return 2;
  if (returnPct > -0.015) return 1;
  return 0;
}

function starsText(stars) {
  return "★★★★★".slice(0, stars) + "☆☆☆☆☆".slice(0, 5 - stars);
}

function nextLevelIndex(levels) {
  const records = levelModeForDataset().records || {};
  const firstUncleared = levels.find((level) => !(records[level.id]?.bestStars > 0));
  if (firstUncleared) return firstUncleared.index;
  const firstNotFive = levels.find((level) => (records[level.id]?.bestStars || 0) < 5);
  return firstNotFive ? firstNotFive.index : Math.max(0, levels.length - 1);
}

function recordLevelResult(result) {
  if (!result.levelId) return null;
  const levelMode = levelModeForDataset(result.levelDatasetKey, result.levelDatasetLabel);
  const records = levelMode.records;
  const previous = records[result.levelId] || {
    id: result.levelId,
    index: result.levelIndex,
    datasetKey: levelMode.key,
    datasetLabel: levelMode.label,
    attempts: 0,
    bestStars: 0,
    bestScore: 0,
    bestReturnPct: -Infinity,
  };
  const previousBestStars = previous.bestStars || 0;
  const attempts = (previous.attempts || 0) + 1;
  const bestStars = Math.max(previousBestStars, result.stars);
  const bestScore = Math.max(previous.bestScore || 0, result.score);
  const bestReturnPct = Math.max(previous.bestReturnPct ?? -Infinity, result.returnPct);
  const record = {
    ...previous,
    id: result.levelId,
    index: result.levelIndex,
    datasetKey: levelMode.key,
    datasetLabel: levelMode.label,
    attempts,
    bestStars,
    bestScore,
    bestReturnPct,
    lastStars: result.stars,
    lastScore: result.score,
    lastReturnPct: result.returnPct,
    lastPlayedAt: Date.now(),
    clearedAt: bestStars > 0 ? previous.clearedAt || Date.now() : previous.clearedAt || null,
  };
  records[result.levelId] = record;
  levelMode.lastLevelId = result.levelId;
  levelMode.updatedAt = Date.now();
  return {
    ...record,
    previousBestStars,
    bestImproved: result.stars > previousBestStars,
    firstClear: previousBestStars <= 0 && result.stars > 0,
  };
}

function randomTraining(blind) {
  if (!state.candles.length) return;
  const min = Math.min(120, state.candles.length - 1);
  const index = weightedRecentIndex(min, state.candles.length - 1, 1.8);
  state.blindMode = blind || state.blindMode;
  state.dateRevealed = !state.blindMode;
  revealTo(index, true);
  showToast(blind ? "已进入随机盲测" : "已随机跳转");
}

function weightedRecentIndex(min, max, strength = 2.2) {
  if (max <= min) return min;
  const ratio = 1 - Math.pow(1 - Math.random(), strength);
  return clamp(Math.floor(min + ratio * (max - min + 1)), min, max);
}

function chooseChallengeStart(config) {
  const min = Math.min(config.context, Math.max(0, state.candles.length - config.horizon - 2));
  const max = state.candles.length - config.horizon - 2;
  if (max <= min) return Math.max(0, Math.floor(state.candles.length / 3));

  if (config.key === "survival") {
    let best = min;
    let bestScore = 0;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const candidate = weightedRecentIndex(min, max, 2.1);
      const start = state.candles[candidate].close;
      const end = state.candles[Math.min(candidate + config.horizon, state.candles.length - 1)].close;
      const drop = (start - end) / start;
      const recency = (candidate - min) / Math.max(1, max - min);
      const score = drop * (0.7 + recency * 0.3);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }

  return weightedRecentIndex(min, max, 2.2);
}

function startChallenge(type = "blind") {
  if (!state.candles.length) {
    showToast("先导入历史 K线，游戏才能发牌。");
    return;
  }
  const base = CHALLENGE_TYPES[type] || CHALLENGE_TYPES.blind;
  const config = { ...base, key: type };
  const startIndex = chooseChallengeStart(config);
  const endIndex = clamp(startIndex + config.horizon, startIndex + 1, state.candles.length - 1);
  const startCandle = state.candles[startIndex];

  stopPlayback();
  if (state.game.active && state.game.externalAccount) {
    state.account = cloneAccount(state.game.externalAccount);
    state.game.active = null;
    state.game.externalAccount = null;
  }
  if (!state.game.externalAccount) {
    state.game.externalAccount = cloneAccount(state.account);
  }
  const gameCash = Number(els.initialCashInput.value);
  state.account = createAccount(Number.isFinite(gameCash) && gameCash > 0 ? gameCash : 10_000);
  state.bookmarks = [];
  state.annotations = [];
  state.game.active = {
    id: uniqueId("challenge"),
    type,
    title: config.name,
    text: config.text,
    startIndex,
    endIndex,
    startTime: startCandle.time,
    startPrice: startCandle.close,
    horizon: config.horizon,
    xp: config.xp,
    bias: null,
    trialKind: "normal",
    startedAt: Date.now(),
    tradesAtStart: 0,
    bookmarksAtStart: 0,
  };
  state.game.lastType = type;
  state.hideFuture = true;
  state.blindMode = true;
  state.dateRevealed = false;
  els.sessionNameInput.value = config.name;
  els.sessionNotesInput.value = "";
  els.bookmarkInput.value = "";
  els.tradeReasonInput.value = "";
  els.stopLossInput.value = "";
  els.takeProfitInput.value = "";
  revealTo(startIndex, true);
  showToast(`${config.name} 开局：先选方向，再推进行情。`);
}

function startLevelChallenge(levelIndex = null) {
  if (!ensureLevelTimeframe()) return;
  const levels = generateLevelList();
  if (!levels.length) {
    showToast("没有生成可用关卡。请确认数据覆盖 2020 年之后且为 15m。");
    return;
  }
  const targetIndex = levelIndex == null ? nextLevelIndex(levels) : clamp(levelIndex, 0, levels.length - 1);
  const level = levels[targetIndex];
  const config = CHALLENGE_TYPES.level;
  const startCandle = state.candles[level.startIndex];
  const dataset = currentLevelDatasetInfo();

  stopPlayback();
  if (state.game.active && state.game.externalAccount) {
    state.account = cloneAccount(state.game.externalAccount);
    state.game.active = null;
    state.game.externalAccount = null;
  }
  if (!state.game.externalAccount) {
    state.game.externalAccount = cloneAccount(state.account);
  }
  const gameCash = Number(els.initialCashInput.value);
  state.account = createAccount(Number.isFinite(gameCash) && gameCash > 0 ? gameCash : 10_000);
  state.bookmarks = [];
  state.annotations = [];
  state.game.active = {
    id: uniqueId("level"),
    type: "level",
    title: level.title,
    text: config.text,
    startIndex: level.startIndex,
    endIndex: level.endIndex,
    startTime: startCandle.time,
    startPrice: startCandle.close,
    horizon: level.endIndex - level.startIndex,
    xp: config.xp,
    bias: null,
    trialKind: "level",
    levelId: level.id,
    levelIndex: level.index,
    levelDatasetKey: dataset.key,
    levelDatasetLabel: dataset.label,
    startedAt: Date.now(),
    tradesAtStart: 0,
    bookmarksAtStart: 0,
  };
  state.game.lastType = "level";
  state.hideFuture = true;
  state.blindMode = false;
  state.dateRevealed = true;
  els.sessionNameInput.value = level.title;
  els.sessionNotesInput.value = "";
  els.bookmarkInput.value = "";
  els.tradeReasonInput.value = "";
  els.stopLossInput.value = "";
  els.takeProfitInput.value = "";
  revealTo(level.startIndex, true);
  showToast(`${level.title} 开始：目标 5 星通关。`);
}

function startCharacterTrial(kind = "normal") {
  const character = activeCharacter();
  startChallenge(character.challengeType);
  if (!state.game.active) return;
  state.game.active.characterId = character.id;
  state.game.active.trialKind = kind;
  state.game.active.title = kind === "ascension" ? `${character.name} · 进阶试炼` : `${character.name} · 角色试炼`;
  state.game.active.text =
    kind === "ascension"
      ? `特殊试炼：本局无杠杆收益达到 5% 才会获得 ${character.material}。`
      : `${character.style}。本局主要获取角色经验。`;
  els.sessionNameInput.value = state.game.active.title;
  renderGame();
  showToast(state.game.active.text);
}

function setChallengeBias(bias) {
  if (!state.game.active) {
    showToast("先开一局，再选择方向。");
    return;
  }
  state.game.active.bias = bias;
  renderGame();
}

function expectedBias(movePct) {
  if (movePct > 0.006) return "long";
  if (movePct < -0.006) return "short";
  return "flat";
}

function biasLabel(bias) {
  return { long: "看多", short: "看空", flat: "观望" }[bias] || "未选择";
}

function challengeTypeLabel(type) {
  return CHALLENGE_TYPES[type]?.name || type || "训练";
}

function pickSettlementReviewerId(active) {
  if (active?.characterId) return active.characterId;
  const seed = `${active?.id || "settlement"}-${active?.type || "training"}-${active?.startTime || Date.now()}`;
  const random = seededDailyRandom(seed);
  return CHARACTER_CONFIG[Math.floor(random() * CHARACTER_CONFIG.length)]?.id || CHARACTER_CONFIG[0].id;
}

function settlementTradesForReport(trades) {
  return trades.slice(-40).map((trade) => ({
    time: formatTime(trade.time),
    side: tradeSideLabel(trade),
    price: Number(trade.price).toFixed(2),
    qty: Number(trade.qty).toFixed(8),
    reason: trade.reason || "",
    tags: trade.tags || [],
    stopPrice: trade.stopPrice ? Number(trade.stopPrice).toFixed(2) : "",
    takePrice: trade.takePrice ? Number(trade.takePrice).toFixed(2) : "",
    realizedPnl: Number.isFinite(trade.realizedPnl) ? Number(trade.realizedPnl).toFixed(2) : "",
    r: Number.isFinite(trade.r) ? Number(trade.r).toFixed(2) : "",
    auto: Boolean(trade.auto),
  }));
}

function finishChallenge(reason = "manual") {
  const active = state.game.active;
  if (!active || state.game.settling) return;
  state.game.settling = true;

  const endIndex = clamp(active.endIndex, 0, state.candles.length - 1);
  if (state.currentIndex < endIndex) {
    const triggerIndex = checkAutoExit(state.currentIndex + 1, endIndex);
    if (triggerIndex != null) state.currentIndex = triggerIndex;
  }
  const endCandle = state.candles[endIndex];
  const movePct = (endCandle.close - active.startPrice) / active.startPrice;
  const expected = expectedBias(movePct);
  const finalIndex = state.currentIndex;
  const trades = state.account.trades.filter((trade) => trade.time >= active.startTime);
  const hasStop = trades.some((trade) => trade.stopPrice) || Boolean(state.account.stopPrice);
  const reviewText = [els.sessionNotesInput.value.trim(), els.tradeReasonInput.value.trim(), ...state.bookmarks.map((mark) => mark.text || "")].join(" ").trim();
  const stats = accountStats(endCandle.close);
  const returnPct = stats.pnl / state.account.initialCash;

  let directionScore = active.bias === expected ? 25 : active.bias ? 8 : 0;
  if (active.type === "survival" && stats.maxDrawdown < 0.08) directionScore = Math.max(directionScore, 18);
  const pnlScore = clamp(Math.round((stats.pnl / state.account.initialCash) * 900) + 12, 0, 25);
  const riskScore = hasStop || trades.length === 0 ? 20 : 6;
  const patienceScore = trades.length <= 2 ? 15 : trades.length <= 4 ? 9 : 3;
  const reviewScore = reviewText.length >= 12 ? 15 : reviewText.length ? 8 : 0;
  const completionScore = reason === "auto" || finalIndex >= endIndex ? 5 : 2;
  const score = clamp(directionScore + pnlScore + riskScore + patienceScore + reviewScore + completionScore, 0, 100);
  const levelStars = active.type === "level" ? levelStarsFromResult(score, returnPct) : null;
  const earnedXp = Math.round(active.xp * (0.35 + score / 100));
  const newAchievements = applyGameRewards({
    type: active.type,
    score,
    earnedXp,
    bias: active.bias,
    expected,
    movePct,
    returnPct,
    trialKind: active.trialKind,
    characterId: active.characterId,
    hasStop,
    reviewed: reviewText.length >= 12,
    goodFlat: active.bias === "flat" && expected === "flat" && score >= 70,
    levelId: active.levelId,
    levelIndex: active.levelIndex,
    levelDatasetKey: active.levelDatasetKey,
    levelDatasetLabel: active.levelDatasetLabel,
    stars: levelStars,
  });

  state.hideFuture = false;
  state.dateRevealed = true;
  state.blindMode = false;
  state.currentIndex = endIndex;
  centerOnCurrent(state.viewEnd - state.viewStart || 220);
  const reviewerId = pickSettlementReviewerId(active);
  const notes = els.sessionNotesInput.value.trim();
  const tradeReason = els.tradeReasonInput.value.trim();
  const settlementTags = selectedTags();
  state.game.lastSettlement = {
    id: active.id,
    title: active.title,
    type: active.type,
    typeLabel: challengeTypeLabel(active.type),
    trialKind: active.trialKind,
    score,
    earnedXp,
    newAchievements,
    levelStars,
    reviewerId,
    reviewerReason: active.characterId ? "角色试炼指定角色" : "自主挑战随机角色",
    report: {
      fileName: state.fileName,
      timeframe: formatInterval(state.timeframeMs),
      startTime: formatTime(active.startTime),
      endTime: formatTime(endCandle.time),
      startPrice: active.startPrice,
      endPrice: endCandle.close,
      bias: biasLabel(active.bias),
      expected: biasLabel(expected),
      movePct,
      returnPct,
      score,
      levelStars,
      equity: stats.equity,
      pnl: stats.pnl,
      winRate: stats.winRate,
      maxDrawdown: stats.maxDrawdown,
      sumR: stats.sumR,
      tradeCount: trades.length,
      hasStop,
      reviewed: reviewText.length >= 12,
      notes,
      tradeReason,
      tags: settlementTags,
      bookmarks: state.bookmarks.map((mark) => ({
        time: formatTime(mark.time),
        price: mark.price,
        text: mark.text || "",
        tags: mark.tags || [],
      })),
      trades: settlementTradesForReport(trades),
    },
    lines: [
      `你的判断：${biasLabel(active.bias)}，实际：${biasLabel(expected)}，涨跌幅 ${(movePct * 100).toFixed(2)}%`,
      `本局收益：${(returnPct * 100).toFixed(2)}%（游戏资金独立结算）`,
      ...(levelStars == null ? [] : [`关卡星级：${starsText(levelStars)}（${levelStars}/5）`]),
      `方向 ${directionScore}/25，交易结果 ${pnlScore}/25，风控 ${riskScore}/20`,
      `耐心 ${patienceScore}/15，复盘 ${reviewScore}/15，完成 ${completionScore}/5`,
    ],
  };
  state.game.active = null;
  state.game.lastGameAccount = cloneAccount(state.account);
  if (state.game.externalAccount) {
    state.account = cloneAccount(state.game.externalAccount);
    state.game.externalAccount = null;
  }
  state.game.settling = false;
  syncTimeline();
  render();
  showSettlement();
}

function applyGameRewards(result) {
  const profile = state.game.profile;
  const today = todayKey();
  if (profile.lastPlayedDate !== today) {
    const yesterdayKey = offsetDateKey(today, -1);
    profile.streak = profile.lastPlayedDate === yesterdayKey ? profile.streak + 1 : 1;
    profile.lastPlayedDate = today;
  }

  profile.xp += result.earnedXp;
  profile.level = levelFromXp(profile.xp);
  profile.stats.completed += 1;
  profile.stats[result.type] = (profile.stats[result.type] || 0) + 1;
  profile.stats.totalScore += result.score;
  profile.stats.bestScore = Math.max(profile.stats.bestScore, result.score);
  if (result.hasStop) profile.stats.stopUsed += 1;
  if (result.reviewed) profile.stats.reviewed += 1;
  if (result.goodFlat) profile.stats.goodFlat += 1;

  const levelRecord = result.type === "level" ? recordLevelResult(result) : null;

  if (profile.daily.date !== today) {
    profile.dailyHistory[profile.daily.date] = snapshotDailyProgress(profile.daily);
    profile.daily = createDailyProgress(today);
  }
  profile.daily.completed += 1;
  profile.daily[result.type] = (profile.daily[result.type] || 0) + 1;
  if (result.type === "level") {
    const stars = Number.isFinite(result.stars) ? result.stars : 0;
    profile.daily.levelStars = (profile.daily.levelStars || 0) + stars;
    profile.daily.levelBestStars = Math.max(profile.daily.levelBestStars || 0, stars);
    if (levelRecord?.firstClear) profile.daily.levelClears = (profile.daily.levelClears || 0) + 1;
    if (levelRecord?.bestImproved) profile.daily.levelBestImproved = (profile.daily.levelBestImproved || 0) + 1;
  }
  if (result.hasStop) profile.daily.stopUsed += 1;
  if (result.reviewed) profile.daily.reviewed += 1;
  if (result.goodFlat) profile.daily.goodFlat = (profile.daily.goodFlat || 0) + 1;
  profile.daily.highScore = Math.max(profile.daily.highScore, result.score);
  applyCompletedDailyTaskRewards(true);
  profile.dailyHistory[profile.daily.date] = snapshotDailyProgress(profile.daily);

  const characterGain = applyCharacterRewards(result);

  const newAchievements = [];
  for (const achievement of ACHIEVEMENTS) {
    if (!profile.achievements.includes(achievement.id) && achievement.test(profile)) {
      profile.achievements.push(achievement.id);
      newAchievements.push(achievement);
    }
  }
  profile.recentAchievements = [...newAchievements.map((item) => item.id), ...profile.recentAchievements].slice(0, 5);
  saveGameProfile();
  state.game.lastCharacterGain = characterGain;
  state.game.lastLevelRecord = levelRecord;
  return newAchievements;
}

function applyCharacterRewards(result) {
  const profile = state.game.profile;
  const character = characterById(result.characterId || profile.activeCharacter);
  const charState = profile.characters[character.id];
  const beforeStage = charState.stage;
  const beforeLevel = characterLevelFromXp(charState.xp, charState.stage);
  const success = Boolean(character.success(result));
  const baseGain = Math.max(18, Math.round(result.earnedXp * 0.7));
  const bonus = success ? 28 : 0;
  const ascensionTrial = result.trialKind === "ascension";
  const ascensionPassed = ascensionTrial && result.returnPct >= 0.05;
  const materialGain = ascensionPassed ? 1 + (success ? 1 : 0) + (result.reviewed ? 1 : 0) : 0;

  charState.xp += baseGain + bonus;
  charState.materials += materialGain;
  charState.runs += 1;
  if (success) charState.successes += 1;
  charState.trialWindow = [...charState.trialWindow, success].slice(-10);

  let ascended = false;
  let level = characterLevelFromXp(charState.xp, charState.stage);
  const atCap = level >= charState.stage * 20;
  const trialSuccesses = charState.trialWindow.filter(Boolean).length;
  const neededMaterials = charState.stage * 12;
  if (charState.stage < 5 && atCap && charState.materials >= neededMaterials && trialSuccesses >= 3) {
    charState.stage += 1;
    charState.materials -= neededMaterials;
    ascended = true;
    level = characterLevelFromXp(charState.xp, charState.stage);
  }

  const afterLevel = characterLevelFromXp(charState.xp, charState.stage);
  charState.lastGain = materialGain ? `${character.material} +${materialGain}` : "进阶材料 +0";
  return {
    character,
    xp: baseGain + bonus,
    materials: materialGain,
    success,
    ascensionTrial,
    ascensionPassed,
    ascended,
    beforeLevel,
    afterLevel,
    beforeStage,
    afterStage: charState.stage,
  };
}

function dailyTasks() {
  return dailyTasksFor(state.game.profile.daily);
}

function dailyAllDone(daily = state.game.profile.daily) {
  const tasks = dailyTasksFor(daily);
  return tasks.length > 0 && tasks.every((task) => task.done);
}

function applyCompletedDailyTaskRewards(showToastMessage = false) {
  const profile = state.game.profile;
  const daily = profile.daily;
  daily.taskRewards = daily.taskRewards && typeof daily.taskRewards === "object" && !Array.isArray(daily.taskRewards) ? daily.taskRewards : {};
  const character = activeCharacter();
  const charState = profile.characters[character.id];
  const completedWithoutReward = dailyTasksFor(daily).filter((task) => task.done && !daily.taskRewards[task.id]);
  if (!completedWithoutReward.length) return 0;

  const beforeLevel = characterLevelFromXp(charState.xp, charState.stage);
  const gainedXp = completedWithoutReward.length * DAILY_TASK_XP;
  charState.xp += gainedXp;
  const afterLevel = characterLevelFromXp(charState.xp, charState.stage);
  charState.lastGain = `每日任务经验 +${gainedXp}`;
  for (const task of completedWithoutReward) {
    daily.taskRewards[task.id] = {
      characterId: character.id,
      xp: DAILY_TASK_XP,
      at: Date.now(),
    };
  }
  syncDailyHistory();
  saveGameProfile();
  if (showToastMessage) {
    const levelText = afterLevel > beforeLevel ? `，升到 Lv.${afterLevel}` : "";
    showToast(`${character.name} 完成每日任务，获得 ${gainedXp} 经验${levelText}`);
  }
  return gainedXp;
}

function syncDailyHistory() {
  const profile = state.game.profile;
  profile.dailyHistory[profile.daily.date] = snapshotDailyProgress(profile.daily);
}

function parseDateKey(key) {
  const [year, month, day] = String(key || "").split("-").map(Number);
  return { year, month: month - 1, day };
}

function makeDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function ensureCalendarCursor() {
  if (state.game.calendarYear == null || state.game.calendarMonth == null) {
    const today = parseDateKey(todayKey());
    state.game.calendarYear = today.year;
    state.game.calendarMonth = today.month;
  }
}

function moveCalendarMonth(delta) {
  ensureCalendarCursor();
  const date = new Date(state.game.calendarYear, state.game.calendarMonth + delta, 1);
  state.game.calendarYear = date.getFullYear();
  state.game.calendarMonth = date.getMonth();
  renderDailyCalendar();
}

function renderCalendarControls() {
  ensureCalendarCursor();
  const today = parseDateKey(todayKey());
  const historyYears = Object.keys(state.game.profile.dailyHistory || {})
    .map((key) => Number(key.slice(0, 4)))
    .filter(Number.isFinite);
  const minYear = Math.min(today.year - 1, state.game.calendarYear, ...historyYears);
  const maxYear = Math.max(today.year + 1, state.game.calendarYear, ...historyYears);

  els.dailyCalendarYearSelect.innerHTML = Array.from({ length: maxYear - minYear + 1 }, (_, index) => {
    const year = minYear + index;
    return `<option value="${year}">${year} 年</option>`;
  }).join("");
  els.dailyCalendarMonthSelect.innerHTML = Array.from({ length: 12 }, (_, index) => `<option value="${index}">${index + 1} 月</option>`).join("");
  els.dailyCalendarYearSelect.value = String(state.game.calendarYear);
  els.dailyCalendarMonthSelect.value = String(state.game.calendarMonth);
}

function claimDailyReward() {
  const profile = state.game.profile;
  if (!dailyAllDone(profile.daily)) {
    showToast("今日任务全部完成后才能领取进阶材料。");
    return;
  }
  if (profile.daily.rewardClaimed) {
    showToast("今天的进阶材料已经领过啦。");
    return;
  }

  const random = seededDailyRandom(`daily-material-${profile.daily.date}`);
  const materialCharacter = CHARACTER_CONFIG[Math.floor(random() * CHARACTER_CONFIG.length)] || CHARACTER_CONFIG[0];
  const materialState = profile.characters[materialCharacter.id];
  materialState.materials += 1;
  materialState.lastGain = `${materialCharacter.material} +1`;

  profile.daily.rewardClaimed = true;
  profile.daily.rewardCharacterId = "";
  profile.daily.rewardXp = 0;
  profile.daily.rewardMaterialCharacterId = materialCharacter.id;
  profile.daily.rewardMaterialName = materialCharacter.material;
  profile.stats.dailyRewards = (profile.stats.dailyRewards || 0) + 1;
  syncDailyHistory();
  saveGameProfile();
  renderGame();
  showToast(`获得 ${materialCharacter.material} +1`);
}

function renderDailyReward() {
  const tasks = dailyTasks();
  const doneCount = tasks.filter((task) => task.done).length;
  const total = tasks.length;
  const allDone = doneCount === total;
  const claimed = state.game.profile.daily.rewardClaimed;
  const materialName = state.game.profile.daily.rewardMaterialName;
  els.dailyRewardText.textContent = claimed
    ? materialName
      ? `今日已领取，${materialName} +1。`
      : "今日已领取随机进阶材料。"
    : allDone
      ? "今日任务已完成，可领取随机进阶材料。"
      : `完成 ${doneCount}/${total} 个任务后，可领取随机进阶材料。每个每日任务完成时会自动给当前角色 +${DAILY_TASK_XP} 经验。`;
  els.claimDailyRewardBtn.disabled = !allDone || claimed;
  els.claimDailyRewardBtn.textContent = claimed ? "已领取" : "领取材料";
}

function renderDailyCalendar() {
  syncDailyHistory();
  ensureCalendarCursor();
  renderCalendarControls();
  const history = state.game.profile.dailyHistory;
  const year = state.game.calendarYear;
  const month = state.game.calendarMonth;
  const today = todayKey();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (const weekday of ["日", "一", "二", "三", "四", "五", "六"]) {
    cells.push(`<div class="calendar-weekday">${weekday}</div>`);
  }
  for (let blank = 0; blank < firstWeekday; blank += 1) {
    cells.push('<div class="calendar-day muted"></div>');
  }
  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const key = makeDateKey(year, month, dayNumber);
    const day = snapshotDailyProgress({ ...createDailyProgress(key), ...(history[key] || {}) });
    const complete = day.doneCount >= day.totalCount && day.totalCount > 0;
    const partial = day.doneCount > 0 && !complete;
    const className = ["calendar-day", key === today ? "today" : "", complete ? "complete" : partial ? "partial" : "", day.rewardClaimed ? "claimed" : ""]
      .filter(Boolean)
      .join(" ");
    cells.push(
      `<div class="${className}" title="${escapeHtml(key)}：${day.doneCount}/${day.totalCount}${day.rewardClaimed ? "，已领奖" : ""}">${dayNumber}</div>`,
    );
  }
  els.dailyCalendar.innerHTML = cells.join("");
}

function renderHudBadges() {
  const dailyNeedsAttention = !dailyAllDone(state.game.profile.daily);
  els.dailyTaskDot.classList.toggle("hidden", !dailyNeedsAttention);
  const unseenAchievements = state.game.profile.achievements.length > (state.game.profile.achievementSeenCount || 0);
  els.achievementDot.classList.toggle("hidden", !unseenAchievements);
}

function openDailyTaskModal() {
  renderDailyReward();
  renderDailyCalendar();
  els.dailyTaskModal.classList.add("show");
}

function closeDailyTaskModal() {
  els.dailyTaskModal.classList.remove("show");
}

function clampLevelPage(levels, levelMode = levelModeForDataset()) {
  const totalPages = Math.max(1, Math.ceil(levels.length / LEVELS_PER_PAGE));
  levelMode.page = clamp(Number(levelMode.page) || 0, 0, totalPages - 1);
  return totalPages;
}

function renderLevelModal() {
  const levelMode = levelModeForDataset();
  const levels = generateLevelList();
  const records = levelMode.records || {};
  const stats = levelModeStats(levelMode);
  const totalPages = clampLevelPage(levels, levelMode);
  const page = levelMode.page;
  const start = page * LEVELS_PER_PAGE;
  const pageLevels = levels.slice(start, start + LEVELS_PER_PAGE);
  els.levelSummary.innerHTML = `
    <div><span>当前数据</span><strong>${escapeHtml(levelMode.label)}</strong></div>
    <div><span>通过关卡</span><strong>${stats.cleared}/${levels.length}</strong></div>
    <div><span>累计星数</span><strong>${stats.stars}</strong></div>
    <div><span>总挑战</span><strong>${stats.attempts}</strong></div>
    <div><span>最佳收益</span><strong>${(stats.bestReturn * 100).toFixed(2)}%</strong></div>
  `;
  if (!levels.length) {
    els.levelRows.innerHTML = '<div class="level-row"><div><strong>暂无关卡</strong><span>请导入覆盖 2020 年后的 15m 数据。</span></div></div>';
    els.levelPageSelect.innerHTML = '<option value="0">第 1 / 1 页</option>';
    els.prevLevelPageBtn.disabled = true;
    els.nextLevelPageBtn.disabled = true;
    return;
  }
  els.levelPageSelect.innerHTML = Array.from({ length: totalPages }, (_, index) => {
    const first = index * LEVELS_PER_PAGE + 1;
    const last = Math.min(levels.length, (index + 1) * LEVELS_PER_PAGE);
    return `<option value="${index}">第 ${index + 1} / ${totalPages} 页（${first}-${last}关）</option>`;
  }).join("");
  els.levelPageSelect.value = String(page);
  els.prevLevelPageBtn.disabled = page <= 0;
  els.nextLevelPageBtn.disabled = page >= totalPages - 1;
  els.levelRows.innerHTML = pageLevels
    .map((level) => {
      const record = records[level.id] || {};
      const stars = record.bestStars || 0;
      const attempts = record.attempts || 0;
      const bestReturn = Number.isFinite(record.bestReturnPct) ? `${(record.bestReturnPct * 100).toFixed(2)}%` : "-";
      return `
        <div class="level-row">
          <div>
            <strong>${escapeHtml(level.title)}</strong>
            <span>${formatShortTime(level.startTime)} - ${formatShortTime(level.endTime)} / 尝试 ${attempts} 次 / 最佳收益 ${bestReturn}</span>
          </div>
          <div>
            <div class="level-stars">${starsText(stars)}</div>
            <button type="button" data-level-index="${level.index}">${stars > 0 ? "重打" : "挑战"}</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function setLevelPage(page) {
  const levelMode = levelModeForDataset();
  const levels = generateLevelList();
  const totalPages = Math.max(1, Math.ceil(levels.length / LEVELS_PER_PAGE));
  levelMode.page = clamp(Number(page) || 0, 0, totalPages - 1);
  levelMode.updatedAt = Date.now();
  saveGameProfile();
  renderLevelModal();
}

function openLevelModal() {
  if (!ensureLevelTimeframe()) return;
  renderLevelModal();
  els.levelModal.classList.add("show");
}

function closeLevelModal() {
  els.levelModal.classList.remove("show");
}

function syncUnlockedAchievements() {
  const profile = state.game.profile;
  let changed = false;
  for (const achievement of ACHIEVEMENTS) {
    if (!profile.achievements.includes(achievement.id) && achievement.test(profile)) {
      profile.achievements.push(achievement.id);
      changed = true;
    }
  }
  if (changed) saveGameProfile();
}

function renderAchievementModal() {
  const unlocked = new Set(state.game.profile.achievements);
  els.achievementAllList.innerHTML = ACHIEVEMENTS.map((item) => {
    const done = unlocked.has(item.id);
    return `
      <div class="achievement-card ${done ? "unlocked" : ""}">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.desc)}</span>
        <div class="achievement-state">${done ? "已解锁" : "未解锁"}</div>
      </div>
    `;
  }).join("");
}

function openAchievementModal() {
  renderAchievementModal();
  state.game.profile.achievementSeenCount = state.game.profile.achievements.length;
  saveGameProfile();
  renderHudBadges();
  els.achievementModal.classList.add("show");
}

function closeAchievementModal() {
  els.achievementModal.classList.remove("show");
}

function chatHistory(characterId = state.chat.activeCharacterId) {
  if (!state.chat.histories[characterId]) state.chat.histories[characterId] = [];
  return state.chat.histories[characterId];
}

function chatSystemPrompt(character) {
  return [
    `你是 BTC Replay Lab 里的二次元交易训练角色「${character.name}」。`,
    `称号：${character.title}。`,
    `性格与培养风格：${character.style}。`,
    `角色特殊规则：${character.rule}。`,
    "你正在陪玩家做历史行情回放训练，可以聊盘面、复盘、情绪管理和角色日常互动。",
    "回答要像角色本人在说话，温柔、有个性、有二次元游戏对话感，但不要太长。",
    "不要承诺真实收益，也不要把回答包装成现实投资建议；重点帮助玩家训练判断和复盘。",
  ].join("\n");
}

function renderChatCharacterSelect() {
  els.chatCharacterSelect.innerHTML = CHARACTER_CONFIG.map((character) => `<option value="${character.id}">${escapeHtml(character.name)}</option>`).join("");
  els.chatCharacterSelect.value = state.chat.activeCharacterId;
}

function renderChat() {
  const character = characterById(state.chat.activeCharacterId);
  const history = chatHistory(character.id);
  els.chatPortrait.src = characterImagePath(character);
  els.chatSpeaker.textContent = character.name;
  els.chatStreamingText.textContent = history.slice().reverse().find((item) => item.role === "assistant")?.content || activeCharacterQuote(character);
  els.chatLog.innerHTML =
    history
      .map((item) => `<div class="chat-message ${item.role === "user" ? "user" : "assistant"}">${escapeHtml(item.content)}</div>`)
      .join("") || `<div class="chat-message assistant">${escapeHtml(activeCharacterQuote(character))}</div>`;
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
  els.chatSendBtn.disabled = state.chat.isStreaming;
  els.chatInput.disabled = state.chat.isStreaming;
}

async function refreshChatStatus() {
  try {
    const response = await fetch("./api/chat/status", { cache: "no-store" });
    const status = await response.json();
    els.chatStatus.textContent = status.configured
      ? `已连接 DeepSeek ${status.model}，对话记录会按角色保存在本地。`
      : "DeepSeek API key 未配置：请设置 DEEPSEEK_API_KEY，或在项目目录创建 .deepseek_api_key。";
  } catch {
    els.chatStatus.textContent = "本地对话服务未连接，请用 start_app.py 或快捷方式启动。";
  }
}

function openCharacterChat() {
  state.chat.activeCharacterId = state.game.profile.activeCharacter || CHARACTER_CONFIG[0].id;
  renderChatCharacterSelect();
  renderChat();
  refreshChatStatus();
  els.characterChatModal.classList.add("show");
  setTimeout(() => els.chatInput.focus(), 80);
}

function closeCharacterChat() {
  els.characterChatModal.classList.remove("show");
}

function changeChatCharacter(characterId) {
  state.chat.activeCharacterId = characterId;
  renderChat();
  refreshChatStatus();
}

async function sendChatMessage() {
  const text = els.chatInput.value.trim();
  if (!text || state.chat.isStreaming) return;
  const character = characterById(state.chat.activeCharacterId);
  const history = chatHistory(character.id);
  history.push({ role: "user", content: text, time: Date.now() });
  els.chatInput.value = "";
  state.chat.isStreaming = true;
  renderChat();
  els.chatStreamingText.textContent = "";
  els.chatStatus.textContent = `${character.name} 正在回应...`;

  const messages = [
    { role: "system", content: chatSystemPrompt(character) },
    ...history.slice(-20).map((item) => ({ role: item.role, content: item.content })),
  ];

  try {
    const response = await fetch("./api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: character.id, messages }),
    });
    if (!response.ok || !response.body) {
      let detail = "";
      try {
        detail = (await response.json()).error || "";
      } catch {
        detail = await response.text();
      }
      throw new Error(detail || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let answer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      answer += decoder.decode(value, { stream: true });
      els.chatStreamingText.textContent = answer;
    }
    answer += decoder.decode();
    const finalAnswer = answer.trim() || "……我刚刚好像走神了，再说一次好吗？";
    history.push({ role: "assistant", content: finalAnswer, time: Date.now() });
    state.chat.histories[character.id] = history.slice(-60);
    saveChatHistories();
    els.chatStatus.textContent = "对话已保存到本地。";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    history.push({ role: "assistant", content: `连接失败：${message}`, time: Date.now() });
    els.chatStatus.textContent = "对话请求失败，请检查 API key 或网络。";
  } finally {
    state.chat.isStreaming = false;
    saveChatHistories();
    renderChat();
  }
}

function clearChatHistory() {
  if (state.chat.isStreaming) return;
  state.chat.histories[state.chat.activeCharacterId] = [];
  saveChatHistories();
  renderChat();
  showToast("已清空当前角色对话记录");
}

function renderGame() {
  if (!els.levelValue) return;
  ensureTodayDailyProgress();
  applyCompletedDailyTaskRewards(false);
  syncUnlockedAchievements();
  const profile = state.game.profile;
  const level = levelFromXp(profile.xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpProgress = clamp(((profile.xp - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp)) * 100, 0, 100);
  const active = state.game.active;

  els.levelValue.textContent = `Lv.${level}`;
  els.levelTitle.textContent = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  els.streakValue.textContent = `${profile.streak || 0} 天`;
  els.xpFill.style.width = `${xpProgress}%`;
  els.xpText.textContent = `${profile.xp - currentLevelXp} / ${nextLevelXp - currentLevelXp} XP`;
  renderCharacterPanel();

  if (active) {
    const progress = clamp(((state.currentIndex - active.startIndex) / Math.max(1, active.endIndex - active.startIndex)) * 100, 0, 100);
    els.challengeTitle.textContent = active.title;
    els.challengeText.textContent = `${active.text} 进度 ${progress.toFixed(0)}%，终点还剩 ${Math.max(0, active.endIndex - state.currentIndex)} 根。`;
  } else {
    const avg = profile.stats.completed ? Math.round(profile.stats.totalScore / profile.stats.completed) : 0;
    els.challengeTitle.textContent = "今日开一局";
    els.challengeText.textContent = profile.stats.completed ? `已完成 ${profile.stats.completed} 局，平均 ${avg} 分。` : "选择一个模式，系统会直接抽取历史行情片段。";
  }

  for (const [button, bias] of [
    [els.biasLongBtn, "long"],
    [els.biasShortBtn, "short"],
    [els.biasFlatBtn, "flat"],
  ]) {
    button.classList.toggle("active", active?.bias === bias);
    button.disabled = !active;
  }
  els.settleGameBtn.disabled = !active;

  const dailyRewards = profile.daily.taskRewards || {};
  els.dailyTaskList.innerHTML = dailyTasks()
    .map((task) => {
      const reward = dailyRewards[task.id];
      const rewardText = task.done && reward ? ` · +${reward.xp || DAILY_TASK_XP}XP` : "";
      return `<div class="task-item ${task.done ? "done" : ""}">${task.done ? "已完成" : task.progress} · ${escapeHtml(task.text)}${rewardText}</div>`;
    })
    .join("");
  renderDailyReward();
  renderDailyCalendar();

  const unlocked = profile.achievements
    .slice()
    .reverse()
    .slice(0, 5)
    .map((id) => ACHIEVEMENTS.find((item) => item.id === id))
    .filter(Boolean);
  els.achievementList.innerHTML =
    unlocked.map((item) => `<div class="achievement-item unlocked"><strong>${escapeHtml(item.name)}</strong><br>${escapeHtml(item.desc)}</div>`).join("") ||
    '<div class="achievement-item">还没有成就。打一局，第一枚徽章就会亮。</div>';
  renderAchievementModal();
  renderHudBadges();
}

function renderCharacterPanel() {
  const profile = state.game.profile;
  const character = activeCharacter();
  const charState = profile.characters[character.id];
  const level = characterLevelFromXp(charState.xp, charState.stage);
  const currentLevelXp = characterXpForLevel(level);
  const nextLevelXp = characterXpForLevel(Math.min(level + 1, charState.stage * 20 + 1));
  const xpProgress = level >= charState.stage * 20 ? 100 : clamp(((charState.xp - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp)) * 100, 0, 100);
  const trialSuccesses = charState.trialWindow.filter(Boolean).length;
  const ascensionNeed = charState.stage * 12;

  els.characterPortrait.src = characterImagePath(character);
  els.characterTitle.textContent = character.title;
  els.characterName.textContent = character.name;
  els.characterLevel.textContent = `Lv.${level} · ${stageName(charState.stage)}`;
  els.characterXpFill.style.width = `${xpProgress}%`;
  els.characterText.textContent = activeCharacterQuote(character);
  els.characterRuleCard.innerHTML = `
    <strong>${escapeHtml(character.name)} 的特殊规则</strong>
    <span>${escapeHtml(character.rule)}</span><br>
    <span>适合试炼：${escapeHtml(CHALLENGE_TYPES[character.challengeType]?.name || "盲测快局")}；培养风格：${escapeHtml(character.style)}</span>
  `;
  els.characterQuestBtn.textContent = `开启 ${character.name} 试炼`;
  els.ascensionTrialBtn.textContent = `开启 ${character.name} 进阶试炼`;
  els.characterGrid.innerHTML = CHARACTER_CONFIG.map((item) => {
    const itemState = profile.characters[item.id];
    const itemLevel = characterLevelFromXp(itemState.xp, itemState.stage);
    return `
      <button class="character-pick ${item.id === character.id ? "active" : ""}" type="button" data-character="${item.id}" title="${escapeHtml(item.name)} Lv.${itemLevel}">
        <img src="${characterImagePath(item)}" alt="${escapeHtml(item.name)}" />
        <span>${escapeHtml(item.name)}</span>
      </button>
    `;
  }).join("");
  els.characterMaterialList.innerHTML = `
    <div class="material-item"><span>${escapeHtml(character.material)}</span><strong>${charState.materials}/${ascensionNeed}</strong></div>
    <div class="material-item"><span>进阶门槛</span><strong>特殊试炼收益 >= 5%</strong></div>
    <div class="material-item"><span>角色试炼</span><strong>${trialSuccesses}/10 成功</strong></div>
    <div class="material-item"><span>培养风格</span><strong>${escapeHtml(character.style)}</strong></div>
  `;
}

function settlementReviewCharacter(settlement = state.game.lastSettlement) {
  return characterById(settlement?.reviewerId || state.game.profile.activeCharacter);
}

function renderSettlementReview() {
  const settlement = state.game.lastSettlement;
  if (!settlement || !els.settlementReviewText) return;
  const character = settlementReviewCharacter(settlement);
  const review = state.game.settlementReview;
  els.settlementReviewPortrait.src = characterImagePath(character);
  els.settlementReviewTitle.textContent = `${character.name} 的角色点评`;
  els.settlementReviewStatus.textContent = review.isStreaming
    ? "正在阅读本局交易记录..."
    : `${settlement.reviewerReason || "独立角色复盘"}，不会写入日常聊天。`;
  els.settlementReviewText.textContent =
    review.text ||
    (review.isStreaming ? "正在整理点评..." : "结算后会自动生成点评；如果本地对话服务不可用，这里会显示原因。");
}

function settlementReviewMessages(settlement, character) {
  const history = (state.chat.histories[character.id] || []).slice(-10).map((item) => ({
    role: item.role === "user" ? "user" : "assistant",
    content: item.content,
  }));
  const report = settlement.report || {};
  const trades = report.trades?.length
    ? report.trades
        .map((trade, index) => {
          const risk = [trade.stopPrice ? `SL ${trade.stopPrice}` : "", trade.takePrice ? `TP ${trade.takePrice}` : ""].filter(Boolean).join(" / ");
          const result = [trade.realizedPnl ? `PnL ${trade.realizedPnl}` : "", trade.r ? `${trade.r}R` : ""].filter(Boolean).join(" / ");
          const note = [trade.reason, ...(trade.tags || [])].filter(Boolean).join(" / ");
          return `${index + 1}. ${trade.time} ${trade.side} @ ${trade.price} qty ${trade.qty}${risk ? ` (${risk})` : ""}${result ? ` -> ${result}` : ""}${trade.auto ? " [自动]" : ""}${note ? `；备注：${note}` : ""}`;
        })
        .join("\n")
    : "本局没有交易。";
  const bookmarks = report.bookmarks?.length
    ? report.bookmarks.map((mark) => `- ${mark.time} $${priceFmt.format(mark.price)} ${mark.text || ""} ${(mark.tags || []).join(" / ")}`).join("\n")
    : "无标注。";

  return [
    {
      role: "system",
      content: [
        chatSystemPrompt(character),
        "这是一次独立训练复盘，不要把这次回复写成日常聊天续篇，也不要要求玩家继续提供行情截图。",
        "你可以参考前面的日常聊天来保持角色语气和熟悉感，但本次点评不会保存进聊天历史。",
        "输出要像游戏结算后的角色点评：先给一句角色化总评，再指出 2-3 个具体做得好或需要修正的点，最后给下一局一个可执行训练目标。",
      ].join("\n"),
    },
    ...history,
    {
      role: "user",
      content: [
        `请按「${character.name}」的人设点评这局训练。`,
        "",
        `训练标题：${settlement.title}`,
        `训练类型：${settlement.typeLabel || challengeTypeLabel(settlement.type)}`,
        `数据：${report.fileName || "-"} / ${report.timeframe || "-"}`,
        `区间：${report.startTime || "-"} -> ${report.endTime || "-"}`,
        `判断：${report.bias || "-"}；实际：${report.expected || "-"}；行情涨跌幅：${((report.movePct || 0) * 100).toFixed(2)}%`,
        `评分：${settlement.score}/100${settlement.levelStars == null ? "" : `；关卡星级：${settlement.levelStars}/5`}`,
        `收益：${((report.returnPct || 0) * 100).toFixed(2)}%；权益：$${money.format(report.equity || 0)}；PnL：${report.pnl >= 0 ? "+" : ""}$${money.format(report.pnl || 0)}`,
        `最大回撤：${((report.maxDrawdown || 0) * 100).toFixed(1)}%；R 倍数：${Number.isFinite(report.sumR) ? report.sumR.toFixed(2) : "0.00"}R；交易数：${report.tradeCount || 0}`,
        `是否带止损：${report.hasStop ? "是" : "否"}；是否有复盘文字：${report.reviewed ? "是" : "否"}`,
        "",
        `玩家交易理由：${report.tradeReason || "无"}`,
        `玩家总复盘：${report.notes || "无"}`,
        `勾选标签：${(report.tags || []).join(" / ") || "无"}`,
        "",
        "交易记录：",
        trades,
        "",
        "标注：",
        bookmarks,
      ].join("\n"),
    },
  ];
}

async function requestSettlementCharacterReview(settlementId = state.game.lastSettlement?.id) {
  const settlement = state.game.lastSettlement;
  const review = state.game.settlementReview;
  if (!settlement || settlement.id !== settlementId || review.isStreaming || review.text) return;
  const character = settlementReviewCharacter(settlement);
  review.isStreaming = true;
  review.text = "";
  renderSettlementReview();

  try {
    const response = await fetch("./api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: character.id,
        messages: settlementReviewMessages(settlement, character),
      }),
    });
    if (!response.ok || !response.body) {
      let detail = "";
      try {
        detail = (await response.json()).error || "";
      } catch {
        detail = await response.text();
      }
      throw new Error(detail || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      review.text += decoder.decode(value, { stream: true });
      els.settlementReviewText.textContent = review.text;
    }
    review.text += decoder.decode();
    review.text = review.text.trim() || `${character.name} 这次没有说出完整点评。`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    review.text = `角色点评生成失败：${message}`;
  } finally {
    review.isStreaming = false;
    renderSettlementReview();
  }
}

function showSettlement() {
  const settlement = state.game.lastSettlement;
  if (!settlement) return;
  if (state.game.settlementReview.settlementId !== settlement.id) {
    state.game.settlementReview = {
      settlementId: settlement.id,
      isStreaming: false,
      text: "",
    };
  }
  els.settlementTitle.textContent = `${settlement.title} 结算`;
  els.settlementScore.textContent = String(settlement.score);
  els.settlementBreakdown.innerHTML = settlement.lines
    .map((line) => `<div class="score-line">${escapeHtml(line)}</div>`)
    .join("");
  const rewards = [`获得 ${settlement.earnedXp} XP`];
  if (settlement.levelStars != null) {
    const record = state.game.lastLevelRecord;
    rewards.push(`关卡星级：${starsText(settlement.levelStars)}，历史最佳 ${starsText(record?.bestStars || settlement.levelStars)}`);
  }
  for (const achievement of settlement.newAchievements) {
    rewards.push(`解锁成就：${achievement.name}`);
  }
  const gain = state.game.lastCharacterGain;
  if (gain) {
    rewards.push(`${gain.character.name} 获得 ${gain.xp} 经验`);
    if (gain.ascensionTrial) {
      rewards.push(gain.ascensionPassed ? `进阶试炼通过：${gain.character.material} +${gain.materials}` : "进阶试炼未通过：本局收益未达到 5%，进阶材料 +0");
    } else {
      rewards.push("普通角色试炼只给经验；进阶材料需要特殊试炼。");
    }
    if (gain.afterLevel > gain.beforeLevel) rewards.push(`${gain.character.name} 升到 Lv.${gain.afterLevel}`);
    if (gain.ascended) rewards.push(`${gain.character.name} 进阶为 ${stageName(gain.afterStage)}`);
  }
  els.settlementRewards.innerHTML = rewards.map((line) => `<div class="reward-item">${escapeHtml(line)}</div>`).join("");
  renderSettlementReview();
  els.settlementModal.classList.add("show");
  window.setTimeout(() => requestSettlementCharacterReview(settlement.id), 0);
}

function closeSettlement() {
  els.settlementModal.classList.remove("show");
}

function addBookmark() {
  const candle = currentCandle();
  if (!candle) return;
  const text = els.bookmarkInput.value.trim();
  const tags = selectedTags();
  state.bookmarks.push({
    id: uniqueId("mark"),
    time: candle.time,
    price: candle.close,
    text,
    tags,
  });
  els.bookmarkInput.value = "";
  render();
  showToast("已添加标注");
}

function addHorizontalLine() {
  const candle = currentCandle();
  if (!candle) return;
  const text = els.bookmarkInput.value.trim();
  state.annotations.push({
    id: uniqueId("line"),
    time: candle.time,
    price: candle.close,
    label: text || "水平线",
    color: "#f0b90b",
  });
  render();
  showToast(`已添加水平线 $${priceFmt.format(candle.close)}`);
}

function clearLines() {
  state.annotations = [];
  render();
  showToast("已清除水平线");
}

function buildSession() {
  const candle = currentCandle();
  return {
    id: els.sessionSelect.value && els.sessionSelect.value !== "" ? els.sessionSelect.value : uniqueId("session"),
    name: els.sessionNameInput.value.trim() || `训练 ${new Date().toLocaleString("zh-CN", { hour12: false })}`,
    savedAt: Date.now(),
    fileName: state.fileName,
    sourceIntervalMs: state.sourceIntervalMs,
    timeframeValue: els.timeframeSelect.value,
    currentTime: candle?.time ?? null,
    viewWidth: state.viewEnd - state.viewStart,
    settings: {
      hideFuture: state.hideFuture,
      blindMode: state.blindMode,
      dateRevealed: state.dateRevealed,
      logScale: state.logScale,
      showMA20: state.showMA20,
      showMA60: state.showMA60,
      fee: Number(els.feeInput.value) || 0,
      riskPct: Number(els.riskPctInput.value) || 1,
      selectedTags: selectedTags(),
    },
    notes: els.sessionNotesInput.value,
    account: state.account,
    bookmarks: state.bookmarks,
    annotations: state.annotations,
  };
}

function saveSession() {
  const session = buildSession();
  const sessions = readSessions();
  const index = sessions.findIndex((item) => item.id === session.id);
  if (index >= 0) sessions[index] = session;
  else sessions.push(session);
  writeSessions(sessions);
  refreshSessionSelect();
  els.sessionSelect.value = session.id;
  showToast("训练会话已保存");
}

function loadSelectedSession() {
  const id = els.sessionSelect.value;
  const session = readSessions().find((item) => item.id === id);
  if (!session) return;

  state.hideFuture = session.settings?.hideFuture ?? true;
  state.blindMode = session.settings?.blindMode ?? false;
  state.dateRevealed = session.settings?.dateRevealed ?? !state.blindMode;
  state.logScale = session.settings?.logScale ?? true;
  state.showMA20 = session.settings?.showMA20 ?? true;
  state.showMA60 = session.settings?.showMA60 ?? false;
  state.account = {
    ...createAccount(session.account?.initialCash ?? 10_000),
    ...(session.account || {}),
  };
  state.bookmarks = session.bookmarks || [];
  state.annotations = session.annotations || [];

  els.sessionNameInput.value = session.name || "";
  els.sessionNotesInput.value = session.notes || "";
  els.feeInput.value = session.settings?.fee ?? els.feeInput.value;
  els.riskPctInput.value = session.settings?.riskPct ?? els.riskPctInput.value;
  els.initialCashInput.value = state.account.initialCash;
  els.stopLossInput.value = state.account.stopPrice ?? "";
  els.takeProfitInput.value = state.account.takePrice ?? "";
  setSelectedTags(session.settings?.selectedTags || []);

  if (session.timeframeValue) els.timeframeSelect.value = session.timeframeValue;
  if (state.sourceCandles.length && session.currentTime) {
    applyTimeframe(true, session.currentTime);
    clampView(state.currentIndex + 1 - (session.viewWidth || 220), state.currentIndex + 1);
  }
  render();
  showToast(state.sourceCandles.length ? "已载入会话" : "已载入会话，请再导入对应 CSV");
}

function deleteSelectedSession() {
  const id = els.sessionSelect.value;
  if (!id) return;
  const sessions = readSessions().filter((session) => session.id !== id);
  writeSessions(sessions);
  refreshSessionSelect();
  showToast("已删除会话");
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadText(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportTrades() {
  const header = ["time", "side", "price", "qty", "fee", "realized_pnl", "r", "reason", "tags"].join(",");
  const rows = state.account.trades.map((trade) =>
    [
      formatTime(trade.time),
      trade.side,
      trade.price,
      trade.qty,
      trade.fee,
      trade.realizedPnl ?? "",
      trade.r ?? "",
      trade.reason || "",
      (trade.tags || []).join("|"),
    ]
      .map(csvEscape)
      .join(","),
  );
  downloadText("btc-replay-trades.csv", [header, ...rows].join("\n"), "text/csv;charset=utf-8");
}

function exportReport() {
  const candle = currentCandle();
  const stats = accountStats(candle?.close ?? 0);
  const lines = [
    `# ${els.sessionNameInput.value.trim() || "BTC Replay 训练报告"}`,
    "",
    `- 数据文件: ${state.fileName || "-"}`,
    `- 周期: ${formatInterval(state.timeframeMs)}`,
    `- 当前时间: ${candle ? formatTime(candle.time) : "-"}`,
    `- 权益: $${money.format(stats.equity)}`,
    `- 收益: ${stats.pnl >= 0 ? "+" : ""}$${money.format(stats.pnl)}`,
    `- 胜率: ${stats.winRate == null ? "-" : `${stats.winRate.toFixed(1)}%`}`,
    `- 最大回撤: ${(stats.maxDrawdown * 100).toFixed(1)}%`,
    `- R 倍数: ${stats.sells.length ? `${stats.sumR.toFixed(2)}R` : "-"}`,
    "",
    "## 总复盘",
    "",
    els.sessionNotesInput.value || "暂无",
    "",
    "## 标注",
    "",
    ...(state.bookmarks.length
      ? state.bookmarks.map((mark) => `- ${formatTime(mark.time)} $${priceFmt.format(mark.price)} ${mark.text || ""} ${(mark.tags || []).join(" / ")}`)
      : ["暂无"]),
    "",
    "## 交易",
    "",
    ...(state.account.trades.length
      ? state.account.trades.map((trade) => `- ${formatTime(trade.time)} ${tradeSideLabel(trade)} $${priceFmt.format(trade.price)} ${btcFmt.format(trade.qty)} BTC ${trade.reason || ""}`)
      : ["暂无"]),
  ];
  downloadText("btc-replay-report.md", lines.join("\n"), "text/markdown;charset=utf-8");
}

function saveScreenshot() {
  renderChart();
  els.canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "btc-replay-chart.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
}

function bindEvents() {
  els.brandAvatarSelect.addEventListener("change", () => {
    state.brandAvatarChoice = els.brandAvatarSelect.value;
    saveSettings();
    syncSettingControls();
  });

  els.fileInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      setStatus(`正在解析 ${file.name} ...`);
      const text = await file.text();
      const candles = parseCsv(text);
      loadCandles(candles, file.name);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "CSV 解析失败。");
    } finally {
      els.fileInput.value = "";
    }
  });

  els.timeframeSelect.addEventListener("change", () => applyTimeframe(true));
  els.hideFutureToggle.addEventListener("change", () => {
    state.hideFuture = els.hideFutureToggle.checked;
    clampView(state.viewStart, state.viewEnd);
    saveSettings();
    render();
  });
  els.blindModeToggle.addEventListener("change", () => {
    state.blindMode = els.blindModeToggle.checked;
    state.dateRevealed = !state.blindMode;
    saveSettings();
    render();
  });
  els.logScaleToggle.addEventListener("change", () => {
    state.logScale = els.logScaleToggle.checked;
    saveSettings();
    render();
  });
  els.ma20Toggle.addEventListener("change", () => {
    state.showMA20 = els.ma20Toggle.checked;
    saveSettings();
    render();
  });
  els.ma60Toggle.addEventListener("change", () => {
    state.showMA60 = els.ma60Toggle.checked;
    saveSettings();
    render();
  });

  els.timeline.addEventListener("input", () => revealTo(Number(els.timeline.value), true));
  els.firstBtn.addEventListener("click", () => revealTo(0, true));
  els.backBtn.addEventListener("click", () => stepBy(-1));
  els.playBtn.addEventListener("click", togglePlayback);
  els.forwardBtn.addEventListener("click", () => stepBy(1));
  els.plusTenBtn.addEventListener("click", () => stepBy(10));
  els.latestBtn.addEventListener("click", () => revealTo(state.candles.length - 1, true));
  els.randomBtn.addEventListener("click", () => randomTraining(false));
  els.blindRandomBtn.addEventListener("click", () => randomTraining(true));
  els.revealDateBtn.addEventListener("click", () => {
    state.dateRevealed = true;
    render();
    showToast("日期已揭晓");
  });
  els.speedSelect.addEventListener("change", resetPlaybackTimer);
  els.jumpBtn.addEventListener("click", () => {
    if (!state.candles.length || !els.jumpInput.value) return;
    const target = new Date(els.jumpInput.value).getTime();
    revealTo(findIndexAtOrBefore(state.candles, target), true);
  });

  els.resetAccountBtn.addEventListener("click", () => resetAccount(true));
  els.riskBuyBtn.addEventListener("click", executeRiskBuy);
  els.closePositionBtn.addEventListener("click", () => closePosition());
  els.attachStopsBtn.addEventListener("click", setStopsFromInputs);
  els.clearStopsBtn.addEventListener("click", clearStops);
  [els.feeInput, els.riskPctInput, els.initialCashInput].forEach((input) => {
    input.addEventListener("change", saveSettings);
  });

  document.querySelectorAll("[data-side][data-pct]").forEach((button) => {
    button.addEventListener("click", () => {
      executeTrade(button.dataset.side, Number(button.dataset.pct));
    });
  });

  els.addBookmarkBtn.addEventListener("click", addBookmark);
  els.addHlineBtn.addEventListener("click", addHorizontalLine);
  els.clearLinesBtn.addEventListener("click", clearLines);
  els.saveSessionBtn.addEventListener("click", saveSession);
  els.loadSessionBtn.addEventListener("click", loadSelectedSession);
  els.deleteSessionBtn.addEventListener("click", deleteSelectedSession);
  els.exportTradesBtn.addEventListener("click", exportTrades);
  els.exportReportBtn.addEventListener("click", exportReport);
  els.screenshotBtn.addEventListener("click", saveScreenshot);
  els.characterGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-character]");
    if (!button) return;
    state.game.profile.activeCharacter = button.dataset.character;
    state.game.activeQuoteCharacterId = null;
    state.game.activeQuote = "";
    saveGameProfile();
    syncSettingControls();
    renderGame();
    showToast(`已切换到 ${activeCharacter().name}`);
  });
  els.characterQuestBtn.addEventListener("click", () => {
    startCharacterTrial("normal");
  });
  els.ascensionTrialBtn.addEventListener("click", () => {
    startCharacterTrial("ascension");
  });
  els.quickGameBtn.addEventListener("click", () => startChallenge("blind"));
  els.trendGameBtn.addEventListener("click", () => startChallenge("trend"));
  els.trapGameBtn.addEventListener("click", () => startChallenge("trap"));
  els.survivalGameBtn.addEventListener("click", () => startChallenge("survival"));
  els.revengeGameBtn.addEventListener("click", () => startChallenge("revenge"));
  els.levelGameBtn.addEventListener("click", () => startLevelChallenge());
  els.levelListBtn.addEventListener("click", openLevelModal);
  els.prevLevelPageBtn.addEventListener("click", () => setLevelPage((Number(levelModeForDataset().page) || 0) - 1));
  els.nextLevelPageBtn.addEventListener("click", () => setLevelPage((Number(levelModeForDataset().page) || 0) + 1));
  els.levelPageSelect.addEventListener("change", () => setLevelPage(Number(els.levelPageSelect.value)));
  els.levelRows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-level-index]");
    if (!button) return;
    closeLevelModal();
    startLevelChallenge(Number(button.dataset.levelIndex));
  });
  els.closeLevelModalBtn.addEventListener("click", closeLevelModal);
  els.levelModal.addEventListener("click", (event) => {
    if (event.target === els.levelModal) closeLevelModal();
  });
  els.settleGameBtn.addEventListener("click", () => finishChallenge("manual"));
  els.dailyTaskHudBtn.addEventListener("click", openDailyTaskModal);
  els.closeDailyTaskBtn.addEventListener("click", closeDailyTaskModal);
  els.claimDailyRewardBtn.addEventListener("click", claimDailyReward);
  els.prevCalendarMonthBtn.addEventListener("click", () => moveCalendarMonth(-1));
  els.nextCalendarMonthBtn.addEventListener("click", () => moveCalendarMonth(1));
  els.dailyCalendarYearSelect.addEventListener("change", () => {
    state.game.calendarYear = Number(els.dailyCalendarYearSelect.value);
    renderDailyCalendar();
  });
  els.dailyCalendarMonthSelect.addEventListener("change", () => {
    state.game.calendarMonth = Number(els.dailyCalendarMonthSelect.value);
    renderDailyCalendar();
  });
  els.biasLongBtn.addEventListener("click", () => setChallengeBias("long"));
  els.biasShortBtn.addEventListener("click", () => setChallengeBias("short"));
  els.biasFlatBtn.addEventListener("click", () => setChallengeBias("flat"));
  els.closeSettlementBtn.addEventListener("click", closeSettlement);
  els.achievementAllBtn.addEventListener("click", openAchievementModal);
  els.closeAchievementBtn.addEventListener("click", closeAchievementModal);
  els.nextChallengeBtn.addEventListener("click", () => {
    closeSettlement();
    startChallenge(state.game.lastType || "blind");
  });
  els.reviewMistakeBtn.addEventListener("click", () => {
    closeSettlement();
    startChallenge("revenge");
  });
  els.settlementModal.addEventListener("click", (event) => {
    if (event.target === els.settlementModal) closeSettlement();
  });
  els.dailyTaskModal.addEventListener("click", (event) => {
    if (event.target === els.dailyTaskModal) closeDailyTaskModal();
  });
  els.achievementModal.addEventListener("click", (event) => {
    if (event.target === els.achievementModal) closeAchievementModal();
  });
  els.characterChatHudBtn.addEventListener("click", openCharacterChat);
  els.closeCharacterChatBtn.addEventListener("click", closeCharacterChat);
  els.characterChatModal.addEventListener("click", (event) => {
    if (event.target === els.characterChatModal) closeCharacterChat();
  });
  els.chatCharacterSelect.addEventListener("change", () => changeChatCharacter(els.chatCharacterSelect.value));
  els.chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendChatMessage();
    }
  });
  els.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendChatMessage();
  });
  els.chatClearBtn.addEventListener("click", clearChatHistory);

  const handleChartDrag = (event) => {
    if (!state.drag) return;
    const point = canvasPoint(event);
    const metrics = chartMetrics();

    const distance = Math.hypot(point.x - state.drag.x, point.y - state.drag.y);
    if (distance > 4) state.drag.moved = true;

    if (state.drag.mode === "scrub") {
      const delta = Math.round((point.x - state.drag.x) / scrubPixelsPerCandle(event));
      const target = clamp(state.drag.index + delta, 0, state.candles.length - 1);
      if (target !== state.currentIndex) {
        state.followCurrent = true;
        revealTo(target, false);
      } else {
        renderChart();
      }
    } else if (state.drag.mode === "pending" && state.drag.moved) {
      state.drag.mode = "pan";
    }

    if (state.drag?.mode === "pan") {
      const width = Math.max(1, state.drag.end - state.drag.start);
      const candleDelta = Math.round(((state.drag.x - point.x) / Math.max(1, metrics.plotWidth)) * width);
      state.followCurrent = false;
      clampView(state.drag.start + candleDelta, state.drag.end + candleDelta);
      state.hover = point;
      renderChart();
    }
  };

  els.canvas.addEventListener("mousemove", (event) => {
    if (state.drag) return;
    const point = canvasPoint(event);
    const metrics = chartMetrics();
    state.hover = point;
    els.canvas.style.cursor = isNearCurrentLine(point, metrics) ? "ew-resize" : "crosshair";
    renderChart();
  });
  window.addEventListener("mousemove", (event) => {
    handleChartDrag(event);
  });
  els.canvas.addEventListener("mouseleave", () => {
    state.hover = null;
    if (!state.drag) els.canvas.style.cursor = "crosshair";
    els.tooltip.style.display = "none";
    renderChart();
  });
  els.canvas.addEventListener("mousedown", (event) => {
    if (!state.candles.length || event.button !== 0) return;
    const point = canvasPoint(event);
    const metrics = chartMetrics();
    stopPlayback();
    if (isNearCurrentLine(point, metrics)) {
      state.drag = {
        mode: "scrub",
        x: point.x,
        y: point.y,
        index: state.currentIndex,
        moved: false,
      };
      els.canvas.style.cursor = "ew-resize";
      return;
    }
    state.drag = {
      mode: "pending",
      x: point.x,
      y: point.y,
      start: state.viewStart,
      end: state.viewEnd,
      moved: false,
    };
  });
  window.addEventListener("mouseup", (event) => {
    if (state.drag?.mode === "pending" && !state.drag.moved) {
      const point = canvasPoint(event);
      const metrics = chartMetrics();
      if (pointInChart(point, metrics)) {
        state.followCurrent = false;
        revealTo(indexFromChartX(point.x, metrics), false);
        state.lastClickAt = Date.now();
      }
    }
    state.drag = null;
    els.canvas.style.cursor = "crosshair";
  });
  els.canvas.addEventListener(
    "wheel",
    (event) => {
      if (!state.candles.length) return;
      event.preventDefault();
      const metrics = chartMetrics();
      const point = canvasPoint(event);
      const width = state.viewEnd - state.viewStart;
      const ratio = clamp((point.x - metrics.plotLeft) / Math.max(1, metrics.plotWidth), 0, 1);
      const nextWidth = clamp(Math.round(width * (event.deltaY > 0 ? 1.18 : 0.84)), 20, maxChartIndex() + 1);
      const center = state.viewStart + width * ratio;
      const nextStart = center - nextWidth * ratio;
      state.followCurrent = false;
      clampView(nextStart, nextStart + nextWidth);
      render();
    },
    { passive: false },
  );
  els.canvas.addEventListener("dblclick", () => {
    state.followCurrent = true;
    centerOnCurrent(state.viewEnd - state.viewStart || 220);
    render();
  });

  window.addEventListener("resize", render);
  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.code === "Space") {
      event.preventDefault();
      togglePlayback();
    } else if (event.code === "ArrowRight") {
      event.preventDefault();
      stepBy(event.ctrlKey || event.metaKey ? 50 : event.shiftKey ? 10 : 1);
    } else if (event.code === "ArrowLeft") {
      event.preventDefault();
      stepBy(event.ctrlKey || event.metaKey ? -50 : event.shiftKey ? -10 : -1);
    } else if (event.code === "PageDown") {
      event.preventDefault();
      stepBy(25);
    } else if (event.code === "PageUp") {
      event.preventDefault();
      stepBy(-25);
    } else if (event.code === "Home") {
      event.preventDefault();
      revealTo(0, true);
    } else if (event.code === "End") {
      event.preventDefault();
      revealTo(state.candles.length - 1, true);
    } else if (event.key.toLowerCase() === "b") {
      executeTrade("buy", 1);
    } else if (event.key.toLowerCase() === "s") {
      executeTrade("sell", 1);
    } else if (event.key.toLowerCase() === "c") {
      closePosition();
    } else if (event.key.toLowerCase() === "m") {
      addBookmark();
    } else if (event.key.toLowerCase() === "h") {
      addHorizontalLine();
    }
  });
}

loadSettings();
loadGameProfile();
loadChatHistories();
syncSettingControls();
refreshSessionSelect();
bindEvents();
render();
autoLoadDefaultCsv();
