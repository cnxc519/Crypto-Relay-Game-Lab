"use strict";

function collectCelebrationEvents() {
  const events = [];
  const gain = state.game.lastCharacterGain;
  const record = state.game.lastLevelRecord;
  const achievements = state.game.lastSettlement?.newAchievements || [];

  if (gain) {
    if (gain.afterLevel > gain.beforeLevel) {
      events.push({
        type: "level_up",
        character: gain.character,
        beforeLevel: gain.beforeLevel,
        afterLevel: gain.afterLevel,
        stage: gain.afterStage,
      });
    }
    if (gain.ascended) {
      events.push({
        type: "ascension",
        character: gain.character,
        beforeStage: gain.beforeStage,
        afterStage: gain.afterStage,
      });
    }
  }

  for (const achievement of achievements) {
    events.push({
      type: "achievement",
      achievement,
    });
  }

  if (record && record.previousBestStars < 3 && record.bestStars >= 3) {
    events.push({
      type: "first_star",
      stars: record.bestStars,
      levelId: record.id,
      levelIndex: record.index,
      datasetLabel: record.datasetLabel,
    });
  }

  return events;
}

function celebrationCardHTML(event) {
  switch (event.type) {
    case "level_up": {
      const charImg = characterImagePath(event.character);
      return `
        <div class="celebration-card card-level-up">
          <div class="celebration-shine"></div>
          <div class="celebration-card-inner">
            <div class="celebration-icon-wrap">
              <img class="celebration-portrait" src="${charImg}" alt="${escapeHtml(event.character.name)}" />
              <span class="celebration-badge">LEVEL UP</span>
            </div>
            <div class="celebration-body">
              <strong>${escapeHtml(event.character.name)} 升级了！</strong>
              <div class="celebration-level-jump">
                <span class="level-from">Lv.${event.beforeLevel}</span>
                <span class="level-arrow">→</span>
                <span class="level-to">Lv.${event.afterLevel}</span>
              </div>
              <small>${stageName(event.stage)} · ${escapeHtml(event.character.title)}</small>
            </div>
          </div>
        </div>`;
    }
    case "ascension": {
      const charImg = characterImagePath(event.character);
      return `
        <div class="celebration-card card-ascension">
          <div class="celebration-shine"></div>
          <div class="celebration-card-inner">
            <div class="celebration-icon-wrap">
              <img class="celebration-portrait" src="${charImg}" alt="${escapeHtml(event.character.name)}" />
              <span class="celebration-badge ascension-badge">进阶</span>
            </div>
            <div class="celebration-body">
              <strong>${escapeHtml(event.character.name)} 突破进阶！</strong>
              <div class="celebration-stage-jump">
                <span class="stage-from">${stageName(event.beforeStage)}</span>
                <span class="stage-arrow">→</span>
                <span class="stage-to">${stageName(event.afterStage)}</span>
              </div>
              <small>实力大幅提升，等级上限解锁至 ${event.afterStage * 200} 级</small>
            </div>
          </div>
        </div>`;
    }
    case "achievement": {
      const a = event.achievement;
      const cat = achievementCategory(a.category);
      return `
        <div class="celebration-card card-achievement">
          <div class="celebration-shine"></div>
          <div class="celebration-card-inner">
            <div class="celebration-icon-wrap achievement-icon">
              <span class="achievement-emoji">🏆</span>
            </div>
            <div class="celebration-body">
              <strong>成就解锁！</strong>
              <div class="achievement-name">${escapeHtml(a.name)}</div>
              <small>${escapeHtml(cat?.name || a.category || "")} · ${escapeHtml(a.desc)}</small>
            </div>
          </div>
        </div>`;
    }
    case "first_star": {
      const levelTitle = event.datasetLabel
        ? `${escapeHtml(event.datasetLabel)} #${event.levelIndex + 1}`
        : `关卡 #${event.levelIndex + 1}`;
      return `
        <div class="celebration-card card-star">
          <div class="celebration-shine"></div>
          <div class="celebration-card-inner">
            <div class="celebration-icon-wrap star-icon">
              <span class="star-display">${"★".repeat(event.stars)}${"☆".repeat(5 - event.stars)}</span>
            </div>
            <div class="celebration-body">
              <strong>首次 ${event.stars} 星通关！</strong>
              <div class="star-level-name">${levelTitle}</div>
              <small>继续挑战，向 5 星冲刺</small>
            </div>
          </div>
        </div>`;
    }
    default:
      return "";
  }
}

function showCelebrations(events) {
  if (!events.length) return;
  const container = els.celebrationContainer;
  container.innerHTML = events.map((e) => celebrationCardHTML(e)).join("");

  const cards = container.querySelectorAll(".celebration-card");
  els.celebrationOverlay.classList.add("show");

  cards.forEach((card, index) => {
    card.style.animationDelay = `${index * 0.18}s`;
    card.addEventListener("animationend", (e) => {
      if (e.animationName === "celebrationIn") {
        card.classList.add("done");
      }
    });
  });

  const totalShowTime = (cards.length - 1) * 180 + 2800;
  window.clearTimeout(state._celebrationTimer);
  state._celebrationTimer = window.setTimeout(() => {
    dismissCelebration();
  }, totalShowTime);
}

function dismissCelebration() {
  window.clearTimeout(state._celebrationTimer);
  els.celebrationOverlay.classList.add("hiding");
  window.setTimeout(() => {
    els.celebrationOverlay.classList.remove("show", "hiding");
    els.celebrationContainer.innerHTML = "";
  }, 320);
}

els.celebrationCloseBtn.addEventListener("click", dismissCelebration);
els.celebrationOverlay.addEventListener("click", (e) => {
  if (e.target === els.celebrationOverlay) dismissCelebration();
});
