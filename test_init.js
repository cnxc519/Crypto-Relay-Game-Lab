"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;

// ---------- minimal DOM stubs ----------

function createElement(tag) {
  const el = {
    tagName: tag.toUpperCase(),
    classList: {
      _list: [],
      add(...names) { for (const n of names) this._list.push(n); el._class = this._list.join(" "); },
      remove(...names) { this._list = this._list.filter(n => !names.includes(n)); el._class = this._list.join(" "); },
      contains(name) { return this._list.includes(name); },
      toggle(name) { this.contains(name) ? this.remove(name) : this.add(name); },
    },
    _class: "",
    style: {},
    innerHTML: "",
    textContent: "",
    value: "",
    checked: false,
    disabled: false,
    src: "",
    alt: "",
    type: "text",
    href: "",
    _attrs: {},
    _events: {},
    _children: [],
    options: { length: 0 },
    selectedIndex: 0,
    files: null,
    setAttribute(name, value) { this._attrs[name] = value; },
    getAttribute(name) { return this._attrs[name] || null; },
    insertAdjacentHTML(pos, html) { this.innerHTML = html; },
    addEventListener(evt, fn) {
      if (!this._events[evt]) this._events[evt] = [];
      this._events[evt].push(fn);
    },
    removeEventListener(evt, fn) { /* noop */ },
    click() { (this._events.click || []).forEach(fn => fn.call(this)); },
    appendChild(child) { this._children.push(child); return child; },
    querySelector(sel) { return this._children[0] || null; },
    querySelectorAll(sel) { return this._children; },
    closest(sel) { return null; },
    focus() {},
    blur() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }; },
  };
  return el;
}

const stubEl = () => createElement("div");

// cache: same id → same stub element
const idMap = new Map();
function getElementById(id) {
  if (idMap.has(id)) return idMap.get(id);
  const el = stubEl();
  idMap.set(id, el);
  return el;
}

// document stub
global.document = {
  getElementById,
  createElement,
  querySelectorAll: () => [],
  querySelector: () => null,
  body: createElement("body"),
  head: createElement("head"),
  addEventListener() {},
  createTextNode(text) { return { nodeType: 3, textContent: text }; },
  createElementNS(ns, tag) { return createElement(tag); },
};

// window / global stubs
global.window = global;
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.dispatchEvent = () => {};
global.HTMLInputElement = function() {};
global.HTMLSelectElement = function() {};
global.HTMLTextAreaElement = function() {};
global.Image = function() { return createElement("img"); };
global.location = { href: "http://localhost/", protocol: "http:", reload() {} };
Object.defineProperty(global, "navigator", { value: { userAgent: "node-test", language: "zh-CN" }, writable: true, configurable: true });
Object.defineProperty(global, "history", { value: { pushState() {}, replaceState() {} }, writable: true, configurable: true });
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
  get length() { return Object.keys(this._data).length; },
  key(i) { return Object.keys(this._data)[i] || null; },
  clear() { this._data = {}; },
};
global.sessionStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; },
};
global.fetch = async () => { throw new Error("fetch not available in test"); };
global.WebSocket = function() {};
global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.setInterval = setInterval;
global.clearInterval = clearInterval;

// Canvas stub
global.HTMLCanvasElement = function() {};
const canvasCtx = {
  save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
  fill() {}, stroke() {}, fillText() {}, strokeText() {}, measureText(t) { return { width: t.length * 7 }; },
  fillRect() {}, clearRect() {}, arc() {}, rect() {}, quadraticCurveTo() {}, bezierCurveTo() {},
  createLinearGradient() { return { addColorStop() {} }; },
  createRadialGradient() { return { addColorStop() {} }; },
  setLineDash() {}, getLineDash() { return []; },
  translate() {}, scale() {}, rotate() {}, setTransform() {},
  getImageData() { return { data: new Uint8ClampedArray(4) }; },
  putImageData() {},
  drawImage() {},
  clip() {},
  get canvas() { return document.getElementById("chartCanvas"); },
  globalAlpha: 1,
  globalCompositeOperation: "source-over",
  lineWidth: 1,
  strokeStyle: "#000",
  fillStyle: "#000",
  font: "12px sans-serif",
  textAlign: "left",
  textBaseline: "top",
};
const chartCanvas = getElementById("chartCanvas");
chartCanvas.getContext = () => canvasCtx;
chartCanvas.width = 800;
chartCanvas.height = 500;
chartCanvas.toBlob = (cb) => cb(new Blob());

// ---------- script loader ----------

const scripts = [
  "./src/config/constants.js",
  "./src/content/achievements.js",
  "./src/content/game-content.js",
  "./src/ui/dom.js",
  "./src/core/deps.js",
  "./src/core/models.js",
  "./src/core/state.js",
  "./src/core/utils.js",
  "./src/data/candles.js",
  "./src/ui/helpers.js",
  "./src/game/characters.js",
  "./src/game/levels.js",
  "./src/data/storage.js",
  "./src/replay/navigation.js",
  "./src/trade/trade.js",
  "./src/chart/chart.js",
  "./src/game/celebration.js",
  "./src/game/challenges.js",
  "./src/game/daily.js",
  "./src/game/level-modal.js",
  "./src/game/achievements.js",
  "./src/game/chat.js",
  "./src/game/ui.js",
  "./src/features/annotations.js",
  "./src/features/sessions.js",
  "./src/features/export.js",
  "./src/app/init.js",
];

let errors = 0;
for (const rel of scripts) {
  const filePath = path.join(ROOT, rel);
  if (!fs.existsSync(filePath)) {
    console.error(`MISSING: ${rel}`);
    errors++;
    continue;
  }
  const code = fs.readFileSync(filePath, "utf-8");
  try {
    vm.runInThisContext(code, { filename: rel, lineOffset: 0 });
  } catch (err) {
    console.error(`\n=== ERROR in ${rel} ===`);
    console.error(err.message);
    if (err.stack) {
      const lines = err.stack.split("\n").slice(0, 5);
      console.error(lines.join("\n"));
    }
    errors++;
  }
}

if (errors) {
  console.error(`\n${errors} script(s) failed.`);
  process.exit(1);
}

console.log("All scripts loaded successfully.");
