"use strict";

function resetAccount(shouldRender = true) {
  const initial = Number(els.initialCashInput.value);
  state.account = createAccount(Number.isFinite(initial) && initial > 0 ? initial : 10_000);
  els.stopLossInput.value = "";
  els.takeProfitInput.value = "";
  saveSettings();
  if (shouldRender) render();
}

function feeRate() {
  const value = Number(els.feeInput.value);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function currentCandle() {
  return state.candles[state.currentIndex] || null;
}

function accountEquity(price) {
  return state.account.cash + state.account.btc * price;
}

function activeStopFromInput() {
  const value = Number(els.stopLossInput.value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function activeTakeFromInput() {
  const value = Number(els.takeProfitInput.value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeRiskPrice(price) {
  if (!Number.isFinite(price) || price <= 0) return null;
  return Number(price.toFixed(2));
}

function riskLineLabel(kind) {
  return kind === "stop" ? "止损" : "止盈";
}

function riskLineValue(kind) {
  return kind === "stop" ? state.account.stopPrice : state.account.takePrice;
}

function syncRiskInputs() {
  els.stopLossInput.value = state.account.stopPrice == null ? "" : normalizeRiskPrice(state.account.stopPrice).toFixed(2);
  els.takeProfitInput.value = state.account.takePrice == null ? "" : normalizeRiskPrice(state.account.takePrice).toFixed(2);
}

function setRiskLine(kind, price, options = {}) {
  const normalized = normalizeRiskPrice(price);
  if (kind === "stop") state.account.stopPrice = normalized;
  if (kind === "take") state.account.takePrice = normalized;
  syncRiskInputs();

  if (options.renderMode === "chart") renderChart();
  else if (options.renderMode !== "none") render();

  if (!options.silent) {
    if (normalized) showToast(options.message || `已设置${riskLineLabel(kind)}：$${priceFmt.format(normalized)}`);
    else showToast(options.message || `已清除${riskLineLabel(kind)}线`);
  }
  return normalized;
}

function addRiskLine(kind) {
  const candle = currentCandle();
  if (!candle) return;
  const price = setRiskLine(kind, candle.close, { silent: true });
  if (price != null) showToast(`已添加${riskLineLabel(kind)}线：$${priceFmt.format(price)}，可直接在图上拖动修改`);
}

function setStopsFromInputs() {
  state.account.stopPrice = activeStopFromInput();
  state.account.takePrice = activeTakeFromInput();
  syncRiskInputs();
  render();
  showToast("已更新止损止盈线");
}

function clearStops() {
  clearAccountRiskLines();
  render();
  showToast("已清除风控线");
}

function tradeCommon(extra = {}) {
  const candle = currentCandle();
  const action = extra.action || "";
  const closing = isClosingTrade(action);
  return {
    id: uniqueId("trade"),
    time: extra.time ?? candle?.time ?? Date.now(),
    reason: extra.reason ?? els.tradeReasonInput.value.trim(),
    review: extra.review ?? (closing ? els.sessionNotesInput.value.trim() : ""),
    tags: extra.tags ?? selectedTags(),
    stopPrice: extra.stopPrice ?? state.account.stopPrice,
    takePrice: extra.takePrice ?? state.account.takePrice,
    auto: Boolean(extra.auto),
  };
}

function activeChallengeTrades() {
  const startTime = state.game.active?.startTime ?? -Infinity;
  return state.account.trades.filter((trade) => trade.time >= startTime);
}

function hasTradeReason() {
  return Boolean(els.tradeReasonInput.value.trim());
}

function isOpeningTrade(side) {
  return side === "buy" || side === "short";
}

function isClosingTrade(side) {
  return side === "sell" || side === "cover";
}

function validStopForSide(side, price, stopPrice) {
  if (!stopPrice || !Number.isFinite(price)) return false;
  if (side === "buy") return stopPrice < price;
  if (side === "short") return stopPrice > price;
  return false;
}

function validTakeForSide(side, price, takePrice) {
  if (!takePrice || !Number.isFinite(price)) return false;
  if (side === "buy") return takePrice > price;
  if (side === "short") return takePrice < price;
  return false;
}

function plannedEntryFraction(side, options, price) {
  const equity = accountEquity(price);
  if (!Number.isFinite(equity) || equity <= 0) return 0;
  if (side === "buy") {
    const spend = options.spend ?? state.account.cash * (options.pct ?? 0);
    return spend / equity;
  }
  if (side === "short") {
    const notional = options.notional ?? equity * (options.pct ?? 0);
    return notional / equity;
  }
  return 0;
}

function validateCharacterTrade(side, options = {}) {
  if (options.auto || options.skipCharacterRules) return true;
  if (!state.game.active) return true;

  const character = activeCharacter();
  const price = options.price ?? currentCandle()?.close;
  const stopPrice = options.stopPrice ?? activeStopFromInput() ?? state.account.stopPrice;
  const takePrice = options.takePrice ?? activeTakeFromInput() ?? state.account.takePrice;
  const opening = isOpeningTrade(side);
  const stopOk = opening && validStopForSide(side, price, stopPrice);
  const takeOk = opening && validTakeForSide(side, price, takePrice);
  const reasonOk = hasTradeReason();
  const trades = activeChallengeTrades();
  const activeEntries = trades.filter((trade) => isOpeningTrade(trade.side) && !trade.auto);

  if (character.id === "btc_hime") {
    if (side === "short") {
      showToast(`${character.name}：这局只练多头，不开空。`);
      return false;
    }
    if (side === "buy" && !reasonOk) {
      showToast(`${character.name}：看多前先写一句理由。`);
      return false;
    }
  }

  if (character.id === "ember_keeper" && opening) {
    if (activeEntries.length >= 2) {
      showToast(`${character.name}：今天轻量训练，这局最多两次主动开仓。`);
      return false;
    }
    if (plannedEntryFraction(side, options, price) > 0.5) {
      showToast(`${character.name}：别一口气冲满，单次开仓最多 50% 权益。`);
      return false;
    }
  }

  if (character.id === "white_saint" && opening && !stopOk) {
    showToast(`${character.name}：没有有效止损，不准入场。多单止损低于现价，空单止损高于现价。`);
    return false;
  }

  if (character.id === "gentle_queen") {
    if (side === "buy") {
      showToast(`${character.name}：这局只审判空头机会，不开多。`);
      return false;
    }
    if (side === "short" && !takeOk) {
      showToast(`${character.name}：空单先写好低于现价的止盈目标。`);
      return false;
    }
  }

  if (character.id === "clear_eye" && opening) {
    if (!state.game.active.bias) {
      showToast(`${character.name}：先选看多、看空或观望，再决定要不要动手。`);
      return false;
    }
    if (state.game.active.bias === "flat") {
      showToast(`${character.name}：你选了观望，这局就练不出手。`);
      return false;
    }
    if ((state.game.active.bias === "long" && side !== "buy") || (state.game.active.bias === "short" && side !== "short")) {
      showToast(`${character.name}：开仓方向必须和你先选的判断一致。`);
      return false;
    }
    if (activeEntries.length >= 1) {
      showToast(`${character.name}：这局只允许一次主动开仓，练少交易。`);
      return false;
    }
  }

  if (character.id === "kind_saint" && opening) {
    if (!reasonOk) {
      showToast(`${character.name}：先写理由，交易才有复盘价值。`);
      return false;
    }
    if (!selectedTags().length) {
      showToast(`${character.name}：至少勾选一个复盘标签，再开仓。`);
      return false;
    }
  }

  if (character.id === "green_eth" && opening && (!stopOk || !takeOk)) {
    showToast(`${character.name}：高波动局必须同时设置有效止损和止盈。`);
    return false;
  }
  return true;
}

function executeTrade(side, pct, options = {}) {
  const candle = currentCandle();
  if (!candle && options.price == null) return null;
  const price = options.price ?? candle.close;
  const fee = feeRate();
  const currentSide = positionSide();
  let action = side;
  if (side === "buy" && currentSide === "short") action = "cover";
  if (side === "sell" && currentSide !== "long") {
    if (!options.auto) showToast("当前没有多头仓位可卖，开空请用空单按钮。");
    return null;
  }
  if (side === "short" && currentSide === "long") {
    if (!options.auto) showToast("先平多仓，再开空。");
    return null;
  }
  if (!validateCharacterTrade(action, { ...options, pct, price })) return null;
  const common = tradeCommon({ ...options, action });

  if (action === "buy") {
    const requestedSpend = options.spend ?? state.account.cash * pct;
    const spend = clamp(requestedSpend, 0, state.account.cash);
    if (spend <= 0 || price <= 0) return null;
    const feeCost = spend * fee;
    const qty = (spend - feeCost) / price;
    const stopPrice = options.stopPrice ?? activeStopFromInput() ?? state.account.stopPrice;
    const takePrice = options.takePrice ?? activeTakeFromInput() ?? state.account.takePrice;
    const riskAmount = stopPrice && stopPrice < price ? qty * (price - stopPrice) : 0;

    state.account.cash -= spend;
    state.account.btc += qty;
    state.account.positionCost += spend;
    state.account.positionRisk += riskAmount;
    state.account.stopPrice = stopPrice;
    state.account.takePrice = takePrice;
    syncRiskInputs();

    const trade = {
      ...common,
      side: action,
      price,
      qty,
      fee: feeCost,
      spend,
      stopPrice,
      takePrice,
      riskAmount,
      realizedPnl: null,
      r: null,
      cash: state.account.cash,
      btc: state.account.btc,
      equity: accountEquity(price),
    };
    state.account.trades.push(trade);
    if (!options.skipRender) render();
    return trade;
  }

  if (action === "short") {
    const equity = Math.max(0, accountEquity(price));
    const gross = options.notional ?? equity * pct;
    if (gross <= 0 || price <= 0) return null;
    const qty = gross / price;
    const feeCost = gross * fee;
    const proceeds = gross - feeCost;
    const stopPrice = options.stopPrice ?? activeStopFromInput() ?? state.account.stopPrice;
    const takePrice = options.takePrice ?? activeTakeFromInput() ?? state.account.takePrice;
    const riskAmount = stopPrice && stopPrice > price ? qty * (stopPrice - price) : 0;

    state.account.cash += proceeds;
    state.account.btc -= qty;
    state.account.positionCost += proceeds;
    state.account.positionRisk += riskAmount;
    state.account.stopPrice = stopPrice;
    state.account.takePrice = takePrice;
    syncRiskInputs();

    const trade = {
      ...common,
      side: action,
      price,
      qty,
      fee: feeCost,
      gross,
      proceeds,
      stopPrice,
      takePrice,
      riskAmount,
      realizedPnl: null,
      r: null,
      cash: state.account.cash,
      btc: state.account.btc,
      equity: accountEquity(price),
    };
    state.account.trades.push(trade);
    if (!options.skipRender) render();
    return trade;
  }

  if (action === "sell") {
    const qty = clamp(options.qty ?? state.account.btc * pct, 0, state.account.btc);
    if (qty <= 0 || price <= 0) return null;
    const btcBefore = state.account.btc;
    const gross = qty * price;
    const feeCost = gross * fee;
    const proceeds = gross - feeCost;
    const fraction = btcBefore > 0 ? qty / btcBefore : 1;
    const costBasis = state.account.positionCost * fraction;
    const riskBasis = state.account.positionRisk * fraction;
    const realizedPnl = proceeds - costBasis;

    state.account.cash += proceeds;
    state.account.btc -= qty;
    state.account.positionCost = Math.max(0, state.account.positionCost - costBasis);
    state.account.positionRisk = Math.max(0, state.account.positionRisk - riskBasis);
    if (state.account.btc < POSITION_EPSILON) {
      state.account.btc = 0;
      state.account.positionCost = 0;
      state.account.positionRisk = 0;
      clearAccountRiskLines();
    }

    const trade = {
      ...common,
      side: action,
      price,
      qty,
      fee: feeCost,
      gross,
      proceeds,
      costBasis,
      riskAmount: riskBasis,
      realizedPnl,
      r: riskBasis > 0 ? realizedPnl / riskBasis : null,
      cash: state.account.cash,
      btc: state.account.btc,
      equity: accountEquity(price),
    };
    state.account.trades.push(trade);
    if (!options.skipRender) render();
    return trade;
  }

  if (action === "cover") {
    if (positionSide() !== "short") return null;
    const shortQty = Math.abs(state.account.btc);
    const qty = clamp(options.qty ?? shortQty * pct, 0, shortQty);
    if (qty <= 0 || price <= 0) return null;
    const gross = qty * price;
    const feeCost = gross * fee;
    const coverCost = gross + feeCost;
    const fraction = shortQty > 0 ? qty / shortQty : 1;
    const costBasis = state.account.positionCost * fraction;
    const riskBasis = state.account.positionRisk * fraction;
    const realizedPnl = costBasis - coverCost;

    state.account.cash -= coverCost;
    state.account.btc += qty;
    state.account.positionCost = Math.max(0, state.account.positionCost - costBasis);
    state.account.positionRisk = Math.max(0, state.account.positionRisk - riskBasis);
    if (Math.abs(state.account.btc) < POSITION_EPSILON) {
      state.account.btc = 0;
      state.account.positionCost = 0;
      state.account.positionRisk = 0;
      clearAccountRiskLines();
    }

    const trade = {
      ...common,
      side: action,
      price,
      qty,
      fee: feeCost,
      gross,
      coverCost,
      costBasis,
      riskAmount: riskBasis,
      realizedPnl,
      r: riskBasis > 0 ? realizedPnl / riskBasis : null,
      cash: state.account.cash,
      btc: state.account.btc,
      equity: accountEquity(price),
    };
    state.account.trades.push(trade);
    if (!options.skipRender) render();
    return trade;
  }

  return null;
}

function closePosition(options = {}) {
  const side = positionSide();
  if (side === "flat") {
    showToast("当前没有持仓。");
    return null;
  }
  const manualReason = els.tradeReasonInput.value.trim();
  const trade =
    side === "long"
      ? executeTrade("sell", 1, { reason: options.reason ?? (manualReason || "手动平仓"), skipCharacterRules: true })
      : executeTrade("cover", 1, { reason: options.reason ?? (manualReason || "手动平空"), skipCharacterRules: true });
  if (trade) showToast(`已平${positionSideLabel(side)}仓`);
  return trade;
}

function executeRiskBuy() {
  const candle = currentCandle();
  if (!candle) return;
  if (positionSide() === "short") {
    showToast("先平空仓，再按风险买入。");
    return;
  }
  const stopPrice = activeStopFromInput();
  if (!stopPrice || stopPrice >= candle.close) {
    showToast("按风险买入需要填写低于当前价的止损价");
    return;
  }
  const takePrice = activeTakeFromInput();
  const riskPct = Number(els.riskPctInput.value);
  const equity = accountEquity(candle.close);
  const riskAmount = equity * (Number.isFinite(riskPct) ? riskPct : 1) / 100;
  const qty = riskAmount / (candle.close - stopPrice);
  const spend = qty * candle.close / Math.max(0.000001, 1 - feeRate());
  const trade = executeTrade("buy", 0, {
    spend,
    stopPrice,
    takePrice,
    reason: els.tradeReasonInput.value.trim() || `按 ${riskPct || 1}% 风险买入`,
  });
  if (trade) showToast(`已按风险买入，理论风险约 $${money.format(trade.riskAmount)}`);
}

function checkAutoExit(fromIndex, toIndex) {
  const side = positionSide();
  if (side === "flat") return null;
  const stopPrice = state.account.stopPrice;
  const takePrice = state.account.takePrice;
  if (!stopPrice && !takePrice) return null;

  for (let i = fromIndex; i <= toIndex; i += 1) {
    const candle = state.candles[i];
    if (!candle) continue;
    if (side === "long" && stopPrice && candle.low <= stopPrice) {
      executeTrade("sell", 1, {
        price: stopPrice,
        time: candle.time,
        reason: "止损触发",
        tags: selectedTags(),
        auto: true,
        skipRender: true,
      });
      showToast(`止损触发：$${priceFmt.format(stopPrice)}`);
      return i;
    }
    if (side === "long" && takePrice && candle.high >= takePrice) {
      executeTrade("sell", 1, {
        price: takePrice,
        time: candle.time,
        reason: "止盈触发",
        tags: selectedTags(),
        auto: true,
        skipRender: true,
      });
      showToast(`止盈触发：$${priceFmt.format(takePrice)}`);
      return i;
    }
    if (side === "short" && stopPrice && candle.high >= stopPrice) {
      executeTrade("cover", 1, {
        price: stopPrice,
        time: candle.time,
        reason: "空单止损触发",
        tags: selectedTags(),
        auto: true,
        skipRender: true,
      });
      showToast(`空单止损触发：$${priceFmt.format(stopPrice)}`);
      return i;
    }
    if (side === "short" && takePrice && candle.low <= takePrice) {
      executeTrade("cover", 1, {
        price: takePrice,
        time: candle.time,
        reason: "空单止盈触发",
        tags: selectedTags(),
        auto: true,
        skipRender: true,
      });
      showToast(`空单止盈触发：$${priceFmt.format(takePrice)}`);
      return i;
    }
  }
  return null;
}
