# Game Autoplayer

A goal-driven game autoplayer prototype.

## Phase 1

- Selectable game architecture (2048 is the first game).
- Configurable goal tile: 64 → 4096.
- Autoplay, pause, single-step, reset.
- A model-based 2048 decision engine using board evaluation + shallow expectimax.
- No fixed move sequence: the agent evaluates the current board before every move.

## Run

This is a static browser app. Open `index.html`, or serve the repository with any static server.

Example:

```powershell
python -m http.server 8000
```

Then open http://localhost:8000.

## Planned architecture

Future games should implement the same conceptual interface:

- `observe()`
- `getActions()`
- `act(action)`
- `isGoalReached()`
- `getScore()`

The 2048 engine is currently embedded in `game.js`; it will be extracted behind a game adapter as additional games are introduced.
