// 粘贴到浏览器 F12 控制台运行
// 诊断游戏模式按钮为什么没反应

console.log("=== 1. DOM 元素检查 ===");
const gDaily = document.getElementById("levelModeGameDailyBtn");
const gWeekly = document.getElementById("levelModeGameWeeklyBtn");
console.log("1天游戏按钮:", gDaily ? "存在" : "❌ 不存在");
console.log("7天游戏按钮:", gWeekly ? "存在" : "❌ 不存在");

console.log("\n=== 2. setLevelSpanMode 测试 ===");
try {
  setLevelSpanMode("game_daily");
  console.log("setLevelSpanMode('game_daily') 成功");
  console.log("当前 mode:", state.game.profile.levelMode?.currentSpanModeId);
} catch (e) {
  console.error("❌ setLevelSpanMode 报错:", e.message);
  console.error(e.stack);
}

console.log("\n=== 3. renderLevelModal 测试 ===");
try {
  renderLevelModal();
  console.log("renderLevelModal() 成功");
  console.log("1天游戏按钮 active?", gDaily?.classList.contains("active"));
  console.log("7天游戏按钮 active?", gWeekly?.classList.contains("active"));
} catch (e) {
  console.error("❌ renderLevelModal 报错:", e.message);
  console.error(e.stack);
}

console.log("\n=== 4. generateLevelList 测试 ===");
try {
  const mode = currentLevelSpanMode();
  console.log("当前 mode:", JSON.stringify(mode));
  const levels = generateLevelList(mode);
  console.log("关卡数量:", levels.length);
} catch (e) {
  console.error("❌ generateLevelList 报错:", e.message);
  console.error(e.stack);
}

console.log("\n=== 5. 事件监听器检查 ===");
if (gDaily) {
  const listeners = getEventListeners(gDaily);
  console.log("1天游戏按钮 click 监听器数量:", listeners?.click?.length || 0);
} else {
  console.log("❌ 按钮不存在，无法检查事件监听");
}

// 切回 daily 避免影响后续使用
try { setLevelSpanMode("daily"); } catch(e) {}
console.log("\n=== 诊断完成 ===");
