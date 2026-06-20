/*
 * Mirror Twins — level generator (dev tool).
 *
 * Procedurally generates candidate levels per chapter, then KEEPS only ones
 * that the BFS solver proves solvable, that land in the chapter's difficulty
 * band, AND that satisfy per-bucket QUALITY constraints so every chapter
 * actually delivers its theme:
 *   - requireSpecial:   at least N twins use a non-"normal" (mirror/rotation)
 *                       transform — so "Reflections" really has reflections.
 *   - requireWallLB:    walls are load-bearing (removing them changes the
 *                       minimum solution or makes it unsolvable).
 *   - requireHazardLB:  spikes force a detour (removing them shortens the
 *                       solution), so spikes are never pointless.
 *   - requireObstacleLB: a wall OR a spike is load-bearing.
 *
 * Every shipped level is therefore solvable AND non-degenerate, using the
 * exact same engine the game runs.
 *
 * Run: node generate.js   (overwrites levels.js)   then: node verify.js
 * Deterministic: a fixed RNG seed means re-running produces the same set.
 */

var fs = require("fs");
var E = require("./engine.js");

// ---- Seeded RNG (mulberry32) --------------------------------------------
var SEED = 20260620;
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
var rng = mulberry32(SEED);
function ri(n) { return Math.floor(rng() * n); }
function rint(lo, hi) { return lo + ri(hi - lo + 1); }
function pick(arr) { return arr[ri(arr.length)]; }

// ---- BFS solver: minimum solution length, with a state cap --------------
var DIRS = ["up", "down", "left", "right"];
function keyOf(ps) { return ps.map(function (p) { return p.x + "," + p.y; }).join("|"); }
var CAP = 200000;

function minMoves(level) {
  var sets = E.buildSets(level);
  var start = E.startPositions(level);
  if (E.isWon(level, start)) return 0;
  var seen = new Set([keyOf(start)]);
  var q = [start], depth = [0], head = 0;
  while (head < q.length) {
    if (seen.size > CAP) return -2; // too complex, treat as reject
    var pos = q[head], d = depth[head]; head++;
    for (var i = 0; i < 4; i++) {
      var r = E.resolveStep(level, pos, DIRS[i], sets);
      if (r.dead) continue;
      var k = keyOf(r.positions);
      if (seen.has(k)) continue;
      if (E.isWon(level, r.positions)) return d + 1;
      seen.add(k); q.push(r.positions); depth.push(d + 1);
    }
  }
  return -1; // unsolvable
}

// ---- Candidate generation -----------------------------------------------
var PALETTE = ["#22d3ee", "#f472b6", "#fbbf24", "#a3e635"];

function genCandidate(b) {
  var w = rint(b.w[0], b.w[1]);
  var h = rint(b.h[0], b.h[1]);
  var area = w * h;
  var twins = b.twins;
  var nWall = rint(b.walls[0], b.walls[1]);
  var nHaz = rint(b.haz[0], b.haz[1]);
  if (twins * 2 + nWall + nHaz > area * 0.7) return null;

  var occupied = {};
  function take() {
    for (var t = 0; t < 200; t++) {
      var x = ri(w), y = ri(h), k = x + "," + y;
      if (!occupied[k]) { occupied[k] = true; return [x, y]; }
    }
    return null;
  }

  var walls = [], hazards = [], avatars = [];
  for (var i = 0; i < nWall; i++) { var c = take(); if (!c) return null; walls.push(c); }
  for (var j = 0; j < nHaz; j++) { var hc = take(); if (!hc) return null; hazards.push(hc); }
  var starts = [], goals = [];
  for (var s = 0; s < twins; s++) { var sc = take(); if (!sc) return null; starts.push(sc); }
  for (var g = 0; g < twins; g++) { var gc = take(); if (!gc) return null; goals.push(gc); }
  for (var a = 0; a < twins; a++) {
    avatars.push({
      start: starts[a], goal: goals[a], color: PALETTE[a],
      transform: twins === 1 ? "normal" : pick(b.transforms),
    });
  }
  return { w: w, h: h, walls: walls, hazards: hazards, avatars: avatars };
}

function specialsCount(L) {
  return L.avatars.filter(function (a) { return a.transform !== "normal"; }).length;
}
function without(L, field) {
  var c = { w: L.w, h: L.h, walls: L.walls, hazards: L.hazards, avatars: L.avatars };
  c[field] = [];
  return c;
}

// Quality gate for a solvable candidate with known min-move count.
function passesQuality(L, b, moves) {
  if (b.requireSpecial && specialsCount(L) < b.requireSpecial) return false;
  if (b.requireWallLB) {
    if (!L.walls.length) return false;
    var m = minMoves(without(L, "walls"));
    if (!(m === -1 || m !== moves)) return false; // walls must matter
  }
  if (b.requireHazardLB) {
    if (!L.hazards.length) return false;
    var mh = minMoves(without(L, "hazards"));
    if (!(mh >= 0 && mh < moves)) return false; // spike must force a detour
  }
  if (b.requireObstacleLB) {
    var wLB = L.walls.length && (function () { var m = minMoves(without(L, "walls")); return m === -1 || m !== moves; })();
    var hLB = L.hazards.length && (function () { var m = minMoves(without(L, "hazards")); return m >= 0 && m < moves; })();
    if (!wLB && !hLB) return false;
  }
  return true;
}

function signature(L) {
  function sc(list) { return list.map(function (c) { return c[0] + "," + c[1]; }).sort().join(";"); }
  var av = L.avatars.map(function (a) { return a.start.join(",") + ">" + a.goal.join(",") + ":" + a.transform; }).sort().join("|");
  return L.w + "x" + L.h + "#" + sc(L.walls) + "#" + sc(L.hazards) + "#" + av;
}

// ---- Chapters & buckets -------------------------------------------------
var CHAPTERS = [
  { name: "First Steps", blurb: "Guide each twin onto its own matching ring." },
  { name: "Reflections", blurb: "Mirror twins flip your moves — watch which way each one goes." },
  { name: "Blocking Walls", blurb: "Walls stop one twin while the others keep moving. Use them." },
  { name: "Spikes", blurb: "Spikes reset the level. Route every twin safely around them." },
  { name: "Mastery", blurb: "Everything at once: mirrors, rotations, walls and spikes." },
];

var ALLMIRROR = ["normal", "mirrorX", "mirrorY", "mirrorXY"];
var ALLT = ["normal", "mirrorX", "mirrorY", "mirrorXY", "rot90", "rot270"];

// Each chapter is one or more buckets, concatenated (in order) and sorted by
// difficulty within each bucket — giving a smooth ramp.
var CHAPTER_BUCKETS = [
  [ // 1 — First Steps: a tiny tutorial, then introduce a mirror twin.
    //     No walls/spikes — keep it purely about movement + reflection.
    { twins: 1, count: 2, w: [4, 5], h: [4, 5], walls: [0, 0], haz: [0, 0], transforms: ["normal"], band: [3, 6] },
    { twins: 2, count: 8, w: [5, 6], h: [4, 6], walls: [0, 0], haz: [0, 0], transforms: ["normal", "mirrorX"], band: [4, 10], requireSpecial: 1 },
  ],
  [ // 2 — Reflections: both twins are mirrors, open grids (walls arrive in ch.3)
    { twins: 2, count: 10, w: [5, 6], h: [5, 6], walls: [0, 0], haz: [0, 0], transforms: ["mirrorX", "mirrorY", "mirrorXY"], band: [6, 13], requireSpecial: 2 },
  ],
  [ // 3 — Blocking Walls: walls must be load-bearing
    { twins: 2, count: 10, w: [5, 7], h: [5, 7], walls: [2, 6], haz: [0, 0], transforms: ALLMIRROR, band: [7, 18], requireSpecial: 1, requireWallLB: true },
  ],
  [ // 4 — Spikes: a spike must force a detour
    { twins: 2, count: 10, w: [5, 7], h: [5, 7], walls: [0, 3], haz: [1, 4], transforms: ALLMIRROR, band: [7, 18], requireSpecial: 1, requireHazardLB: true },
  ],
  [ // 5 — Mastery: mirrors+rotations with load-bearing obstacles, then 3 twins
    { twins: 2, count: 5, w: [5, 7], h: [5, 7], walls: [1, 4], haz: [0, 2], transforms: ALLT, band: [9, 22], requireSpecial: 1, requireObstacleLB: true },
    { twins: 3, count: 5, w: [6, 7], h: [6, 7], walls: [0, 3], haz: [0, 2], transforms: ALLT, band: [11, 26], requireSpecial: 2 },
  ],
];

// ---- Build ---------------------------------------------------------------
var seen = {};
var allLevels = [];
var MAX_ATTEMPTS = 1500000;

for (var c = 0; c < CHAPTER_BUCKETS.length; c++) {
  var chapterLevels = [];
  var buckets = CHAPTER_BUCKETS[c];
  for (var bi = 0; bi < buckets.length; bi++) {
    var b = buckets[bi];
    var kept = [];
    var attempts = 0;
    while (kept.length < b.count && attempts < MAX_ATTEMPTS) {
      attempts++;
      var cand = genCandidate(b);
      if (!cand) continue;
      var sig = signature(cand);
      if (seen[sig]) continue;
      var moves = minMoves(cand);
      if (moves < b.band[0] || moves > b.band[1]) continue;
      if (!passesQuality(cand, b, moves)) continue;
      seen[sig] = true;
      cand.moves = moves;
      kept.push(cand);
    }
    kept.sort(function (a, b2) { return a.moves - b2.moves; });
    chapterLevels = chapterLevels.concat(kept);
    if (kept.length < b.count) {
      console.log("  !! Chapter " + (c + 1) + " bucket " + (bi + 1) + " only found " +
        kept.length + "/" + b.count + " after " + attempts + " attempts");
    }
  }
  for (var i = 0; i < chapterLevels.length; i++) {
    var L = chapterLevels[i];
    L.chapter = c;
    L.name = CHAPTERS[c].name + " " + (i + 1);
    L.hint = CHAPTERS[c].blurb;
    allLevels.push(L);
  }
  console.log("Chapter " + (c + 1) + " " + CHAPTERS[c].name + ": " + chapterLevels.length +
    " levels (moves " + chapterLevels[0].moves + "-" + chapterLevels[chapterLevels.length - 1].moves + ")");
}

// ---- Emit levels.js ------------------------------------------------------
function fmtCells(list) { return "[" + list.map(function (c) { return "[" + c[0] + "," + c[1] + "]"; }).join(", ") + "]"; }
function fmtLevel(L) {
  var lines = [];
  lines.push("  {");
  lines.push("    name: " + JSON.stringify(L.name) + ", chapter: " + L.chapter + ", moves: " + L.moves + ",");
  lines.push("    hint: " + JSON.stringify(L.hint) + ",");
  lines.push("    w: " + L.w + ", h: " + L.h + ", walls: " + fmtCells(L.walls) + ", hazards: " + fmtCells(L.hazards) + ",");
  lines.push("    avatars: [");
  L.avatars.forEach(function (a) {
    lines.push("      { start: [" + a.start[0] + "," + a.start[1] + "], goal: [" + a.goal[0] + "," + a.goal[1] +
      "], color: " + JSON.stringify(a.color) + ", transform: " + JSON.stringify(a.transform) + " },");
  });
  lines.push("    ],");
  lines.push("  },");
  return lines.join("\n");
}

var out = [];
out.push("/*");
out.push(" * Mirror Twins — level data. GENERATED by generate.js — do not edit by hand.");
out.push(" * " + allLevels.length + " levels across " + CHAPTERS.length + " chapters; every one is BFS-verified solvable.");
out.push(" * Regenerate with: node generate.js   (then: node verify.js)");
out.push(" */");
out.push("");
out.push("var CHAPTERS = " + JSON.stringify(CHAPTERS, null, 2) + ";");
out.push("");
out.push("var LEVELS = [");
out.push(allLevels.map(fmtLevel).join("\n"));
out.push("];");
out.push("");
out.push("if (typeof module !== \"undefined\" && module.exports) module.exports = { LEVELS: LEVELS, CHAPTERS: CHAPTERS };");
out.push("if (typeof window !== \"undefined\") { window.LEVELS = LEVELS; window.CHAPTERS = CHAPTERS; }");
out.push("");

fs.writeFileSync(__dirname + "/levels.js", out.join("\n"));
console.log("\nWrote levels.js with " + allLevels.length + " levels.");
