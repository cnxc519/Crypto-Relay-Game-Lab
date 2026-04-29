"use strict";

function clampLevelPage(levels, levelMode = levelModeForDataset()) {
  const totalPages = Math.max(1, Math.ceil(levels.length / LEVELS_PER_PAGE));
  levelMode.page = clamp(Number(levelMode.page) || 0, 0, totalPages - 1);
  return totalPages;
}

function renderLevelModal() {
  const levelMode = levelModeForDataset();
  const levels = generateLevelList();
  const records = levelMode.records || {};
  const stats = levelModeStats(levelMode);
  const totalPages = clampLevelPage(levels, levelMode);
  const page = levelMode.page;
  const start = page * LEVELS_PER_PAGE;
  const pageLevels = levels.slice(start, start + LEVELS_PER_PAGE);
  els.levelSummary.innerHTML = `
    <div><span>当前数据</span><strong>${escapeHtml(levelMode.label)}</strong></div>
    <div><span>通过关卡</span><strong>${stats.cleared}/${levels.length}</strong></div>
    <div><span>累计星数</span><strong>${stats.stars}</strong></div>
    <div><span>总挑战</span><strong>${stats.attempts}</strong></div>
    <div><span>最佳收益</span><strong>${(stats.bestReturn * 100).toFixed(2)}%</strong></div>
  `;
  if (!levels.length) {
    els.levelRows.innerHTML = '<div class="level-row"><div><strong>暂无关卡</strong><span>请导入覆盖 2020 年后的 15m 数据。</span></div></div>';
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
  const levelMode = levelModeForDataset();
  const levels = generateLevelList();
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
