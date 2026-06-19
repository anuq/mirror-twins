/*
 * Mirror Twins — level generator (dev tool).
 *
 * Procedurally generates candidate levels per chapter, then KEEPS only the
 * ones the BFS solver proves are solvable AND whose minimum solution length
 * falls inside that chapter's difficulty band. Every shipped level is
 * therefore guaranteed solvable, using the exact same engine the game runs.
 *
 * Run: node generate.js   (overwrites levels.js)
 *
 * Deterministic: a fixed RNG seed means re-running produces the same set,
 * so levels.js only changes when this generator changes.
 */

var fs = require("fs");
var E = require("./engine.js");

// ---- Seeded RNG (mulberry32) so output is reproducible ------------------
var SEED = 1337;
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

// ---- BFS solver with a state cap ----------------------------------------
var DIRS = ["up", "down", "left", "right"];
function keyOf(ps) { return ps.map(function (p) { return p.x + "," + p.y; }).join("|"); }

function solve(level, cap) {
  var sets = E.buildSets(level);
  var start = E.startPositions(level);
  if (E.isWon(level, start)) return { ok: false }; // already solved = trivial, reject
  var seen = new Set([keyOf(start)]);
  var q = [start], depth = [0], head = 0;
  while (head < q.length) {
    if (seen.size > cap) return { ok: false, capped: true };
    var pos = q[head], d = depth[head]; head++;
    for (var i = 0; i < 4; i++) {
      var r = E.resolveStep(level, pos, DIRS[i], sets);
      if (r.dead) continue;
      var k = keyOf(r.positions);
      if (seen.has(k)) continue;
      if (E.isWon(level, r.positions)) return { ok: true, moves: d + 1 };
      seen.add(k);
      q.push(r.positions);
      depth.push(d + 1);
    }
  }
  return { ok: false };
}

// ---- Candidate generation -----------------------------------------------
var PALETTE = ["#22d3ee", "#f472b6", "#fbbf24", "#a3e635"];

function genCandidate(spec) {
  var w = rint(spec.w[0], spec.w[1]);
  var h = rint(spec.h[0], spec.h[1]);
  var area = w * h;
  var twins = pick(spec.twins);
  var nWall = rint(spec.walls[0], spec.walls[1]);
  var nHaz = rint(spec.haz[0], spec.haz[1]);
  if (twins * 2 + nWall + nHaz > area * 0.7) return null; // too crowded

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
      start: starts[a],
      goal: goals[a],
      color: PALETTE[a],
      transform: twins === 1 ? "normal" : pick(spec.transforms),
    });
  }
  return { w: w, h: h, walls: walls, hazards: hazards, avatars: avatars };
}

function signature(L) {
  function sc(list) { return list.map(function (c) { return c[0] + "," + c[1]; }).sort().join(";"); }
  var av = L.avatars.map(function (a) {
    return a.start.join(",") + ">" + a.goal.join(",") + ":" + a.transform;
  }).sort().join("|");
  return L.w + "x" + L.h + "#" + sc(L.walls) + "#" + sc(L.hazards) + "#" + av;
}

// ---- Chapter specs ------------------------------------------------------
var CAP = 200000; // BFS state cap per candidate
var CHAPTERS = [
  { name: "First Steps", blurb: "Guide each twin onto its own matching ring." },
  { name: "Reflections", blurb: "Mirror twins flip your moves — watch which way each one goes." },
  { name: "Blocking Walls", blurb: "Walls stop one twin while the others keep moving. Use them." },
  { name: "Spikes", blurb: "Spikes reset the level. Route every twin safely around them." },
  { name: "Mastery", blurb: "Everything at once: mirrors, rotations, walls and spikes." },
];
var SPECS = [
  { twins: [1, 1, 2], w: [4, 5], h: [4, 5], walls: [0, 0], haz: [0, 0],
    transforms: ["normal", "mirrorX"], band: [3, 9], count: 10 },
  { twins: [2], w: [5, 6], h: [5, 6], walls: [0, 2], haz: [0, 0],
    transforms: ["normal", "mirrorX", "mirrorY", "mirrorXY"], band: [5, 12], count: 10 },
  { twins: [2], w: [5, 7], h: [5, 7], walls: [3, 7], haz: [0, 0],
    transforms: ["normal", "mirrorX", "mirrorY", "mirrorXY"], band: [7, 17], count: 10 },
  { twins: [2], w: [5, 7], h: [5, 7], walls: [0, 3], haz: [1, 4],
    transforms: ["normal", "mirrorX", "mirrorY", "mirrorXY"], band: [7, 17], count: 10 },
  { twins: [2, 2, 3], w: [5, 7], h: [5, 7], walls: [0, 4], haz: [0, 3],
    transforms: ["normal", "mirrorX", "mirrorY", "mirrorXY", "rot90", "rot270"], band: [9, 26], count: 10 },
];

// ---- Build ---------------------------------------------------------------
var seen = {};
var allLevels = [];
var MAX_ATTEMPTS = 400000;

for (var c = 0; c < SPECS.length; c++) {
  var spec = SPECS[c];
  var kept = [];
  var attempts = 0;
  while (kept.length < spec.count && attempts < MAX_ATTEMPTS) {
    attempts++;
    var cand = genCandidate(spec);
    if (!cand) continue;
    var sig = signature(cand);
    if (seen[sig]) continue;
    var res = solve(cand, CAP);
    if (!res.ok) continue;
    if (res.moves < spec.band[0] || res.moves > spec.band[1]) continue;
    seen[sig] = true;
    cand.moves = res.moves;
    kept.push(cand);
  }
  kept.sort(function (a, b) { return a.moves - b.moves; });
  for (var i = 0; i < kept.length; i++) {
    var L = kept[i];
    L.chapter = c;
    L.name = CHAPTERS[c].name + " " + (i + 1);
    L.hint = CHAPTERS[c].blurb;
    allLevels.push(L);
  }
  console.log("Chapter " + (c + 1) + " " + CHAPTERS[c].name + ": kept " +
    kept.length + "/" + spec.count + " (attempts " + attempts + ", moves " +
    (kept.length ? kept[0].moves + "-" + kept[kept.length - 1].moves : "-") + ")");
}

// ---- Emit levels.js ------------------------------------------------------
function fmtCells(list) {
  return "[" + list.map(function (c) { return "[" + c[0] + "," + c[1] + "]"; }).join(", ") + "]";
}
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
out.push("var CHAPTERS = " + JSON.stringify(CHAPTERS, null, 2).replace(/\n/g, "\n") + ";");
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
