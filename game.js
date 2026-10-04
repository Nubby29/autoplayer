/* Game Autoplayer — Phase 1: 2048 goal-driven agent */
(() => {
  "use strict";

  const SIZE = 4;
  const DIRS = ["UP", "RIGHT", "DOWN", "LEFT"];
  const boardEl = document.querySelector("#board");
  const gameSelect = document.querySelector("#gameSelect");
  const goalSelect = document.querySelector("#goalSelect");
  const speedSelect = document.querySelector("#speedSelect");
  const startBtn = document.querySelector("#startBtn");
  const stepBtn = document.querySelector("#stepBtn");
  const resetBtn = document.querySelector("#resetBtn");
  const overlay = document.querySelector("#overlay");
  const overlayTitle = document.querySelector("#overlayTitle");
  const overlayText = document.querySelector("#overlayText");
  const statusPill = document.querySelector("#statusPill");
  const statusText = document.querySelector("#statusText");
  const goalMetric = document.querySelector("#goalMetric");
  const highestMetric = document.querySelector("#highestMetric");
  const scoreMetric = document.querySelector("#scoreMetric");
  const movesMetric = document.querySelector("#movesMetric");
  const decisionText = document.querySelector("#decisionText");
  const nextMove = document.querySelector("#nextMove");
  const evaluation = document.querySelector("#evaluation");

  let board, score, moves, timer = null, running = false, finished = false, goal = 2048;

  function emptyBoard(){ return Array.from({length:SIZE}, () => Array(SIZE).fill(0)); }
  function clone(b){ return b.map(row => row.slice()); }
  function addRandom(b){
    const empty=[];
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(!b[r][c]) empty.push([r,c]);
    if(!empty.length) return false;
    const [r,c]=empty[Math.floor(Math.random()*empty.length)];
    b[r][c]=Math.random()<0.9?2:4;
    return true;
  }
  function reset(){
    stop();
    board=emptyBoard(); score=0; moves=0; finished=false;
    addRandom(board); addRandom(board);
    overlay.classList.add("hidden");
    statusText.textContent="Ready"; statusPill.classList.remove("running");
    nextMove.textContent="—"; evaluation.textContent="—"; decisionText.textContent="Waiting for a board";
    render();
  }
  function slideLine(line){
    const values=line.filter(Boolean), out=[], merges=0;
    for(let i=0;i<values.length;i++){
      if(values[i]===values[i+1]){ out.push(values[i]*2); i++; }
      else out.push(values[i]);
    }
    while(out.length<SIZE) out.push(0);
    return {line:out, merges};
  }
  function move(b, dir){
    const out=emptyBoard(); let changed=false, gained=0;
    const write=(r,c,line)=>{
      const s=slideLine(line);
      for(let i=0;i<SIZE;i++) out[r][c+i]=s.line[i];
      gained+=s.line.reduce((sum,v)=>sum+v,0)-line.reduce((sum,v)=>sum+v,0);
    };
    if(dir==="LEFT"){
      for(let r=0;r<SIZE;r++){const line=b[r]; const s=slideLine(line); out[r]=s.line; if(s.line.some((v,i)=>v!==line[i])) changed=true; gained+=s.line.reduce((a,v)=>a+v,0)-line.reduce((a,v)=>a+v,0);}
    } else if(dir==="RIGHT"){
      for(let r=0;r<SIZE;r++){const line=b[r].slice().reverse(),s=slideLine(line);s.line.reverse();out[r]=s.line;if(s.line.some((v,i)=>v!==line.slice().reverse()[i]))changed=true;gained+=s.line.reduce((a,v)=>a+v,0)-b[r].reduce((a,v)=>a+v,0);}
    } else if(dir==="UP"){
      for(let c=0;c<SIZE;c++){const line=b.map(r=>r[c]),s=slideLine(line);for(let r=0;r<SIZE;r++)out[r][c]=s.line[r];if(s.line.some((v,i)=>v!==line[i]))changed=true;gained+=s.line.reduce((a,v)=>a+v,0)-line.reduce((a,v)=>a+v,0);}
    } else {
      for(let c=0;c<SIZE;c++){const line=b.map(r=>r[c]).reverse(),s=slideLine(line);s.line.reverse();for(let r=0;r<SIZE;r++)out[r][c]=s.line[r];const original=b.map(r=>r[c]);if(s.line.some((v,i)=>v!==original[i]))changed=true;gained+=s.line.reduce((a,v)=>a+v,0)-original.reduce((a,v)=>a+v,0);}
    }
    return {board:out,changed,gained};
  }

  // Speedrun planner:
  // - Goal progress is the primary objective.
  // - A stable corner/snake layout prevents the classic 256-tile trap.
  // - Expectimax looks ahead through real 2/4 spawns.
  // - Every legal move is compared by expected future progress, not by a
  //   pre-recorded sequence. This keeps the agent responsive to randomness.

  const SPEEDRUN_WEIGHTS = [
    [65536, 32768, 16384, 8192],
    [512, 1024, 2048, 4096],
    [256, 128, 64, 32],
    [2, 4, 8, 16]
  ];

  function emptyCount(b){
    return b.flat().filter(v => v === 0).length;
  }

  function logTile(v){
    return v ? Math.log2(v) : 0;
  }

  function maxTile(b){
    return Math.max(...b.flat());
  }

  function mergePotential(b){
    let potential = 0;
    for(let r = 0; r < SIZE; r++){
      for(let c = 0; c < SIZE; c++){
        const v = b[r][c];
        if(!v) continue;
        if(c + 1 < SIZE && b[r][c + 1] === v) potential += logTile(v);
        if(r + 1 < SIZE && b[r + 1][c] === v) potential += logTile(v);
      }
    }
    return potential;
  }

  function smoothness(b){
    let value = 0;
    for(let r = 0; r < SIZE; r++){
      for(let c = 0; c < SIZE; c++){
        if(!b[r][c]) continue;
        const a = logTile(b[r][c]);
        if(c + 1 < SIZE && b[r][c + 1]) value -= Math.abs(a - logTile(b[r][c + 1]));
        if(r + 1 < SIZE && b[r + 1][c]) value -= Math.abs(a - logTile(b[r + 1][c]));
      }
    }
    return value;
  }

  function speedrunShape(b){
    let value = 0;
    for(let r = 0; r < SIZE; r++){
      for(let c = 0; c < SIZE; c++){
        value += logTile(b[r][c]) * SPEEDRUN_WEIGHTS[r][c];
      }
    }
    return value;
  }

  function monotonicity(b){
    let total = 0;

    for(let r = 0; r < SIZE; r++){
      let inc = 0, dec = 0;
      for(let c = 0; c < SIZE - 1; c++){
        const a = logTile(b[r][c]);
        const d = logTile(b[r][c + 1]);
        if(a > d) inc += a - d;
        else dec += d - a;
      }
      total += Math.max(inc, dec);
    }

    for(let c = 0; c < SIZE; c++){
      let inc = 0, dec = 0;
      for(let r = 0; r < SIZE - 1; r++){
        const a = logTile(b[r][c]);
        const d = logTile(b[r + 1][c]);
        if(a > d) inc += a - d;
        else dec += d - a;
      }
      total += Math.max(inc, dec);
    }

    return total;
  }

  function goalProgress(b){
    const max = maxTile(b);
    if(max >= goal) return 1000000;
    return Math.pow(Math.log2(Math.max(2, max)) / Math.log2(goal), 4) * 100;
  }

  function evaluateBoard(b, moveGain = 0){
    const empty = emptyCount(b);
    const max = maxTile(b);

    // The coefficients deliberately put goal progress first. Empty space
    // protects the run, while the snake shape keeps the largest tile anchored.
    return (
      goalProgress(b) * 12 +
      Math.log2(Math.max(2, max)) * 35 +
      empty * 24 +
      speedrunShape(b) * 0.012 +
      monotonicity(b) * 8 +
      smoothness(b) * 2 +
      mergePotential(b) * 18 +
      moveGain * 0.08
    );
  }

  function boardKey(b){
    return b.flat().join(",");
  }

  function spawnCandidates(b){
    const empty = [];
    for(let r = 0; r < SIZE; r++){
      for(let c = 0; c < SIZE; c++){
        if(!b[r][c]) empty.push([r,c]);
      }
    }

    if(empty.length <= 4) return empty;

    // Evaluate the most dangerous / most influential spawn squares instead
    // of exploding the search tree over every empty cell.
    return empty
      .map(([r,c]) => ({
        r, c,
        priority: SPEEDRUN_WEIGHTS[r][c] + ((r === 0 || r === SIZE - 1) && (c === 0 || c === SIZE - 1) ? 50000 : 0)
      }))
      .sort((a,b) => b.priority - a.priority)
      .slice(0, 4)
      .map(p => [p.r,p.c]);
  }

  function expectimax(b, depth, cache){
    if(depth <= 0) return evaluateBoard(b);

    const key = boardKey(b) + "|" + depth;
    if(cache.has(key)) return cache.get(key);

    let best = -Infinity;
    for(const dir of DIRS){
      const result = move(b, dir);
      if(!result.changed) continue;

      let value = evaluateBoard(result.board, result.gained);

      if(depth > 1){
        const candidates = spawnCandidates(result.board);
        if(candidates.length){
          let chance = 0;

          for(const [r,c] of candidates){
            const b2 = clone(result.board);
            b2[r][c] = 2;
            const b4 = clone(result.board);
            b4[r][c] = 4;

            chance += 0.9 * expectimax(b2, depth - 1, cache);
            chance += 0.1 * expectimax(b4, depth - 1, cache);
          }

          value += chance / candidates.length;
        }
      }

      // A speedrun wants progress with as few moves as possible.
      value += Math.log2(Math.max(1, result.gained)) * 2;
      best = Math.max(best, value);
    }

    const finalValue = best === -Infinity ? -1000000 : best;
    cache.set(key, finalValue);
    return finalValue;
  }

  function chooseMove(){
    const candidates = [];
    const cache = new Map();

    // Use a lighter search while the board is open, then spend more search
    // time once the run becomes crowded and a bad move can kill the speedrun.
    const searchDepth = emptyCount(board) >= 9 ? 2 : 3;

    for(const dir of DIRS){
      const result = move(board, dir);
      if(!result.changed) continue;

      const future = expectimax(result.board, searchDepth, cache);
      const maxAfter = maxTile(result.board);
      const progressBonus = maxAfter > maxTile(board)
        ? Math.log2(maxAfter) * 30
        : 0;

      candidates.push({
        dir,
        value: future + result.gained * 0.12 + progressBonus
      });
    }

    candidates.sort((a,b) => b.value - a.value);

    if(!candidates.length) return {dir:null, value:-Infinity};

    return candidates[0];
  }

  function apply(dir){
    if(finished)return false;
    const result=move(board,dir); if(!result.changed)return false;
    board=result.board;score+=result.gained;moves++;addRandom(board);
    const max=Math.max(...board.flat());
    if(max>=goal){finished=true;stop();showOverlay("Goal reached",`The agent reached ${goal.toLocaleString()} in ${moves} moves.`);}
    else if(!hasMoves()){finished=true;stop();showOverlay("Game over",`No moves remain. Highest tile: ${max.toLocaleString()}.`);}
    render(); return true;
  }
  function hasMoves(){return DIRS.some(d=>move(board,d).changed);}
  function render(){
    boardEl.innerHTML="";
    board.flat().forEach(v=>{const cell=document.createElement("div");cell.className="cell";cell.dataset.value=String(v);cell.textContent=v?v.toLocaleString():"";boardEl.appendChild(cell);});
    const max=Math.max(...board.flat());
    goalMetric.textContent=goal.toLocaleString();highestMetric.textContent=max.toLocaleString();scoreMetric.textContent=score.toLocaleString();movesMetric.textContent=moves.toLocaleString();
  }
  function showOverlay(title,text){overlayTitle.textContent=title;overlayText.textContent=text;overlay.classList.remove("hidden");statusText.textContent=title;}
  function step(){
    if(finished)return;
    const decision=chooseMove();
    if(!decision.dir){finished=true;showOverlay("Game over","The agent has no legal move.");return;}
    nextMove.textContent=decision.dir;evaluation.textContent=decision.value.toFixed(2);decisionText.textContent="Speedrun planner: comparing efficient futures";
    apply(decision.dir);
  }
  function start(){
    if(finished)reset();
    running=!running;
    if(running){statusText.textContent="Autoplaying";statusPill.classList.add("running");startBtn.textContent="Pause";tick();}
    else stop();
  }
  function stop(){
    running=false;statusPill.classList.remove("running");if(timer){clearTimeout(timer);timer=null;}if(!finished){statusText.textContent="Paused";startBtn.textContent="Start autoplay";}
  }
  function tick(){
    if(!running)return;
    step();
    if(running)timer=setTimeout(tick,Number(speedSelect.value));
  }
  goalSelect.addEventListener("change",()=>{goal=Number(goalSelect.value);reset();});
  startBtn.addEventListener("click",start);
  stepBtn.addEventListener("click",()=>{if(!finished){stop();step();}});
  resetBtn.addEventListener("click",reset);
  gameSelect.addEventListener("change",()=>reset());
  reset();
})();