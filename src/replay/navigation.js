"use strict";

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
  clearTradeDraftInputs();
  els.bookmarkInput.value = "";
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
    clearTradeDraftInputs();
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
