/* ============================================================
 * ui.js — 呈现层
 * galgame 观感、白光剪影、逐字浮现、结局显影、普瑞塞斯前置层。
 * 引擎通过 window.UI 调用这里,不直接碰 DOM。
 * ============================================================ */

const UI = (() => {
  const $ = s => document.querySelector(s);
  const stage = $("#stage"), scene = $("#scene");
  const sil = $("#silhouette");
  const speakerEl = $("#speaker"), dialogueEl = $("#dialogue");
  const hintEl = $("#continue-hint"), choicesEl = $("#choices");

  let typing = false, typeTimer = null, onAdvance = null;
  let curFull = "", curDone = null;
  let justCompleted = false;   // 一句刚显示完整,需再点一下才推进

  /* ---- 场景:漂浮尘埃 + 三阶段剪影初始化 ---- */
  function initScene() {
    for (let i = 0; i < 26; i++) {
      const d = document.createElement("div");
      d.className = "dust";
      d.style.left = Math.random() * 100 + "vw";
      d.style.animationDuration = (10 + Math.random() * 14) + "s";
      d.style.animationDelay = -(Math.random() * 20) + "s";
      const sz = 1 + Math.random() * 2;
      d.style.width = d.style.height = sz + "px";
      scene.appendChild(d);
    }
    // 三阶段结构
    sil.innerHTML = `
      <div class="halo"></div>
      <div class="blob"></div>
      <div class="figure">${SIL_SVG}</div>
      <div class="portraits">
        <div class="portrait" data-slot="0"></div>
        <div class="portrait" data-slot="1"></div>
        <div class="portrait" data-slot="2"></div>
        <div class="shards">
          ${Array.from({length:6}).map((_,i)=>{
            const pts = randomShardClip();
            const dx = (Math.random()*2-1)*40, dy=(Math.random()*2-1)*40;
            return `<div class="shard" style="clip-path:${pts};--dx:${dx}px;--dy:${dy}px"></div>`;
          }).join("")}
        </div>
      </div>`;
  }

  function setBackground(color) { stage.style.background = color; }

  /* ---- 剪影三阶段控制 ---- */
  let rotTimer = null;      // 阶段3 立绘轮播计时器
  let rotIdx = 0;
  let curStage = 0;

  function setSilhouetteStage(n, opts = {}) {
    const blob = sil.querySelector(".blob");
    const figure = sil.querySelector(".figure");
    const portraits = sil.querySelector(".portraits");
    const halo = sil.querySelector(".halo");
    sil.classList.remove("hidden");

    // 阶段切换时,停掉旧的轮播
    if (n !== 3 && rotTimer) { clearInterval(rotTimer); rotTimer = null; }

    if (n === 1) {
      blob.style.opacity = "1";
      figure.style.opacity = "0";
      portraits.style.opacity = "0";
      halo.style.opacity = "1";
    } else if (n === 2) {
      blob.style.opacity = "0";
      figure.style.opacity = "1";
      portraits.style.opacity = "0";
      halo.style.opacity = "1";
    } else if (n === 3) {
      blob.style.opacity = "0";
      figure.style.opacity = "0";
      portraits.style.opacity = "1";
      halo.style.opacity = ".5";
      startPortraitRotation(opts.candidates || []);
    }
    curStage = n;
  }

  // 阶段3:三立绘水波纹 + 玻璃碎片轮播
  function startPortraitRotation(cands) {
    const slots = sil.querySelectorAll(".portrait");
    // 装载候选立绘到三个 slot
    const files = cands.filter(c => c && c.file).map(c => c.file);
    slots.forEach((el, i) => {
      if (files[i]) {
        el.style.backgroundImage = `url("assets/silhouettes/${files[i]}")`;
        el.dataset.has = "1";
      } else {
        el.style.backgroundImage = "";
        el.dataset.has = "";
      }
    });
    rotIdx = 0;
    showPortrait(0);
    if (rotTimer) clearInterval(rotTimer);
    // 只有多于一个候选才轮播
    const active = [...slots].filter(s => s.dataset.has === "1");
    if (active.length > 1) {
      rotTimer = setInterval(() => {
        rotIdx = (rotIdx + 1) % active.length;
        fireShards();
        showPortrait(rotIdx);
      }, 2600);
    }
  }

  function showPortrait(idx) {
    const slots = [...sil.querySelectorAll(".portrait")].filter(s => s.dataset.has === "1");
    slots.forEach((el, i) => el.classList.toggle("active", i === idx));
  }

  // 玻璃碎片闪光
  function fireShards() {
    const shards = sil.querySelector(".shards");
    shards.classList.remove("fire");
    void shards.offsetWidth;     // reflow 重置动画
    shards.classList.add("fire");
    setTimeout(() => shards.classList.remove("fire"), 950);
  }

  /* ---- 渲染一个节点 ---- */
  function renderNode({ text, options, onContinue, onChoose }) {
    clearChoices();
    hintEl.classList.remove("show");
    speakerEl.textContent = "";
    const lines = Array.isArray(text) ? text.slice() : [text];

    // 逐行播放,行内逐字
    let idx = 0;
    function playLine() {
      typeLine(lines[idx], () => {
        idx++;
        if (idx < lines.length) {
          onAdvance = playLine;
          hintEl.classList.add("show");
        } else {
          // 全部行播完
          if (options) {
            showChoices(options, onChoose);
            onAdvance = null;
          } else {
            onAdvance = () => { onAdvance = null; onContinue && onContinue(); };
            hintEl.classList.add("show");
          }
        }
      });
    }
    playLine();
  }

  /* ---- 逐字打字 ---- */
  function typeLine(str, done) {
    clearTimeout(typeTimer);
    typing = true;
    curFull = str; curDone = done;
    hintEl.classList.remove("show");
    dialogueEl.innerHTML = "";
    let i = 0;
    const cursor = '<span class="cursor">▊</span>';
    (function step() {
      if (i <= str.length) {
        dialogueEl.innerHTML = str.slice(0, i) + cursor;
        i++;
        typeTimer = setTimeout(step, 38);
      } else {
        dialogueEl.innerHTML = str;
        typing = false;
        justCompleted = true;        // 打完了,吞掉紧接着的这次点击
        hintEl.classList.add("show"); // 提示"可以继续了"
        const d = curDone; curDone = null;
        d && d();
      }
    })();
  }

  /* 点击/空格:打字中则快进,否则推进 */
  function advance() {
    // 1. 打字进行中:立即补全整句。补全本身是一次有效交互,
    //    补全后再点一下即推进(不额外吞点击)。
    if (typing) {
      clearTimeout(typeTimer);
      typing = false;
      dialogueEl.innerHTML = curFull;
      justCompleted = false;        // 手动补全:不吞下一次点击
      hintEl.classList.add("show");
      const d = curDone; curDone = null;
      d && d();
      return;
    }
    // 2. 文字自然打完的那一下:吞掉一次,避免"刚打完就被切走"
    if (justCompleted) {
      justCompleted = false;
      return;
    }
    // 3. 正常推进
    if (onAdvance) onAdvance();
  }

  /* ---- 选项 ---- */
  function showChoices(options, onChoose) {
    choicesEl.innerHTML = "";
    hintEl.classList.remove("show");
    options.forEach((opt, i) => {
      const b = document.createElement("button");
      b.className = "choice";
      b.textContent = opt.text;
      b.addEventListener("click", () => {
        if (typing) return;
        clearChoices();
        onChoose(opt);
      });
      choicesEl.appendChild(b);
      setTimeout(() => b.classList.add("in"), 120 + i * 90);
    });
  }
  function clearChoices() { choicesEl.innerHTML = ""; }

  /* ---- 结局显影:三横切片居中进入 → 清晰 → 移左出信息 ---- */
  let curOp = null;
  function showEnding(op) {
    curOp = op;
    const box = $("#ending");
    const frames = box.querySelectorAll(".frame");

    // 三个窗口 + 合并后的完整立绘,装载同一张图
    if (op && op.file) {
      const src = `assets/portraits/${op.file}`;
      box.querySelectorAll(".fimg").forEach(el => el.src = src);
      box.querySelector(".full-portrait").src = src;
    }

    // 文字
    box.querySelector(".op-name").textContent = op ? op.name : "???";
    const endWrap = box.querySelector(".op-ending");
    endWrap.innerHTML = "";
    const lines = op ? op.ending : ["……光散去了,却没有人。也许那个人,一直是你自己。"];
    lines.forEach((t, i) => {
      const p = document.createElement("p");
      p.textContent = t;
      p.style.animationDelay = (0.4 + i * 0.9) + "s";
      endWrap.appendChild(p);
    });
    const reBtn = $("#reunion");
    reBtn.style.display = (op && op.reunion && op.reunion.length) ? "" : "none";

    // 序列:三窗口错落入场(上中下) → 合并成完整立绘 → 整体移左 + 信息滑入
    box.classList.remove("revealed", "merged", "shifted");
    box.classList.add("show");
    frames.forEach((f, i) => { f.style.transitionDelay = (i * 0.2) + "s"; });
    requestAnimationFrame(() => {
      setTimeout(() => box.classList.add("revealed"), 60);    // 三窗口入场清晰
      setTimeout(() => {
        frames.forEach(f => f.style.transitionDelay = "0s");
        box.classList.add("merged");                          // 合并成完整立绘
      }, 1700);
      setTimeout(() => box.classList.add("shifted"), 2500);   // 移左 + 出信息
    });
  }

  /* ---- 重逢剧情:点"走近那个人"后拉起 ---- */
  function startReunion() {
    if (!curOp || !curOp.reunion) return;
    const layer = $("#reunion-scene");
    const bg = layer.querySelector(".rs-bg");
    if (curOp.file) bg.style.backgroundImage = `url("assets/portraits/${curOp.file}")`;
    layer.classList.add("show");
    const speaker = layer.querySelector(".rs-speaker");
    const dlg = layer.querySelector(".rs-dialogue");
    const hint = layer.querySelector(".rs-hint");
    let idx = 0;
    const lines = curOp.reunion;
    let rTyping = false, rTimer = null, rFull = "";
    function play() {
      const line = lines[idx];
      // 支持 "名字|台词" 格式
      let sp = "", tx = line;
      const bar = line.indexOf("|");
      if (bar > -1) { sp = line.slice(0, bar); tx = line.slice(bar + 1); }
      speaker.textContent = sp;
      rTyping = true; rFull = tx; hint.classList.remove("show");
      dlg.textContent = ""; let i = 0;
      clearInterval(rTimer);
      rTimer = setInterval(() => {
        if (i <= tx.length) { dlg.textContent = tx.slice(0, i); i++; }
        else { clearInterval(rTimer); rTyping = false; hint.classList.add("show"); }
      }, 40);
    }
    function next() {
      if (rTyping) { clearInterval(rTimer); dlg.textContent = rFull; rTyping = false;
                     hint.classList.add("show"); return; }
      idx++;
      if (idx < lines.length) play();
      else layer.classList.remove("show");   // 剧情结束,回到结算
    }
    layer.onclick = next;
    play();
  }

  /* ---- 普瑞塞斯 meta:在所有 UI 之前 ---- */
  function showPrologueMeta(cfg) {
    const layer = $("#meta");
    const wrap = $("#meta-lines");
    wrap.innerHTML = "";
    layer.classList.add("show");
    cfg.lines.forEach((t, i) => {
      const p = document.createElement("p");
      if (i === cfg.lines.length - 3) {
        // 名字单独放大(约定:倒数第三行是自报家门)
      }
      p.textContent = t;
      wrap.appendChild(p);
      setTimeout(() => p.classList.add("in"), 700 + i * 1400);
    });
    // 结尾放大名字
    setTimeout(() => {
      const nameP = document.createElement("div");
      nameP.className = "meta-name";
      nameP.textContent = cfg.name;
      wrap.appendChild(nameP);
      requestAnimationFrame(() => nameP.style.opacity = 1);
    }, 700 + cfg.lines.length * 1400);
  }

  /* 全局点击/键盘推进 */
  document.addEventListener("click", (e) => {
    if (e.target.closest(".choice") || e.target.closest("button")) return;
    advance();
  });
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); advance(); }
  });

  return { initScene, setBackground, setSilhouetteStage, renderNode,
           showEnding, showPrologueMeta, startReunion };
})();

/* ---- 随机玻璃碎片多边形 clip-path ---- */
function randomShardClip() {
  const p = [];
  const n = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    p.push(`${Math.round(Math.random()*100)}% ${Math.round(Math.random()*100)}%`);
  }
  return `polygon(${p.join(",")})`;
}

/* ---- 剪影 SVG:抽象人形(阶段2) ---- */
const SIL_SVG = `
<svg viewBox="0 0 200 320" xmlns="http://www.w3.org/2000/svg">
  <!-- 基础人形轮廓(始终存在,模糊) -->
  <g class="form">
    <ellipse cx="100" cy="52" rx="30" ry="34"/>
    <path d="M70 84 Q100 96 130 84 L142 200
             Q140 232 128 250 L120 316 L80 316 L72 250
             Q60 232 58 200 Z"/>
    <path d="M70 96 L44 190 L56 196 L82 110 Z"/>
    <path d="M130 96 L156 190 L144 196 L118 110 Z"/>
  </g>
  <!-- 细节层(发丝/衣褶暗示,清晰度高时才浮现) -->
  <g class="detail" style="opacity:0;fill:#bcd4ee">
    <path d="M74 30 Q100 14 126 30 Q120 44 100 40 Q80 44 74 30 Z"/>
    <path d="M96 100 L100 200 L104 100 Z" opacity="0.4"/>
  </g>
</svg>`;

window.UI = UI;
