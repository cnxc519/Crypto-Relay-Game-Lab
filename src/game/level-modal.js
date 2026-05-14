"use strict";

function clampLevelPage(levels, levelMode = levelModeForDataset()) {
  const totalPages = Math.max(1, Math.ceil(levels.length / LEVELS_PER_PAGE));
  levelMode.page = clamp(Number(levelMode.page) || 0, 0, totalPages - 1);
  return totalPages;
}

function renderLevelModal() {
  const mode = currentLevelSpanMode();
  const datasetInfo = currentLevelDatasetInfo();
  const bucketInfo = currentLevelBucketInfo(mode, datasetInfo);
  const levelMode = levelModeForDataset(bucketInfo);
  const levels = generateLevelList(mode);
  const records = levelMode.records || {};
  const stats = levelModeStats(levelMode);
  const totalPages = clampLevelPage(levels, levelMode);
  const page = levelMode.page;
  const start = page * LEVELS_PER_PAGE;
  const pageLevels = levels.slice(start, start + LEVELS_PER_PAGE);
  els.levelModeDailyBtn.classList.toggle("active", mode.id === "daily");
  els.levelModeWeeklyBtn.classList.toggle("active", mode.id === "weekly");
  els.levelModeGameDailyBtn.classList.toggle("active", mode.id === "game_daily");
  els.levelModeGameWeeklyBtn.classList.toggle("active", mode.id === "game_weekly");
  els.levelModePredictionBtn.classList.toggle("active", mode.id === "prediction");
  if (mode.prediction) {
    const now = Date.now();
    const all = predictionPeriodStats(records, 0);
    const today = predictionPeriodStats(records, dayStart(new Date()));
    const week = predictionPeriodStats(records, weekStart(new Date()));
    const sDay = levelMode._streakDay || 0, bDay = levelMode._bestStreakDay || 0;
    const sWeek = levelMode._streakWeek || 0, bWeek = levelMode._bestStreakWeek || 0;
    const sAll = levelMode._streakAll || 0, bAll = levelMode._bestStreakAll || 0;
    const gainStr = (v) => (v >= 0 ? "+" : "") + (v * 100).toFixed(2) + "%";
    const streakStr = (s, b) => `连胜 ${s} · 最佳 ${b}`;
    els.levelSummary.innerHTML = `
      <div class="prediction-stats-table">
        <div class="prediction-stats-row">
          <span class="stats-label">总计</span>
          <span>${all.total} 预测</span>
          <span>正确率 ${all.rate === "-" ? "-" : all.rate + "%"}</span>
          <span class="${all.gain >= 0 ? "text-green" : "text-red"}">收益 ${gainStr(all.gain)}</span>
          <span>${streakStr(sAll, bAll)}</span>
        </div>
        <div class="prediction-stats-row">
          <span class="stats-label">本周</span>
          <span>${week.total} 预测</span>
          <span>正确率 ${week.rate === "-" ? "-" : week.rate + "%"}</span>
          <span class="${week.gain >= 0 ? "text-green" : "text-red"}">收益 ${gainStr(week.gain)}</span>
          <span>${streakStr(sWeek, bWeek)}</span>
        </div>
        <div class="prediction-stats-row">
          <span class="stats-label">今日</span>
          <span>${today.total} 预测</span>
          <span>正确率 ${today.rate === "-" ? "-" : today.rate + "%"}</span>
          <span class="${today.gain >= 0 ? "text-green" : "text-red"}">收益 ${gainStr(today.gain)}</span>
          <span>${streakStr(sDay, bDay)}</span>
        </div>
      </div>
      <div class="level-summary-action">
        <span class="summary-left"><button id="predictionLogBtn" type="button" class="log-btn">记录</button></span>
        <span class="summary-center"><button id="levelRandomTestBtn" type="button" class="random-test-btn">随机测试</button></span>
        <span class="summary-right"></span>
      </div>
    `;
  } else {
    els.levelSummary.innerHTML = `
      <div><span>当前数据</span><strong>${escapeHtml(datasetInfo.label)}</strong></div>
      <div><span>通过关卡</span><strong>${stats.cleared}/${levels.length}</strong></div>
      <div><span>累计星数</span><strong>${stats.stars}</strong></div>
      <div><span>总挑战</span><strong>${stats.attempts}</strong></div>
      <div><span>最佳收益</span><strong>${(stats.bestReturn * 100).toFixed(2)}%</strong></div>
    `;
  }
  if (!levels.length) {
    els.levelRows.innerHTML = `<div class="level-row"><div><strong>暂无关卡</strong><span>请导入覆盖 2020 年后的 15m 数据，当前模式为 ${escapeHtml(mode.label)}。</span></div></div>`;
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
  const levelMode = levelModeForDataset(currentLevelBucketInfo());
  const levels = generateLevelList(currentLevelSpanMode());
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
