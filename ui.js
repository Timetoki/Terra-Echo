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
      </div>`;
  }

  function setBackground(color) {
    // 把节点背景色转成半透明,让底层 Blue 视频透出来一部分
    stage.style.background = hexToRgba(color, 0.8);
  }
  function hexToRgba(hex, a) {
    if (!hex || hex[0] !== "#") return hex;
    const h = hex.slice(1);
    const n = h.length === 3
      ? h.split("").map(c => c + c).join("")
      : h;
    const r = parseInt(n.slice(0,2),16), g = parseInt(n.slice(2,4),16), b = parseInt(n.slice(4,6),16);
    return `rgba(${r},${g},${b},${a})`;
  }

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
        showPortrait(rotIdx);
      }, 3000);
    }
  }

  function showPortrait(idx) {
    const slots = [...sil.querySelectorAll(".portrait")].filter(s => s.dataset.has === "1");
    slots.forEach((el, i) => el.classList.toggle("active", i === idx));
  }

  /* ---- 渲染一个节点 ---- */
  function renderNode({ text, options, onContinue, onChoose, solo }) {
    clearChoices();
    choicesEl.classList.toggle("centered", !!solo);
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

  /* ---- 结局显影:眨眼 → 白光绽开 → 斜切科技页滑入 ---- */
  let curOp = null;
  function showEnding(op) {
    curOp = op;
    const box = $("#ending");

    if (op && op.file) {
      box.querySelector(".rv-sil").src = `assets/silhouettes/${op.file}`;
      box.querySelector(".rv-real").src = `assets/portraits/${op.file}`;
      const back = box.querySelector(".rv-back");
      if (back) back.src = `assets/silhouettes/${op.file}`;
    }

    const name = op ? op.name : "???";
    box.querySelector(".op-name").textContent = name;
    const dash = "—";
    const set = (sel, v) => { const el = box.querySelector(sel); if (el) el.textContent = v || dash; };
    set(".id-en", op && (op.enName || op.en));
    set(".id-gender", op && op.gender);
    set(".id-faction", op && op.faction);
    set(".id-origin", op && op.origin);
    set(".id-race", op && op.race);
    set(".id-class", op && (op.subclass || op.job));
    const noEl = $("#op-data-no");
    if (noEl) noEl.textContent = "#" + dataNo(op);

    if (op && op.code) bumpTally(op.code);

    buildHaze(box.querySelector(".haze-wrap"));
    buildDust(box.querySelector(".dust-wrap"));

    box.classList.remove("blink", "bloomed", "shifted");
    box.classList.add("show");
    requestAnimationFrame(() => {
      setTimeout(() => box.classList.add("blink"), 80);
      setTimeout(() => box.classList.add("bloomed"), 2800);
      setTimeout(() => box.classList.add("shifted"), 5000);
    });
  }

  function dataNo(op) {
    const s = (op && (op.code || op.name)) || "NULL";
    let n = 0;
    for (let i = 0; i < s.length; i++) n = (n * 33 + s.charCodeAt(i)) >>> 0;
    return (n % 9000 + 1000).toString().padStart(4, "0");
  }

  function reunionLines(op) {
    if (op && op.reunion && op.reunion.length) return op.reunion.slice();
    if (op && op.ending && op.ending.length) return op.ending.slice();
    if (op && op.solo) return [op.solo];
    return ["……光散去了。你们终于站在了彼此面前。"];
  }

  // 生成几团模糊晕染的白色柔光垫底(不规则、大小不一、缓慢漂移)
  function buildDust(layer){
    if (!layer) return;
    layer.innerHTML = "";
    const N = 44;
    for (let i=0;i<N;i++){
      const d = document.createElement("div");
      d.className = "fdust";
      const s = 1.5 + Math.random()*3.5;
      d.style.width = s+"px";
      d.style.height = s+"px";
      d.style.left = (Math.random()*100)+"%";
      d.style.top = (60+Math.random()*45)+"%";
      d.style.setProperty("--fdx", (Math.random()*2-1)*12+"vw");
      d.style.setProperty("--fdy", -(30+Math.random()*55)+"vh");
      d.style.setProperty("--fo", (0.5+Math.random()*0.5).toFixed(2));
      const dur = 9 + Math.random()*10;
      d.style.animationDuration = dur+"s";
      d.style.animationDelay = -(Math.random()*dur)+"s";
      layer.appendChild(d);
    }
  }
  function buildHaze(layer){
    if (!layer) return;
    layer.innerHTML = "";
    const mobile = window.matchMedia("(max-width:760px)").matches;
    const N = mobile ? 3 : 6;
    for (let i=0;i<N;i++){
      const d = document.createElement("div");
      d.className = "haze";
      const w = 24 + Math.random()*34;            // 视宽百分比,团块大
      const h = w * (0.6 + Math.random()*0.7);    // 不规则:宽高不等
      d.style.width = w+"vw";
      d.style.height = h+"vw";
      d.style.left = (Math.random()*90-8)+"%";
      d.style.top = (Math.random()*90-8)+"%";
      d.style.setProperty("--hx", (Math.random()*2-1)*8+"vw");
      d.style.setProperty("--hy", (Math.random()*2-1)*6+"vw");
      const dur = 7 + Math.random()*6;
      d.style.animationDuration = dur+"s";
      d.style.animationDelay = -(Math.random()*dur)+"s";
      layer.appendChild(d);
    }
  }

  /* ---- 全球榜单(本机 localStorage 计数 + 基础种子;真全球统计待接计数服务) ---- */
  const TALLY_KEY = "terra_echo_tally_v1";
  // 基础种子:让榜单初始就有内容(code: 次数)。本机寻找会在此之上累加。
  const SEED = {
    amiya: 128, texas: 96, kalts: 84, chen: 77, skadi2: 71,
    nearl2: 65, wisdel: 58, angel: 52, blaze2: 47, texas2: 41,
  };
  function loadTally() {
    try { return JSON.parse(localStorage.getItem(TALLY_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function bumpTally(code) {
    try {
      const t = loadTally();
      t[code] = (t[code] || 0) + 1;
      localStorage.setItem(TALLY_KEY, JSON.stringify(t));
    } catch (e) {}
  }
  function mergedTally() {
    const local = loadTally();
    const out = Object.assign({}, SEED);
    for (const k in local) out[k] = (out[k] || 0) + local[k];
    return out;
  }
  function opByCode(code) {
    if (typeof OPERATORS === "undefined") return null;
    return OPERATORS.find(o => o.code === code) || null;
  }
  function renderGlobalList() {
    const list = $("#gp-list");
    if (!list) return;
    const t = mergedTally();
    const rows = Object.keys(t)
      .map(code => ({ code, n: t[code], op: opByCode(code) }))
      .filter(r => r.op)
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);
    list.innerHTML = "";
    rows.forEach((r, i) => {
      const li = document.createElement("li");
      li.innerHTML =
        `<span class="gp-rank">${i + 1}</span>` +
        `<span class="gp-ava"><img src="assets/portraits/${r.op.file}" alt=""></span>` +
        `<span class="gp-nm">${r.op.name}</span>` +
        `<span class="gp-ct"><b>${r.n}</b>次</span>`;
      list.appendChild(li);
    });
  }
  function openGlobal() { renderGlobalList(); $("#global-panel").classList.add("show"); }
  function closeGlobal() { $("#global-panel").classList.remove("show"); }
  function openCredit() { $("#credit-panel").classList.add("show"); }
  function closeCredit() { $("#credit-panel").classList.remove("show"); }

  /* ---- 重逢剧情:点击底栏或上拉后升起半透明层 ---- */
  function startReunion() {
    if (!$("#ending").classList.contains("shifted")) return;
    const layer = $("#reunion-scene");
    if (layer.classList.contains("show")) return;
    const bg = layer.querySelector(".rs-bg");
    if (curOp && curOp.file) bg.style.backgroundImage = `url("assets/portraits/${curOp.file}")`;
    layer.classList.add("show");
    requestAnimationFrame(() => layer.classList.add("up"));
    const speaker = layer.querySelector(".rs-speaker");
    const dlg = layer.querySelector(".rs-dialogue");
    const hint = layer.querySelector(".rs-hint");
    let idx = 0;
    const lines = reunionLines(curOp);
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
      else {                                     // 剧情结束,滑下收起
        layer.classList.remove("up");
        setTimeout(() => layer.classList.remove("show"), 700);
      }
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

  /* ---- 普瑞塞斯跳脸(可被可露希尔救场) ---- */
  function pickWeighted(lines) {
    let r = Math.random(), acc = 0;
    for (const l of lines) { acc += l.weight; if (r <= acc) return l.text; }
    return lines[lines.length - 1].text;
  }
  function typeInto(el, text, speed, done) {
    el.textContent = ""; let i = 0;
    const t = setInterval(() => {
      if (i <= text.length) { el.textContent = text.slice(0, i); i++; }
      else { clearInterval(t); done && done(); }
    }, speed);
  }
  function blinkOut(el, done) {
    let n = 0;
    const t = setInterval(() => {
      el.style.opacity = (n % 2 ? "1" : "0"); n++;
      if (n >= 6) { clearInterval(t); el.style.opacity = "1"; done && done(); }
    }, 120);
  }

  function showPriestess(P, cb) {
    const layer = $("#priestess");
    const img = layer.querySelector(".pr-portrait");
    const dlg = layer.querySelector(".pr-dialogue");
    const confirm = layer.querySelector(".pr-confirm");
    dlg.textContent = ""; dlg.classList.remove("show");
    confirm.innerHTML = ""; confirm.classList.remove("show");
    layer.classList.remove("broken", "glitchout", "rescued");
    const old = layer.querySelector(".pr-blackout"); if (old) old.remove();
    img.src = P.portrait;
    layer.classList.add("show");                 // 立绘直接刷现,叠在所有 UI 最前(层透明,原界面保留)

    if (Math.random() < P.brokenChance) {        // 20% 先破碎 1s
      layer.classList.add("broken");
      setTimeout(() => layer.classList.remove("broken"), 1000);
    }

    if (cb.rescuer) { runRescue(); return; }

    // 时序:刷现 → 等 2s → 中央缓缓渐现台词 → 停 2s 看清 → 台词消失,渐现竖排红"好"
    const line = pickWeighted(P.lines);
    setTimeout(() => {
      dlg.textContent = line;
      dlg.classList.add("show");                 // 缓缓刷出
      setTimeout(() => {
        dlg.classList.remove("show");            // 台词消失
        setTimeout(showConfirmButtons, 600);     // 淡出后出按钮
      }, 2000);                                  // 停 2s 看清
    }, 2000);

    function showConfirmButtons() {
      for (let i = 0; i < P.confirmCount; i++) {
        const b = document.createElement("button");
        b.textContent = P.confirmLabel;
        b.onclick = endWithGlitch;
        confirm.appendChild(b);
      }
      requestAnimationFrame(() => confirm.classList.add("show"));  // 缓缓渐现
    }
    function endWithGlitch() {
      confirm.classList.remove("show");
      layer.classList.add("glitchout");
      const black = document.createElement("div");
      black.className = "pr-blackout";
      layer.appendChild(black);
      setTimeout(() => black.classList.add("on"), 300);
      setTimeout(() => cb.onRestart(), 300 + 2000);   // 黑屏 2s → reload
    }

    // 可露希尔救场:等 2s → 普瑞塞斯"等等…?" → 闪烁消失 → 可露希尔接管台词 → 交回专属题
    function runRescue() {
      const line = pickWeighted(P.lines);
      setTimeout(() => {
        dlg.textContent = line; dlg.classList.add("show");
        setTimeout(() => {
          dlg.classList.remove("show");
          setTimeout(() => {
            dlg.textContent = P.rescueLine; dlg.classList.add("show");   // "等等…?"
            setTimeout(() => blinkOut(layer, () => {
              layer.classList.add("rescued");
              img.src = `assets/portraits/${cb.rescuer.file}`;
              dlg.classList.remove("show");
              let i = 0;
              (function next() {
                if (i >= P.closureLines.length) {
                  // 收起普瑞塞斯层,交回普通 UI 出可露希尔专属题(两选项都是"我找到你了")
                  layer.classList.remove("show");
                  cb.onRescueSolo(cb.rescuer);
                  return;
                }
                dlg.textContent = P.closureLines[i++];
                dlg.classList.add("show");
                setTimeout(() => { dlg.classList.remove("show");
                  setTimeout(next, 500); }, 1600);
              })();
            }), 1400);
          }, 700);
        }, 1800);
      }, 2000);
    }
  }

  /* 底栏上拉手势 */
  (function bindPull() {
    const bar = $("#pull-bar");
    if (!bar) return;
    let y0 = null;
    bar.addEventListener("pointerdown", (e) => { y0 = e.clientY; });
    bar.addEventListener("pointerup", (e) => {
      if (y0 == null) return;
      const dy = y0 - e.clientY;
      y0 = null;
      if (dy >= 28) startReunion();
    });
  })();

  /* 全局点击/键盘推进 */
  document.addEventListener("click", (e) => {
    if (e.target.closest(".choice") || e.target.closest("button")) return;
    if (e.target.closest("#ending") || e.target.closest("#reunion-scene")) return;
    if (e.target.closest(".pull-bar")) return;
    advance();
  });
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); advance(); }
  });

  return { initScene, setBackground, setSilhouetteStage, renderNode,
           showEnding, showPrologueMeta, showPriestess,
           startReunion,
           openGlobal, closeGlobal, openCredit, closeCredit };
})();

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
