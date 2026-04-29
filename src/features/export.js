"use strict";

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadText(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportTrades() {
  const header = ["time", "side", "price", "qty", "fee", "realized_pnl", "r", "reason", "review", "tags"].join(",");
  const rows = state.account.trades.map((trade) =>
    [
      formatTime(trade.time),
      trade.side,
      trade.price,
      trade.qty,
      trade.fee,
      trade.realizedPnl ?? "",
      trade.r ?? "",
      trade.reason || "",
      trade.review || "",
      (trade.tags || []).join("|"),
    ]
      .map(csvEscape)
      .join(","),
  );
  downloadText("btc-replay-trades.csv", [header, ...rows].join("\n"), "text/csv;charset=utf-8");
}

function exportReport() {
  const candle = currentCandle();
  const stats = accountStats(candle?.close ?? 0);
  const currentNotes = els.sessionNotesInput.value.trim();
  const savedReviews = state.account.trades
    .map((trade) => trade.review || "")
    .filter(Boolean)
    .filter((review, index, list) => review !== currentNotes && list.indexOf(review) === index);
  const reviewBlock = [currentNotes, ...savedReviews.map((review) => `- ${review}`)].filter(Boolean).join("\n");
  const lines = [
    `# ${els.sessionNameInput.value.trim() || "BTC Replay 训练报告"}`,
    "",
    `- 数据文件: ${state.fileName || "-"}`,
    `- 周期: ${formatInterval(state.timeframeMs)}`,
    `- 当前时间: ${candle ? formatTime(candle.time) : "-"}`,
    `- 权益: $${money.format(stats.equity)}`,
    `- 收益: ${stats.pnl >= 0 ? "+" : ""}$${money.format(stats.pnl)}`,
    `- 胜率: ${stats.winRate == null ? "-" : `${stats.winRate.toFixed(1)}%`}`,
    `- 最大回撤: ${(stats.maxDrawdown * 100).toFixed(1)}%`,
    `- R 倍数: ${stats.sells.length ? `${stats.sumR.toFixed(2)}R` : "-"}`,
    "",
    "## 总复盘",
    "",
    reviewBlock || "暂无",
    "",
    "## 标注",
    "",
    ...(state.bookmarks.length
      ? state.bookmarks.map((mark) => `- ${formatTime(mark.time)} $${priceFmt.format(mark.price)} ${mark.text || ""} ${(mark.tags || []).join(" / ")}`)
      : ["暂无"]),
    "",
    "## 交易",
    "",
    ...(state.account.trades.length
      ? state.account.trades.map((trade) => `- ${formatTime(trade.time)} ${tradeSideLabel(trade)} $${priceFmt.format(trade.price)} ${btcFmt.format(trade.qty)} BTC ${tradeNoteSummary(trade) || "-"}`)
      : ["暂无"]),
  ];
  downloadText("btc-replay-report.md", lines.join("\n"), "text/markdown;charset=utf-8");
}

function saveScreenshot() {
  renderChart();
  els.canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "btc-replay-chart.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
}
