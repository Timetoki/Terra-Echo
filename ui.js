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

  /* ---- 场景:漂浮尘埃 + 剪影初始化 ---- */
  function initScene() {
    for (let i = 0; i < 26; i++) {
      const d = document.createElement("div");
      d.className = "dust";
      d.style.left = Math.random() * 100 + "vw";
      d.style.animationDuration = (10 + Math.random() * 14) + "s";
      d.style.animationDelay = -(Math.random() * 20) + "s";
      const s = 1 + Math.random() * 2;
      d.style.width = d.style.height = s + "px";
      scene.appendChild(d);
    }
    sil.innerHTML = SIL_SVG;
  }

  function setBackground(color) { stage.style.background = color; }

  /* ---- 剪影清晰度:0 纯模糊虚影 → 1 接近显形 ---- */
  function setSilhouette(level) {
    if (level <= 0) { sil.style.opacity = "0"; return; }
    sil.style.opacity = "1";
    // 模糊随清晰度下降,内部细节随清晰度浮现
    const blur = (1 - level) * 26 + 2;         // 28px → 2px
    sil.style.filter = `blur(${blur}px)`;
    const detail = sil.querySelector(".detail");
    if (detail) detail.style.opacity = String(Math.max(0, level - 0.3));
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
        const d = curDone; curDone = null;
        d && d();
      }
    })();
  }

  /* 点击/空格:打字中则快进,否则推进 */
  function advance() {
    if (typing) {
      // 打字中:立即补全当前行,触发其 done
      clearTimeout(typeTimer);
      typing = false;
      dialogueEl.innerHTML = curFull;
      const d = curDone; curDone = null;
      d && d();
      return;               // 这次只补全,不推进
    }
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

  /* ---- 结局显影 ---- */
  function showEnding(op) {
    const box = $("#ending");
    const flash = box.querySelector(".reveal-flash");
    const card = box.querySelector(".op-card");
    box.querySelector(".op-name").textContent = op ? op.name : "???";
    const endWrap = box.querySelector(".op-ending");
    endWrap.innerHTML = "";
    const lines = op ? op.ending : ["……光散去了,却没有人。也许那个人,一直是你自己。"];
    lines.forEach((t, i) => {
      const p = document.createElement("p");
      p.textContent = t;
      p.style.animationDelay = (1.2 + i * 0.9) + "s";
      endWrap.appendChild(p);
    });
    box.querySelector(".op-tier").textContent =
      op ? (op.tier === "core" ? "" : "· 日常线 ·") : "";

    box.classList.add("show");
    flash.classList.add("fire");           // 白光爆闪
    setTimeout(() => card.classList.add("in"), 900);
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

  return { initScene, setBackground, setSilhouette, renderNode,
           showEnding, showPrologueMeta };
})();

/* ---- 剪影 SVG:一个抽象人形,detail 层随清晰度浮现 ---- */
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
