"use strict";

function levelFromXp(xp) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 120)) + 1);
}

function xpForLevel(level) {
  return Math.pow(Math.max(0, level - 1), 2) * 120;
}

function characterById(id) {
  return CHARACTER_CONFIG.find((character) => character.id === id) || CHARACTER_CONFIG[0];
}

function activeCharacter() {
  return characterById(state.game.profile.activeCharacter);
}

function characterLevelFromXp(xp, stage) {
  const rawLevel = Math.floor(Math.sqrt(Math.max(0, xp) / 55)) + 1;
  return clamp(rawLevel, 1, stage * 20);
}

function characterXpForLevel(level) {
  return Math.pow(Math.max(0, level - 1), 2) * 55;
}

function stageName(stage) {
  return ["一阶", "二阶", "三阶", "四阶", "终阶"][clamp(stage, 1, 5) - 1];
}

function characterImagePath(character) {
  return `./character/${encodeURIComponent(character.file)}`;
}

function brandAvatarSrc(choice = state.brandAvatarChoice) {
  if (choice === "icon") return "./icon/icon2.png";
  const character = choice === "active" ? activeCharacter() : characterById(choice);
  return characterImagePath(character);
}

function pickCharacterQuote(character) {
  const quotes = character.quotes?.length ? character.quotes : [character.quote || ""];
  return quotes[Math.floor(Math.random() * quotes.length)] || "";
}

function activeCharacterQuote(character) {
  if (state.game.activeQuoteCharacterId !== character.id || !state.game.activeQuote) {
    state.game.activeQuoteCharacterId = character.id;
    state.game.activeQuote = pickCharacterQuote(character);
  }
  return state.game.activeQuote;
}
