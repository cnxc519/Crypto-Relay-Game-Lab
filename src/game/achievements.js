"use strict";

let achievementView = "recommended";

function syncUnlockedAchievements() {
  const profile = state.game.profile;
  const newAchievements = unlockNewAchievements(profile);
  if (newAchievements.length) saveGameProfile();
}

function setAchievementView(view) {
  if (!["recommended", "unlocked", "all"].includes(view)) return;
  achievementView = view;
  renderAchievementModal();
}

function handleAchievementListClick(event) {
  const button = event.target.closest("[data-achievement-view]");
  if (!button) return;
  setAchievementView(button.dataset.achievementView);
}

function achievementOrderMap() {
  return new Map(ACHIEVEMENTS.map((item, index) => [item.id, index]));
}

function achievementProgressText(item, profile, done) {
  if (done || item.hidden) return "";
  return achievementProgressSnapshot(item, profile)?.text || "";
}

function achievementCardHtml(item, profile, done) {
  const progressText = achievementProgressText(item, profile, done);
  const progress = achievementProgressSnapshot(item, profile);
  const hiddenLocked = item.hidden && !done;
  const displayName = hiddenLocked ? "隐藏成就" : item.name;
  const displayDesc = hiddenLocked ? "达成特别条件后才会揭晓。" : item.desc;
  return `
    <div class="achievement-card ${done ? "unlocked" : "locked"} ${hiddenLocked ? "secret" : ""}">
      <strong>${escapeHtml(displayName)}</strong>
      <span>${escapeHtml(displayDesc)}</span>
      ${progressText ? `<div class="achievement-progress-text">进度 ${escapeHtml(progressText)}</div>` : ""}
      ${!done && progress && !hiddenLocked ? `<div class="achievement-progress-bar"><span style="width:${(progress.ratio * 100).toFixed(1)}%"></span></div>` : ""}
      <div class="achievement-state">${done ? "已解锁" : hiddenLocked ? "秘密条件" : "未解锁"}</div>
    </div>
  `;
}

function categoryAchievements(categoryId) {
  return ACHIEVEMENTS.filter((item) => item.category === categoryId);
}

function sortAchievementsForDisplay(items, profile, unlocked) {
  const order = achievementOrderMap();
  return items.slice().sort((left, right) => {
    const leftDone = unlocked.has(left.id);
    const rightDone = unlocked.has(right.id);
    if (leftDone !== rightDone) return leftDone ? -1 : 1;
    if (leftDone && rightDone) {
      const leftRecent = (profile.recentAchievements || []).indexOf(left.id);
      const rightRecent = (profile.recentAchievements || []).indexOf(right.id);
      if (leftRecent !== rightRecent) {
        if (leftRecent === -1) return 1;
        if (rightRecent === -1) return -1;
        return leftRecent - rightRecent;
      }
    }
    const leftRatio = achievementProgressSnapshot(left, profile)?.ratio || 0;
    const rightRatio = achievementProgressSnapshot(right, profile)?.ratio || 0;
    if (!leftDone && rightRatio !== leftRatio) return rightRatio - leftRatio;
    return (order.get(left.id) || 0) - (order.get(right.id) || 0);
  });
}

function visibleAchievementsForCategory(items, profile, unlocked) {
  const sorted = sortAchievementsForDisplay(items, profile, unlocked);
  if (achievementView === "all") return sorted;
  if (achievementView === "unlocked") return sorted.filter((item) => unlocked.has(item.id));

  const unlockedItems = sorted.filter((item) => unlocked.has(item.id));
  const visibleLocked = sorted.filter((item) => !unlocked.has(item.id) && !item.hidden).slice(0, 4);
  return [...unlockedItems, ...visibleLocked];
}

function achievementSummaryHtml(profile, unlocked) {
  const unlockedCount = unlocked.size;
  const completedCategories = ACHIEVEMENT_CATEGORIES.filter((category) => categoryAchievements(category.id).every((item) => unlocked.has(item.id))).length;
  const hiddenRemaining = ACHIEVEMENTS.filter((item) => item.hidden && !unlocked.has(item.id)).length;
  const recent = (profile.recentAchievements || [])
    .map((id) => ACHIEVEMENTS.find((item) => item.id === id))
    .filter(Boolean)
    .slice(0, 4);

  return `
    <div class="achievement-summary-grid">
      <div class="achievement-summary-card">
        <span>已解锁</span>
        <strong>${unlockedCount}/${ACHIEVEMENTS.length}</strong>
      </div>
      <div class="achievement-summary-card">
        <span>分类完成</span>
        <strong>${completedCategories}/${ACHIEVEMENT_CATEGORIES.length}</strong>
      </div>
      <div class="achievement-summary-card">
        <span>隐藏成就</span>
        <strong>${hiddenRemaining} 个未揭晓</strong>
      </div>
      <div class="achievement-summary-card wide">
        <span>最近解锁</span>
        <strong>${recent.length ? escapeHtml(recent.map((item) => item.name).join(" / ")) : "继续打一局，新的徽章会亮。"}</strong>
      </div>
    </div>
  `;
}

function achievementToolbarHtml() {
  const items = [
    ["recommended", "推荐查看"],
    ["unlocked", "只看已解锁"],
    ["all", "查看全部"],
  ];
  return `
    <div class="achievement-toolbar">
      ${items
        .map(
          ([id, label]) => `
            <button class="achievement-chip ${achievementView === id ? "active" : ""}" type="button" data-achievement-view="${id}">
              ${label}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function categorySectionHtml(category, profile, unlocked) {
  const items = categoryAchievements(category.id);
  const unlockedCount = items.filter((item) => unlocked.has(item.id)).length;
  const visibleItems = visibleAchievementsForCategory(items, profile, unlocked);
  const hiddenLockedCount = items.filter((item) => item.hidden && !unlocked.has(item.id)).length;
  const remainingCount = items.length - visibleItems.length;
  const open = achievementView === "all" || unlockedCount > 0 || category.order <= 2;

  if (achievementView === "unlocked" && unlockedCount === 0) return "";

  return `
    <details class="achievement-group" ${open ? "open" : ""}>
      <summary>
        <span>${escapeHtml(category.icon)} · ${escapeHtml(category.name)}</span>
        <span class="achievement-group-count">${unlockedCount}/${items.length}</span>
      </summary>
      <div class="achievement-group-grid">
        ${visibleItems.length ? visibleItems.map((item) => achievementCardHtml(item, profile, unlocked.has(item.id))).join("") : '<div class="achievement-card locked"><strong>还没有进展</strong><span>先从这一类拿下一枚徽章吧。</span><div class="achievement-state">等待解锁</div></div>'}
      </div>
      ${
        achievementView !== "all" && remainingCount > 0
          ? `<div class="achievement-group-note">这一类还有 ${remainingCount} 个成就未展开，切到“查看全部”会更完整。</div>`
          : ""
      }
      ${
        hiddenLockedCount > 0
          ? `<div class="achievement-group-note">另有 ${hiddenLockedCount} 个隐藏成就等待揭晓。</div>`
          : ""
      }
    </details>
  `;
}

function renderAchievementModal() {
  const profile = state.game.profile;
  const unlocked = new Set(profile.achievements);
  els.achievementAllList.innerHTML = `
    ${achievementSummaryHtml(profile, unlocked)}
    ${achievementToolbarHtml()}
    <div class="achievement-groups">
      ${ACHIEVEMENT_CATEGORIES.slice()
        .sort((left, right) => left.order - right.order)
        .map((category) => categorySectionHtml(category, profile, unlocked))
        .join("")}
    </div>
  `;
}

function openAchievementModal() {
  renderAchievementModal();
  state.game.profile.achievementSeenCount = state.game.profile.achievements.length;
  saveGameProfile();
  renderHudBadges();
  els.achievementModal.classList.add("show");
}

function closeAchievementModal() {
  els.achievementModal.classList.remove("show");
}
