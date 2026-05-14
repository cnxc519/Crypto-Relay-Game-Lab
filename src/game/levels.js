"use strict";

const LEVEL_SPAN_MODES = Object.freeze({
  daily: { id: "daily", label: "1天一关", shortLabel: "1天", days: 1 },
  weekly: { id: "weekly", label: "7天一关", shortLabel: "7天", days: 7 },
  game_daily: { id: "game_daily", label: "1天游戏", shortLabel: "1天游", days: 1, game: true },
  game_weekly: { id: "game_weekly", label: "7天游戏", shortLabel: "7天游", days: 7, game: true },
  prediction: { id: "prediction", label: "超级预测", shortLabel: "预测", days: 0.5, game: true, prediction: true },
});
const LEVEL_DAY_MS = 86_400_000;

function cleanDatasetFileName(fileName = state.fileName) {
  return String(fileName || "")
    .replace(/（.*?）/g, "")
    .replace(/\s*\(.*?\)\s*/g, "")
    .split(/[\\/]/)
    .pop()
    .trim();
}

function levelSpanModeById(modeId = "daily") {
  return LEVEL_SPAN_MODES[modeId] || LEVEL_SPAN_MODES.daily;
}

function currentLevelSpanModeId() {
  return levelSpanModeById(state.game.profile.levelMode?.currentSpanModeId).id;
}

function currentLevelSpanMode() {
  return levelSpanModeById(currentLevelSpanModeId());
}

function setLevelSpanMode(modeId) {
  const mode = levelSpanModeById(modeId);
  state.game.profile.levelMode.currentSpanModeId = mode.id;
  saveGameProfile();
  renderGame();
  if (els.levelModal.classList.contains("show")) renderLevelModal();
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

function levelBucketKey(datasetKey, modeId = currentLevelSpanModeId()) {
  return `${datasetKey}|span:${modeId}`;
}

function currentLevelBucketInfo(mode = currentLevelSpanMode(), datasetInfo = currentLevelDatasetInfo()) {
  return {
    key: levelBucketKey(datasetInfo.key, mode.id),
    label: `${datasetInfo.label} · ${mode.label}`,
    datasetKey: datasetInfo.key,
    datasetLabel: datasetInfo.label,
    modeId: mode.id,
    modeLabel: mode.label,
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
    archivedLegacy: Boolean(bucket.archivedLegacy),
    createdAt: bucket.createdAt || Date.now(),
    updatedAt: bucket.updatedAt || bucket.createdAt || Date.now(),
  };
}

function hasLevelRecords(records) {
  return Boolean(records && typeof records === "object" && !Array.isArray(records) && Object.keys(records).length);
}

function levelModeForDataset(
  keyOrInfo = currentLevelBucketInfo(),
  label = currentLevelBucketInfo().label,
  datasetKey = currentLevelBucketInfo().datasetKey,
  modeId = currentLevelBucketInfo().modeId,
) {
  const info =
    keyOrInfo && typeof keyOrInfo === "object"
      ? keyOrInfo
      : { key: keyOrInfo, label, datasetKey, modeId };
  const bucketKey = info.key;
  const bucketLabel = info.label || info.key || "未命名数据";
  const legacyDatasetKey = info.datasetKey || info.key;
  const spanModeId = info.modeId || currentLevelSpanModeId();
  const levelMode = state.game.profile.levelMode;
  if (!levelMode.datasets || typeof levelMode.datasets !== "object" || Array.isArray(levelMode.datasets)) {
    levelMode.datasets = {};
  }

  if (!levelMode.datasets[bucketKey]) {
    const legacyBucket =
      spanModeId === "daily" && legacyDatasetKey && legacyDatasetKey !== bucketKey ? levelMode.datasets[legacyDatasetKey] : null;
    const shouldAttachLegacyDatasetBucket = hasLevelRecords(legacyBucket?.records) && !legacyBucket?.archivedLegacy;
    const shouldAttachLegacyRecords =
      spanModeId === "daily" &&
      bucketKey === levelBucketKey("csv:btcusdt-15m", "daily") &&
      !levelMode.legacyDatasetKey &&
      hasLevelRecords(levelMode.records);
    levelMode.datasets[bucketKey] = normalizeLevelModeBucket(
      {
        key: bucketKey,
        label: bucketLabel,
        records: shouldAttachLegacyDatasetBucket ? { ...(legacyBucket.records || {}) } : shouldAttachLegacyRecords ? { ...levelMode.records } : {},
        lastLevelId: shouldAttachLegacyDatasetBucket
          ? legacyBucket.lastLevelId || ""
          : shouldAttachLegacyRecords
            ? levelMode.lastLevelId || ""
            : "",
        page: shouldAttachLegacyDatasetBucket ? legacyBucket.page || 0 : shouldAttachLegacyRecords ? levelMode.page || 0 : 0,
      },
      bucketKey,
      bucketLabel,
    );
    if (shouldAttachLegacyRecords) levelMode.legacyDatasetKey = bucketKey;
    if (shouldAttachLegacyDatasetBucket) {
      levelMode.datasets[legacyDatasetKey] = normalizeLevelModeBucket(
        {
          ...legacyBucket,
          archivedLegacy: true,
        },
        legacyDatasetKey,
        legacyBucket.label || legacyDatasetKey,
      );
    }
  }

  levelMode.datasets[bucketKey] = normalizeLevelModeBucket(levelMode.datasets[bucketKey], bucketKey, bucketLabel);
  levelMode.datasets[bucketKey].label = bucketLabel;
  return levelMode.datasets[bucketKey];
}

function levelModeRecordsForStats(profileOrLevelMode = state.game.profile) {
  const levelMode = profileOrLevelMode.levelMode || profileOrLevelMode || {};
  const datasets =
    levelMode.datasets && typeof levelMode.datasets === "object" && !Array.isArray(levelMode.datasets)
      ? Object.values(levelMode.datasets).filter((bucket) => !bucket.archivedLegacy)
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

function levelCandlesForMode(mode = currentLevelSpanMode()) {
  return LEVEL_MODE_CANDLES * mode.days;
}

function levelWindowLabel(startTime, endTimeExclusive, mode = currentLevelSpanMode()) {
  if (mode.days < 1) {
    const start = new Date(startTime);
    const end = new Date(endTimeExclusive - 1);
    const pad = (n) => String(n).padStart(2, "0");
    const wd = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][start.getUTCDay()];
    return `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())} ${wd} ${pad(start.getUTCHours())}:00~${pad(end.getUTCHours())}:59`;
  }
  const startKey = levelDateKey(startTime);
  if (mode.days <= 1) return startKey;
  return `${startKey} ~ ${levelDateKey(endTimeExclusive - 1)}`;
}

function levelChallengeText(mode = currentLevelSpanMode()) {
  if (mode.game) return `↑ 做多 100% / ↓ 做空 100%，每按一次 K 线前进一格。`;
  return mode.id === "weekly"
    ? "从 2020 年开始，每 7 天是一关，更适合中长线持仓训练，目标是稳定拿星。"
    : "从 2020 年开始，每 1 天是一关，目标是稳定拿星。";
}

function generateLevelList(mode = currentLevelSpanMode()) {
  if (!state.candles.length) return [];
  const levels = [];
  const lastTime = state.candles[state.candles.length - 1].time;
  const spanMs = mode.days * LEVEL_DAY_MS;
  const candlesPerLevel = levelCandlesForMode(mode);
  for (let dayStart = LEVEL_MODE_START_TIME; dayStart + spanMs <= lastTime; dayStart += spanMs) {
    const dayEnd = dayStart + spanMs;
    const startIndex = findIndexAtOrAfter(state.candles, dayStart);
    const endIndex = startIndex + candlesPerLevel - 1;
    if (!state.candles[startIndex] || !state.candles[endIndex]) continue;
    if (state.candles[startIndex].time >= dayEnd || state.candles[endIndex].time >= dayEnd) continue;
    const rangeLabel = levelWindowLabel(dayStart, dayEnd, mode);
    const id = mode.days < 1
      ? `${levelDateKey(dayStart)}T${String(new Date(dayStart).getUTCHours()).padStart(2, "0")}`
      : mode.days <= 1
        ? levelDateKey(dayStart)
        : `${levelDateKey(dayStart)}_${levelDateKey(dayEnd - 1)}`;
    levels.push({
      id,
      index: levels.length,
      title: `${rangeLabel} 第 ${levels.length + 1} 关`,
      startIndex,
      endIndex,
      startTime: state.candles[startIndex].time,
      endTime: state.candles[endIndex].time,
    });
  }
  return levels;
}

function pickRandomPredictionLevel() {
  const mode = levelSpanModeById("prediction");
  const levels = generateLevelList(mode);
  if (!levels.length) return null;
  return levels[Math.floor(Math.random() * levels.length)];
}

function dayStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff).getTime();
}

function predictionPeriodStats(records, since) {
  const list = Object.values(records || {}).filter((r) => (r.lastPlayedAt || 0) >= since);
  const total = list.reduce((s, r) => s + (r.attempts || 0), 0);
  const correct = list.reduce((s, r) => s + (r.correct ? 1 : 0), 0);
  const rate = total > 0 ? ((correct / list.length) * 100).toFixed(1) : "-";
  const gain = list.reduce((s, r) => {
    const pct = r.lastMovePct || 0;
    return s + (r.lastCorrect ? Math.abs(pct) : -Math.abs(pct));
  }, 0);
  return { total: list.length, correct, rate, gain };
}

function predictionStars(correct, movePct) {
  const abs = Math.abs(movePct || 0);
  if (correct) {
    if (abs > 0.03) return 5;
    if (abs > 0.01) return 4;
    return 3;
  }
  if (abs < 0.01) return 2;
  if (abs < 0.03) return 1;
  return 0;
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
  const records = levelModeForDataset(currentLevelBucketInfo()).records || {};
  const firstUncleared = levels.find((level) => !(records[level.id]?.bestStars > 0));
  if (firstUncleared) return firstUncleared.index;
  const firstNotFive = levels.find((level) => (records[level.id]?.bestStars || 0) < 5);
  return firstNotFive ? firstNotFive.index : Math.max(0, levels.length - 1);
}

function recordLevelResult(result) {
  if (!result.levelId) return null;
  const levelMode = levelModeForDataset({
    key: result.levelDatasetKey,
    label: result.levelDatasetLabel,
    datasetKey: result.levelBaseDatasetKey || result.levelDatasetKey,
    modeId: result.levelSpanModeId || "daily",
  });
  const records = levelMode.records;
  const previous = records[result.levelId] || {
    id: result.levelId,
    index: result.levelIndex,
    datasetKey: levelMode.key,
    datasetLabel: levelMode.label,
    baseDatasetKey: result.levelBaseDatasetKey || result.levelDatasetKey,
    spanModeId: result.levelSpanModeId || "daily",
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
    baseDatasetKey: result.levelBaseDatasetKey || result.levelDatasetKey,
    spanModeId: result.levelSpanModeId || "daily",
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
