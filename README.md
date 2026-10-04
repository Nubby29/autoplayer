# Game Autoplayer

A goal-driven game autoplayer prototype.

## Phase 1 — 2048 speedrun agent

The first milestone is a selectable-game autoplayer with **2048** as the initial game.

The goal is not simply to play indefinitely. The agent receives a target tile and must reach it using an efficient, adaptive strategy.

### Current behavior

- Select **2048** from the game selector.
- Select a target from **64 → 4096**.
- Start, pause, single-step, or reset the run.
- Change autoplay speed.
- The agent evaluates legal moves before every action.
- The planner prioritizes **goal progress per move**, rather than following a fixed sequence.
- The planner uses a stable high-tile corner/snake layout to reduce the common 2048 mid-game collapse.
- The planner uses expectimax-style lookahead with possible `2` and `4` spawns.
- Search is lighter when the board is open and deeper when the board becomes crowded.
- The run stops immediately when the selected goal tile is reached.

The important distinction is that the agent is **state-driven**: after every random tile spawn it observes the new board and recomputes its next move.


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
