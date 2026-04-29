"use strict";

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
