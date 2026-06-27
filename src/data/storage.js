"use strict";

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
    riskPct: Number(els.riskPctInput.value) || 10,
    leverage: Number(els.leverageInput.value) || 50,
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
  if (!Array.isArray(merged.stats.tagsUsed)) {
    merged.stats.tagsUsed = [];
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
    els.riskPctInput.value = settings.riskPct ?? 10;
    els.leverageInput.value = settings.leverage ?? 50;
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
