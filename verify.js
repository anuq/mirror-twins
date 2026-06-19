/*
 * Level verifier — BFS over game states to prove each level is solvable
 * using the SAME engine the browser runs. Run with: node verify.js
 *
 * Prints, per level, whether a solution exists and the minimum number of
 * arrow presses to solve it (a proxy for difficulty).
 */

var ENGINE = require("./engine.js");
var LEVELS = require("./levels.js");

var DIR_NAMES = ["up", "down", "left", "right"];

function stateKey(positions) {
  return positions.map(function (p) { return p.x + "," + p.y; }).join("|");
}

function solve(level) {
  var sets = ENGINE.buildSets(level);
  var start = ENGINE.startPositions(level);
  if (ENGINE.isWon(level, start)) return { ok: true, moves: 0 };

  var seen = {};
  seen[stateKey(start)] = true;
  var queue = [{ pos: start, depth: 0 }];
  var head = 0;
  var explored = 0;

  while (head < queue.length) {
    var node = queue[head++];
    explored++;
    for (var i = 0; i < DIR_NAMES.length; i++) {
      var res = ENGINE.resolveStep(level, node.pos, DIR_NAMES[i], sets);
      if (res.dead) continue; // stepping on a hazard is a dead state
      var k = stateKey(res.positions);
      if (seen[k]) continue;
      if (ENGINE.isWon(level, res.positions)) {
        return { ok: true, moves: node.depth + 1, explored: explored };
      }
      seen[k] = true;
      queue.push({ pos: res.positions, depth: node.depth + 1 });
    }
  }
  return { ok: false, explored: explored };
}

var allOk = true;
console.log("Verifying " + LEVELS.length + " levels...\n");
LEVELS.forEach(function (lvl, idx) {
  var r = solve(lvl);
  var tag = r.ok ? "OK " : "FAIL";
  if (!r.ok) allOk = false;
  var detail = r.ok
    ? ("min " + r.moves + " moves")
    : "NO SOLUTION";
  console.log(
    "  [" + tag + "] L" + (idx + 1) + " " + lvl.name +
    "  (" + detail + ", " + (r.explored || 0) + " states explored)"
  );
});

console.log("\n" + (allOk ? "All levels solvable." : "SOME LEVELS ARE UNSOLVABLE — fix needed."));
process.exit(allOk ? 0 : 1);
