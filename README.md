# Mirror Twins 🪞

An original arrow-keys-only puzzle game that runs in any modern web browser — no
install, no build step, no dependencies.

You press **one** set of arrow keys, but you control **several twins at once**.
Each twin reacts to your input through its own *mirror*: some move exactly as you
press, some are flipped left/right or up/down, some are rotated 90°. Every twin
must sit on its matching ring **at the same time** to clear a level. The catch:
a move that saves one twin can doom another, so you'll use walls to block and
desync them — and steer clear of the spikes.

## Play

Just open `index.html` in a browser. That's it — works on desktop and mobile.

Pick a level from the **level select** screen (clear a level to unlock the next;
progress is saved on your device), then:

**Desktop**
- **Arrow keys** — move every twin one step (each through its own mirror)
- **R** — restart the current level
- **Esc** — back to the level select
- **🔊** — toggle sound

**Mobile / touch**
- **Swipe** on the board, or tap the on-screen **D-pad**
- The **← Levels** button returns to the level select

Sound effects are generated on the fly with the Web Audio API (no audio files).

## The mirrors

| Transform  | Behavior                                   |
|------------|--------------------------------------------|
| `normal`   | moves exactly as you press                 |
| `mirrorX`  | left/right inverted                        |
| `mirrorY`  | up/down inverted                           |
| `mirrorXY` | both inverted (point symmetry)             |
| `rot90`    | your press rotated 90° clockwise           |
| `rot270`   | your press rotated 90° counter-clockwise   |

Walls block an individual twin (the others keep moving), twins block each other,
and spikes reset the level.

## Project layout

| File          | Role                                                           |
|---------------|----------------------------------------------------------------|
| `index.html`  | page shell + canvas + UI                                       |
| `style.css`   | dark neon theme, level select, D-pad                           |
| `engine.js`   | pure game rules (movement, collisions, win check) — no DOM     |
| `levels.js`   | level data (grid, walls, hazards, twins) — easy to extend      |
| `audio.js`    | procedural Web Audio sound effects (`window.SFX`)              |
| `game.js`     | level select, rendering, animation, keyboard + touch, flow     |
| `verify.js`   | dev tool: BFS solver that proves every level is solvable       |
| `devserver.py`| dev tool: no-cache static server (see below)                   |

`engine.js` is shared by the browser **and** the verifier, so the rules used to
play are exactly the rules used to prove each level can be beaten.

## Running locally during development

Opening `index.html` directly works, but if you're editing the code a static
server with caching disabled avoids stale files:

```sh
python devserver.py 5193     # then open http://127.0.0.1:5193/
```

## Adding your own levels

Append an entry to the array in `levels.js`, then check it's solvable:

```sh
node verify.js
```

It prints the minimum number of moves for each level (a handy difficulty proxy)
and fails loudly if any level has no solution.

## License

Mirror Twins is an original game — engine, levels, rendering, and sound were all
written from scratch with no third-party code or assets. It is released under the
[MIT License](LICENSE). © 2026 Anup Shetye.
