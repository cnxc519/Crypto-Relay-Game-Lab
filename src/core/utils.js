"use strict";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function uniqueId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatInterval(ms) {
  if (!ms) return "-";
  if (INTERVAL_LABELS.has(ms)) return INTERVAL_LABELS.get(ms);
  const minutes = ms / 60_000;
  if (minutes < 60) return `${minutes.toFixed(0)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1).replace(/\.0$/, "")}h`;
  const days = hours / 24;
  return `${days.toFixed(1).replace(/\.0$/, "")}d`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortTime(ts) {
  return new Date(ts).toLocaleDateString("zh-CN", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatVisibleTime(ts, index = state.currentIndex) {
  if (state.blindMode && !state.dateRevealed) return `盲测 #${index + 1}`;
  return formatTime(ts);
}

function formatAxisTime(ts, index) {
  if (state.blindMode && !state.dateRevealed) return `#${index + 1}`;
  return formatShortTime(ts);
}

function toLocalInputValue(ts) {
  if (!Number.isFinite(ts)) return "";
  const offset = new Date(ts).getTimezoneOffset() * 60_000;
  return new Date(ts - offset).toISOString().slice(0, 16);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
