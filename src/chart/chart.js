"use strict";

function generateDemoCandles() {
  const candles = [];
  const start = Date.UTC(2017, 0, 1, 0, 0, 0);
  const end = Date.now();
  const interval = 14_400_000;
  let price = 960;
  let seed = 42;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let time = start; time <= end; time += interval) {
    const years = (time - start) / (365 * 24 * 60 * 60 * 1000);
    const cycle = Math.sin(years * Math.PI * 1.45) * 0.018 + Math.sin(years * Math.PI * 4.1) * 0.008;
    const drift = 0.00034;
    const shock = (random() - 0.5) * 0.045;
    const open = price;
    price = Math.max(120, price * (1 + drift + cycle + shock));
    const close = price;
    const spread = Math.abs(close - open) + open * (0.01 + random() * 0.028);
    const high = Math.max(open, close) + spread * random();
    const low = Math.max(1, Math.min(open, close) - spread * random());
    const volume = 400 + random() * 4200;
    candles.push({ time, open, high, low, close, volume });
  }
  return candles;
}

function chartMetrics() {
  const rect = els.canvas.getBoundingClientRect();
  const width = rect.width || 1;
  const height = rect.height || 1;
  const pad = { left: 12, right: 88, top: 18, bottom: 28 };
  const volumeTop = Math.floor(height * 0.78);
  const priceBottom = volumeTop - 12;
  return {
    width,
    height,
    pad,
    plotLeft: pad.left,
    plotRight: width - pad.right,
    plotTop: pad.top,
    priceBottom,
    volumeTop,
    volumeBottom: height - pad.bottom,
    plotWidth: width - pad.left - pad.right,
    priceHeight: priceBottom - pad.top,
    volumeHeight: height - pad.bottom - volumeTop,
  };
}

function visibleBounds(start, end) {
  let min = Infinity;
  let max = -Infinity;
  let maxVolume = 0;
  for (let i = start; i < end; i += 1) {
    const candle = state.candles[i];
    if (!candle) continue;
    min = Math.min(min, candle.low);
    max = Math.max(max, candle.high);
    maxVolume = Math.max(maxVolume, candle.volume || 0);
  }
  for (const line of state.annotations) {
    min = Math.min(min, line.price);
    max = Math.max(max, line.price);
  }
  for (const price of [state.account.stopPrice, state.account.takePrice]) {
    if (price) {
      min = Math.min(min, price);
      max = Math.max(max, price);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    min = 1;
    max = 2;
  }
  const padding = (max - min) * 0.08;
  return {
    min: Math.max(0.00000001, min - padding),
    max: max + padding,
    maxVolume: Math.max(1, maxVolume),
  };
}

function createScale(bounds, metrics) {
  const minValue = state.logScale ? Math.log(Math.max(bounds.min, 0.00000001)) : bounds.min;
  const maxValue = state.logScale ? Math.log(Math.max(bounds.max, 0.00000001)) : bounds.max;
  const span = Math.max(0.00000001, maxValue - minValue);
  return {
    y(price) {
      const value = state.logScale ? Math.log(Math.max(price, 0.00000001)) : price;
      return metrics.priceBottom - ((value - minValue) / span) * metrics.priceHeight;
    },
    price(y) {
      const value = minValue + ((metrics.priceBottom - y) / metrics.priceHeight) * span;
      return state.logScale ? Math.exp(value) : value;
    },
    priceAt(t) {
      const value = minValue + t * span;
      return state.logScale ? Math.exp(value) : value;
    },
  };
}

function drawGrid(metrics, scale, start, end) {
  ctx.strokeStyle = "rgba(255,255,255,0.075)";
  ctx.fillStyle = "#8b98a8";
  ctx.lineWidth = 1;
  ctx.font = "12px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= 5; i += 1) {
    const t = i / 5;
    const y = metrics.plotTop + t * metrics.priceHeight;
    ctx.beginPath();
    ctx.moveTo(metrics.plotLeft, y);
    ctx.lineTo(metrics.plotRight, y);
    ctx.stroke();
    const price = scale.priceAt(1 - t);
    ctx.fillText(priceFmt.format(price), metrics.plotRight + 8, y);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const count = Math.max(1, end - start);
  for (let i = 0; i <= 6; i += 1) {
    const x = metrics.plotLeft + (i / 6) * metrics.plotWidth;
    const index = clamp(Math.floor(start + (i / 6) * count), start, end - 1);
    const candle = state.candles[index];
    ctx.beginPath();
    ctx.moveTo(x, metrics.plotTop);
    ctx.lineTo(x, metrics.volumeBottom);
    ctx.stroke();
    if (candle) ctx.fillText(formatAxisTime(candle.time, index), x, metrics.volumeBottom + 8);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.11)";
  ctx.beginPath();
  ctx.moveTo(metrics.plotLeft, metrics.volumeTop);
  ctx.lineTo(metrics.plotRight, metrics.volumeTop);
  ctx.stroke();
}

function drawCandles(metrics, scale, bounds, start, end) {
  const count = Math.max(1, end - start);
  const step = metrics.plotWidth / count;

  if (count > 2600) {
    drawCondensedCandles(metrics, scale, bounds, start, end, count);
    return;
  }

  const bodyWidth = clamp(step * 0.64, 1, 14);
  for (let i = start; i < end; i += 1) {
    const candle = state.candles[i];
    if (!candle) continue;
    const x = metrics.plotLeft + (i - start + 0.5) * step;
    drawOneCandle(candle, x, bodyWidth, metrics, scale, bounds, i);
  }
}

function drawCondensedCandles(metrics, scale, bounds, start, end, count) {
  const pixels = Math.max(1, Math.floor(metrics.plotWidth));
  const buckets = new Array(pixels);
  for (let i = start; i < end; i += 1) {
    const candle = state.candles[i];
    const px = clamp(Math.floor(((i - start) / count) * pixels), 0, pixels - 1);
    let bucket = buckets[px];
    if (!bucket) {
      bucket = {
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        index: i,
      };
      buckets[px] = bucket;
    } else {
      bucket.high = Math.max(bucket.high, candle.high);
      bucket.low = Math.min(bucket.low, candle.low);
      bucket.close = candle.close;
      bucket.volume += candle.volume;
      bucket.index = i;
    }
  }

  for (let px = 0; px < buckets.length; px += 1) {
    const bucket = buckets[px];
    if (!bucket) continue;
    const x = metrics.plotLeft + px + 0.5;
    drawOneCandle(bucket, x, 1, metrics, scale, bounds, bucket.index);
  }
}

function drawOneCandle(candle, x, bodyWidth, metrics, scale, bounds, index) {
  const rising = candle.close >= candle.open;
  const color = rising ? "#18b982" : "#ef5350";
  const future = !state.hideFuture && index > state.currentIndex;
  ctx.globalAlpha = future ? 0.26 : 1;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  const highY = scale.y(candle.high);
  const lowY = scale.y(candle.low);
  const openY = scale.y(candle.open);
  const closeY = scale.y(candle.close);
  ctx.beginPath();
  ctx.moveTo(x, highY);
  ctx.lineTo(x, lowY);
  ctx.stroke();

  const top = Math.min(openY, closeY);
  const height = Math.max(1, Math.abs(openY - closeY));
  ctx.fillRect(x - bodyWidth / 2, top, bodyWidth, height);

  const volHeight = ((candle.volume || 0) / bounds.maxVolume) * metrics.volumeHeight;
  ctx.globalAlpha = future ? 0.12 : 0.34;
  ctx.fillRect(x - bodyWidth / 2, metrics.volumeBottom - volHeight, bodyWidth, volHeight);
  ctx.globalAlpha = 1;
}

function movingAverageAt(index, period) {
  if (index < period - 1) return NaN;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i += 1) {
    sum += state.candles[i].close;
  }
  return sum / period;
}

function drawMA(metrics, scale, start, end, period, color) {
  if (end - start > 3000 || start + period >= end) return;
  const count = Math.max(1, end - start);
  const step = metrics.plotWidth / count;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  let hasPoint = false;
  for (let i = start; i < end; i += 1) {
    const value = movingAverageAt(i, period);
    if (!Number.isFinite(value)) continue;
    const x = metrics.plotLeft + (i - start + 0.5) * step;
    const y = scale.y(value);
    if (!hasPoint) {
      ctx.moveTo(x, y);
      hasPoint = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  if (hasPoint) ctx.stroke();
}

function drawCurrentLine(metrics, start, end) {
  if (state.currentIndex < start || state.currentIndex >= end) return;
  const count = Math.max(1, end - start);
  const x = metrics.plotLeft + (state.currentIndex - start + 0.5) * (metrics.plotWidth / count);
  ctx.strokeStyle = "#f0b90b";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(x, metrics.plotTop);
  ctx.lineTo(x, metrics.volumeBottom);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawTrades(metrics, scale, start, end) {
  if (!state.account.trades.length) return;
  const count = Math.max(1, end - start);
  const step = metrics.plotWidth / count;
  for (const trade of state.account.trades) {
    const index = findIndexAtOrBefore(state.candles, trade.time);
    if (index < start || index >= end) continue;
    const x = metrics.plotLeft + (index - start + 0.5) * step;
    const y = scale.y(trade.price);
    const upward = trade.side === "buy" || trade.side === "cover";
    ctx.fillStyle =
      trade.side === "buy"
        ? "#38bdf8"
        : trade.side === "cover"
          ? "#18b982"
          : trade.side === "short"
            ? "#a78bfa"
            : "#ef5350";
    ctx.beginPath();
    if (upward) {
      ctx.moveTo(x, y - 12);
      ctx.lineTo(x - 6, y - 2);
      ctx.lineTo(x + 6, y - 2);
    } else {
      ctx.moveTo(x, y + 12);
      ctx.lineTo(x - 6, y + 2);
      ctx.lineTo(x + 6, y + 2);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function drawPriceLine(metrics, scale, price, color, label) {
  if (!price) return;
  const y = scale.y(price);
  if (y < metrics.plotTop - 20 || y > metrics.priceBottom + 20) return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(metrics.plotLeft, y);
  ctx.lineTo(metrics.plotRight, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "12px Inter, sans-serif";
  ctx.fillText(`${label} ${priceFmt.format(price)}`, metrics.plotLeft + 8, y - 10);
}

function drawAnnotations(metrics, scale, start, end) {
  for (const line of state.annotations) {
    drawPriceLine(metrics, scale, line.price, line.color || "#f0b90b", line.label || "水平线");
  }

  const count = Math.max(1, end - start);
  const step = metrics.plotWidth / count;
  for (const mark of state.bookmarks) {
    const index = findIndexAtOrBefore(state.candles, mark.time);
    if (index < start || index >= end) continue;
    const candle = state.candles[index];
    const x = metrics.plotLeft + (index - start + 0.5) * step;
    const y = scale.y(mark.price || candle.close);
    ctx.fillStyle = "#f0b90b";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPriceLine(metrics, scale, state.account.stopPrice, "#ef5350", "SL");
  drawPriceLine(metrics, scale, state.account.takePrice, "#18b982", "TP");
}

function drawHover(metrics, scale, start, end) {
  if (!state.hover) return;
  const { x, y } = state.hover;
  if (x < metrics.plotLeft || x > metrics.plotRight || y < metrics.plotTop || y > metrics.volumeBottom) {
    els.tooltip.style.display = "none";
    return;
  }

  ctx.strokeStyle = "rgba(237,242,247,0.42)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(x, metrics.plotTop);
  ctx.lineTo(x, metrics.volumeBottom);
  ctx.moveTo(metrics.plotLeft, y);
  ctx.lineTo(metrics.plotRight, y);
  ctx.stroke();
  ctx.setLineDash([]);

  const count = Math.max(1, end - start);
  const index = clamp(Math.floor(start + ((x - metrics.plotLeft) / metrics.plotWidth) * count), start, end - 1);
  const candle = state.candles[index];
  if (!candle) return;
  const cursorPrice = y <= metrics.priceBottom ? scale.price(y) : candle.close;
  els.cursorInfo.textContent = `${formatVisibleTime(candle.time, index)}  O ${priceFmt.format(candle.open)}  H ${priceFmt.format(candle.high)}  L ${priceFmt.format(candle.low)}  C ${priceFmt.format(candle.close)}`;
  els.tooltip.innerHTML = `
    <strong>${formatVisibleTime(candle.time, index)}</strong><br>
    O ${priceFmt.format(candle.open)}<br>
    H ${priceFmt.format(candle.high)}<br>
    L ${priceFmt.format(candle.low)}<br>
    C ${priceFmt.format(candle.close)}<br>
    光标 ${priceFmt.format(cursorPrice)}
  `;
  const rect = els.chartFrame.getBoundingClientRect();
  const tooltipX = x + 16 > rect.width - 230 ? x - 232 : x + 16;
  const tooltipY = y + 16 > rect.height - 160 ? y - 150 : y + 16;
  els.tooltip.style.display = "block";
  els.tooltip.style.left = `${Math.max(8, tooltipX)}px`;
  els.tooltip.style.top = `${Math.max(8, tooltipY)}px`;
}

function renderChart() {
  const metrics = chartMetrics();
  ctx.clearRect(0, 0, metrics.width, metrics.height);
  ctx.fillStyle = "#080d13";
  ctx.fillRect(0, 0, metrics.width, metrics.height);

  if (!state.candles.length) {
    els.tooltip.style.display = "none";
    return;
  }

  clampView(state.viewStart, state.viewEnd);
  const start = state.viewStart;
  const end = state.viewEnd;
  const bounds = visibleBounds(start, end);
  const scale = createScale(bounds, metrics);

  drawGrid(metrics, scale, start, end);
  drawCandles(metrics, scale, bounds, start, end);
  if (state.showMA20) drawMA(metrics, scale, start, end, 20, "#38bdf8");
  if (state.showMA60) drawMA(metrics, scale, start, end, 60, "#f0b90b");
  drawAnnotations(metrics, scale, start, end);
  drawCurrentLine(metrics, start, end);
  drawTrades(metrics, scale, start, end);
  drawHover(metrics, scale, start, end);
}

function accountStats(currentPriceValue) {
  const equity = state.account.cash + state.account.btc * currentPriceValue;
  const pnl = equity - state.account.initialCash;
  const closedTrades = state.account.trades.filter((trade) => Number.isFinite(trade.realizedPnl));
  const wins = closedTrades.filter((trade) => trade.realizedPnl > 0).length;
  const winRate = closedTrades.length ? (wins / closedTrades.length) * 100 : null;
  const sumR = closedTrades.reduce((sum, trade) => sum + (Number.isFinite(trade.r) ? trade.r : 0), 0);

  let peak = state.account.initialCash;
  let maxDrawdown = 0;
  for (const trade of state.account.trades) {
    if (!Number.isFinite(trade.equity)) continue;
    peak = Math.max(peak, trade.equity);
    maxDrawdown = Math.max(maxDrawdown, peak > 0 ? (peak - trade.equity) / peak : 0);
  }
  peak = Math.max(peak, equity);
  maxDrawdown = Math.max(maxDrawdown, peak > 0 ? (peak - equity) / peak : 0);

  return { equity, pnl, winRate, maxDrawdown, sumR, sells: closedTrades, closedTrades };
}

function tradeSideLabel(trade) {
  if (trade.side === "buy") return "买";
  if (trade.side === "sell") return trade.auto ? "自动卖" : "卖";
  if (trade.side === "short") return "开空";
  if (trade.side === "cover") return trade.auto ? "自动平空" : "平空";
  return trade.side || "-";
}

function tradeSideClass(side) {
  if (side === "buy" || side === "cover") return "positive";
  if (side === "sell" || side === "short") return "negative";
  return "neutral";
}

function renderAccount() {
  const candle = currentCandle();
  const price = candle ? candle.close : 0;
  const stats = accountStats(price);

  els.currentPrice.textContent = candle ? `$${priceFmt.format(price)}` : "-";
  els.equityValue.textContent = candle ? `$${money.format(stats.equity)}` : "-";
  els.pnlValue.textContent = candle ? `${stats.pnl >= 0 ? "+" : ""}$${money.format(stats.pnl)}` : "-";
  els.pnlValue.className = stats.pnl >= 0 ? "positive" : "negative";
  els.cashValue.textContent = `$${money.format(state.account.cash)}`;
  const side = positionSide();
  els.btcValue.textContent = side === "flat" ? "0 空仓" : `${state.account.btc > 0 ? "+" : ""}${btcFmt.format(state.account.btc)} ${positionSideLabel(side)}`;
  els.btcValue.className = side === "long" ? "positive" : side === "short" ? "negative" : "neutral";
  els.closePositionBtn.disabled = side === "flat";
  els.winRateValue.textContent = stats.winRate == null ? "-" : `${stats.winRate.toFixed(1)}%`;
  els.drawdownValue.textContent = `${(stats.maxDrawdown * 100).toFixed(1)}%`;
  els.tradeCountValue.textContent = String(state.account.trades.length);
  els.rValue.textContent = stats.sells.length ? `${stats.sumR.toFixed(2)}R` : "-";

  const rows = state.account.trades
    .slice()
    .reverse()
    .slice(0, 80)
    .map((trade) => {
      const sideText = tradeSideLabel(trade);
      const note = [trade.reason, ...(trade.tags || [])].filter(Boolean).join(" / ");
      return `
        <tr>
          <td>${formatVisibleTime(trade.time, findIndexAtOrBefore(state.candles, trade.time))}</td>
          <td class="${tradeSideClass(trade.side)}">${sideText}</td>
          <td>${priceFmt.format(trade.price)}</td>
          <td>${btcFmt.format(trade.qty)}</td>
          <td>${escapeHtml(note || "-")}</td>
        </tr>
      `;
    })
    .join("");
  els.tradeRows.innerHTML = rows || '<tr><td colspan="5">暂无交易</td></tr>';
}

function renderBookmarks() {
  if (!state.bookmarks.length) {
    els.bookmarkList.innerHTML = "暂无标注";
    return;
  }
  els.bookmarkList.innerHTML = state.bookmarks
    .slice()
    .reverse()
    .map((mark) => {
      const index = findIndexAtOrBefore(state.candles, mark.time);
      return `
        <div class="list-item">
          <strong>${formatVisibleTime(mark.time, index)} / $${priceFmt.format(mark.price)}</strong>
          <span>${escapeHtml(mark.text || "无文字标注")}</span>
          ${(mark.tags || []).length ? `<div class="tagline">${escapeHtml(mark.tags.join(" / "))}</div>` : ""}
        </div>
      `;
    })
    .join("");
}

function renderStatus() {
  if (!state.candles.length) {
    setStatus("等待导入 BTC K线 CSV");
    els.cursorInfo.textContent = "-";
    return;
  }
  const first = state.candles[0];
  const last = state.candles[state.candles.length - 1];
  const current = state.candles[state.currentIndex];
  const gapText = state.sourceGaps ? ` | 缺口 ${state.sourceGaps}` : "";
  const rangeText =
    state.blindMode && !state.dateRevealed
      ? "盲测区间已隐藏"
      : `${formatShortTime(first.time)} - ${formatShortTime(last.time)}`;
  setStatus(
    `${state.fileName} | ${formatInterval(state.timeframeMs)} | ${state.candles.length.toLocaleString("en-US")} 根 | ${rangeText}${gapText}`,
  );
  els.cursorInfo.textContent = current
    ? `当前 ${formatVisibleTime(current.time, state.currentIndex)} | 已揭示 ${(state.currentIndex + 1).toLocaleString("en-US")} 根`
    : "-";
}

function render() {
  syncSettingControls();
  syncTimeline();
  renderStatus();
  renderAccount();
  renderBookmarks();
  renderGame();
  resizeCanvas();
  renderChart();
}

function resizeCanvas() {
  const rect = els.canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (els.canvas.width !== width || els.canvas.height !== height) {
    els.canvas.width = width;
    els.canvas.height = height;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function canvasPoint(event) {
  const rect = els.canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function pointInChart(point, metrics = chartMetrics()) {
  return (
    point.x >= metrics.plotLeft &&
    point.x <= metrics.plotRight &&
    point.y >= metrics.plotTop &&
    point.y <= metrics.volumeBottom
  );
}

function indexFromChartX(x, metrics = chartMetrics()) {
  const start = state.viewStart;
  const end = state.viewEnd;
  const count = Math.max(1, end - start);
  const ratio = clamp((x - metrics.plotLeft) / Math.max(1, metrics.plotWidth), 0, 0.999999);
  return clamp(Math.floor(start + ratio * count), start, Math.max(start, end - 1));
}

function currentLineX(metrics = chartMetrics()) {
  if (!state.candles.length || state.currentIndex < state.viewStart || state.currentIndex >= state.viewEnd) {
    return null;
  }
  const count = Math.max(1, state.viewEnd - state.viewStart);
  return metrics.plotLeft + (state.currentIndex - state.viewStart + 0.5) * (metrics.plotWidth / count);
}

function isNearCurrentLine(point, metrics = chartMetrics()) {
  const x = currentLineX(metrics);
  return x != null && pointInChart(point, metrics) && Math.abs(point.x - x) <= 12;
}

function scrubPixelsPerCandle(event) {
  if (event.altKey) return 18;
  if (event.shiftKey) return 3;
  return 8;
}
