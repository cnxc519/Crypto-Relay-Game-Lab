"""Test the live viewer init by simulating script loading with live overrides."""
import os, sys, json, subprocess, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

script = r"""
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = process.argv[2];
process.chdir(ROOT);

// Minimal DOM stubs
function createElement(tag) {
  return {
    tagName: tag.toUpperCase(),
    classList: { _list: [], add(...n) {}, remove(...n) {}, contains(n) { return false; }, toggle(n) {} },
    style: {}, innerHTML: "", textContent: "", value: "", checked: false, disabled: false,
    options: { length: 0 }, selectedIndex: 0, files: null, _attrs: {}, _events: {},
    setAttribute(n,v) {}, getAttribute(n) { return null; },
    insertAdjacentHTML(p,h) { this.innerHTML = h; },
    addEventListener(e,fn) { if(!this._events[e]) this._events[e]=[]; this._events[e].push(fn); },
    removeEventListener() {}, click() {}, appendChild(c) { return c; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, focus() {}, blur() {},
    getBoundingClientRect() { return {left:0,top:0,width:800,height:600,right:800,bottom:600}; },
  };
}
const stubEl = () => createElement("div");
const idMap = new Map();
global.document = {
  getElementById(id) { if (idMap.has(id)) return idMap.get(id); const el = stubEl(); idMap.set(id, el); return el; },
  createElement, querySelectorAll: () => [], querySelector: () => null,
  body: createElement("body"), head: createElement("head"), addEventListener() {},
  createTextNode(t) { return {nodeType:3,textContent:t}; }, createElementNS(ns,t) { return createElement(t); },
};
global.window = global;
global.addEventListener = () => {}; global.removeEventListener = () => {}; global.dispatchEvent = () => {};
global.HTMLInputElement = function(){}; global.HTMLSelectElement = function(){};
global.HTMLTextAreaElement = function(){}; global.Image = function(){ return createElement("img"); };
global.location = {href:"http://127.0.0.1:8766/",protocol:"http:",reload(){}};
Object.defineProperty(global,"navigator",{value:{userAgent:"node-test",language:"zh-CN"},writable:true,configurable:true});
Object.defineProperty(global,"history",{value:{pushState(){},replaceState(){}},writable:true,configurable:true});
global.localStorage = {_data:{},getItem(k){return this._data[k]||null;},setItem(k,v){this._data[k]=String(v);},removeItem(k){delete this._data[k];},clear(){this._data={};}};
global.sessionStorage = {_data:{},getItem(k){return this._data[k]||null;},setItem(k,v){this._data[k]=String(v);},removeItem(k){delete this._data[k];},clear(){this._data={};}};
global.fetch = async () => { throw new Error("fetch not available"); };
global.WebSocket = function(){}; global.requestAnimationFrame = fn => setTimeout(fn,16);
global.cancelAnimationFrame = id => clearTimeout(id); global.setInterval = setInterval; global.clearInterval = clearInterval;
global.HTMLCanvasElement = function(){};
const canvasCtx = {
  save(){},restore(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},fill(){},stroke(){},
  fillText(){},strokeText(){},measureText(t){return{width:t.length*7};},fillRect(){},clearRect(){},
  arc(){},rect(){},createLinearGradient(){return{addColorStop(){}};},createRadialGradient(){return{addColorStop(){}};},
  setLineDash(){},getLineDash(){return[];},translate(){},scale(){},rotate(){},setTransform(){},
  getImageData(){return{data:new Uint8ClampedArray(4)};},putImageData(){},drawImage(){},clip(){},
  get canvas(){return document.getElementById("chartCanvas");},
  globalAlpha:1,globalCompositeOperation:"source-over",lineWidth:1,strokeStyle:"#000",fillStyle:"#000",
  font:"12px sans-serif",textAlign:"left",textBaseline:"top",
};
const chartCanvas = document.getElementById("chartCanvas");
chartCanvas.getContext = () => canvasCtx; chartCanvas.width = 800; chartCanvas.height = 500;
chartCanvas.toBlob = cb => cb(new Blob());

let errors = 0;

// 1. Load constants.js
try {
  vm.runInThisContext(fs.readFileSync("./src/config/constants.js","utf-8"), { filename: "constants.js" });
} catch(e) { console.error("ERROR constants.js:", e.message); errors++; }

// 2. Apply live override (same as live.html)
console.log("=== Override ===");
try {
  window.BtcReplay.constants.DEFAULT_DATA_URL = "./live_view/data/BTCUSDT-15m.csv";
  window.BtcReplay.constants.DEFAULT_BINARY_DATA_URL = "./live_view/data/BTCUSDT-15m.bin";
  console.log("OK: DATA_URL=" + window.BtcReplay.constants.DEFAULT_DATA_URL);
  console.log("OK: BIN_URL=" + window.BtcReplay.constants.DEFAULT_BINARY_DATA_URL);
} catch(e) { console.error("FAILED:", e.message); errors++; }

// 3. Load rest
const all = [
  "./src/content/achievements.js", "./src/content/game-content.js",
  "./src/ui/dom.js", "./src/core/deps.js", "./src/core/models.js", "./src/core/state.js",
  "./src/core/utils.js", "./src/data/candles.js", "./src/ui/helpers.js", "./src/game/characters.js",
  "./src/game/levels.js", "./src/data/storage.js", "./src/replay/navigation.js", "./src/trade/trade.js",
  "./src/chart/chart.js", "./src/game/celebration.js", "./src/game/challenges.js", "./src/game/daily.js",
  "./src/game/level-modal.js", "./src/game/achievements.js", "./src/game/chat.js", "./src/game/ui.js",
  "./src/features/annotations.js", "./src/features/sessions.js", "./src/features/export.js",
];
for (const rel of all) {
  try { vm.runInThisContext(fs.readFileSync(rel,"utf-8"), { filename: rel }); }
  catch(e) { console.error("ERROR", rel, ":", e.message); errors++; break; }
}

// 4. Auto-jump override
console.log("=== Auto-jump ===");
try {
  const _orig = autoLoadDefaultCsv;
  autoLoadDefaultCsv = async function() { await _orig(); if (state.candles.length) revealTo(state.candles.length - 1, true); };
  console.log("OK");
} catch(e) { console.error("FAILED:", e.message); errors++; }

// 5. Init
console.log("=== Init ===");
try {
  vm.runInThisContext(fs.readFileSync("./src/app/init.js","utf-8"), { filename: "init.js" });
  console.log("OK");
} catch(e) { console.error("FAILED:", e.message); errors++; }

// 6. Verify data paths in deps
console.log("=== Verify ===");
try {
  console.log("DEFAULT_DATA_URL =", DEFAULT_DATA_URL);
  console.log("DEFAULT_BINARY_DATA_URL =", DEFAULT_BINARY_DATA_URL);
  console.log("CHARACTER_CONFIG count =", CHARACTER_CONFIG.length);
} catch(e) { console.error("FAILED:", e.message); errors++; }

if (errors) { console.error(errors + " errors"); process.exit(1); }
console.log("All live viewer scripts loaded successfully.");
""";

with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False, encoding='utf-8') as f:
    f.write(script)
    tmp = f.name

try:
    result = subprocess.run(["node", tmp, ROOT], capture_output=True, text=True, timeout=30, cwd=ROOT)
    print(result.stdout)
    if result.stderr.strip():
        print("STDERR:", result.stderr[:500])
    if result.returncode != 0:
        print(f"Exit: {result.returncode}")
except subprocess.TimeoutExpired:
    print("TIMEOUT")
except FileNotFoundError:
    print("Node.js not found.")
finally:
    os.unlink(tmp)
