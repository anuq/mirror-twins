/*
 * Mirror Twins — pure game engine.
 *
 * No DOM, no rendering, no globals beyond the export. This file is shared by
 * the browser (game.js) and the Node level-verifier (verify.js) so that the
 * rules used to play the game are EXACTLY the rules used to prove each level
 * is solvable.
 *
 * Coordinate system: x = column (0 = left), y = row (0 = top).
 */

// Raw arrow directions as unit vectors.
var DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// How a twin's transform warps the player's raw direction.
function transform(d, t) {
  var dx = d.dx, dy = d.dy;
  switch (t) {
    case "mirrorX": return { dx: -dx, dy: dy };
    case "mirrorY": return { dx: dx, dy: -dy };
    case "mirrorXY": return { dx: -dx, dy: -dy };
    case "rot90": return { dx: -dy, dy: dx }; // clockwise
    case "rot270": return { dx: dy, dy: -dx }; // counter-clockwise
    case "normal":
    default: return { dx: dx, dy: dy };
  }
}

function key(x, y) { return x + "," + y; }

// Build fast lookup sets for a level's static geometry.
function buildSets(level) {
  var walls = {}, hazards = {};
  (level.walls || []).forEach(function (c) { walls[key(c[0], c[1])] = true; });
  (level.hazards || []).forEach(function (c) { hazards[key(c[0], c[1])] = true; });
  return { walls: walls, hazards: hazards };
}

function inBounds(level, x, y) {
  return x >= 0 && y >= 0 && x < level.w && y < level.h;
}

/*
 * Resolve a single step for one raw direction.
 *
 * positions: array of {x,y} (one per avatar, index-matched to level.avatars).
 * Returns { positions, dead }. `dead` is true if any avatar ends on a hazard.
 *
 * Movement rules:
 *  - Each avatar applies its own transform to the raw direction.
 *  - A move into a wall / out of bounds is invalid -> that avatar stays.
 *  - Avatars block each other. Conflicts are resolved by a fixpoint: an avatar
 *    is forced to stay if its target is occupied by another avatar that is
 *    staying, or if two movers want the same cell. Pure swaps and follow-chains
 *    are allowed.
 */
function resolveStep(level, positions, dirName, sets) {
  sets = sets || buildSets(level);
  var raw = DIRS[dirName];
  var n = positions.length;

  var cur = positions.map(function (p) { return { x: p.x, y: p.y }; });
  var target = new Array(n);
  var moving = new Array(n);

  // Phase 1: static validity (bounds + walls).
  for (var i = 0; i < n; i++) {
    var d = transform(raw, level.avatars[i].transform);
    var tx = cur[i].x + d.dx, ty = cur[i].y + d.dy;
    if (d.dx === 0 && d.dy === 0) { target[i] = { x: cur[i].x, y: cur[i].y }; moving[i] = false; continue; }
    if (!inBounds(level, tx, ty) || sets.walls[key(tx, ty)]) {
      target[i] = { x: cur[i].x, y: cur[i].y };
      moving[i] = false;
    } else {
      target[i] = { x: tx, y: ty };
      moving[i] = true;
    }
  }

  // Phase 2: fixpoint resolution of avatar-vs-avatar blocking.
  var changed = true;
  while (changed) {
    changed = false;

    // final position of each avatar given current moving flags.
    function fin(i) { return moving[i] ? target[i] : cur[i]; }

    for (var a = 0; a < n; a++) {
      if (!moving[a]) continue;

      // (a) target occupied by an avatar that is staying put.
      for (var b = 0; b < n; b++) {
        if (b === a) continue;
        if (!moving[b] && cur[b].x === target[a].x && cur[b].y === target[a].y) {
          moving[a] = false; changed = true; break;
        }
      }
      if (!moving[a]) continue;

      // (b) two movers want the same destination cell -> both stay.
      for (var c = 0; c < n; c++) {
        if (c === a || !moving[c]) continue;
        if (target[c].x === target[a].x && target[c].y === target[a].y) {
          moving[a] = false; moving[c] = false; changed = true; break;
        }
      }
    }
    void fin;
  }

  var out = [];
  var dead = false;
  for (var k = 0; k < n; k++) {
    var p = moving[k] ? target[k] : cur[k];
    out.push({ x: p.x, y: p.y });
    if (sets.hazards[key(p.x, p.y)]) dead = true;
  }
  return { positions: out, dead: dead };
}

// A level is won when every avatar sits on its own goal.
function isWon(level, positions) {
  for (var i = 0; i < level.avatars.length; i++) {
    var g = level.avatars[i].goal;
    if (positions[i].x !== g[0] || positions[i].y !== g[1]) return false;
  }
  return true;
}

function startPositions(level) {
  return level.avatars.map(function (a) { return { x: a.start[0], y: a.start[1] }; });
}

var ENGINE = {
  DIRS: DIRS,
  transform: transform,
  buildSets: buildSets,
  resolveStep: resolveStep,
  isWon: isWon,
  startPositions: startPositions,
  inBounds: inBounds,
  key: key,
};

if (typeof module !== "undefined" && module.exports) module.exports = ENGINE;
if (typeof window !== "undefined") window.ENGINE = ENGINE;
