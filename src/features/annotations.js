"use strict";

function addBookmark() {
  const candle = currentCandle();
  if (!candle) return;
  const text = els.bookmarkInput.value.trim();
  const tags = selectedTags();
  state.bookmarks.push({
    id: uniqueId("mark"),
    time: candle.time,
    price: candle.close,
    text,
    tags,
  });
  els.bookmarkInput.value = "";
  render();
  showToast("已添加标注");
}

function addHorizontalLine() {
  const candle = currentCandle();
  if (!candle) return;
  const text = els.bookmarkInput.value.trim();
  state.annotations.push({
    id: uniqueId("line"),
    time: candle.time,
    price: candle.close,
    label: text || "水平线",
    color: "#f0b90b",
  });
  render();
  showToast(`已添加水平线 $${priceFmt.format(candle.close)}`);
}

function clearLines() {
  state.annotations = [];
  render();
  showToast("已清除水平线");
}
