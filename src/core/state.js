"use strict";

const state = {
  sourceCandles: [],
  sourceIntervalMs: 0,
  sourceGaps: 0,
  candles: [],
  fileName: "",
  timeframeMs: 0,
  currentIndex: 0,
  viewStart: 0,
  viewEnd: 0,
  hideFuture: true,
  blindMode: false,
  dateRevealed: false,
  logScale: true,
  showMA20: true,
  showMA60: false,
  brandAvatarChoice: DEFAULT_BRAND_AVATAR,
  followCurrent: true,
  isPlaying: false,
  timer: null,
  hover: null,
  drag: null,
  lastClickAt: 0,
  bookmarks: [],
  annotations: [],
  account: createAccount(10_000),
  game: {
    profile: createGameProfile(),
    active: null,
    lastType: "blind",
    lastSettlement: null,
    externalAccount: null,
    lastGameAccount: null,
    lastCharacterGain: null,
    lastLevelRecord: null,
    settlementReview: {
      settlementId: "",
      isStreaming: false,
      text: "",
    },
    activeQuoteCharacterId: null,
    activeQuote: "",
    calendarYear: null,
    calendarMonth: null,
    settling: false,
  },
  chat: {
    histories: {},
    activeCharacterId: "btc_hime",
    isStreaming: false,
  },
};

const money = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const priceFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const btcFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 8,
});

const POSITION_EPSILON = 0.00000001;
