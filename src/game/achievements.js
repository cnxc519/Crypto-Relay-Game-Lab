"use strict";

function syncUnlockedAchievements() {
  const profile = state.game.profile;
  let changed = false;
  for (const achievement of ACHIEVEMENTS) {
    if (!profile.achievements.includes(achievement.id) && achievement.test(profile)) {
      profile.achievements.push(achievement.id);
      changed = true;
    }
  }
  if (changed) saveGameProfile();
}

function renderAchievementModal() {
  const unlocked = new Set(state.game.profile.achievements);
  els.achievementAllList.innerHTML = ACHIEVEMENTS.map((item) => {
    const done = unlocked.has(item.id);
    return `
      <div class="achievement-card ${done ? "unlocked" : ""}">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.desc)}</span>
        <div class="achievement-state">${done ? "已解锁" : "未解锁"}</div>
      </div>
    `;
  }).join("");
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
