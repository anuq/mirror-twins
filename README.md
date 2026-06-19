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

There are **50 levels across 5 chapters** (First Steps → Reflections → Blocking
Walls → Spikes → Mastery). Pick a chapter, then a level — clearing levels unlocks
new chapters, a **Continue** button jumps to where you left off, and progress is
saved on your device. Then:

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
| `levels.js`   | level data + chapters — **generated**, do not edit by hand     |
| `audio.js`    | procedural Web Audio sound effects (`window.SFX`)              |
| `game.js`     | chapter/level select, rendering, animation, keyboard + touch   |
| `generate.js` | dev tool: generates + BFS-curates the levels in `levels.js`    |
| `verify.js`   | dev tool: BFS solver that proves every level is solvable       |
| `devserver.py`| dev tool: no-cache static server (see below)                   |

`engine.js` is shared by the browser, the generator, **and** the verifier, so
the rules used to play are exactly the rules used to generate and to prove each
level can be beaten.

## Running locally during development

Opening `index.html` directly works, but if you're editing the code a static
server with caching disabled avoids stale files:

```sh
python devserver.py 5193     # then open http://127.0.0.1:5193/
```

## Generating levels

`levels.js` is produced by `generate.js`. For each chapter it randomly builds
candidate levels, runs the BFS solver, and keeps only ones that are solvable and
whose minimum solution length lands in that chapter's difficulty band (with
dedup). To change counts, grid sizes, mechanics, or difficulty, edit the chapter
specs at the top of `generate.js`, then:

```sh
node generate.js     # rewrites levels.js (deterministic — fixed RNG seed)
node verify.js       # independently re-proves every level is solvable
```

`verify.js` prints the minimum number of moves per level (a handy difficulty
proxy) and fails loudly if any level has no solution. Bumping the level count
toward hundreds is just a matter of raising the per-chapter `count` (and adding
more chapters).

## License

Mirror Twins is an original game — engine, levels, rendering, and sound were all
written from scratch with no third-party code or assets. It is released under the
[MIT License](LICENSE). © 2026 Anup Shetye.
