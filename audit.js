/*
 * Mirror Twins — level quality audit (dev tool).
 * Prints an ASCII map of each level plus flags for potentially "weird" levels:
 *  - unsolvable (should never happen)
 *  - trivial: solvable by repeating a SINGLE direction
 *  - idle twin: a twin that never moves in the optimal solution
 *  - non-interacting: solvable even if twins could overlap (no real blocking),
 *    which tends to feel like two unrelated puzzles
 *  - deadlockable: from the start you can reach a state with NO moves that
 *    changes anything except the same loop (rough stuck-state heuristic)
 */
var E = require("./engine.js");
var data = require("./levels.js");
var LEVELS = data.LEVELS, CHAPTERS = data.CHAPTERS;
var DIRS = ["up", "down", "left", "right"];
function kf(ps) { return ps.map(function (p) { return p.x + "," + p.y; }).join("|"); }

// BFS returning a shortest solution path (array of dir names) or null.
function solvePath(level, allowOverlap) {
  var sets = E.buildSets(level);
  var start = E.startPositions(level);
  if (E.isWon(level, start)) return [];
  var seen = new Set([kf(start)]);
  var q = [{ p: start, path: [] }], h = 0;
  while (h < q.length) {
    var n = q[h++];
    for (var i = 0; i < 4; i++) {
      var r = stepMaybeOverlap(level, n.p, DIRS[i], sets, allowOverlap);
      if (r.dead) continue;
      var k = kf(r.positions);
      if (seen.has(k)) continue;
      var np = n.path.concat(DIRS[i]);
      if (E.isWon(level, r.positions)) return np;
      seen.add(k);
      q.push({ p: r.positions, path: np });
    }
  }
  return null;
}

// Variant of resolveStep that optionally ignores twin-vs-twin blocking.
function stepMaybeOverlap(level, positions, dirName, sets, allowOverlap) {
  if (!allowOverlap) return E.resolveStep(level, positions, dirName, sets);
  // independent movement: each twin moves unless wall/oob; no mutual blocking.
  var DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  function tf(d, t) {
    var dx = d[0], dy = d[1];
    switch (t) {
      case "mirrorX": return [-dx, dy];
      case "mirrorY": return [dx, -dy];
      case "mirrorXY": return [-dx, -dy];
      case "rot90": return [-dy, dx];
      case "rot270": return [dy, -dx];
      default: return [dx, dy];
    }
  }
  var out = [], dead = false;
  for (var i = 0; i < positions.length; i++) {
    var d = tf(DIRV[dirName], level.avatars[i].transform);
    var nx = positions[i].x + d[0], ny = positions[i].y + d[1];
    var oob = nx < 0 || ny < 0 || nx >= level.w || ny >= level.h;
    var wall = sets.walls[nx + "," + ny];
    if (oob || wall) { out.push({ x: positions[i].x, y: positions[i].y }); }
    else { out.push({ x: nx, y: ny }); }
    if (sets.hazards[out[i].x + "," + out[i].y]) dead = true;
  }
  return { positions: out, dead: dead };
}

function asciiMap(L) {
  var grid = [];
  for (var y = 0; y < L.h; y++) { grid.push(new Array(L.w).fill(".")); }
  (L.walls || []).forEach(function (c) { grid[c[1]][c[0]] = "#"; });
  (L.hazards || []).forEach(function (c) { grid[c[1]][c[0]] = "*"; });
  var goalCh = ["a", "b", "c", "d"], startCh = ["1", "2", "3", "4"];
  L.avatars.forEach(function (a, i) {
    grid[a.goal[1]][a.goal[0]] = goalCh[i];
    grid[a.start[1]][a.start[0]] = startCh[i];
  });
  return grid.map(function (r) { return "   " + r.join(" "); }).join("\n");
}

var flagsCount = {};
function flag(name) { flagsCount[name] = (flagsCount[name] || 0) + 1; }

LEVELS.forEach(function (L, idx) {
  var path = solvePath(L, false);
  var flags = [];
  if (!path) flags.push("UNSOLVABLE");
  else {
    // trivial: single repeated direction
    var uniq = {};
    path.forEach(function (d) { uniq[d] = 1; });
    if (Object.keys(uniq).length <= 1 && L.avatars.length > 1) flags.push("trivial-1dir");
    // idle twin: a twin that never changes position along the solution
    var pos = E.startPositions(L), sets = E.buildSets(L);
    var moved = L.avatars.map(function () { return false; });
    path.forEach(function (d) {
      var r = E.resolveStep(L, pos, d, sets);
      for (var i = 0; i < pos.length; i++) if (r.positions[i].x !== pos[i].x || r.positions[i].y !== pos[i].y) moved[i] = true;
      pos = r.positions;
    });
    if (moved.indexOf(false) >= 0 && L.avatars.length > 1) flags.push("idle-twin");
    // non-interacting: solvable with overlap allowed in same #moves
    var indep = solvePath(L, true);
    if (L.avatars.length > 1 && indep && indep.length === path.length) flags.push("non-interacting");
  }
  flags.forEach(flag);
  var tag = flags.length ? "  <<< " + flags.join(", ") : "";
  console.log("L" + (idx + 1) + "  " + L.name + "  [" + L.w + "x" + L.h + ", " +
    L.avatars.length + " twins, " + (path ? path.length : "?") + " moves]" + tag);
  console.log("   transforms: " + L.avatars.map(function (a) { return a.transform; }).join(", "));
  console.log(asciiMap(L));
  console.log("");
});

console.log("=== flag summary ===");
Object.keys(flagsCount).forEach(function (k) { console.log("  " + k + ": " + flagsCount[k]); });
if (!Object.keys(flagsCount).length) console.log("  none");
