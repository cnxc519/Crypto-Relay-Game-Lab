"use strict";

window.BtcReplay = window.BtcReplay || {};

(() => {
  const MODE_KEYS = ["blind", "trend", "trap", "survival", "revenge"];

  function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }

  function numeric(value) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  function statValue(key) {
    return (profile) => numeric(profile.stats?.[key]);
  }

  function profileValue(key) {
    return (profile) => numeric(profile[key]);
  }

  function counterProgress(current, target, options = {}) {
    const actualCurrent = Math.max(0, numeric(current));
    const actualTarget = Math.max(1, numeric(target));
    const precision = options.precision || 0;
    const format = (value) => (precision > 0 ? value.toFixed(precision) : String(Math.floor(value)));
    return {
      current: actualCurrent,
      target: actualTarget,
      ratio: clamp01(actualCurrent / actualTarget),
      text: options.text || `${format(Math.min(actualCurrent, actualTarget))}/${format(actualTarget)}`,
    };
  }

  function counterAchievement({ id, category, name, desc, target, value, hidden = false, progress }) {
    return {
      id,
      category,
      name,
      desc,
      hidden,
      test: (profile) => value(profile) >= target,
      progress:
        progress ||
        ((profile) => {
          return counterProgress(value(profile), target);
        }),
    };
  }

  function customAchievement(definition) {
    return definition;
  }

  function levelStats(profile) {
    return levelModeStats(profile);
  }

  function characterStates(profile) {
    return Object.values(profile.characters || {});
  }

  function totalCharacters() {
    return Array.isArray(CHARACTER_CONFIG) ? CHARACTER_CONFIG.length : 0;
  }

  function maxCharacterLevel(profile) {
    return characterStates(profile).reduce((max, character) => Math.max(max, characterLevelFromXp(character.xp, character.stage)), 0);
  }

  function charactersAtLevel(profile, level) {
    return characterStates(profile).filter((character) => characterLevelFromXp(character.xp, character.stage) >= level).length;
  }

  function maxCharacterStage(profile) {
    return characterStates(profile).reduce((max, character) => Math.max(max, numeric(character.stage)), 0);
  }

  function maxCharacterMaterials(profile) {
    return characterStates(profile).reduce((max, character) => Math.max(max, numeric(character.materials)), 0);
  }

  function countModesAtLeast(profile, target) {
    return MODE_KEYS.filter((key) => numeric(profile.stats?.[key]) >= target).length;
  }

  function averageScore(profile) {
    const completed = numeric(profile.stats?.completed);
    return completed > 0 ? numeric(profile.stats?.totalScore) / completed : 0;
  }

  function recentAchievementCount(profile) {
    return Array.isArray(profile.achievements) ? profile.achievements.length : 0;
  }

  function uniqueTagCount(profile) {
    return new Set(Array.isArray(profile.stats?.tagsUsed) ? profile.stats.tagsUsed : []).size;
  }

  function dynamicBooleanProgress(done, textWhenLocked) {
    return {
      current: done ? 1 : 0,
      target: 1,
      ratio: done ? 1 : 0,
      text: done ? "已达成" : textWhenLocked,
    };
  }

  const ACHIEVEMENT_CATEGORIES = [
    { id: "beginner", name: "入门之路", icon: "起步", order: 1 },
    { id: "streak", name: "坚持不懈", icon: "坚持", order: 2 },
    { id: "insight", name: "火眼金睛", icon: "眼光", order: 3 },
    { id: "skill", name: "交易高手", icon: "技术", order: 4 },
    { id: "risk", name: "风控铁壁", icon: "风控", order: 5 },
    { id: "review", name: "复盘修行", icon: "复盘", order: 6 },
    { id: "mode", name: "模式专家", icon: "模式", order: 7 },
    { id: "level", name: "闯关达人", icon: "闯关", order: 8 },
    { id: "character", name: "角色之缘", icon: "角色", order: 9 },
    { id: "fun", name: "趣味挑战", icon: "彩蛋", order: 10 },
    { id: "legend", name: "传奇之路", icon: "传奇", order: 11 },
  ];

  const CATEGORY_MAP = Object.fromEntries(ACHIEVEMENT_CATEGORIES.map((category) => [category.id, category]));

  const ACHIEVEMENTS = [
    ...[
      ["first_run", "beginner", "第一局开打", "完成 1 个训练关卡", 1],
      ["three_runs", "beginner", "开始上瘾", "累计完成 3 局", 3],
      ["ten_runs", "beginner", "历史回放常客", "累计完成 10 局", 10],
      ["twenty_runs", "beginner", "盘感打磨中", "累计完成 20 局", 20],
      ["fifty_runs", "beginner", "回放长跑者", "累计完成 50 局", 50],
      ["hundred_runs", "beginner", "百里挑一", "累计完成 100 局", 100],
      ["two_hundred_runs", "beginner", "训练成习惯", "累计完成 200 局", 200],
      ["five_hundred_runs", "beginner", "半千旅人", "累计完成 500 局", 500],
      ["thousand_runs", "beginner", "千局传说", "累计完成 1000 局", 1000],
    ].map(([id, category, name, desc, target]) => counterAchievement({ id, category, name, desc, target, value: statValue("completed") })),

    ...[
      ["streak_3", "streak", "三天不断线", "连续训练 3 天", 3],
      ["streak_7", "streak", "七日训练营", "连续训练 7 天", 7],
      ["streak_14", "streak", "两周手感", "连续训练 14 天", 14],
      ["streak_30", "streak", "月度全勤", "连续训练 30 天", 30],
      ["streak_60", "streak", "双月修行", "连续训练 60 天", 60],
      ["streak_100", "streak", "百日筑基", "连续训练 100 天", 100],
      ["streak_200", "streak", "年度意志力", "连续训练 200 天", 200],
      ["streak_365", "streak", "全年无休", "连续训练 365 天", 365],
    ].map(([id, category, name, desc, target]) => counterAchievement({ id, category, name, desc, target, value: profileValue("streak") })),

    ...[
      ["observer", "insight", "观望也是操作", "用观望拿到一次高分（>=70）", 1, statValue("goodFlat")],
      ["observer_5", "insight", "不动如山", "用观望拿到 5 次高分", 5, statValue("goodFlat")],
      ["observer_15", "insight", "沉默是金", "用观望拿到 15 次高分", 15, statValue("goodFlat")],
      ["observer_30", "insight", "空仓大师", "用观望拿到 30 次高分", 30, statValue("goodFlat")],
      ["direction_5", "insight", "盘感初现", "方向判断正确 5 次", 5, statValue("directionCorrect")],
      ["direction_25", "insight", "一眼看穿", "方向判断正确 25 次", 25, statValue("directionCorrect")],
      ["direction_100", "insight", "市场读心术", "方向判断正确 100 次", 100, statValue("directionCorrect")],
      ["zero_trade_win", "insight", "不动也能赢", "0 笔交易且方向判断正确", 1, statValue("zeroTradeCorrect")],
      ["zero_trade_5", "insight", "静观其变", "0 笔交易且方向正确 5 次", 5, statValue("zeroTradeCorrect")],
    ].map(([id, category, name, desc, target, value]) => counterAchievement({ id, category, name, desc, target, value })),

    ...[
      ["score_80", "skill", "冷静的一局", "任意关卡达到 80 分", 80, statValue("bestScore")],
      ["score_90", "skill", "神清气定", "任意关卡达到 90 分", 90, statValue("bestScore")],
      ["score_95", "skill", "几乎无噪音", "任意关卡达到 95 分", 95, statValue("bestScore")],
      ["score_100", "skill", "完美一局", "任意关卡达到 100 分满分", 100, statValue("bestScore")],
      ["multi_80plus_5", "skill", "高分段常客", "累计 5 局达到 80 分以上", 5, statValue("score80plus")],
      ["multi_80plus_20", "skill", "稳定输出", "累计 20 局达到 80 分以上", 20, statValue("score80plus")],
      ["multi_90plus_5", "skill", "精致交易", "累计 5 局达到 90 分以上", 5, statValue("score90plus")],
      ["multi_90plus_15", "skill", "精益求精", "累计 15 局达到 90 分以上", 15, statValue("score90plus")],
      ["score100_3", "skill", "三局封神", "累计 3 局满分", 3, statValue("score100")],
    ].map(([id, category, name, desc, target, value]) => counterAchievement({ id, category, name, desc, target, value })),

    customAchievement({
      id: "avg_score_60",
      category: "skill",
      name: "及格线以上",
      desc: "完成 10 局且平均分 >= 60",
      test: (profile) => numeric(profile.stats?.completed) >= 10 && averageScore(profile) >= 60,
      progress: (profile) => {
        const completed = numeric(profile.stats?.completed);
        const avg = averageScore(profile);
        return {
          current: Math.min(completed, 10),
          target: 10,
          ratio: Math.min(clamp01(completed / 10), clamp01(avg / 60)),
          text: `${Math.min(completed, 10)}/10 局，均分 ${avg.toFixed(1)}/60`,
        };
      },
    }),
    customAchievement({
      id: "avg_score_75",
      category: "skill",
      name: "优等生",
      desc: "完成 20 局且平均分 >= 75",
      test: (profile) => numeric(profile.stats?.completed) >= 20 && averageScore(profile) >= 75,
      progress: (profile) => {
        const completed = numeric(profile.stats?.completed);
        const avg = averageScore(profile);
        return {
          current: Math.min(completed, 20),
          target: 20,
          ratio: Math.min(clamp01(completed / 20), clamp01(avg / 75)),
          text: `${Math.min(completed, 20)}/20 局，均分 ${avg.toFixed(1)}/75`,
        };
      },
    }),

    ...[
      ["seatbelt", "risk", "先系安全带", "带止损完成 5 局", 5, statValue("stopUsed")],
      ["seatbelt_15", "risk", "风控成习惯", "带止损完成 15 局", 15, statValue("stopUsed")],
      ["seatbelt_30", "risk", "止损圣徒", "带止损完成 30 局", 30, statValue("stopUsed")],
      ["seatbelt_80", "risk", "永远别裸奔", "带止损完成 80 局", 80, statValue("stopUsed")],
      ["seatbelt_all", "risk", "全副武装", "最近 10 局全部带止损", 10, statValue("stopUsedStreak")],
      ["drawdown_low3", "risk", "稳如磐石", "任意一局最大回撤 < 1% 且盈利", 1, statValue("lowDrawdownWins")],
      ["drawdown_low10", "risk", "波动免疫", "累计 10 局最大回撤 < 2%", 10, statValue("lowDrawdown")],
    ].map(([id, category, name, desc, target, value]) => counterAchievement({ id, category, name, desc, target, value })),

    ...[
      ["reviewer", "review", "诚实复盘者", "带复盘完成 5 局", 5, statValue("reviewed")],
      ["reviewer_15", "review", "错题会发光", "带复盘完成 15 局", 15, statValue("reviewed")],
      ["reviewer_30", "review", "复盘成自然", "带复盘完成 30 局", 30, statValue("reviewed")],
      ["reviewer_80", "review", "不写不舒服", "带复盘完成 80 局", 80, statValue("reviewed")],
      ["reviewer_all10", "review", "每局都记", "最近 10 局全部带复盘", 10, statValue("reviewedStreak")],
      ["note_100char", "review", "长篇大论", "单局复盘笔记超过 100 字", 1, statValue("longReview")],
      ["note_200char", "review", "交易论文", "单局复盘笔记超过 200 字", 1, statValue("veryLongReview")],
      ["bookmark_10", "review", "标注狂魔", "单局添加 10 个以上标注", 10, statValue("mostBookmarks")],
    ].map(([id, category, name, desc, target, value]) => counterAchievement({ id, category, name, desc, target, value })),

    customAchievement({
      id: "tag_master",
      category: "review",
      name: "标签收集家",
      desc: "使用过全部 6 种复盘标签",
      test: (profile) => uniqueTagCount(profile) >= 6,
      progress: (profile) => {
        return counterProgress(uniqueTagCount(profile), 6);
      },
    }),

    ...[
      ["blind_10", "mode", "盲区行者", "累计完成 10 局盲测快局", 10, statValue("blind")],
      ["blind_25", "mode", "盲区老手", "累计完成 25 局盲测快局", 25, statValue("blind")],
      ["blind_50", "mode", "盲区领主", "累计完成 50 局盲测快局", 50, statValue("blind")],
      ["trend_10", "mode", "顺势雷达", "累计完成 10 局趋势猎人", 10, statValue("trend")],
      ["trend_25", "mode", "顺风船长", "累计完成 25 局趋势猎人", 25, statValue("trend")],
      ["trend_50", "mode", "趋势之王", "累计完成 50 局趋势猎人", 50, statValue("trend")],
      ["trap_10", "mode", "假突破拆解员", "累计完成 10 局假突破", 10, statValue("trap")],
      ["trap_25", "mode", "陷阱猎人", "累计完成 25 局假突破", 25, statValue("trap")],
      ["trap_50", "mode", "假突破免疫", "累计完成 50 局假突破", 50, statValue("trap")],
      ["survival_10", "mode", "波动防线", "累计完成 10 局暴跌生存", 10, statValue("survival")],
      ["survival_25", "mode", "风暴幸存者", "累计完成 25 局暴跌生存", 25, statValue("survival")],
      ["survival_50", "mode", "不死之身", "累计完成 50 局暴跌生存", 50, statValue("survival")],
      ["revenge_10", "mode", "复仇清单", "累计完成 10 局错题复仇", 10, statValue("revenge")],
      ["revenge_25", "mode", "错题消灭者", "累计完成 25 局错题复仇", 25, statValue("revenge")],
      ["revenge_50", "mode", "无怨无恨", "累计完成 50 局错题复仇", 50, statValue("revenge")],
    ].map(([id, category, name, desc, target, value]) => counterAchievement({ id, category, name, desc, target, value })),

    ...[
      ["all_modes_5", "mode", "五味俱全", "五种模式各完成 5 局", 5],
      ["all_modes_25", "mode", "全能战神", "五种模式各完成 25 局", 25],
    ].map(([id, category, name, desc, target]) =>
      customAchievement({
        id,
        category,
        name,
        desc,
        test: (profile) => countModesAtLeast(profile, target) >= MODE_KEYS.length,
        progress: (profile) => {
          const doneModes = countModesAtLeast(profile, target);
          return {
            current: doneModes,
            target: MODE_KEYS.length,
            ratio: clamp01(doneModes / MODE_KEYS.length),
            text: `${doneModes}/${MODE_KEYS.length} 模式达标`,
          };
        },
      }),
    ),

    ...[
      ["level_clear_1", "level", "第一关通过", "历史闯关通过 1 关", 1, (profile) => levelStats(profile).cleared],
      ["level_clear_10", "level", "十日远征", "历史闯关通过 10 关", 10, (profile) => levelStats(profile).cleared],
      ["level_clear_50", "level", "五十关巡礼", "历史闯关通过 50 关", 50, (profile) => levelStats(profile).cleared],
      ["level_clear_100", "level", "百关征服", "历史闯关通过 100 关", 100, (profile) => levelStats(profile).cleared],
      ["level_clear_300", "level", "三百关老兵", "历史闯关通过 300 关", 300, (profile) => levelStats(profile).cleared],
      ["level_stars_25", "level", "星光初聚", "历史闯关累计获得 25 星", 25, (profile) => levelStats(profile).stars],
      ["level_stars_100", "level", "百星图鉴", "历史闯关累计获得 100 星", 100, (profile) => levelStats(profile).stars],
      ["level_stars_250", "level", "星河灿烂", "历史闯关累计获得 250 星", 250, (profile) => levelStats(profile).stars],
      ["level_stars_500", "level", "五星满堂", "历史闯关累计获得 500 星", 500, (profile) => levelStats(profile).stars],
      ["level_five_star", "level", "五星日线", "任意历史关卡获得 5 星", 1, (profile) => levelStats(profile).fiveStars],
      ["level_five_star_5", "level", "五星专业户", "5 个不同关卡获得 5 星", 5, (profile) => levelStats(profile).fiveStars],
      ["level_five_star_20", "level", "满星收割机", "20 个不同关卡获得 5 星", 20, (profile) => levelStats(profile).fiveStars],
      ["level_retry_5", "level", "不服再来", "同一历史关卡累计挑战 5 次", 5, (profile) => levelStats(profile).maxAttempts],
      ["level_retry_15", "level", "死磕到底", "同一历史关卡累计挑战 15 次", 15, (profile) => levelStats(profile).maxAttempts],
    ].map(([id, category, name, desc, target, value]) => counterAchievement({ id, category, name, desc, target, value })),

    ...[
      ["character_lv10", "character", "初窥门径", "任意角色达到 Lv.10", 10],
      ["character_lv25", "character", "略有小成", "任意角色达到 Lv.25", 25],
      ["character_lv50", "character", "登堂入室", "任意角色达到 Lv.50", 50],
      ["character_lv100", "character", "百级里程碑", "任意角色达到 Lv.100", 100],
      ["character_lv200", "character", "一阶巅峰", "任意角色达到 Lv.200（一阶上限）", 200],
      ["character_lv400", "character", "二阶跨越", "任意角色达到 Lv.400（二阶上限）", 400],
      ["character_lv600", "character", "三阶大成", "任意角色达到 Lv.600（三阶上限）", 600],
      ["character_lv800", "character", "四阶圆满", "任意角色达到 Lv.800（四阶上限）", 800],
      ["character_lv1000", "character", "终阶封神", "任意角色达到 Lv.1000（满级）", 1000],
    ].map(([id, category, name, desc, target]) =>
      customAchievement({
        id,
        category,
        name,
        desc,
        test: (profile) => maxCharacterLevel(profile) >= target,
        progress: (profile) => counterProgress(maxCharacterLevel(profile), target),
      }),
    ),

    ...[
      ["ascended_once", "character", "第一次进阶", "任意角色升到二阶", 2],
      ["ascended_twice", "character", "三阶跃迁", "任意角色升到三阶", 3],
      ["ascended_thrice", "character", "四阶升华", "任意角色升到四阶", 4],
      ["ascended_final", "character", "终阶觉醒", "任意角色升到终阶（五阶）", 5],
    ].map(([id, category, name, desc, target]) =>
      customAchievement({
        id,
        category,
        name,
        desc,
        test: (profile) => maxCharacterStage(profile) >= target,
        progress: (profile) => counterProgress(maxCharacterStage(profile), target),
      }),
    ),

    ...[
      ["materials_12", "character", "材料收藏家", "任意角色持有 12 个进阶材料（够升二阶）", 12],
      ["materials_48", "character", "材料囤积者", "任意角色持有 48 个进阶材料（够升三阶）", 48],
      ["materials_120", "character", "材料大亨", "任意角色持有 120 个进阶材料（够全程进阶）", 120],
    ].map(([id, category, name, desc, target]) =>
      customAchievement({
        id,
        category,
        name,
        desc,
        test: (profile) => maxCharacterMaterials(profile) >= target,
        progress: (profile) => counterProgress(maxCharacterMaterials(profile), target),
      }),
    ),

    ...[
      ["two_char_lv50", "character", "双人共进", "两个不同角色达到 Lv.50", 2, 50],
      ["two_char_lv200", "character", "双星闪耀", "两个不同角色达到 Lv.200", 2, 200],
      ["two_char_lv500", "character", "双雄并立", "两个不同角色达到 Lv.500", 2, 500],
      ["all_char_lv25", "character", "全员起步", "全部角色达到 Lv.25", () => totalCharacters(), 25],
      ["all_char_lv100", "character", "全员精锐", "全部角色达到 Lv.100", () => totalCharacters(), 100],
      ["all_char_lv200", "character", "全员巅峰", "全部角色达到 Lv.200", () => totalCharacters(), 200],
    ].map(([id, category, name, desc, target, level]) =>
      customAchievement({
        id,
        category,
        name,
        desc,
        test: (profile) => charactersAtLevel(profile, level) >= (typeof target === "function" ? target() : target),
        progress: (profile) => {
          const actualTarget = typeof target === "function" ? target() : target;
          return counterProgress(charactersAtLevel(profile, level), actualTarget);
        },
      }),
    ),

    ...[
      ["full_send", "fun", "全仓猛男", "单笔开仓达到 100% 权益并盈利", 1, statValue("fullSendWins"), true],
      ["micro_trader", "fun", "微操达人", "单笔开仓 <= 10% 权益并盈利", 1, statValue("microWins"), true],
      ["opposite_win", "fun", "反着来也能赚", "方向判断错误但仍盈利", 1, statValue("oppositeWins"), true],
      ["triple_trade", "fun", "黄金三笔", "单局正好交易 3 笔且盈利", 1, statValue("tripleTradeWins"), true],
      ["one_trade_win", "fun", "一剑封喉", "单局只做 1 笔交易且盈利", 1, statValue("oneTradeWins"), true],
      ["no_trade_80", "fun", "佛系高分", "0 笔交易获得 80 分以上", 1, statValue("zeroTradeHighScore"), false],
      ["speed_3min", "fun", "快枪手", "3 分钟内完成一局训练", 1, statValue("quickGames"), true],
      ["speed_1min", "fun", "闪电侠", "1 分钟内完成一局训练", 1, statValue("ultraQuickGames"), true],
      ["trader_20", "fun", "交易狂魔", "单局超过 20 笔交易", 20, statValue("mostTrades"), false],
      ["trader_50", "fun", "高频交易员", "单局超过 50 笔交易", 50, statValue("mostTrades"), true],
      ["buy_bottom", "fun", "抄底圣手", "在本局最低点附近买入并盈利", 1, statValue("nearBottomBuy"), true],
      ["sell_top", "fun", "逃顶天王", "在本局最高点附近卖出并盈利", 1, statValue("nearTopSell"), true],
    ].map(([id, category, name, desc, target, value, hidden]) => counterAchievement({ id, category, name, desc, target, value, hidden })),

    ...[
      ["total_xp_5000", "legend", "经验老手", "累计获得 5000 XP", 5000, profileValue("xp")],
      ["total_xp_20000", "legend", "修行大师", "累计获得 20000 XP", 20000, profileValue("xp")],
      ["total_xp_50000", "legend", "盘感永存", "累计获得 50000 XP", 50000, profileValue("xp")],
      ["total_xp_100000", "legend", "交易之魂", "累计获得 100000 XP", 100000, profileValue("xp")],
      ["level_stars_1000", "legend", "千星圣殿", "历史闯关累计获得 1000 星", 1000, (profile) => levelStats(profile).stars],
      ["completed_2000", "legend", "一生之练", "累计完成 2000 局训练", 2000, statValue("completed")],
      ["achievement_50", "legend", "成就猎人", "解锁 50 个成就", 50, recentAchievementCount],
      ["achievement_80", "legend", "成就收藏癖", "解锁 80 个成就", 80, recentAchievementCount],
    ].map(([id, category, name, desc, target, value]) => counterAchievement({ id, category, name, desc, target, value })),

    customAchievement({
      id: "all_modes_50",
      category: "legend",
      name: "众神之王",
      desc: "五种模式各完成 50 局",
      test: (profile) => countModesAtLeast(profile, 50) >= MODE_KEYS.length,
      progress: (profile) => {
        const doneModes = countModesAtLeast(profile, 50);
        return {
          current: doneModes,
          target: MODE_KEYS.length,
          ratio: clamp01(doneModes / MODE_KEYS.length),
          text: `${doneModes}/${MODE_KEYS.length} 模式达标`,
        };
      },
    }),

    customAchievement({
      id: "achievement_all",
      category: "legend",
      name: "全成就制霸",
      desc: "解锁除本成就外的全部成就",
      hidden: true,
      test: (profile) => recentAchievementCount(profile) >= ACHIEVEMENTS.length - 1,
      progress: (profile) => {
        const target = Math.max(1, ACHIEVEMENTS.length - 1);
        return counterProgress(recentAchievementCount(profile), target);
      },
    }),
  ];

  function achievementCategory(id) {
    return CATEGORY_MAP[id] || CATEGORY_MAP.beginner;
  }

  function achievementProgressSnapshot(achievement, profile) {
    if (!achievement || typeof achievement.progress !== "function") return null;
    const progress = achievement.progress(profile);
    if (!progress) return null;
    if (typeof progress === "string") {
      return { ratio: 0, text: progress };
    }
    const ratio = Number.isFinite(progress.ratio)
      ? clamp01(progress.ratio)
      : clamp01(numeric(progress.current) / Math.max(1, numeric(progress.target)));
    return {
      current: numeric(progress.current),
      target: Math.max(1, numeric(progress.target)),
      ratio,
      text: progress.text || `${Math.floor(numeric(progress.current))}/${Math.floor(Math.max(1, numeric(progress.target)))}`,
    };
  }

  function unlockNewAchievements(profile) {
    const unlocked = new Set(Array.isArray(profile.achievements) ? profile.achievements : []);
    const newAchievements = [];
    for (const achievement of ACHIEVEMENTS) {
      if (unlocked.has(achievement.id)) continue;
      if (!achievement.test(profile)) continue;
      unlocked.add(achievement.id);
      profile.achievements.push(achievement.id);
      newAchievements.push(achievement);
    }

    if (newAchievements.length) {
      const newIds = newAchievements.map((achievement) => achievement.id);
      const previous = Array.isArray(profile.recentAchievements) ? profile.recentAchievements : [];
      profile.recentAchievements = [...newIds, ...previous.filter((id) => !newIds.includes(id))].slice(0, 12);
    }
    return newAchievements;
  }

  window.BtcReplay.achievements = {
    ACHIEVEMENT_CATEGORIES,
    ACHIEVEMENTS,
    achievementCategory,
    achievementProgressSnapshot,
    unlockNewAchievements,
  };
})();
