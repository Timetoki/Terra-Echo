/* ============================================================
 * engine.js — 纯逻辑引擎
 * 不含任何剧情/题目/干员数据(那些全在 data.js)。
 * 职责:状态机推进、维度打分、收敛计算、彩蛋触发、驱动渲染。
 * ============================================================ */

const GD = window.GAME_DATA;
const E_DIM_KEYS  = GD.DIM_KEYS;
const E_STORY     = GD.STORY;
const E_OPERATORS = GD.OPERATORS;
const E_PROSECTS  = GD.PROSECTS;

/* ---- 运行时状态 ---- */
const state = {
  node: "start",
  coord: Object.fromEntries(E_DIM_KEYS.map(k => [k, 0])), // 测试者性格坐标
  poolTags: [],       // branch 圈定的结果池标签
  relationTags: [],   // branch 确立的关系标签
  metaCount: 0,       // meta 彩蛋计数
  history: [],        // 走过的节点(可用于回溯/调试)
};

/* ---- 应用一个选项的效果 ---- */
function applyOption(opt) {
  if (opt.scores) {
    for (const k in opt.scores) {
      state.coord[k] = clamp(state.coord[k] + opt.scores[k], -1, 1);
    }
  }
  if (opt.pool) state.poolTags.push(opt.pool);
  if (opt.relation) state.relationTags.push(opt.relation);
  if (opt.meta) state.metaCount += 1;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ---- 收敛:从全干员池定位到唯一结果 ---- */
function converge() {
  // 1. 池过滤:属于任一已选 pool 的干员
  let pool = E_OPERATORS.filter(op =>
    op.pools.some(p => state.poolTags.includes(p))
  );
  // 2. 关系加权过滤:优先保留匹配关系的,不硬砍(避免池空)
  const relMatched = pool.filter(op =>
    op.relations.some(r => state.relationTags.includes(r))
  );
  if (relMatched.length > 0) pool = relMatched;
  // 3. 兜底:池空则放开到全体
  if (pool.length === 0) pool = E_OPERATORS.slice();

  // 4. 找加权距离最近者
  let best = null, bestDist = Infinity;
  for (const op of pool) {
    const d = weightedDistance(state.coord, op.coord);
    if (d < bestDist) { bestDist = d; best = op; }
  }
  return best;
}

// 欧氏距离(缺失维度按 0 处理),可在此加权某些轴
function weightedDistance(a, b) {
  let sum = 0;
  for (const k of E_DIM_KEYS) {
    const av = a[k] ?? 0, bv = b[k] ?? 0;
    sum += (av - bv) * (av - bv);
  }
  return Math.sqrt(sum);
}

// 实时计算当前候选池(按已选 pool/relation 过滤),返回按距离排序的 top-N
function liveCandidates(n = 3) {
  let pool = E_OPERATORS.filter(op =>
    op.pools && op.pools.some(p => state.poolTags.includes(p))
  );
  if (pool.length === 0) pool = E_OPERATORS.slice();
  const relMatched = pool.filter(op =>
    op.relations && op.relations.some(r => state.relationTags.includes(r))
  );
  if (relMatched.length > 0) pool = relMatched;
  const ranked = pool
    .map(op => ({ op, d: weightedDistance(state.coord, op.coord) }))
    .sort((a, b) => a.d - b.d);
  return { size: pool.length, top: ranked.slice(0, n).map(x => x.op) };
}

/* ---- 推进到某节点并渲染 ---- */
function goTo(nodeKey) {
  state.node = nodeKey;
  state.history.push(nodeKey);
  const node = E_STORY[nodeKey];
  if (!node) { console.error("未知节点:", nodeKey); return; }

  UI.setBackground(node.bg || "#0a1420");

  // 决定剪影阶段:
  //   阶段1 光团   —— 还没圈定池子(未选阵营)
  //   阶段2 人影   —— 已选阵营,池子仍大
  //   阶段3 立绘轮播 —— 候选池收敛到很少(<=4)
  const s = node.silhouette ?? 0;
  const cand = liveCandidates(3);
  let stage;
  if (state.poolTags.length === 0 || s < 0.15) stage = 1;
  else if (cand.size > 4 || s < 0.55) stage = 2;
  else stage = 3;
  UI.setSilhouetteStage(stage, {
    clarity: s,
    candidates: cand.top,   // 阶段3 用的 top-3 立绘
  });

  if (node.type === "ending") {
    resolveEnding(node);
    return;
  }

  const hasOptions = node.type === "branch" || node.type === "moral";
  UI.renderNode({
    text: node.text,
    options: hasOptions ? node.options : null,
    onContinue: hasOptions ? null : () => goTo(node.next),
    onChoose: hasOptions ? (opt) => { applyOption(opt); goTo(opt.next); } : null,
  });
}

/* ---- 结局结算:先判彩蛋,否则正常收敛 ---- */
function resolveEnding(node) {
  UI.renderNode({
    text: node.text,
    options: null,
    onContinue: () => {
      if (state.metaCount >= E_PROSECTS.threshold) {
        UI.showPrologueMeta(E_PROSECTS);   // 普瑞塞斯:在所有 UI 之前
      } else {
        const op = converge();
        UI.showEnding(op);
      }
    },
  });
}

/* ---- 启动 ---- */
function startGame() {
  // 重置
  state.node = "start";
  state.coord = Object.fromEntries(E_DIM_KEYS.map(k => [k, 0]));
  state.poolTags = []; state.relationTags = []; state.metaCount = 0;
  state.history = [];
  goTo("start");
}

window.ENGINE = { startGame, state, converge }; // converge 暴露供调试
