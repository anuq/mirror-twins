/*
 * Mirror Twins — browser front-end.
 * Chapter / level select, rendering, smooth animation, keyboard + touch input,
 * sound effects, and progression.
 * Rules live in engine.js; level data in levels.js; sounds in audio.js.
 */
(function () {
  "use strict";

  var E = window.ENGINE;
  var LEVELS = window.LEVELS;
  var CHAPTERS = window.CHAPTERS;
  var SFX = window.SFX;

  // DOM
  var canvas = document.getElementById("board");
  var ctx = canvas.getContext("2d");
  var levelLabel = document.getElementById("levelLabel");
  var hintEl = document.getElementById("hint");
  var overlay = document.getElementById("overlay");
  var overlayTitle = document.getElementById("overlayTitle");
  var overlaySub = document.getElementById("overlaySub");
  var menuEl = document.getElementById("menu");
  var chapterScreen = document.getElementById("chapterScreen");
  var chapterGrid = document.getElementById("chapterGrid");
  var continueBtn = document.getElementById("continueBtn");
  var levelScreen = document.getElementById("levelScreen");
  var levelScreenTitle = document.getElementById("levelScreenTitle");
  var chapterBlurb = document.getElementById("chapterBlurb");
  var gridEl = document.getElementById("levelGrid");
  var chaptersBackBtn = document.getElementById("chaptersBackBtn");
  var stageEl = document.getElementById("stage");
  var dpadEl = document.getElementById("dpad");
  var backBtn = document.getElementById("backBtn");
  var muteBtn = document.getElementById("muteBtn");
  var keyhints = document.getElementById("keyhints");

  var ANIM_MS = 110;
  var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  var isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);

  // ---- Chapter ranges (levels are stored grouped & ordered by chapter) ----
  var chapterRanges = (function () {
    var r = [];
    for (var i = 0; i < LEVELS.length; i++) {
      var c = LEVELS[i].chapter;
      if (!r[c]) r[c] = { start: i, end: i };
      else r[c].end = i;
    }
    return r;
  })();
  function chapterLen(c) { return chapterRanges[c].end - chapterRanges[c].start + 1; }
  function chapterDoneCount(c) {
    return Math.max(0, Math.min(progress.completed - chapterRanges[c].start, chapterLen(c)));
  }

  // ---- Progress (persisted) -----------------------------------------------
  var STORE = "mirrorTwins.progress.v1";
  var progress = readProgress();
  function readProgress() {
    try { var p = JSON.parse(localStorage.getItem(STORE)); if (p && typeof p.completed === "number") return p; } catch (e) {}
    return { completed: 0 };
  }
  function writeProgress() { try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch (e) {} }
  function nextPlayable() { return Math.min(progress.completed, LEVELS.length - 1); }
  function isUnlocked(i) { return i >= 0 && i < LEVELS.length && i <= progress.completed; }
  function chapterUnlocked(c) { return chapterRanges[c].start <= progress.completed; }
  function levelState(i) {
    if (i < progress.completed) return "done";
    if (i === progress.completed && i < LEVELS.length) return "open";
    return "locked";
  }
  function chapterState(c) {
    if (progress.completed > chapterRanges[c].end) return "done";
    if (chapterUnlocked(c)) return "open";
    return "locked";
  }
  function markCompleted(i) { if (i + 1 > progress.completed) { progress.completed = i + 1; writeProgress(); } }

  // ---- Runtime state ------------------------------------------------------
  var appMode = "chapters"; // "chapters" | "levels" | "play"
  var chapterSel = 0;
  var levelSel = 0;      // global index, while on the levels screen
  var levelIndex = 0;
  var level = null, sets = null, cell = 40;
  var logical = [], fromPos = [], toPos = [];
  var animStart = 0, animating = false, animating_dead = false;
  var mode = "play";    // "play" | "solved" | "dead" | "won"
  var shake = 0;

  function clone(arr) { return arr.map(function (p) { return { x: p.x, y: p.y }; }); }
  function menuCols() { return window.innerWidth <= 520 ? 4 : 5; }
  function chapterCols() { return window.innerWidth <= 520 ? 2 : 3; }

  // ---- Chapter screen -----------------------------------------------------
  function buildChapters() {
    chapterGrid.innerHTML = "";
    for (var c = 0; c < CHAPTERS.length; c++) {
      var b = document.createElement("button");
      b.className = "chapter";
      b.setAttribute("data-c", String(c));
      b.innerHTML =
        '<span class="lock">🔒</span>' +
        '<span class="cnum">Chapter ' + (c + 1) + '</span>' +
        '<span class="cname">' + CHAPTERS[c].name + '</span>' +
        '<span class="bar"><i></i></span>' +
        '<span class="cprog"></span>';
      b.addEventListener("click", function () { openChapter(parseInt(this.getAttribute("data-c"), 10)); });
      chapterGrid.appendChild(b);
    }
  }

  function refreshChapters() {
    chapterGrid.style.gridTemplateColumns = "repeat(" + chapterCols() + ", 1fr)";
    var tiles = chapterGrid.children;
    for (var c = 0; c < tiles.length; c++) {
      var st = chapterState(c);
      tiles[c].className = "chapter " + st + (c === chapterSel ? " sel" : "");
      tiles[c].disabled = (st === "locked");
      var done = chapterDoneCount(c), len = chapterLen(c);
      tiles[c].querySelector(".cprog").textContent = done + " / " + len + " cleared";
      tiles[c].querySelector(".bar > i").style.width = Math.round((done / len) * 100) + "%";
    }
    var inProgress = progress.completed > 0 && progress.completed < LEVELS.length;
    continueBtn.hidden = !inProgress;
  }

  function showChapters() {
    appMode = "chapters";
    mode = "play";
    menuEl.hidden = false;
    chapterScreen.hidden = false;
    levelScreen.hidden = true;
    stageEl.hidden = true;
    levelLabel.hidden = true;
    backBtn.hidden = true;
    dpadEl.hidden = true;
    hintEl.textContent = "";
    if (keyhints) keyhints.hidden = true;
    chapterSel = LEVELS[nextPlayable()].chapter;
    refreshChapters();
  }

  // ---- Levels screen ------------------------------------------------------
  function buildLevelGrid(c) {
    gridEl.innerHTML = "";
    gridEl.style.gridTemplateColumns = "repeat(" + menuCols() + ", 1fr)";
    var range = chapterRanges[c];
    for (var i = range.start; i <= range.end; i++) {
      var b = document.createElement("button");
      b.className = "tile";
      b.setAttribute("data-idx", String(i));
      b.innerHTML = '<span class="num">' + (i - range.start + 1) + '</span>' +
                    '<span class="nm">' + LEVELS[i].moves + ' moves</span>';
      b.addEventListener("click", function () { startLevel(parseInt(this.getAttribute("data-idx"), 10)); });
      gridEl.appendChild(b);
    }
  }

  function refreshLevels(c) {
    var range = chapterRanges[c];
    var tiles = gridEl.children;
    for (var k = 0; k < tiles.length; k++) {
      var i = range.start + k;
      var st = levelState(i);
      tiles[k].className = "tile " + st + (i === levelSel ? " sel" : "");
      tiles[k].disabled = (st === "locked");
    }
  }

  function openChapter(c) {
    if (!chapterUnlocked(c)) { SFX.blocked(); return; }
    SFX.select();
    appMode = "levels";
    chapterSel = c;
    levelSel = Math.min(Math.max(progress.completed, chapterRanges[c].start), chapterRanges[c].end);
    menuEl.hidden = false;
    chapterScreen.hidden = true;
    levelScreen.hidden = false;
    stageEl.hidden = true;
    levelLabel.hidden = true;
    backBtn.hidden = true;
    dpadEl.hidden = true;
    hintEl.textContent = "";
    if (keyhints) keyhints.hidden = true;
    levelScreenTitle.textContent = "Chapter " + (c + 1) + " · " + CHAPTERS[c].name;
    chapterBlurb.textContent = CHAPTERS[c].blurb;
    buildLevelGrid(c);
    refreshLevels(c);
  }

  function startLevel(i) {
    if (!isUnlocked(i)) { SFX.blocked(); return; }
    SFX.resume();
    SFX.select();
    appMode = "play";
    menuEl.hidden = true;
    stageEl.hidden = false;
    levelLabel.hidden = false;
    backBtn.hidden = false;
    if (keyhints) keyhints.hidden = false;
    if (isTouch) dpadEl.hidden = false;
    loadLevel(i);
  }

  function backToLevels() { openChapter(LEVELS[levelIndex].chapter); }

  // ---- Menu navigation ----------------------------------------------------
  function navigate(dir) {
    if (appMode === "chapters") chapterNav(dir);
    else if (appMode === "levels") levelNav(dir);
  }
  function chapterNav(dir) {
    var cols = chapterCols(), n = CHAPTERS.length, s = chapterSel;
    if (dir === "left") s -= 1; else if (dir === "right") s += 1;
    else if (dir === "up") s -= cols; else if (dir === "down") s += cols;
    if (s < 0 || s >= n) return;
    chapterSel = s; SFX.tick(); refreshChapters();
  }
  function levelNav(dir) {
    var cols = menuCols(), range = chapterRanges[chapterSel], len = chapterLen(chapterSel);
    var rel = levelSel - range.start;
    if (dir === "left") rel -= 1; else if (dir === "right") rel += 1;
    else if (dir === "up") rel -= cols; else if (dir === "down") rel += cols;
    if (rel < 0 || rel >= len) return;
    levelSel = range.start + rel; SFX.tick(); refreshLevels(chapterSel);
  }

  // ---- Level loading & sizing ---------------------------------------------
  function computeMaxBoard() {
    var w = Math.min(540, window.innerWidth - 36);
    var h = window.innerHeight - (isTouch ? 360 : 230);
    return Math.max(220, Math.min(w, h, 540));
  }
  function sizeCanvas() {
    var maxb = computeMaxBoard();
    cell = Math.floor(maxb / Math.max(level.w, level.h));
    var w = cell * level.w, h = cell * level.h;
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function loadLevel(i) {
    levelIndex = i;
    level = LEVELS[i];
    sets = E.buildSets(level);
    logical = E.startPositions(level);
    fromPos = clone(logical); toPos = clone(logical);
    animating = false; mode = "play"; shake = 0;
    sizeCanvas();
    var c = level.chapter, range = chapterRanges[c];
    levelLabel.textContent = CHAPTERS[c].name + "  ·  Level " + (i - range.start + 1) + " / " + chapterLen(c);
    hintEl.textContent = level.hint || "";
    hideOverlay();
    renderFrame(performance.now());
  }

  // ---- Move logic ---------------------------------------------------------
  function satisfiedCount(pos) {
    var c = 0;
    for (var i = 0; i < level.avatars.length; i++) {
      var g = level.avatars[i].goal;
      if (pos[i].x === g[0] && pos[i].y === g[1]) c++;
    }
    return c;
  }
  function samePositions(a, b) {
    for (var i = 0; i < a.length; i++) if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
    return true;
  }
  function tryMove(dir) {
    if (appMode !== "play" || mode !== "play" || animating) return;
    var res = E.resolveStep(level, logical, dir, sets);
    if (samePositions(res.positions, logical)) { SFX.blocked(); return; }
    var before = satisfiedCount(logical);
    fromPos = clone(logical); toPos = clone(res.positions); logical = res.positions;
    animStart = performance.now(); animating = true; animating_dead = res.dead;
    if (res.dead) { SFX.spike(); }
    else { SFX.move(); if (satisfiedCount(logical) > before && !E.isWon(level, logical)) SFX.lock(); }
    setTimeout(onAnimEnd, ANIM_MS);
  }
  function onAnimEnd() {
    if (!animating) return;
    animating = false;
    if (animating_dead) {
      mode = "dead"; shake = 1;
      showOverlay("Ouch — spikes!", "Resetting level…");
      setTimeout(function () { loadLevel(levelIndex); }, 720);
      return;
    }
    if (E.isWon(level, logical)) {
      markCompleted(levelIndex);
      if (levelIndex + 1 >= LEVELS.length) {
        mode = "won"; SFX.win();
        showOverlay("You Win! ✨", "All " + LEVELS.length + " levels complete! Press any key for the menu.");
      } else {
        mode = "solved"; SFX.solved();
        var nextC = LEVELS[levelIndex + 1].chapter;
        var msg = (nextC !== level.chapter)
          ? ("Chapter complete! Next: " + CHAPTERS[nextC].name)
          : "On to the next…";
        showOverlay("Solved!", msg);
        setTimeout(function () { loadLevel(levelIndex + 1); }, 850);
      }
    }
  }
  function showOverlay(title, sub) { overlayTitle.textContent = title; overlaySub.textContent = sub; overlay.hidden = false; }
  function hideOverlay() { overlay.hidden = true; }

  // ---- Input: keyboard ----------------------------------------------------
  var KEYMAP = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  window.addEventListener("keydown", function (ev) {
    SFX.resume();
    if (appMode !== "play") {
      var md = KEYMAP[ev.key];
      if (md) { ev.preventDefault(); navigate(md); return; }
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        if (appMode === "chapters") openChapter(chapterSel);
        else startLevel(levelSel);
        return;
      }
      if (ev.key === "Escape" && appMode === "levels") { ev.preventDefault(); showChapters(); return; }
      return;
    }
    // play mode
    if (ev.key === "Escape") { ev.preventDefault(); backToLevels(); return; }
    if (mode === "won") { ev.preventDefault(); showChapters(); return; }
    if (ev.key === "r" || ev.key === "R") { ev.preventDefault(); loadLevel(levelIndex); return; }
    var dir = KEYMAP[ev.key];
    if (!dir) return;
    ev.preventDefault();
    tryMove(dir);
  }, { passive: false });

  // ---- Input: D-pad -------------------------------------------------------
  dpadEl.addEventListener("click", function (ev) {
    var btn = ev.target.closest("button[data-dir]");
    if (!btn) return;
    SFX.resume();
    handleDir(btn.getAttribute("data-dir"));
  });
  function handleDir(dir) {
    if (appMode !== "play") { navigate(dir); return; }
    if (mode === "won") { showChapters(); return; }
    tryMove(dir);
  }

  // ---- Input: swipe on the board ------------------------------------------
  var sx = 0, sy = 0, swiping = false;
  stageEl.addEventListener("touchstart", function (ev) {
    SFX.resume(); var t = ev.changedTouches[0]; sx = t.clientX; sy = t.clientY; swiping = true;
  }, { passive: true });
  stageEl.addEventListener("touchmove", function (ev) { if (swiping) ev.preventDefault(); }, { passive: false });
  stageEl.addEventListener("touchend", function (ev) {
    if (!swiping) return; swiping = false;
    var t = ev.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < 24) return;
    handleDir(ax > ay ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  }, { passive: true });

  // ---- Buttons ------------------------------------------------------------
  backBtn.addEventListener("click", function () { SFX.select(); backToLevels(); });
  chaptersBackBtn.addEventListener("click", function () { SFX.select(); showChapters(); });
  continueBtn.addEventListener("click", function () { startLevel(nextPlayable()); });
  function updateMuteBtn() { muteBtn.textContent = SFX.isMuted() ? "🔇" : "🔊"; }
  muteBtn.addEventListener("click", function () { SFX.toggleMute(); updateMuteBtn(); });
  updateMuteBtn();

  window.addEventListener("resize", function () {
    if (appMode === "play" && level) { sizeCanvas(); renderFrame(performance.now()); }
    else if (appMode === "chapters") refreshChapters();
    else if (appMode === "levels") { buildLevelGrid(chapterSel); refreshLevels(chapterSel); }
  });

  // ---- Rendering ----------------------------------------------------------
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function loop(now) { renderFrame(now); requestAnimationFrame(loop); }
  function renderFrame(now) {
    if (!level || appMode !== "play") return;
    var t = 1;
    if (animating) { t = (now - animStart) / ANIM_MS; if (t >= 1) t = 1; }
    var e = easeOutCubic(t);
    var ox = 0, oy = 0;
    if (mode === "dead" && shake > 0) {
      ox = (Math.random() - 0.5) * 8 * shake; oy = (Math.random() - 0.5) * 8 * shake; shake *= 0.9;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(ox, oy);
    drawGrid(); drawWalls(); drawHazards(); drawGoals();
    for (var i = 0; i < level.avatars.length; i++) {
      var fx = fromPos[i].x + (toPos[i].x - fromPos[i].x) * e;
      var fy = fromPos[i].y + (toPos[i].y - fromPos[i].y) * e;
      drawAvatar(fx, fy, level.avatars[i].color);
    }
    ctx.restore();
  }
  function drawGrid() {
    ctx.strokeStyle = getCss("--grid"); ctx.lineWidth = 1;
    for (var x = 0; x <= level.w; x++) line(x * cell, 0, x * cell, level.h * cell);
    for (var y = 0; y <= level.h; y++) line(0, y * cell, level.w * cell, y * cell);
  }
  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
    ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
    ctx.stroke();
  }
  function drawWalls() {
    ctx.fillStyle = getCss("--wall");
    (level.walls || []).forEach(function (c) { roundRect(c[0] * cell + 2, c[1] * cell + 2, cell - 4, cell - 4, 6); ctx.fill(); });
  }
  function drawHazards() {
    (level.hazards || []).forEach(function (c) {
      var cx = c[0] * cell + cell / 2, cy = c[1] * cell + cell / 2, r = cell * 0.34;
      ctx.save(); ctx.translate(cx, cy);
      ctx.fillStyle = "#ef4444"; ctx.shadowColor = "rgba(239,68,68,0.6)"; ctx.shadowBlur = 10;
      ctx.beginPath();
      var spikes = 8;
      for (var k = 0; k < spikes * 2; k++) {
        var ang = (Math.PI / spikes) * k - Math.PI / 2;
        var rad = (k % 2 === 0) ? r : r * 0.5;
        var px = Math.cos(ang) * rad, py = Math.sin(ang) * rad;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.restore();
    });
  }
  function drawGoals() {
    for (var i = 0; i < level.avatars.length; i++) {
      var a = level.avatars[i];
      var cx = a.goal[0] * cell + cell / 2, cy = a.goal[1] * cell + cell / 2;
      var occupied = logical[i].x === a.goal[0] && logical[i].y === a.goal[1];
      ctx.save();
      ctx.strokeStyle = a.color; ctx.lineWidth = occupied ? 4 : 3;
      ctx.shadowColor = a.color; ctx.shadowBlur = occupied ? 18 : 9;
      ctx.globalAlpha = occupied ? 1 : 0.85;
      ctx.beginPath(); ctx.arc(cx, cy, cell * 0.30, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
  function drawAvatar(cellX, cellY, color) {
    var x = cellX * cell + cell * 0.16, y = cellY * cell + cell * 0.16, s = cell * 0.68;
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.fillStyle = color;
    roundRect(x, y, s, s, Math.max(4, cell * 0.16)); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,255,255,0.28)";
    roundRect(x + s * 0.18, y + s * 0.14, s * 0.4, s * 0.22, 4); ctx.fill();
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  var cssCache = {};
  function getCss(name) {
    if (cssCache[name]) return cssCache[name];
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    cssCache[name] = v || "#888"; return cssCache[name];
  }

  // ---- Boot ---------------------------------------------------------------
  buildChapters();
  showChapters();
  requestAnimationFrame(loop);
})();
