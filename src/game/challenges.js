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
  state.game._clearEyeLastStep = 0;
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
  clearTradeDraftInputs();
  els.bookmarkInput.value = "";
  els.stopLossInput.value = "";
  els.takeProfitInput.value = "";
  revealTo(startIndex, true);
  showToast(`${config.name} 开局：先选方向，再推进行情。`);
}

function startLevelChallenge(levelIndex = null) {
  if (!ensureLevelTimeframe()) return;
  const mode = currentLevelSpanMode();
  const levels = generateLevelList(mode);
  if (!levels.length) {
    showToast("没有生成可用关卡。请确认数据覆盖 2020 年之后且为 15m。");
    return;
  }
  const targetIndex = levelIndex == null ? nextLevelIndex(levels) : clamp(levelIndex, 0, levels.length - 1);
  const level = levels[targetIndex];
  const config = CHALLENGE_TYPES.level;
  const startCandle = state.candles[level.startIndex];
  const dataset = currentLevelDatasetInfo();
  const bucketInfo = currentLevelBucketInfo(mode, dataset);

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
    text: levelChallengeText(mode),
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
    levelDatasetKey: bucketInfo.key,
    levelDatasetLabel: bucketInfo.label,
    levelBaseDatasetKey: dataset.key,
    levelBaseDatasetLabel: dataset.label,
    levelSpanModeId: mode.id,
    levelSpanModeLabel: mode.label,
    startedAt: Date.now(),
    tradesAtStart: 0,
    bookmarksAtStart: 0,
  };
  state.game.lastType = "level";
  state.hideFuture = true;
  state.blindMode = false;
  state.dateRevealed = true;
  els.sessionNameInput.value = level.title;
  clearTradeDraftInputs();
  els.bookmarkInput.value = "";
  els.stopLossInput.value = "";
  els.takeProfitInput.value = "";
  revealTo(level.startIndex, true);
  showToast(`${level.title} 开始：${mode.label}，目标 5 星通关。`);
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

function gameModeTrade(targetSide) {
  const active = state.game.active;
  if (!active?.gameMode || state.game.settling) return;
  const current = positionSide();
  if (targetSide === "buy") {
    if (!active.bias) setChallengeBias("long");
    if (current === "long") return;
    if (current === "short") executeTrade("cover", 1, { skipCharacterRules: true });
    executeTrade("buy", 1, { skipCharacterRules: true });
  } else if (targetSide === "short") {
    if (!active.bias) setChallengeBias("short");
    if (current === "short") return;
    if (current === "long") executeTrade("sell", 1, { skipCharacterRules: true });
    executeTrade("short", 1, { skipCharacterRules: true });
  }
}

function startGameLevelChallenge(levelIndex = null) {
  if (!ensureLevelTimeframe()) return;
  const mode = currentLevelSpanMode();
  const levels = generateLevelList(mode);
  if (!levels.length) {
    showToast("没有生成可用关卡。请确认数据覆盖 2020 年之后且为 15m。");
    return;
  }
  const targetIndex = levelIndex == null ? nextLevelIndex(levels) : clamp(levelIndex, 0, levels.length - 1);
  const level = levels[targetIndex];
  const startCandle = state.candles[level.startIndex];
  const dataset = currentLevelDatasetInfo();
  const bucketInfo = currentLevelBucketInfo(mode, dataset);

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
    id: uniqueId("game"),
    type: "level",
    title: `${level.title}（${mode.label}）`,
    text: "按 ↑ 做多 100%，按 ↓ 做空 100%，每按一次 K 线前进一格。",
    startIndex: level.startIndex,
    endIndex: level.endIndex,
    startTime: startCandle.time,
    startPrice: startCandle.close,
    horizon: level.endIndex - level.startIndex,
    xp: CHALLENGE_TYPES.level.xp,
    bias: null,
    trialKind: "level",
    gameMode: true,
    levelId: level.id,
    levelIndex: level.index,
    levelDatasetKey: bucketInfo.key,
    levelDatasetLabel: bucketInfo.label,
    levelBaseDatasetKey: dataset.key,
    levelBaseDatasetLabel: dataset.label,
    levelSpanModeId: mode.id,
    levelSpanModeLabel: mode.label,
    startedAt: Date.now(),
    tradesAtStart: 0,
    bookmarksAtStart: 0,
  };
  state.game.lastType = "level";
  state.hideFuture = true;
  state.blindMode = false;
  state.dateRevealed = true;
  els.sessionNameInput.value = state.game.active.title;
  clearTradeDraftInputs();
  els.bookmarkInput.value = "";
  els.stopLossInput.value = "";
  els.takeProfitInput.value = "";
  revealTo(level.startIndex, true);
  showToast(`↑ 做多 / ↓ 做空，每按一次 K 线前进一格。`);
}

function randomLevelChallenge() {
  const mode = currentLevelSpanMode();
  const levels = generateLevelList(mode);
  if (!levels.length) {
    showToast("请先加载数据。");
    return;
  }
  const level = levels[Math.floor(Math.random() * levels.length)];
  if (mode.prediction) startPrediction(level.index);
  else if (mode.game) startGameLevelChallenge(level.index);
  else startLevelChallenge(level.index);
}

function startPrediction(levelIndex) {
  if (!ensureLevelTimeframe()) return;
  const mode = levelSpanModeById("prediction");
  const levels = generateLevelList(mode);
  if (!levels.length) {
    showToast("没有生成可用关卡。请确认数据覆盖 2020 年之后且为 15m。");
    return;
  }
  const targetIndex = clamp(levelIndex ?? 0, 0, levels.length - 1);
  const level = levels[targetIndex];
  state.game._prediction = {
    level,
    levelId: level.id,
    levelIndex: level.index,
    startTime: level.startTime,
    endTime: level.endTime + 1,
    startPrice: state.candles[level.startIndex].close,
    endPrice: state.candles[Math.min(level.endIndex, state.candles.length - 1)].close,
    movePct: (state.candles[Math.min(level.endIndex, state.candles.length - 1)].close - state.candles[level.startIndex].close) / state.candles[level.startIndex].close,
  };

  state.hideFuture = true;
  state.blindMode = false;
  state.dateRevealed = true;
  state.currentIndex = level.startIndex;
  centerOnCurrent(state.viewEnd - state.viewStart || 220);
  syncTimeline();
  render();

  els.predictionTimeRange.textContent = level.title.replace(/^[^0-9]*/, "").replace(/ 第 \d+ 关$/, "");
  els.predictionBody.style.display = "";
  els.predictionResult.style.display = "none";
  els.predictionReasonInput.value = "";
  if (!state.game._prevCharacter) {
    state.game._prevCharacter = state.game.profile.activeCharacter;
  }
  const pc = characterById("divine_seer");
  if (pc && state.game.profile.activeCharacter !== "divine_seer") {
    state.game.profile.activeCharacter = "divine_seer";
    state.game.activeQuoteCharacterId = null;
    state.game.activeQuote = "";
    saveGameProfile();
    renderGame();
  }
  els.predictionOverlay.classList.add("show");
  positionPredictionCard();
  els.predictionReasonInput.focus();
}

function positionPredictionCard() {
  const pos = state.game._predictionPos;
  const card = els.predictionCard;
  if (pos) {
    card.style.position = "fixed";
    card.style.left = pos.left + "px";
    card.style.top = pos.top + "px";
    card.style.transform = "none";
  } else {
    card.style.position = "";
    card.style.left = "";
    card.style.top = "";
    card.style.transform = "";
  }
}

function initPredictionDrag() {
  const card = els.predictionCard;
  const header = card.querySelector(".prediction-header");
  if (!header) return;
  let dragging = false, startX, startY, origLeft, origTop;

  header.addEventListener("mousedown", (e) => {
    if (e.target.tagName === "BUTTON") return;
    dragging = true;
    const rect = card.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    origLeft = rect.left;
    origTop = rect.top;
    card.style.position = "fixed";
    card.style.left = origLeft + "px";
    card.style.top = origTop + "px";
    card.style.transform = "none";
    card.style.cursor = "grabbing";
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const left = origLeft + e.clientX - startX;
    const top = origTop + e.clientY - startY;
    card.style.left = left + "px";
    card.style.top = top + "px";
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    card.style.cursor = "";
    state.game._predictionPos = {
      left: parseFloat(card.style.left) || 0,
      top: parseFloat(card.style.top) || 0,
    };
  });
}

function skipPrediction() {
  const p = state.game._prediction;
  if (!p || els.predictionBody.style.display === "none") return;
  const reason = els.predictionReasonInput.value.trim();
  appendPredictionLog({
    time: Date.now(),
    levelTitle: `12h · ${p.level.title.replace(/^[^0-9]*/, "").replace(/ 第 \\d+ 关$/, "")}`,
    direction: "跳过",
    reason,
    correct: null,
    movePct: p.movePct,
    stars: 0,
    skip: true,
  });
  showPredictionResult(null, p.movePct, 0, reason);
}

function submitPrediction(direction) {
  const p = state.game._prediction;
  if (!p) return;
  const reason = els.predictionReasonInput.value.trim();
  const correct = (direction === "up" && p.movePct > 0) || (direction === "down" && p.movePct < 0);
  const stars = predictionStars(correct, p.movePct);
  recordPredictionResult(direction, reason, correct, stars);
  appendPredictionLog({
    time: Date.now(),
    levelTitle: `12h · ${p.level.title.replace(/^[^0-9]*/, "").replace(/ 第 \\d+ 关$/, "")}`,
    direction: direction === "up" ? "看涨" : "看跌",
    reason,
    correct,
    movePct: p.movePct,
    stars,
  });
  showPredictionResult(correct, p.movePct, stars, reason);
}

function recordPredictionResult(direction, reason, correct, stars) {
  const p = state.game._prediction;
  if (!p) return;
  const mode = levelSpanModeById("prediction");
  const dataset = currentLevelDatasetInfo();
  const bucketInfo = currentLevelBucketInfo(mode, dataset);
  const levelMode = levelModeForDataset(bucketInfo);

  const now = Date.now();
  const todayKey = levelDateKey(new Date(now));
  const weekKey = levelDateKey(new Date(weekStart(new Date())));
  levelMode._lastDate = levelMode._lastDate || "";
  levelMode._lastWeek = levelMode._lastWeek || "";

  const updateStreak = (key) => {
    const cur = levelMode[key] || 0;
    const best = levelMode[key.replace("_streak", "_bestStreak")] || 0;
    const nxt = correct ? cur + 1 : 0;
    levelMode[key] = nxt;
    if (nxt > best) levelMode[key.replace("_streak", "_bestStreak")] = nxt;
    return nxt;
  };

  if (levelMode._lastDate !== todayKey) {
    levelMode._streakDay = 0;
    levelMode._lastDate = todayKey;
  }
  if (levelMode._lastWeek !== weekKey) {
    levelMode._streakWeek = 0;
    levelMode._lastWeek = weekKey;
  }

  updateStreak("_streakAll");
  updateStreak("_streakDay");
  updateStreak("_streakWeek");

  const character = characterById("divine_seer");
  const charState = state.game.profile.characters["divine_seer"];
  if (charState && correct !== null) {
    const xpGain = correct ? 8 : 2;
    charState.xp += xpGain;
    charState.runs += 1;
    if (correct) charState.successes += 1;
    charState.trialWindow = [...(charState.trialWindow || []), correct].slice(-12);

    const ascensionStreak = levelMode._streakAll || 0;
    const ascensionPassed = ascensionStreak >= 8;
    const materialGain = ascensionPassed ? 1 : 0;
    if (materialGain) {
      levelMode._streakAll = 0;
      levelMode._streakDay = 0;
      levelMode._streakWeek = 0;
    }
    charState.materials += materialGain;
    charState._predictionStreak = levelMode._streakAll || 0;
    if (materialGain) {
      saveGameProfile();
      showToast(`连胜 ${ascensionStreak}！获得 1 个${character.material}`);
    }

    const atCap = characterLevelFromXp(charState.xp, charState.stage) >= charState.stage * 200;
    const trialSuccesses = charState.trialWindow.filter(Boolean).length;
    const neededMaterials = charState.stage * 12;
    if (charState.stage < 5 && atCap && charState.materials >= neededMaterials && trialSuccesses >= 3) {
      charState.stage += 1;
      charState.materials -= neededMaterials;
      saveGameProfile();
      showToast(`${character.name} 进阶至 ${stageName(charState.stage)}！`);
    }

    state.game.lastCharacterGain = {
      character,
      beforeLevel: characterLevelFromXp(charState.xp - xpGain, charState.stage),
      afterLevel: characterLevelFromXp(charState.xp, charState.stage),
      beforeStage: charState.stage,
      afterStage: charState.stage,
      ascended: false,
      xp: xpGain,
      materials: materialGain,
    };
  }

  const records = levelMode.records;
  const previous = records[p.levelId] || {
    id: p.levelId,
    index: p.levelIndex,
    datasetKey: levelMode.key,
    datasetLabel: levelMode.label,
    baseDatasetKey: dataset.key,
    spanModeId: "prediction",
    attempts: 0,
    bestStars: 0,
    correct: false,
    bestStreak: 0,
  };
  const attempts = (previous.attempts || 0) + 1;
  const bestStars = Math.max(previous.bestStars || 0, stars);
  const record = {
    ...previous,
    attempts,
    bestStars,
    correct: correct === null ? previous.correct : correct,
    lastCorrect: correct,
    lastStars: stars,
    lastDirection: direction,
    lastReason: reason,
    lastMovePct: p.movePct,
    lastPlayedAt: Date.now(),
    clearedAt: bestStars > 0 ? previous.clearedAt || Date.now() : previous.clearedAt || null,
  };
  records[p.levelId] = record;
  levelMode.lastLevelId = p.levelId;
  levelMode.updatedAt = Date.now();
  saveGameProfile();
}

function showPredictionResult(correct, movePct, stars, reason) {
  const p = state.game._prediction;
  if (p) {
    const endIdx = Math.min(p.level.endIndex, state.candles.length - 1);
    state.currentIndex = endIdx;
    state.hideFuture = true;
    centerOnCurrent(state.viewEnd - state.viewStart || 220);
    syncTimeline();
    render();
  }
  const pctStr = (movePct >= 0 ? "+" : "") + (movePct * 100).toFixed(2) + "%";
  els.predictionMove.innerHTML = `BTC 涨跌 <strong class="${movePct >= 0 ? "text-green" : "text-red"}">${pctStr}</strong>`;
  if (correct === null) {
    els.predictionOutcome.innerHTML = `<span class="outcome-skip">已跳过</span>`;
  } else {
    els.predictionOutcome.innerHTML = correct
      ? `<span class="outcome-correct">预测正确！</span>`
      : `<span class="outcome-wrong">预测错误</span>`;
  }
  els.predictionStarsDisplay.innerHTML = starsText(stars);
  els.predictionReasonShown.innerHTML = reason ? `<span class="reason-label">你的理由：</span>${escapeHtml(reason)}` : "";
  els.predictionReviewInput.value = "";
  els.predictionBody.style.display = "none";
  els.predictionResult.style.display = "";
}

function predictionLogData() {
  if (!state.game.profile.predictionLog) {
    const legacy = localStorage.getItem("btcReplayLab.predictionLog");
    state.game.profile.predictionLog = legacy ? JSON.parse(legacy) : [];
    if (legacy) { localStorage.removeItem("btcReplayLab.predictionLog"); saveGameProfile(); }
  }
  return state.game.profile.predictionLog;
}

function appendPredictionLog(entry) {
  const log = predictionLogData();
  log.unshift(entry);
  if (log.length > 50000) log.length = 50000;
  saveGameProfile();
}

function saveReview() {
  const review = els.predictionReviewInput.value.trim();
  if (!review) return;
  const log = predictionLogData();
  if (log.length) log[0].review = review;
  saveGameProfile();
}

function randomPrediction() {
  saveReview();
  const level = pickRandomPredictionLevel();
  if (!level) {
    showToast("请先加载数据。");
    return;
  }
  startPrediction(level.index);
}

function retryPrediction() {
  saveReview();
  const p = state.game._prediction;
  if (!p) return;
  startPrediction(p.levelIndex);
}

function nextRandomPrediction() {
  randomPrediction();
}

function closePrediction() {
  saveReview();
  els.predictionOverlay.classList.remove("show");
  state.game._prediction = null;
  if (state.game._prevCharacter && state.game._prevCharacter !== "divine_seer") {
    state.game.profile.activeCharacter = state.game._prevCharacter;
    state.game.activeQuoteCharacterId = null;
    state.game.activeQuote = "";
    state.game._prevCharacter = null;
    saveGameProfile();
    renderGame();
  }
}

function openPredictionLog() {
  renderPredictionCalendar();
  els.predictionLogModal.classList.add("show");
}

function predictionLogEntries() {
  return predictionLogData();
}

function renderPredictionCalendar() {
  const entries = predictionLogEntries();
  const grouped = {};
  for (const e of entries) {
    if (e.skip) continue;
    const dk = new Date(e.time + 8 * 3600000).toISOString().slice(0, 10);
    if (!grouped[dk]) grouped[dk] = { total: 0, correct: 0, gain: 0, entries: [] };
    grouped[dk].total++;
    if (e.correct) grouped[dk].correct++;
    grouped[dk].gain += e.correct ? Math.abs(e.movePct || 0) : -Math.abs(e.movePct || 0);
    grouped[dk].entries.push(e);
  }
  const dates = Object.keys(grouped).sort().reverse();
  if (!dates.length) {
    els.predictionLogCalendar.innerHTML = '<div class="calendar-empty">暂无预测记录</div>';
    els.predictionDayDetail.style.display = "none";
    return;
  }
  els.predictionDayDetail.style.display = "none";
  els.predictionLogCalendar.innerHTML = dates.map((dk) => {
    const g = grouped[dk];
    const rate = g.total > 0 ? ((g.correct / g.total) * 100).toFixed(0) : 0;
    const gainStr = (g.gain >= 0 ? "+" : "") + (g.gain * 100).toFixed(2) + "%";
    return `<div class="calendar-day" data-date="${dk}">
      <span class="cal-date">${dk.slice(5)}</span>
      <span class="cal-total">${g.total}次</span>
      <span class="cal-rate ${rate >= 50 ? "text-green" : "text-red"}">${rate}%</span>
      <span class="cal-gain ${g.gain >= 0 ? "text-green" : "text-red"}">${gainStr}</span>
    </div>`;
  }).join("");

  els.predictionLogCalendar.querySelectorAll(".calendar-day").forEach((el) => {
    el.addEventListener("click", () => renderPredictionDay(el.dataset.date));
  });
}

function renderPredictionDay(dk) {
  const entries = predictionLogEntries().filter((e) => new Date(e.time + 8 * 3600000).toISOString().slice(0, 10) === dk);
  if (!entries.length) return;
  const profits = entries.filter((e) => e.correct).map((e) => Math.abs(e.movePct || 0));
  const losses = entries.filter((e) => e.correct === false).map((e) => Math.abs(e.movePct || 0));
  const avgWin = profits.length ? (profits.reduce((a, b) => a + b, 0) / profits.length * 100).toFixed(2) : "-";
  const avgLoss = losses.length ? (losses.reduce((a, b) => a + b, 0) / losses.length * 100).toFixed(2) : "-";
  const ratio = profits.length && losses.length ? (Number(avgWin) / Number(avgLoss)).toFixed(2) : "-";
  els.predictionDayDetail.innerHTML = `
    <div class="day-detail-header">
      <strong>${dk}</strong>
      <span class="day-ratio">盈 ${avgWin}% / 亏 ${avgLoss}% · 盈亏比 ${ratio}</span>
      <button type="button" class="day-detail-back" id="dayDetailBackBtn">返回日历</button>
    </div>
    <div class="day-detail-list">
      ${entries.map((e) => {
        const time = new Date(e.time).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" });
        const dir = e.direction || "-";
        const correct = e.skip ? "跳过" : (e.correct ? "正确" : "错误");
        const cls = e.skip ? "muted" : (e.correct ? "text-green" : "text-red");
        return `<div class="day-detail-row">
          <span class="dd-time">${time}</span>
          <span class="dd-level">${escapeHtml(e.levelTitle || "")}</span>
          <span class="dd-dir">${dir}</span>
          <span class="dd-pct ${(e.movePct || 0) >= 0 ? "text-green" : "text-red"}">${((e.movePct || 0) >= 0 ? "+" : "") + ((e.movePct || 0) * 100).toFixed(2)}%</span>
          <span class="dd-result ${cls}">${correct}</span>
          <span class="dd-stars">${"★".repeat(e.stars || 0)}${"☆".repeat(5 - (e.stars || 0))}</span>
          ${e.reason ? `<span class="dd-reason">${escapeHtml(e.reason)}</span>` : ""}
          ${e.review ? `<span class="dd-review">复盘：${escapeHtml(e.review)}</span>` : ""}
        </div>`;
      }).join("")}
    </div>
  `;
  els.predictionDayDetail.style.display = "";
  document.getElementById("dayDetailBackBtn").addEventListener("click", () => {
    renderPredictionCalendar();
  });
}

function closePredictionLog() {
  els.predictionLogModal.classList.remove("show");
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
  return state.game.profile.activeCharacter || CHARACTER_CONFIG[0].id;
}

function copyTradesToClipboard(trades) {
  if (!trades || !trades.length) return;
  const header = "时间\t方向\t价格\t数量\t止损\t止盈\t已实现盈亏\tR\t自动\t理由\t复盘\t标签";
  const rows = trades.map((t) => [
    formatTime(t.time),
    tradeSideLabel(t),
    Number(t.price).toFixed(2),
    Number(t.qty).toFixed(8),
    t.stopPrice ? Number(t.stopPrice).toFixed(2) : "",
    t.takePrice ? Number(t.takePrice).toFixed(2) : "",
    Number.isFinite(t.realizedPnl) ? Number(t.realizedPnl).toFixed(2) : "",
    Number.isFinite(t.r) ? Number(t.r).toFixed(2) : "",
    t.auto ? "是" : "",
    (t.reason || "").replace(/\t/g, " "),
    (t.review || "").replace(/\t/g, " "),
    (t.tags || []).join("/"),
  ].join("\t"));
  const text = [header, ...rows].join("\n");
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showToast(`已复制 ${trades.length} 笔交易到剪贴板`),
        () => fallbackCopy(text, trades.length),
      );
    } else {
      fallbackCopy(text, trades.length);
    }
  } catch {
    fallbackCopy(text, trades.length);
  }
}

function fallbackCopy(text, count) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast(`已复制 ${count} 笔交易到剪贴板`);
  } catch {
    showToast("交易记录复制失败");
  }
}

function settlementTradesForReport(trades) {
  return trades.slice(-40).map((trade) => ({
    time: formatTime(trade.time),
    side: tradeSideLabel(trade),
    price: Number(trade.price).toFixed(2),
    qty: Number(trade.qty).toFixed(8),
    reason: trade.reason || "",
    review: trade.review || "",
    tags: trade.tags || [],
    stopPrice: trade.stopPrice ? Number(trade.stopPrice).toFixed(2) : "",
    takePrice: trade.takePrice ? Number(trade.takePrice).toFixed(2) : "",
    realizedPnl: Number.isFinite(trade.realizedPnl) ? Number(trade.realizedPnl).toFixed(2) : "",
    r: Number.isFinite(trade.r) ? Number(trade.r).toFixed(2) : "",
    auto: Boolean(trade.auto),
  }));
}

function challengePriceExtremes(startIndex, endIndex) {
  let low = Infinity;
  let high = -Infinity;
  for (let index = startIndex; index <= endIndex; index += 1) {
    const candle = state.candles[index];
    if (!candle) continue;
    low = Math.min(low, candle.low);
    high = Math.max(high, candle.high);
  }
  return {
    low: Number.isFinite(low) ? low : null,
    high: Number.isFinite(high) ? high : null,
  };
}

function entryFractionForTrade(trade) {
  const equity = Math.max(0.000001, Number(trade.equity) || 0);
  if (trade.side === "buy") return Math.max(0, (Number(trade.spend) || 0) / equity);
  if (trade.side === "short") return Math.max(0, (Number(trade.gross) || 0) / equity);
  return 0;
}

function collectAchievementSignals({ active, endIndex, trades, score, returnPct, expected, reviewText, tags, stats }) {
  const tradeCount = trades.length;
  const openingTrades = trades.filter((trade) => trade.side === "buy" || trade.side === "short");
  const exitTrades = trades.filter((trade) => trade.side === "sell" || trade.side === "cover");
  const entryFractions = openingTrades.map(entryFractionForTrade).filter((value) => value > 0);
  const extremes = challengePriceExtremes(active.startIndex, endIndex);
  const hasProfit = returnPct > 0;
  const biasChosen = Boolean(active.bias);
  const directionCorrect = biasChosen && active.bias === expected;
  const reviewLength = reviewText.length;

  return {
    directionCorrect,
    zeroTradeCorrect: tradeCount === 0 && directionCorrect,
    zeroTradeHighScore: tradeCount === 0 && score >= 80,
    score80plus: score >= 80,
    score90plus: score >= 90,
    score100: score >= 100,
    lowDrawdownWin: stats.maxDrawdown < 0.01 && hasProfit,
    lowDrawdown: stats.maxDrawdown < 0.02,
    longReview: reviewLength >= 100,
    veryLongReview: reviewLength >= 200,
    mostBookmarks: state.bookmarks.length,
    mostTrades: tradeCount,
    quickGame: Date.now() - active.startedAt <= 180_000,
    ultraQuickGame: Date.now() - active.startedAt <= 60_000,
    fullSendWin: hasProfit && entryFractions.some((value) => value >= 0.95),
    microWin: hasProfit && entryFractions.some((value) => value <= 0.10),
    oppositeWin: biasChosen && active.bias !== expected && hasProfit,
    tripleTradeWin: tradeCount === 3 && hasProfit,
    oneTradeWin: tradeCount === 1 && hasProfit,
    nearBottomBuy:
      hasProfit &&
      extremes.low != null &&
      openingTrades.some((trade) => trade.side === "buy" && trade.price <= extremes.low * 1.008),
    nearTopSell:
      hasProfit &&
      extremes.high != null &&
      [...openingTrades, ...exitTrades].some((trade) => (trade.side === "short" || trade.side === "sell") && trade.price >= extremes.high * 0.992),
    usedTags: tags,
  };
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
  const notes = els.sessionNotesInput.value.trim();
  const tradeReason = els.tradeReasonInput.value.trim();
  const settlementTags = selectedTags();
  const reviewText = [
    notes,
    tradeReason,
    ...trades.map((trade) => [trade.reason, trade.review].filter(Boolean).join(" ")),
    ...state.bookmarks.map((mark) => mark.text || ""),
  ]
    .join(" ")
    .trim();
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
  const achievementSignals = collectAchievementSignals({
    active,
    endIndex,
    trades,
    score,
    returnPct,
    expected,
    reviewText,
    tags: settlementTags,
    stats,
  });
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
    ...achievementSignals,
  });

  state.dateRevealed = true;
  state.blindMode = false;
  state.currentIndex = endIndex;
  centerOnCurrent(state.viewEnd - state.viewStart || 220);
  const reviewerId = pickSettlementReviewerId(active);
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
    reviewerReason: "当前选中角色",
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
  copyTradesToClipboard(trades);
  const celebrations = collectCelebrationEvents();
  if (celebrations.length) {
    window.setTimeout(() => showCelebrations(celebrations), 600);
  }
}

function applyGameRewards(result) {
  const profile = state.game.profile;
  const stats = profile.stats;
  const today = todayKey();
  if (profile.lastPlayedDate !== today) {
    const yesterdayKey = offsetDateKey(today, -1);
    profile.streak = profile.lastPlayedDate === yesterdayKey ? profile.streak + 1 : 1;
    profile.lastPlayedDate = today;
  }

  profile.xp += result.earnedXp;
  profile.level = levelFromXp(profile.xp);
  stats.completed += 1;
  stats[result.type] = (stats[result.type] || 0) + 1;
  stats.totalScore += result.score;
  stats.bestScore = Math.max(stats.bestScore, result.score);
  if (result.hasStop) stats.stopUsed += 1;
  if (result.reviewed) stats.reviewed += 1;
  if (result.goodFlat) stats.goodFlat += 1;

  stats.stopUsedStreak = result.hasStop ? (stats.stopUsedStreak || 0) + 1 : 0;
  stats.reviewedStreak = result.reviewed ? (stats.reviewedStreak || 0) + 1 : 0;
  if (result.directionCorrect) stats.directionCorrect += 1;
  if (result.zeroTradeCorrect) stats.zeroTradeCorrect += 1;
  if (result.zeroTradeHighScore) stats.zeroTradeHighScore += 1;
  if (result.score80plus) stats.score80plus += 1;
  if (result.score90plus) stats.score90plus += 1;
  if (result.score100) stats.score100 += 1;
  if (result.lowDrawdownWin) stats.lowDrawdownWins += 1;
  if (result.lowDrawdown) stats.lowDrawdown += 1;
  if (result.longReview) stats.longReview += 1;
  if (result.veryLongReview) stats.veryLongReview += 1;
  if (result.fullSendWin) stats.fullSendWins += 1;
  if (result.microWin) stats.microWins += 1;
  if (result.oppositeWin) stats.oppositeWins += 1;
  if (result.tripleTradeWin) stats.tripleTradeWins += 1;
  if (result.oneTradeWin) stats.oneTradeWins += 1;
  if (result.quickGame) stats.quickGames += 1;
  if (result.ultraQuickGame) stats.ultraQuickGames += 1;
  if (result.nearBottomBuy) stats.nearBottomBuy += 1;
  if (result.nearTopSell) stats.nearTopSell += 1;
  stats.mostBookmarks = Math.max(stats.mostBookmarks || 0, result.mostBookmarks || 0);
  stats.mostTrades = Math.max(stats.mostTrades || 0, result.mostTrades || 0);
  stats.tagsUsed = Array.from(new Set([...(Array.isArray(stats.tagsUsed) ? stats.tagsUsed : []), ...(result.usedTags || [])]));

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

  const newAchievements = unlockNewAchievements(profile);
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
  const atCap = level >= charState.stage * 200;
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
