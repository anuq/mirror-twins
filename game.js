/*
 * Mirror Twins — browser front-end.
 * Rendering, smooth animation, arrow-key input, and level progression.
 * All rules live in engine.js; level data in levels.js.
 */
(function () {
  "use strict";

  var E = window.ENGINE;
  var LEVELS = window.LEVELS;

  var canvas = document.getElementById("board");
  var ctx = canvas.getContext("2d");
  var levelLabel = document.getElementById("levelLabel");
  var hintEl = document.getElementById("hint");
  var overlay = document.getElementById("overlay");
  var overlayTitle = document.getElementById("overlayTitle");
  var overlaySub = document.getElementById("overlaySub");

  var MAX_BOARD = 540;   // max board pixels (longest side)
  var ANIM_MS = 110;     // per-step movement animation

  var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

  // ---- Runtime state -------------------------------------------------------
  var levelIndex = 0;
  var level = null;
  var sets = null;
  var cell = 40;
  var logical = [];      // [{x,y}] logical cell positions
  var fromPos = [];      // animation start (in cells)
  var toPos = [];        // animation end (in cells)
  var animStart = 0;
  var animating = false;
  var mode = "play";     // "play" | "solved" | "dead" | "won"
  var shake = 0;         // dead-shake intensity

  function loadLevel(i) {
    levelIndex = i;
    level = LEVELS[i];
    sets = E.buildSets(level);
    logical = E.startPositions(level);
    fromPos = clone(logical);
    toPos = clone(logical);
    animating = false;
    mode = "play";
    shake = 0;

    cell = Math.floor(MAX_BOARD / Math.max(level.w, level.h));
    var w = cell * level.w, h = cell * level.h;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    levelLabel.textContent = "Level " + (i + 1) + " / " + LEVELS.length + " — " + level.name;
    hintEl.textContent = level.hint || "";
    hideOverlay();
    renderFrame(performance.now()); // paint immediately, don't wait for first rAF
  }

  function clone(arr) { return arr.map(function (p) { return { x: p.x, y: p.y }; }); }

  // ---- Input ---------------------------------------------------------------
  var KEYMAP = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  };

  window.addEventListener("keydown", function (ev) {
    if (ev.key === "r" || ev.key === "R") {
      ev.preventDefault();
      if (mode === "won") loadLevel(0); else loadLevel(levelIndex);
      return;
    }

    var dir = KEYMAP[ev.key];
    if (!dir) return;
    ev.preventDefault();

    if (mode === "won") { loadLevel(0); return; }
    if (mode !== "play" || animating) return;

    var res = E.resolveStep(level, logical, dir, sets);

    // Nothing moved? ignore (no animation, no state change).
    if (samePositions(res.positions, logical)) return;

    fromPos = clone(logical);
    toPos = clone(res.positions);
    logical = res.positions;
    animStart = performance.now();
    animating = true;
    animating_dead = res.dead;
    // Step completion is driven by a timer, not the render loop, so it still
    // fires if the tab is backgrounded (rAF can be paused/throttled there).
    setTimeout(onAnimEnd, ANIM_MS);
  }, { passive: false });

  var animating_dead = false;

  function samePositions(a, b) {
    for (var i = 0; i < a.length; i++) {
      if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
    }
    return true;
  }

  // ---- Step resolution callbacks ------------------------------------------
  function onAnimEnd() {
    if (!animating) return; // guard against any double-fire
    animating = false;
    if (animating_dead) {
      mode = "dead";
      shake = 1;
      showOverlay("Ouch — spikes!", "Resetting level…");
      setTimeout(function () { loadLevel(levelIndex); }, 720);
      return;
    }
    if (E.isWon(level, logical)) {
      if (levelIndex + 1 >= LEVELS.length) {
        mode = "won";
        showOverlay("You Win! ✨", "All twins reunited. Press any arrow to play again.");
      } else {
        mode = "solved";
        showOverlay("Solved!", "Level " + (levelIndex + 2) + " coming up…");
        setTimeout(function () { loadLevel(levelIndex + 1); }, 850);
      }
    }
  }

  function showOverlay(title, sub) {
    overlayTitle.textContent = title;
    overlaySub.textContent = sub;
    overlay.hidden = false;
  }
  function hideOverlay() { overlay.hidden = true; }

  // ---- Rendering -----------------------------------------------------------
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function loop(now) {
    renderFrame(now);
    requestAnimationFrame(loop);
  }

  function renderFrame(now) {
    var t = 1;
    if (animating) {
      t = (now - animStart) / ANIM_MS;
      if (t >= 1) { t = 1; }
    }
    var e = easeOutCubic(t);

    var ox = 0, oy = 0;
    if (mode === "dead" && shake > 0) {
      ox = (Math.random() - 0.5) * 8 * shake;
      oy = (Math.random() - 0.5) * 8 * shake;
      shake *= 0.9;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(ox, oy);

    drawGrid();
    drawWalls();
    drawHazards();
    drawGoals();

    // avatars (interpolated)
    for (var i = 0; i < level.avatars.length; i++) {
      var fx = fromPos[i].x + (toPos[i].x - fromPos[i].x) * e;
      var fy = fromPos[i].y + (toPos[i].y - fromPos[i].y) * e;
      drawAvatar(fx, fy, level.avatars[i].color);
    }

    ctx.restore();
  }

  function drawGrid() {
    ctx.strokeStyle = getCss("--grid");
    ctx.lineWidth = 1;
    for (var x = 0; x <= level.w; x++) {
      line(x * cell, 0, x * cell, level.h * cell);
    }
    for (var y = 0; y <= level.h; y++) {
      line(0, y * cell, level.w * cell, y * cell);
    }
  }

  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
    ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
    ctx.stroke();
  }

  function drawWalls() {
    ctx.fillStyle = getCss("--wall");
    (level.walls || []).forEach(function (c) {
      roundRect(c[0] * cell + 2, c[1] * cell + 2, cell - 4, cell - 4, 6);
      ctx.fill();
    });
  }

  function drawHazards() {
    (level.hazards || []).forEach(function (c) {
      var cx = c[0] * cell + cell / 2;
      var cy = c[1] * cell + cell / 2;
      var r = cell * 0.34;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = "#ef4444";
      ctx.shadowColor = "rgba(239,68,68,0.6)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      var spikes = 8;
      for (var k = 0; k < spikes * 2; k++) {
        var ang = (Math.PI / spikes) * k - Math.PI / 2;
        var rad = (k % 2 === 0) ? r : r * 0.5;
        var px = Math.cos(ang) * rad, py = Math.sin(ang) * rad;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  function drawGoals() {
    for (var i = 0; i < level.avatars.length; i++) {
      var a = level.avatars[i];
      var cx = a.goal[0] * cell + cell / 2;
      var cy = a.goal[1] * cell + cell / 2;
      var occupied = logical[i].x === a.goal[0] && logical[i].y === a.goal[1];
      ctx.save();
      ctx.strokeStyle = a.color;
      ctx.lineWidth = occupied ? 4 : 3;
      ctx.shadowColor = a.color;
      ctx.shadowBlur = occupied ? 18 : 9;
      ctx.globalAlpha = occupied ? 1 : 0.85;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawAvatar(cellX, cellY, color) {
    var x = cellX * cell + cell * 0.16;
    var y = cellY * cell + cell * 0.16;
    var s = cell * 0.68;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    roundRect(x, y, s, s, Math.max(4, cell * 0.16));
    ctx.fill();
    // inner highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    roundRect(x + s * 0.18, y + s * 0.14, s * 0.4, s * 0.22, 4);
    ctx.fill();
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
    cssCache[name] = v || "#888";
    return cssCache[name];
  }

  // ---- Boot ----------------------------------------------------------------
  loadLevel(0);
  requestAnimationFrame(loop);
})();
