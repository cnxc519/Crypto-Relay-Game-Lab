"use strict";

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

function autoSaveSession() {
  const active = state.game.active;
  if (!active) return;
  const now = new Date();
  const practiceTime = now.toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-").replace(/:/g, "").replace(/\s+/g, "_");
  const candleTime = active.startTime
    ? new Date(active.startTime).toLocaleString("zh-CN", { hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/\//g, "-").replace(/:/g, "").replace(/\s+/g, "_")
    : "unknown";
  const session = buildSession();
  session.name = `${practiceTime}__${candleTime}`;
  session.id = uniqueId("auto");
  const sessions = readSessions();
  sessions.unshift(session);
  if (sessions.length > 200) sessions.length = 200;
  writeSessions(sessions);

  try {
    fetch("/api/save-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session),
    }).catch(() => {});
  } catch (_) {}
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
