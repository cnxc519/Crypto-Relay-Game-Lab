"use strict";

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
