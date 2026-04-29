"use strict";

function renderGame() {
  if (!els.levelValue) return;
  ensureTodayDailyProgress();
  applyCompletedDailyTaskRewards(false);
  syncUnlockedAchievements();
  const profile = state.game.profile;
  const level = levelFromXp(profile.xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpProgress = clamp(((profile.xp - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp)) * 100, 0, 100);
  const active = state.game.active;

  els.levelValue.textContent = `Lv.${level}`;
  els.levelTitle.textContent = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  els.streakValue.textContent = `${profile.streak || 0} 天`;
  els.xpFill.style.width = `${xpProgress}%`;
  els.xpText.textContent = `${profile.xp - currentLevelXp} / ${nextLevelXp - currentLevelXp} XP`;
  renderCharacterPanel();

  if (active) {
    const progress = clamp(((state.currentIndex - active.startIndex) / Math.max(1, active.endIndex - active.startIndex)) * 100, 0, 100);
    els.challengeTitle.textContent = active.title;
    els.challengeText.textContent = `${active.text} 进度 ${progress.toFixed(0)}%，终点还剩 ${Math.max(0, active.endIndex - state.currentIndex)} 根。`;
  } else {
    const avg = profile.stats.completed ? Math.round(profile.stats.totalScore / profile.stats.completed) : 0;
    els.challengeTitle.textContent = "今日开一局";
    els.challengeText.textContent = profile.stats.completed ? `已完成 ${profile.stats.completed} 局，平均 ${avg} 分。` : "选择一个模式，系统会直接抽取历史行情片段。";
  }

  for (const [button, bias] of [
    [els.biasLongBtn, "long"],
    [els.biasShortBtn, "short"],
    [els.biasFlatBtn, "flat"],
  ]) {
    button.classList.toggle("active", active?.bias === bias);
    button.disabled = !active;
  }
  els.settleGameBtn.disabled = !active;

  const dailyRewards = profile.daily.taskRewards || {};
  els.dailyTaskList.innerHTML = dailyTasks()
    .map((task) => {
      const reward = dailyRewards[task.id];
      const rewardText = task.done && reward ? ` · +${reward.xp || DAILY_TASK_XP}XP` : "";
      return `<div class="task-item ${task.done ? "done" : ""}">${task.done ? "已完成" : task.progress} · ${escapeHtml(task.text)}${rewardText}</div>`;
    })
    .join("");
  renderDailyReward();
  renderDailyCalendar();

  const unlocked = (profile.recentAchievements?.length ? profile.recentAchievements : profile.achievements.slice().reverse())
    .slice(0, 5)
    .map((id) => ACHIEVEMENTS.find((item) => item.id === id))
    .filter(Boolean);
  els.achievementList.innerHTML =
    unlocked.map((item) => `<div class="achievement-item unlocked"><strong>${escapeHtml(item.name)}</strong><br>${escapeHtml(item.desc)}</div>`).join("") ||
    '<div class="achievement-item">还没有成就。打一局，第一枚徽章就会亮。</div>';
  if (els.achievementModal.classList.contains("show")) renderAchievementModal();
  renderHudBadges();
}

function renderCharacterPanel() {
  const profile = state.game.profile;
  const character = activeCharacter();
  const charState = profile.characters[character.id];
  const level = characterLevelFromXp(charState.xp, charState.stage);
  const currentLevelXp = characterXpForLevel(level);
  const nextLevelXp = characterXpForLevel(Math.min(level + 1, charState.stage * 20 + 1));
  const xpProgress = level >= charState.stage * 20 ? 100 : clamp(((charState.xp - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp)) * 100, 0, 100);
  const trialSuccesses = charState.trialWindow.filter(Boolean).length;
  const ascensionNeed = charState.stage * 12;

  els.characterPortrait.src = characterImagePath(character);
  els.characterTitle.textContent = character.title;
  els.characterName.textContent = character.name;
  els.characterLevel.textContent = `Lv.${level} · ${stageName(charState.stage)}`;
  els.characterXpFill.style.width = `${xpProgress}%`;
  els.characterText.textContent = activeCharacterQuote(character);
  els.characterRuleCard.innerHTML = `
    <strong>${escapeHtml(character.name)} 的特殊规则</strong>
    <span>${escapeHtml(character.rule)}</span><br>
    <span>适合试炼：${escapeHtml(CHALLENGE_TYPES[character.challengeType]?.name || "盲测快局")}；培养风格：${escapeHtml(character.style)}</span>
  `;
  els.characterQuestBtn.textContent = `开启 ${character.name} 试炼`;
  els.ascensionTrialBtn.textContent = `开启 ${character.name} 进阶试炼`;
  els.characterGrid.innerHTML = CHARACTER_CONFIG.map((item) => {
    const itemState = profile.characters[item.id];
    const itemLevel = characterLevelFromXp(itemState.xp, itemState.stage);
    return `
      <button class="character-pick ${item.id === character.id ? "active" : ""}" type="button" data-character="${item.id}" title="${escapeHtml(item.name)} Lv.${itemLevel}">
        <img src="${characterImagePath(item)}" alt="${escapeHtml(item.name)}" />
        <span>${escapeHtml(item.name)}</span>
      </button>
    `;
  }).join("");
  els.characterMaterialList.innerHTML = `
    <div class="material-item"><span>${escapeHtml(character.material)}</span><strong>${charState.materials}/${ascensionNeed}</strong></div>
    <div class="material-item"><span>进阶门槛</span><strong>特殊试炼收益 >= 5%</strong></div>
    <div class="material-item"><span>角色试炼</span><strong>${trialSuccesses}/10 成功</strong></div>
    <div class="material-item"><span>培养风格</span><strong>${escapeHtml(character.style)}</strong></div>
  `;
}

function settlementReviewCharacter(settlement = state.game.lastSettlement) {
  return characterById(settlement?.reviewerId || state.game.profile.activeCharacter);
}

function renderSettlementReview() {
  const settlement = state.game.lastSettlement;
  if (!settlement || !els.settlementReviewText) return;
  const character = settlementReviewCharacter(settlement);
  const review = state.game.settlementReview;
  els.settlementReviewPortrait.src = characterImagePath(character);
  els.settlementReviewTitle.textContent = `${character.name} 的角色点评`;
  els.settlementReviewStatus.textContent = review.isStreaming
    ? "正在阅读本局交易记录..."
    : `${settlement.reviewerReason || "独立角色复盘"}，不会写入日常聊天。`;
  els.settlementReviewText.textContent =
    review.text ||
    (review.isStreaming ? "正在整理点评..." : "结算后会自动生成点评；如果本地对话服务不可用，这里会显示原因。");
}

function settlementReviewMessages(settlement, character) {
  const history = (state.chat.histories[character.id] || []).slice(-10).map((item) => ({
    role: item.role === "user" ? "user" : "assistant",
    content: item.content,
  }));
  const report = settlement.report || {};
  const trades = report.trades?.length
    ? report.trades
        .map((trade, index) => {
          const risk = [trade.stopPrice ? `SL ${trade.stopPrice}` : "", trade.takePrice ? `TP ${trade.takePrice}` : ""].filter(Boolean).join(" / ");
          const result = [trade.realizedPnl ? `PnL ${trade.realizedPnl}` : "", trade.r ? `${trade.r}R` : ""].filter(Boolean).join(" / ");
          const note = tradeNoteSummary(trade);
          return `${index + 1}. ${trade.time} ${trade.side} @ ${trade.price} qty ${trade.qty}${risk ? ` (${risk})` : ""}${result ? ` -> ${result}` : ""}${trade.auto ? " [自动]" : ""}${note ? `；备注：${note}` : ""}`;
        })
        .join("\n")
    : "本局没有交易。";
  const bookmarks = report.bookmarks?.length
    ? report.bookmarks.map((mark) => `- ${mark.time} $${priceFmt.format(mark.price)} ${mark.text || ""} ${(mark.tags || []).join(" / ")}`).join("\n")
    : "无标注。";

  return [
    {
      role: "system",
      content: [
        chatSystemPrompt(character),
        "这是一次独立训练复盘，不要把这次回复写成日常聊天续篇，也不要要求玩家继续提供行情截图。",
        "你可以参考前面的日常聊天来保持角色语气和熟悉感，但本次点评不会保存进聊天历史。",
        "输出要像游戏结算后的角色点评：先给一句角色化总评，再指出 2-3 个具体做得好或需要修正的点，最后给下一局一个可执行训练目标。",
      ].join("\n"),
    },
    ...history,
    {
      role: "user",
      content: [
        `请按「${character.name}」的人设点评这局训练。`,
        "",
        `训练标题：${settlement.title}`,
        `训练类型：${settlement.typeLabel || challengeTypeLabel(settlement.type)}`,
        `数据：${report.fileName || "-"} / ${report.timeframe || "-"}`,
        `区间：${report.startTime || "-"} -> ${report.endTime || "-"}`,
        `判断：${report.bias || "-"}；实际：${report.expected || "-"}；行情涨跌幅：${((report.movePct || 0) * 100).toFixed(2)}%`,
        `评分：${settlement.score}/100${settlement.levelStars == null ? "" : `；关卡星级：${settlement.levelStars}/5`}`,
        `收益：${((report.returnPct || 0) * 100).toFixed(2)}%；权益：$${money.format(report.equity || 0)}；PnL：${report.pnl >= 0 ? "+" : ""}$${money.format(report.pnl || 0)}`,
        `最大回撤：${((report.maxDrawdown || 0) * 100).toFixed(1)}%；R 倍数：${Number.isFinite(report.sumR) ? report.sumR.toFixed(2) : "0.00"}R；交易数：${report.tradeCount || 0}`,
        `是否带止损：${report.hasStop ? "是" : "否"}；是否有复盘文字：${report.reviewed ? "是" : "否"}`,
        "",
        `玩家交易理由：${report.tradeReason || "无"}`,
        `玩家总复盘：${report.notes || "无"}`,
        `勾选标签：${(report.tags || []).join(" / ") || "无"}`,
        "",
        "交易记录：",
        trades,
        "",
        "标注：",
        bookmarks,
      ].join("\n"),
    },
  ];
}

async function requestSettlementCharacterReview(settlementId = state.game.lastSettlement?.id) {
  const settlement = state.game.lastSettlement;
  const review = state.game.settlementReview;
  if (!settlement || settlement.id !== settlementId || review.isStreaming || review.text) return;
  const character = settlementReviewCharacter(settlement);
  review.isStreaming = true;
  review.text = "";
  renderSettlementReview();

  try {
    const response = await fetch("./api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: character.id,
        messages: settlementReviewMessages(settlement, character),
      }),
    });
    if (!response.ok || !response.body) {
      let detail = "";
      try {
        detail = (await response.json()).error || "";
      } catch {
        detail = await response.text();
      }
      throw new Error(detail || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      review.text += decoder.decode(value, { stream: true });
      els.settlementReviewText.textContent = review.text;
    }
    review.text += decoder.decode();
    review.text = review.text.trim() || `${character.name} 这次没有说出完整点评。`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    review.text = `角色点评生成失败：${message}`;
  } finally {
    review.isStreaming = false;
    renderSettlementReview();
  }
}

function showSettlement() {
  const settlement = state.game.lastSettlement;
  if (!settlement) return;
  if (state.game.settlementReview.settlementId !== settlement.id) {
    state.game.settlementReview = {
      settlementId: settlement.id,
      isStreaming: false,
      text: "",
    };
  }
  els.settlementTitle.textContent = `${settlement.title} 结算`;
  els.settlementScore.textContent = String(settlement.score);
  els.settlementBreakdown.innerHTML = settlement.lines
    .map((line) => `<div class="score-line">${escapeHtml(line)}</div>`)
    .join("");
  const rewards = [`获得 ${settlement.earnedXp} XP`];
  if (settlement.levelStars != null) {
    const record = state.game.lastLevelRecord;
    rewards.push(`关卡星级：${starsText(settlement.levelStars)}，历史最佳 ${starsText(record?.bestStars || settlement.levelStars)}`);
  }
  for (const achievement of settlement.newAchievements) {
    rewards.push(`解锁成就：${achievement.name}`);
  }
  const gain = state.game.lastCharacterGain;
  if (gain) {
    rewards.push(`${gain.character.name} 获得 ${gain.xp} 经验`);
    if (gain.ascensionTrial) {
      rewards.push(gain.ascensionPassed ? `进阶试炼通过：${gain.character.material} +${gain.materials}` : "进阶试炼未通过：本局收益未达到 5%，进阶材料 +0");
    } else {
      rewards.push("普通角色试炼只给经验；进阶材料需要特殊试炼。");
    }
    if (gain.afterLevel > gain.beforeLevel) rewards.push(`${gain.character.name} 升到 Lv.${gain.afterLevel}`);
    if (gain.ascended) rewards.push(`${gain.character.name} 进阶为 ${stageName(gain.afterStage)}`);
  }
  els.settlementRewards.innerHTML = rewards.map((line) => `<div class="reward-item">${escapeHtml(line)}</div>`).join("");
  renderSettlementReview();
  els.settlementModal.classList.add("show");
  window.setTimeout(() => requestSettlementCharacterReview(settlement.id), 0);
}

function closeSettlement() {
  els.settlementModal.classList.remove("show");
}
