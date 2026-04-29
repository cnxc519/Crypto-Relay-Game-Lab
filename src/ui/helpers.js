"use strict";

function selectedTags() {
  return Array.from(document.querySelectorAll(".tag-grid input:checked")).map((input) => input.value);
}

function setSelectedTags(tags) {
  document.querySelectorAll(".tag-grid input").forEach((input) => {
    input.checked = tags.includes(input.value);
  });
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.style.display = "block";
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.style.display = "none";
  }, 2400);
}
