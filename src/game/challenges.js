"use strict";

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
