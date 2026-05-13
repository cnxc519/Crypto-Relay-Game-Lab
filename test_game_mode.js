// 粘贴到浏览器 F12 控制台运行
// 诊断游戏/预测模式按钮

console.log("=== 1. DOM 元素检查 ===");
["levelModeGameDailyBtn", "levelModeGameWeeklyBtn", "levelModePredictionBtn"].forEach(id => {
  const el = document.getElementById(id);
  console.log(id + ":", el ? "存在" : "缺失");
});

console.log("\n=== 2. LEVEL_SPAN_MODES ===");
console.log("game_daily:", LEVEL_SPAN_MODES.game_daily ? "有" : "缺失");
console.log("game_weekly:", LEVEL_SPAN_MODES.game_weekly ? "有" : "缺失");
console.log("prediction:", LEVEL_SPAN_MODES.prediction ? "有" : "缺失");

console.log("\n=== 3. setLevelSpanMode('prediction') ===");
try {
  setLevelSpanMode("prediction");
  const mode = currentLevelSpanMode();
  console.log("当前 mode:", mode.id, mode.id === "prediction" ? "正确" : "不对，仍是 " + mode.id);
} catch (e) {
  console.error("报错:", e.message);
}

console.log("\n=== 4. generateLevelList(prediction) ===");
try {
  const mode = currentLevelSpanMode();
  const levels = generateLevelList(mode);
  console.log("12h 关卡数量:", levels.length);
  if (levels.length > 0) {
    console.log("第一关:", levels[0].id, levels[0].title);
    console.log("第二关:", levels[1]?.id, levels[1]?.title);
  }
} catch (e) {
  console.error("报错:", e.message);
}

console.log("\n=== 5. randomPrediction() ===");
try {
  randomPrediction();
  console.log("randomPrediction 成功，弹窗已打开");
} catch (e) {
  console.error("报错:", e.message, e.stack);
}

console.log("\n=== 6. 事件监听器数量 ===");
["levelModeGameDailyBtn", "levelModeGameWeeklyBtn", "levelModePredictionBtn"].forEach(id => {
  try {
    const el = document.getElementById(id);
    const listeners = getEventListeners(el);
    console.log(id + " click:", listeners?.click?.length || 0);
  } catch (e) {
    console.log(id + ": 无法检查");
  }
});

try { setLevelSpanMode("daily"); } catch(e) {}
try { closePrediction(); } catch(e) {}
console.log("\n=== 完成 ===");
