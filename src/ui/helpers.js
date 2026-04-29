"use strict";

function selectedTags() {
  return Array.from(document.querySelectorAll(".tag-grid input:checked")).map((input) => input.value);
}

function setSelectedTags(tags) {
  document.querySelectorAll(".tag-grid input").forEach((input) => {
    input.checked = tags.includes(input.value);
  });
}

function clearTradeDraftInputs() {
  els.tradeReasonInput.value = "";
  els.sessionNotesInput.value = "";
  setSelectedTags([]);
}

function tradeNoteParts(trade) {
  const parts = [];
  const reason = trade?.reason || "";
  const review = trade?.review || "";
  if (reason) parts.push(reason);
  if (review && review !== reason) parts.push(review);
  if (Array.isArray(trade?.tags)) parts.push(...trade.tags.filter(Boolean));
  return parts;
}

function tradeNoteSummary(trade) {
  return tradeNoteParts(trade).join(" / ");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.style.display = "block";
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.style.display = "none";
  }, 2400);
}
