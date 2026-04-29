"use strict";

function bindEvents() {
  els.brandAvatarSelect.addEventListener("change", () => {
    state.brandAvatarChoice = els.brandAvatarSelect.value;
    saveSettings();
    syncSettingControls();
  });

  els.fileInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      setStatus(`正在解析 ${file.name} ...`);
      const text = await file.text();
      const candles = parseCsv(text);
      loadCandles(candles, file.name);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "CSV 解析失败。");
    } finally {
      els.fileInput.value = "";
    }
  });

  els.timeframeSelect.addEventListener("change", () => applyTimeframe(true));
  els.hideFutureToggle.addEventListener("change", () => {
    state.hideFuture = els.hideFutureToggle.checked;
    clampView(state.viewStart, state.viewEnd);
    saveSettings();
    render();
  });
  els.blindModeToggle.addEventListener("change", () => {
    state.blindMode = els.blindModeToggle.checked;
    state.dateRevealed = !state.blindMode;
    saveSettings();
    render();
  });
  els.logScaleToggle.addEventListener("change", () => {
    state.logScale = els.logScaleToggle.checked;
    saveSettings();
    render();
  });
  els.ma20Toggle.addEventListener("change", () => {
    state.showMA20 = els.ma20Toggle.checked;
    saveSettings();
    render();
  });
  els.ma60Toggle.addEventListener("change", () => {
    state.showMA60 = els.ma60Toggle.checked;
    saveSettings();
    render();
  });

  els.timeline.addEventListener("input", () => revealTo(Number(els.timeline.value), true));
  els.firstBtn.addEventListener("click", () => revealTo(0, true));
  els.backBtn.addEventListener("click", () => stepBy(-1));
  els.playBtn.addEventListener("click", togglePlayback);
  els.forwardBtn.addEventListener("click", () => stepBy(1));
  els.plusTenBtn.addEventListener("click", () => stepBy(10));
  els.latestBtn.addEventListener("click", () => revealTo(state.candles.length - 1, true));
  els.randomBtn.addEventListener("click", () => randomTraining(false));
  els.blindRandomBtn.addEventListener("click", () => randomTraining(true));
  els.revealDateBtn.addEventListener("click", () => {
    state.dateRevealed = true;
    render();
    showToast("日期已揭晓");
  });
  els.speedSelect.addEventListener("change", resetPlaybackTimer);
  els.jumpBtn.addEventListener("click", () => {
    if (!state.candles.length || !els.jumpInput.value) return;
    const target = new Date(els.jumpInput.value).getTime();
    revealTo(findIndexAtOrBefore(state.candles, target), true);
  });

  els.resetAccountBtn.addEventListener("click", () => resetAccount(true));
  els.addStopBtn.addEventListener("click", () => addRiskLine("stop"));
  els.addTakeBtn.addEventListener("click", () => addRiskLine("take"));
  els.riskBuyBtn.addEventListener("click", executeRiskBuy);
  els.closePositionBtn.addEventListener("click", () => closePosition());
  els.attachStopsBtn.addEventListener("click", setStopsFromInputs);
  els.clearStopsBtn.addEventListener("click", clearStops);
  [els.feeInput, els.riskPctInput, els.initialCashInput].forEach((input) => {
    input.addEventListener("change", saveSettings);
  });

  document.querySelectorAll("[data-side][data-pct]").forEach((button) => {
    button.addEventListener("click", () => {
      executeTrade(button.dataset.side, Number(button.dataset.pct));
    });
  });

  els.addBookmarkBtn.addEventListener("click", addBookmark);
  els.addHlineBtn.addEventListener("click", addHorizontalLine);
  els.clearLinesBtn.addEventListener("click", clearLines);
  els.saveSessionBtn.addEventListener("click", saveSession);
  els.loadSessionBtn.addEventListener("click", loadSelectedSession);
  els.deleteSessionBtn.addEventListener("click", deleteSelectedSession);
  els.exportTradesBtn.addEventListener("click", exportTrades);
  els.exportReportBtn.addEventListener("click", exportReport);
  els.screenshotBtn.addEventListener("click", saveScreenshot);
  els.characterGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-character]");
    if (!button) return;
    state.game.profile.activeCharacter = button.dataset.character;
    state.game.activeQuoteCharacterId = null;
    state.game.activeQuote = "";
    saveGameProfile();
    syncSettingControls();
    renderGame();
    showToast(`已切换到 ${activeCharacter().name}`);
  });
  els.characterQuestBtn.addEventListener("click", () => {
    startCharacterTrial("normal");
  });
  els.ascensionTrialBtn.addEventListener("click", () => {
    startCharacterTrial("ascension");
  });
  els.quickGameBtn.addEventListener("click", () => startChallenge("blind"));
  els.trendGameBtn.addEventListener("click", () => startChallenge("trend"));
  els.trapGameBtn.addEventListener("click", () => startChallenge("trap"));
  els.survivalGameBtn.addEventListener("click", () => startChallenge("survival"));
  els.revengeGameBtn.addEventListener("click", () => startChallenge("revenge"));
  els.levelGameBtn.addEventListener("click", () => startLevelChallenge());
  els.levelListBtn.addEventListener("click", openLevelModal);
  els.prevLevelPageBtn.addEventListener("click", () => setLevelPage((Number(levelModeForDataset().page) || 0) - 1));
  els.nextLevelPageBtn.addEventListener("click", () => setLevelPage((Number(levelModeForDataset().page) || 0) + 1));
  els.levelPageSelect.addEventListener("change", () => setLevelPage(Number(els.levelPageSelect.value)));
  els.levelRows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-level-index]");
    if (!button) return;
    closeLevelModal();
    startLevelChallenge(Number(button.dataset.levelIndex));
  });
  els.closeLevelModalBtn.addEventListener("click", closeLevelModal);
  els.levelModal.addEventListener("click", (event) => {
    if (event.target === els.levelModal) closeLevelModal();
  });
  els.settleGameBtn.addEventListener("click", () => finishChallenge("manual"));
  els.dailyTaskHudBtn.addEventListener("click", openDailyTaskModal);
  els.closeDailyTaskBtn.addEventListener("click", closeDailyTaskModal);
  els.claimDailyRewardBtn.addEventListener("click", claimDailyReward);
  els.prevCalendarMonthBtn.addEventListener("click", () => moveCalendarMonth(-1));
  els.nextCalendarMonthBtn.addEventListener("click", () => moveCalendarMonth(1));
  els.dailyCalendarYearSelect.addEventListener("change", () => {
    state.game.calendarYear = Number(els.dailyCalendarYearSelect.value);
    renderDailyCalendar();
  });
  els.dailyCalendarMonthSelect.addEventListener("change", () => {
    state.game.calendarMonth = Number(els.dailyCalendarMonthSelect.value);
    renderDailyCalendar();
  });
  els.biasLongBtn.addEventListener("click", () => setChallengeBias("long"));
  els.biasShortBtn.addEventListener("click", () => setChallengeBias("short"));
  els.biasFlatBtn.addEventListener("click", () => setChallengeBias("flat"));
  els.closeSettlementBtn.addEventListener("click", closeSettlement);
  els.achievementAllBtn.addEventListener("click", openAchievementModal);
  els.closeAchievementBtn.addEventListener("click", closeAchievementModal);
  els.achievementAllList.addEventListener("click", handleAchievementListClick);
  els.nextChallengeBtn.addEventListener("click", () => {
    closeSettlement();
    startChallenge(state.game.lastType || "blind");
  });
  els.reviewMistakeBtn.addEventListener("click", () => {
    closeSettlement();
    startChallenge("revenge");
  });
  els.settlementModal.addEventListener("click", (event) => {
    if (event.target === els.settlementModal) closeSettlement();
  });
  els.dailyTaskModal.addEventListener("click", (event) => {
    if (event.target === els.dailyTaskModal) closeDailyTaskModal();
  });
  els.achievementModal.addEventListener("click", (event) => {
    if (event.target === els.achievementModal) closeAchievementModal();
  });
  els.characterChatHudBtn.addEventListener("click", openCharacterChat);
  els.closeCharacterChatBtn.addEventListener("click", closeCharacterChat);
  els.characterChatModal.addEventListener("click", (event) => {
    if (event.target === els.characterChatModal) closeCharacterChat();
  });
  els.chatCharacterSelect.addEventListener("change", () => changeChatCharacter(els.chatCharacterSelect.value));
  els.chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendChatMessage();
    }
  });
  els.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendChatMessage();
  });
  els.chatClearBtn.addEventListener("click", clearChatHistory);

  const handleChartDrag = (event) => {
    if (!state.drag) return;
    const point = canvasPoint(event);
    const metrics = chartMetrics();

    const distance = Math.hypot(point.x - state.drag.x, point.y - state.drag.y);
    if (distance > 4) state.drag.moved = true;

    if (state.drag.mode === "risk-line") {
      setRiskLine(state.drag.kind, priceFromChartY(point.y, metrics), { silent: true, renderMode: "none" });
      state.hover = point;
      renderChart();
      return;
    }

    if (state.drag.mode === "scrub") {
      const delta = Math.round((point.x - state.drag.x) / scrubPixelsPerCandle(event));
      const target = clamp(state.drag.index + delta, 0, state.candles.length - 1);
      if (target !== state.currentIndex) {
        state.followCurrent = true;
        revealTo(target, false);
      } else {
        renderChart();
      }
    } else if (state.drag.mode === "pending" && state.drag.moved) {
      state.drag.mode = "pan";
    }

    if (state.drag?.mode === "pan") {
      const width = Math.max(1, state.drag.end - state.drag.start);
      const candleDelta = Math.round(((state.drag.x - point.x) / Math.max(1, metrics.plotWidth)) * width);
      state.followCurrent = false;
      clampView(state.drag.start + candleDelta, state.drag.end + candleDelta);
      state.hover = point;
      renderChart();
    }
  };

  els.canvas.addEventListener("mousemove", (event) => {
    if (state.drag) return;
    const point = canvasPoint(event);
    const metrics = chartMetrics();
    const riskLine = pickRiskLineAtPoint(point, metrics);
    state.hover = point;
    els.canvas.style.cursor = riskLine ? "ns-resize" : isNearCurrentLine(point, metrics) ? "ew-resize" : "crosshair";
    renderChart();
  });
  window.addEventListener("mousemove", (event) => {
    handleChartDrag(event);
  });
  els.canvas.addEventListener("mouseleave", () => {
    state.hover = null;
    if (!state.drag) els.canvas.style.cursor = "crosshair";
    els.tooltip.style.display = "none";
    renderChart();
  });
  els.canvas.addEventListener("mousedown", (event) => {
    if (!state.candles.length || event.button !== 0) return;
    const point = canvasPoint(event);
    const metrics = chartMetrics();
    stopPlayback();
    const riskLine = pickRiskLineAtPoint(point, metrics);
    if (riskLine) {
      state.drag = {
        mode: "risk-line",
        kind: riskLine.kind,
        x: point.x,
        y: point.y,
        moved: false,
      };
      els.canvas.style.cursor = "ns-resize";
      return;
    }
    if (isNearCurrentLine(point, metrics)) {
      state.drag = {
        mode: "scrub",
        x: point.x,
        y: point.y,
        index: state.currentIndex,
        moved: false,
      };
      els.canvas.style.cursor = "ew-resize";
      return;
    }
    state.drag = {
      mode: "pending",
      x: point.x,
      y: point.y,
      start: state.viewStart,
      end: state.viewEnd,
      moved: false,
    };
  });
  window.addEventListener("mouseup", (event) => {
    const finishedDrag = state.drag;
    if (finishedDrag?.mode === "pending" && !finishedDrag.moved) {
      const point = canvasPoint(event);
      const metrics = chartMetrics();
      if (pointInChart(point, metrics)) {
        state.followCurrent = false;
        revealTo(indexFromChartX(point.x, metrics), false);
        state.lastClickAt = Date.now();
      }
    }
    if (finishedDrag?.mode === "risk-line" && finishedDrag.moved) {
      const price = riskLineValue(finishedDrag.kind);
      if (price != null) showToast(`已调整${riskLineLabel(finishedDrag.kind)}：$${priceFmt.format(price)}`);
    }
    state.drag = null;
    els.canvas.style.cursor = "crosshair";
    if (finishedDrag) renderChart();
  });
  els.canvas.addEventListener(
    "wheel",
    (event) => {
      if (!state.candles.length) return;
      event.preventDefault();
      const metrics = chartMetrics();
      const point = canvasPoint(event);
      const width = state.viewEnd - state.viewStart;
      const ratio = clamp((point.x - metrics.plotLeft) / Math.max(1, metrics.plotWidth), 0, 1);
      const nextWidth = clamp(Math.round(width * (event.deltaY > 0 ? 1.18 : 0.84)), 20, maxChartIndex() + 1);
      const center = state.viewStart + width * ratio;
      const nextStart = center - nextWidth * ratio;
      state.followCurrent = false;
      clampView(nextStart, nextStart + nextWidth);
      render();
    },
    { passive: false },
  );
  els.canvas.addEventListener("dblclick", () => {
    state.followCurrent = true;
    centerOnCurrent(state.viewEnd - state.viewStart || 220);
    render();
  });

  window.addEventListener("resize", render);
  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.code === "Space") {
      event.preventDefault();
      togglePlayback();
    } else if (event.code === "ArrowRight") {
      event.preventDefault();
      stepBy(event.ctrlKey || event.metaKey ? 50 : event.shiftKey ? 10 : 1);
    } else if (event.code === "ArrowLeft") {
      event.preventDefault();
      stepBy(event.ctrlKey || event.metaKey ? -50 : event.shiftKey ? -10 : -1);
    } else if (event.code === "PageDown") {
      event.preventDefault();
      stepBy(25);
    } else if (event.code === "PageUp") {
      event.preventDefault();
      stepBy(-25);
    } else if (event.code === "Home") {
      event.preventDefault();
      revealTo(0, true);
    } else if (event.code === "End") {
      event.preventDefault();
      revealTo(state.candles.length - 1, true);
    } else if (event.key.toLowerCase() === "b") {
      executeTrade("buy", 1);
    } else if (event.key.toLowerCase() === "s") {
      executeTrade("sell", 1);
    } else if (event.key.toLowerCase() === "c") {
      closePosition();
    } else if (event.key.toLowerCase() === "m") {
      addBookmark();
    } else if (event.key.toLowerCase() === "h") {
      addHorizontalLine();
    }
  });
}

loadSettings();
loadGameProfile();
loadChatHistories();
syncSettingControls();
refreshSessionSelect();
bindEvents();
render();
autoLoadDefaultCsv();
