/*
 * Mirror Twins — level data.
 *
 * Each level:
 *   name      : short title
 *   hint      : one-line nudge shown under the board
 *   w, h      : grid size in cells
 *   walls     : [[x,y], ...] impassable cells (block individual twins)
 *   hazards   : [[x,y], ...] spikes — touching one resets the level
 *   avatars   : [{ start:[x,y], goal:[x,y], color, transform }, ...]
 *
 * transform: "normal" | "mirrorX" | "mirrorY" | "mirrorXY" | "rot90" | "rot270"
 *   normal   - moves as pressed
 *   mirrorX  - left/right inverted
 *   mirrorY  - up/down inverted
 *   mirrorXY - both inverted (point symmetry)
 *   rot90    - rotated 90 deg clockwise   (up->right)
 *   rot270   - rotated 90 deg counter-cw  (up->left)
 *
 * Every level is checked solvable by verify.js (BFS) before shipping.
 */

var CY = "#22d3ee"; // cyan
var MG = "#f472b6"; // magenta
var AM = "#fbbf24"; // amber
var LI = "#a3e635"; // lime

var LEVELS = [
  {
    name: "First Steps",
    hint: "Use the arrow keys to guide your twin to the matching ring.",
    w: 5, h: 5, walls: [], hazards: [],
    avatars: [
      { start: [0, 0], goal: [4, 4], color: CY, transform: "normal" },
    ],
  },

  {
    name: "Reflection",
    hint: "The second twin moves LEFT when you press RIGHT. Mirror image.",
    w: 7, h: 5, walls: [], hazards: [],
    avatars: [
      { start: [0, 1], goal: [6, 1], color: CY, transform: "normal" },
      { start: [6, 3], goal: [0, 3], color: MG, transform: "mirrorX" },
    ],
  },

  {
    name: "Hold the Line",
    hint: "Walls block a twin while the other keeps going. Use them.",
    w: 5, h: 5, walls: [[1, 4]], hazards: [],
    avatars: [
      { start: [0, 0], goal: [4, 0], color: CY, transform: "normal" },
      { start: [4, 4], goal: [2, 4], color: MG, transform: "mirrorX" },
    ],
  },

  {
    name: "Upside Down",
    hint: "This twin's UP and DOWN are flipped.",
    w: 5, h: 5, walls: [], hazards: [],
    avatars: [
      { start: [1, 0], goal: [1, 4], color: CY, transform: "normal" },
      { start: [3, 4], goal: [3, 0], color: MG, transform: "mirrorY" },
    ],
  },

  {
    name: "Point Symmetry",
    hint: "This twin mirrors you on BOTH axes at once.",
    w: 5, h: 5, walls: [], hazards: [],
    avatars: [
      { start: [0, 0], goal: [4, 4], color: CY, transform: "normal" },
      { start: [4, 4], goal: [0, 0], color: MG, transform: "mirrorXY" },
    ],
  },

  {
    name: "Mind the Spikes",
    hint: "Spikes reset the level. Route around them.",
    w: 7, h: 5, walls: [], hazards: [[3, 1], [3, 3]],
    avatars: [
      { start: [0, 1], goal: [6, 1], color: CY, transform: "normal" },
      { start: [6, 3], goal: [0, 3], color: MG, transform: "mirrorX" },
    ],
  },

  {
    name: "Threading",
    hint: "Walls and a mirror twin. Block carefully to line them up.",
    w: 7, h: 6,
    walls: [[3, 0], [3, 1], [3, 4], [3, 5]],
    hazards: [],
    avatars: [
      { start: [0, 2], goal: [6, 3], color: CY, transform: "normal" },
      { start: [6, 3], goal: [0, 2], color: MG, transform: "mirrorXY" },
    ],
  },

  {
    name: "Three's Company",
    hint: "Three twins, three mirrors. One move steers them all.",
    w: 7, h: 7, walls: [], hazards: [[3, 3]],
    avatars: [
      { start: [0, 0], goal: [6, 6], color: CY, transform: "normal" },
      { start: [6, 0], goal: [0, 6], color: MG, transform: "mirrorX" },
      { start: [0, 6], goal: [6, 0], color: AM, transform: "mirrorY" },
    ],
  },

  {
    name: "Pinwheel",
    hint: "Rotated twins turn your presses 90 degrees. Find the spin.",
    w: 7, h: 7, walls: [], hazards: [],
    avatars: [
      { start: [0, 0], goal: [6, 0], color: CY, transform: "normal" },
      { start: [6, 0], goal: [6, 6], color: MG, transform: "rot90" },
      { start: [6, 6], goal: [0, 6], color: AM, transform: "mirrorXY" },
      { start: [0, 6], goal: [0, 0], color: LI, transform: "rot270" },
    ],
  },

  {
    name: "Grand Finale",
    hint: "Everything you've learned, all at once. Mind the spikes.",
    w: 7, h: 7,
    walls: [[1, 3], [5, 3]],
    hazards: [[3, 1], [3, 3], [3, 5]],
    avatars: [
      { start: [0, 0], goal: [6, 6], color: CY, transform: "normal" },
      { start: [6, 0], goal: [0, 6], color: MG, transform: "mirrorX" },
      { start: [0, 6], goal: [6, 0], color: AM, transform: "mirrorY" },
    ],
  },
];

if (typeof module !== "undefined" && module.exports) module.exports = LEVELS;
if (typeof window !== "undefined") window.LEVELS = LEVELS;
