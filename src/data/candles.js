"use strict";

function parseNumber(raw) {
  if (raw == null) return NaN;
  const cleaned = String(raw).trim().replace(/^"|"$/g, "").replace(/,/g, "");
  if (!cleaned) return NaN;
  return Number(cleaned);
}

function parseTime(raw) {
  if (raw == null) return NaN;
  const value = String(raw).trim().replace(/^"|"$/g, "");
  if (!value) return NaN;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric > 10_000_000_000_000) return Math.floor(numeric / 1000);
    if (numeric > 10_000_000_000) return Math.floor(numeric);
    return Math.floor(numeric * 1000);
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function splitCsvLine(line, delimiter) {
  const cells = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

function detectDelimiter(line) {
  const candidates = [",", "\t", ";"];
  let best = ",";
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = splitCsvLine(line, candidate).length;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function normalizeHeader(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, "")
    .replace(/[\s-]+/g, "_");
}

function findHeaderIndex(headers, names) {
  return headers.findIndex((header) => names.includes(header));
}

function parseCsv(text) {
  const normalizedText = text.replace(/^\ufeff/, "");
  const lines = normalizedText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return [];

  const delimiter = detectDelimiter(lines[0]);
  const first = splitCsvLine(lines[0], delimiter);
  const headers = first.map(normalizeHeader);
  const hasHeader =
    findHeaderIndex(headers, ["open", "o"]) >= 0 &&
    findHeaderIndex(headers, ["high", "h"]) >= 0 &&
    findHeaderIndex(headers, ["low", "l"]) >= 0 &&
    findHeaderIndex(headers, ["close", "c"]) >= 0;

  let startLine = 0;
  let timeIndex = 0;
  let openIndex = 1;
  let highIndex = 2;
  let lowIndex = 3;
  let closeIndex = 4;
  let volumeIndex = 5;

  if (hasHeader) {
    startLine = 1;
    timeIndex = findHeaderIndex(headers, [
      "timestamp",
      "time",
      "date",
      "datetime",
      "open_time",
      "opentime",
      "open_time_ms",
    ]);
    openIndex = findHeaderIndex(headers, ["open", "o"]);
    highIndex = findHeaderIndex(headers, ["high", "h"]);
    lowIndex = findHeaderIndex(headers, ["low", "l"]);
    closeIndex = findHeaderIndex(headers, ["close", "c"]);
    volumeIndex = findHeaderIndex(headers, ["volume", "vol", "v"]);
  }

  if (timeIndex < 0 || openIndex < 0 || highIndex < 0 || lowIndex < 0 || closeIndex < 0) {
    throw new Error("CSV 需要包含 time/open/high/low/close 列。");
  }

  const byTime = new Map();
  for (let i = startLine; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i], delimiter);
    const time = parseTime(cells[timeIndex]);
    const open = parseNumber(cells[openIndex]);
    const high = parseNumber(cells[highIndex]);
    const low = parseNumber(cells[lowIndex]);
    const close = parseNumber(cells[closeIndex]);
    const volume = volumeIndex >= 0 ? parseNumber(cells[volumeIndex]) : 0;

    if (
      Number.isFinite(time) &&
      Number.isFinite(open) &&
      Number.isFinite(high) &&
      Number.isFinite(low) &&
      Number.isFinite(close)
    ) {
      byTime.set(time, {
        time,
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) ? volume : 0,
      });
    }
  }

  return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

function parseBinaryCandles(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 16) {
    throw new Error("二进制 K线缓存无效。");
  }
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const version = view.getUint32(4, true);
  const count = view.getUint32(8, true);
  const columns = view.getUint32(12, true);
  if (magic !== BINARY_CANDLE_MAGIC || version !== 1 || columns !== 6) {
    throw new Error("二进制 K线缓存格式不兼容。");
  }
  const expectedBytes = 16 + count * columns * Float64Array.BYTES_PER_ELEMENT;
  if (buffer.byteLength < expectedBytes) {
    throw new Error("二进制 K线缓存不完整。");
  }

  const values = new Float64Array(buffer, 16, count * columns);
  const candles = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const base = i * columns;
    candles[i] = {
      time: values[base],
      open: values[base + 1],
      high: values[base + 2],
      low: values[base + 3],
      close: values[base + 4],
      volume: values[base + 5],
    };
  }
  return candles;
}

function detectSourceInterval(candles) {
  const diffs = [];
  const limit = Math.min(candles.length - 1, 5000);
  for (let i = 1; i <= limit; i += 1) {
    const diff = candles[i].time - candles[i - 1].time;
    if (diff > 0) diffs.push(diff);
  }
  if (!diffs.length) return 0;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}

function countGaps(candles, intervalMs) {
  if (!intervalMs) return 0;
  let gaps = 0;
  for (let i = 1; i < candles.length; i += 1) {
    if (candles[i].time - candles[i - 1].time > intervalMs * 1.5) gaps += 1;
  }
  return gaps;
}

function aggregateCandles(source, targetMs) {
  if (!source.length) return [];
  if (!targetMs || targetMs <= 0) return source.slice();
  const sourceMs = state.sourceIntervalMs || detectSourceInterval(source);
  if (sourceMs && targetMs <= sourceMs * 1.05) return source.slice();

  const aggregated = [];
  let bucket = null;
  for (const candle of source) {
    const bucketTime = Math.floor(candle.time / targetMs) * targetMs;
    if (!bucket || bucket.time !== bucketTime) {
      bucket = {
        time: bucketTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      };
      aggregated.push(bucket);
    } else {
      bucket.high = Math.max(bucket.high, candle.high);
      bucket.low = Math.min(bucket.low, candle.low);
      bucket.close = candle.close;
      bucket.volume += candle.volume;
    }
  }
  return aggregated;
}

function findIndexAtOrBefore(candles, time) {
  let lo = 0;
  let hi = candles.length - 1;
  let answer = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (candles[mid].time <= time) {
      answer = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return answer;
}

function findIndexAtOrAfter(candles, time) {
  let lo = 0;
  let hi = candles.length - 1;
  let answer = candles.length;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (candles[mid].time >= time) {
      answer = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return answer;
}
