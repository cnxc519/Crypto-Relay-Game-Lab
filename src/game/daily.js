"use strict";

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
