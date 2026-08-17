/* ============================================================
 * data.js — 全部内容都在这里
 *
 * 引擎(engine.js)只负责读取和计算,不含任何剧情/题目/干员数据。
 * 后期补充内容 = 只改这个文件,不动引擎。
 *
 * 数据分四块:
 *   1. DIMENSIONS  性格维度轴定义(7 维)
 *   2. STORY       剧情节点 + 题目(节点图,靠 next 串联)
 *   3. OPERATORS   干员坐标 + 关系定位 + 结局文案
 *   4. PROSECTS    普瑞塞斯 meta 彩蛋配置
 * ============================================================ */

/* ------------------------------------------------------------
 * 1. 性格维度轴
 * 每条轴是一个从 -1(左极)到 +1(右极)的连续量。
 * 三观题的选项会在若干轴上加减分,累积成测试者坐标。
 * 干员也用同一套坐标标注,最终比距离。
 * ---------------------------------------------------------- */
const DIMENSIONS = {
  ideal:    { name: "理想 / 现实",  neg: "理想主义", pos: "现实主义" },
  order:    { name: "秩序 / 自由",  neg: "秩序",     pos: "自由"     },
  sacrifice:{ name: "牺牲 / 自保",  neg: "牺牲自我", pos: "保全自我" },
  mercy:    { name: "宽恕 / 复仇",  neg: "宽恕",     pos: "复仇"     },
  guard:    { name: "守护 / 征服",  neg: "守护",     pos: "征服"     },
  reason:   { name: "理性 / 炽情",  neg: "理性冷峻", pos: "炽热情感" },
  belong:   { name: "群体 / 孤高",  neg: "群体归属", pos: "孤高独行" },
};
const DIM_KEYS = Object.keys(DIMENSIONS);

/* ------------------------------------------------------------
 * 2. 剧情 + 题目(节点图)
 *
 * 每个节点是 STORY 里的一个键。节点类型:
 *   type: "story"   纯剧情,展示文本后进入 next
 *   type: "branch"  硬分支剧情题,选项切换剧情线 / 圈定结果池(pool)
 *   type: "moral"   三观题(突发事件),选项在维度轴打分,不改剧情线
 *   type: "ending"  收敛结算,触发结局计算
 *
 * 选项 option 字段:
 *   text      选项文字
 *   next      跳转的下一个节点键
 *   scores    { 维度key: 分值 } 对性格坐标的影响(moral/branch 都可带)
 *   pool      (仅 branch)本选项圈定的结果池标签,写进 state.poolTags
 *   relation  (仅 branch)确立的关系定位标签,写进 state.relationTags
 *   meta      (可选)+1 到 meta 计数,用于普瑞塞斯彩蛋触发
 *
 * silhouette: 0~1,该节点白光剪影的清晰度(0=纯模糊,1=接近显影)
 *
 * ↓↓↓ 下面是占位内容,只为跑通机制。真实题库后期替换。
 * ---------------------------------------------------------- */
const STORY = {

  start: {
    type: "story",
    silhouette: 0.05,
    bg: "#0a1420",
    text: [
      "刺耳的鸣笛。金属扭曲的巨响。然后是漫长的、没有尽头的白。",
      "当你重新睁开眼,天空是你从未见过的颜色——空气里飘着细小的、会发光的尘埃。",
      "你不记得自己是谁,叫什么,从哪里来。",
      "但有一件事,像烙进骨头里一样清晰:你在找一个人。你必须找到那个人。",
    ],
    next: "faction",
  },

  /* ---- 第一层:阵营硬分支(圈定大池子) ---- */
  faction: {
    type: "branch",
    silhouette: 0.1,
    bg: "#0a1420",
    text: [
      "你在一片陌生的土地上醒来。远处有几个方向,每一个都让你产生了不同的悸动。",
      "你的脚,不由自主想往哪边走?",
    ],
    options: [
      { text: "驶过来的那辆移动都市——罗德岛。船身的灯让你安心。",
        pool: "rhodes", next: "relation", scores: { belong: -0.3, ideal: -0.2 } },
      { text: "钟塔的方向。那里有种秩序井然的、近乎神圣的宁静。",
        pool: "lateran", next: "relation", scores: { order: -0.6 } },
      { text: "冰雪覆盖的北境。寒冷让你想起某种沉重的东西。",
        pool: "ursus", next: "relation", scores: { mercy: 0.3, reason: -0.2 } },
      { text: "喧闹的港口城市。人群里也许藏着答案。",
        pool: "victoria", next: "relation", scores: { belong: 0.2, order: 0.4 } },
    ],
  },

  /* ---- 第二层:关系性质硬分支 ---- */
  relation: {
    type: "branch",
    silhouette: 0.15,
    bg: "#0c1826",
    text: [
      "闭上眼,那个模糊的身影浮现出来。你看不清脸,但你能感觉到——",
      "你们之间,是什么样的关系?",
    ],
    options: [
      { text: "那是引领过我的人。我曾在对方身后学习、追随。",
        relation: "mentor", next: "moral_1", scores: { belong: -0.2 } },
      { text: "那是并肩作战的人。我们背靠背,共同面对过什么。",
        relation: "comrade", next: "moral_1", scores: { guard: -0.1 } },
      { text: "那是我要守护的人。想到对方,我只想挡在前面。",
        relation: "protect", next: "moral_1", scores: { guard: -0.5, sacrifice: -0.4 } },
      { text: "那是一段未了的亏欠,或一个必须清算的对手。",
        relation: "debt", next: "moral_1", scores: { mercy: 0.4, guard: 0.3 } },
    ],
  },

  /* ---- 第三层:三观题(突发事件),占位两道 ---- */
  moral_1: {
    type: "moral",
    silhouette: 0.25,
    bg: "#0c1826",
    text: [
      "你沿着记忆的方向前行。路边,一个感染者蜷缩在墙角,源石结晶已经爬上他半张脸。",
      "他伸出手,声音沙哑地求你帮忙。周围的人都在躲避。你——",
    ],
    options: [
      { text: "蹲下去,不管危险,先扶他起来。",
        next: "moral_2", scores: { sacrifice: -0.5, reason: 0.4, guard: -0.3 } },
      { text: "评估风险后再决定。冲动救不了任何人。",
        next: "moral_2", scores: { ideal: 0.5, reason: -0.5 } },
      { text: "留下能给的物资,但保持距离。我也有要去的地方。",
        next: "moral_2", scores: { sacrifice: 0.4, belong: 0.3 } },
      { text: "……总觉得这一幕是被安排好的。我为什么会在这里?",
        next: "moral_2", scores: { reason: -0.2 }, meta: true },
    ],
  },

  moral_2: {
    type: "moral",
    silhouette: 0.4,
    bg: "#101d2e",
    text: [
      "夜里,你目睹一场私刑。人群要处决一个据说犯下重罪的人,但没有审判,只有愤怒。",
      "你的手按在了什么东西上。你会——",
    ],
    options: [
      { text: "站出来,哪怕对抗整片人群,也要先问一句'证据呢'。",
        next: "moral_3", scores: { order: -0.4, ideal: -0.4, sacrifice: -0.3 } },
      { text: "如果他真的有罪,愤怒也是一种正义。我不阻拦。",
        next: "moral_3", scores: { mercy: 0.6, order: 0.3 } },
      { text: "记下每个人的脸。清算需要在对的时间,用对的方式。",
        next: "moral_3", scores: { mercy: 0.4, reason: -0.3, guard: 0.3 } },
      { text: "这些'人'的反应太统一了,像被写好的脚本。",
        next: "moral_3", scores: {}, meta: true },
    ],
  },

  moral_3: {
    type: "moral",
    silhouette: 0.6,
    bg: "#12233a",
    text: [
      "你越来越接近记忆尽头的那个身影。但有个声音在你脑海里问:",
      "如果找到那个人,意味着你要永远留在这个世界,回不去了——你还找吗?",
    ],
    options: [
      { text: "找。那个人比任何东西都重要,哪怕付出一切。",
        next: "converge", scores: { sacrifice: -0.6, reason: 0.5, belong: -0.3 } },
      { text: "找。但我要那个人和我一起,活着离开。",
        next: "converge", scores: { guard: -0.4, ideal: -0.3 } },
      { text: "……我开始怀疑,'那个人'是不是根本不存在。",
        next: "converge", scores: { reason: -0.4, belong: 0.4 }, meta: true },
      { text: "停下。如果这一切都是假的,我不想再被牵着走。",
        next: "converge", scores: { belong: 0.5 }, meta: true },
    ],
  },

  /* ---- 收敛结算 ---- */
  converge: {
    type: "ending",
    silhouette: 0.85,
    bg: "#0a1420",
    text: [
      "记忆的尽头,白光里的身影终于停下脚步,缓缓转过身来。",
      "你屏住呼吸。",
    ],
  },
};

/* ------------------------------------------------------------
 * 3. 干员
 *
 * 每个干员:
 *   name      显示名
 *   tier      "core"(有厚度结局) / "daily"(轻量日常结局)
 *   pools     属于哪些结果池标签(对应 branch 的 pool)
 *   relations 适配的关系定位标签(对应 branch 的 relation)
 *   coord     7 维人格坐标(-1~+1),键与 DIMENSIONS 对应
 *   ending    结局文案(core 写完整重逢,daily 写一句日常)
 *
 * 收敛算法:
 *   1. 先按 state.poolTags / relationTags 过滤出候选池
 *   2. 候选池内,算测试者坐标与每个干员 coord 的加权距离
 *   3. 距离最近者即结果;若池空则放宽过滤
 *
 * ↓↓↓ 占位若干干员,覆盖不同池 / 关系 / 坐标,用于验证收敛。
 * ---------------------------------------------------------- */
const OPERATORS = [
  {
    name: "阿米娅", tier: "core", file: "char_002_amiya_1b.png",
    pools: ["rhodes"], relations: ["mentor", "comrade"],
    coord: { ideal: -0.8, order: -0.2, sacrifice: -0.6, mercy: -0.5, guard: -0.7, reason: 0.2, belong: -0.6 },
    ending: [
      "白光散去,是一双紫红色的眼睛。她比你记忆里更瘦削,却站得笔直。",
      "「你终于……回来了。」她的声音发颤,却努力维持着领袖的镇定,「我一直相信,你会找到路的。」",
      "你不记得她的名字,但你的身体先于记忆做出了反应——你想护住她。原来一直要找的,是这个需要被守护、却始终背负着所有人的孩子。",
    ],
  },
  {
    name: "陈", tier: "core", file: "char_010_chen_1b.png",
    pools: ["rhodes", "victoria"], relations: ["comrade", "debt"],
    coord: { ideal: 0.6, order: -0.7, sacrifice: 0.2, mercy: 0.3, guard: 0.4, reason: -0.6, belong: 0.5 },
    ending: [
      "刀锋的寒光先于人影出现。她收刀,盯着你,眉头紧锁。",
      "「这么久……你还欠我一个解释。」话虽冷硬,她握刀的手却松了。",
      "你想起来了——你们曾在同一条战线上,彼此都欠对方一条命。她不是要守护的人,是那个会和你并肩,也会与你争吵到底的人。",
    ],
  },
  {
    name: "能天使", tier: "core", file: "char_1016_agoat2_1b.png",
    pools: ["rhodes", "lateran"], relations: ["comrade", "protect"],
    coord: { ideal: -0.5, order: 0.3, sacrifice: -0.8, mercy: 0.1, guard: -0.6, reason: 0.7, belong: -0.2 },
    ending: [
      "「哟——找了这么久,累不累呀?」熟悉的、没心没肺的笑声先撞进耳朵。",
      "她张开翅膀落在你面前,笑容却在看清你的瞬间僵了一下:「……你真的不记得了。没关系,我记得就够了。」",
      "那个总把赴死说得像玩笑的家伙。你要找的,是这份哪怕世界崩塌也要陪你笑着往前冲的莽撞。",
    ],
  },
  {
    name: "陀螺", tier: "daily", file: "char_1013_chen2_1b.png",
    pools: ["rhodes"], relations: ["comrade"],
    coord: { ideal: -0.2, order: 0.1, sacrifice: 0.3, mercy: -0.2, guard: 0.1, reason: 0.5, belong: 0.3 },
    ending: [
      "光里走出来的人挠了挠头:「诶?你找的是我?那……那正好,晚饭想吃点什么,我请。」",
    ],
  },
  {
    name: "乌尔比安", tier: "core", file: "char_1014_nearl2_1b.png",
    pools: ["lateran"], relations: ["mentor", "debt"],
    coord: { ideal: 0.7, order: -0.9, sacrifice: 0.1, mercy: 0.5, guard: 0.6, reason: -0.4, belong: 0.6 },
    ending: [
      "钟声。他站在光里,像一尊不容置疑的裁决。",
      "「你回来了。很好。」他没有多余的温情,只有一句,「这次,站到我这边来。」",
      "你要找的人,从不是温柔的港湾,而是一个会拽着你一起颠覆旧秩序的、危险的引路人。",
    ],
  },
  {
    name: "娜塔莉娅", tier: "daily", file: "char_1012_skadi2_1b.png",
    pools: ["ursus"], relations: ["protect", "debt"],
    coord: { ideal: 0.3, order: 0.5, sacrifice: 0.4, mercy: 0.6, guard: 0.2, reason: -0.5, belong: 0.7 },
    ending: [
      "雪地里的身影回过头,眼神里有种熟悉的锋利:「……你也是来找我算账的?那就排队吧。」",
    ],
  },
];

/* ------------------------------------------------------------
 * 4. 普瑞塞斯 meta 彩蛋
 *
 * 触发:整局累计 meta 计数 >= threshold 时,
 *       正常结局被替换,普瑞塞斯打破第四面墙出现。
 *       她的 UI 在所有其他 UI 之前(engine 里特殊处理)。
 * ---------------------------------------------------------- */
const PROSECTS = {
  threshold: 3,
  name: "普瑞塞斯",
  lines: [
    "……有意思。",
    "你一直在往'画面外'看,对不对?那些选项——'这是被安排好的''像脚本''那个人根本不存在'——",
    "系统检测到,你比其他测试者都更接近真相。",
    "我是普瑞塞斯。是的,就是那个跳出'测试'来跟你说话的存在。",
    "你要找的人是谁?这个问题一开始就问错了。是'谁在观测你做这个测试'。",
    "答案是我。从第一行字起,一直是我。",
  ],
};

/* 导出到全局,供 engine.js 使用 */
window.GAME_DATA = { DIMENSIONS, DIM_KEYS, STORY, OPERATORS, PROSECTS };
