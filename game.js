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

  function emptyCount(b){return b.flat().filter(v=>v===0).length;}
  function smoothness(b){
    let value=0;
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      if(!b[r][c])continue;
      const a=Math.log2(b[r][c]);
      if(c+1<SIZE&&b[r][c+1])value-=Math.abs(a-Math.log2(b[r][c+1]));
      if(r+1<SIZE&&b[r+1][c])value-=Math.abs(a-Math.log2(b[r+1][c]));
    }
    return value;
  }
  function monotonicity(b){
    let total=0;
    for(let r=0;r<SIZE;r++){
      let inc=0,dec=0;
      for(let c=0;c<SIZE-1;c++){const a=b[r][c]?Math.log2(b[r][c]):0,d=b[r][c+1]?Math.log2(b[r][c+1]):0;if(a>d)inc+=a-d;else dec+=d-a;}
      total+=Math.max(inc,dec);
    }
    for(let c=0;c<SIZE;c++){
      let inc=0,dec=0;
      for(let r=0;r<SIZE-1;r++){const a=b[r][c]?Math.log2(b[r][c]):0,d=b[r+1][c]?Math.log2(b[r+1][c]):0;if(a>d)inc+=a-d;else dec+=d-a;}
      total+=Math.max(inc,dec);
    }
    return total;
  }
  function cornerBonus(b){
    const max=Math.max(...b.flat()), corners=[b[0][0],b[0][3],b[3][0],b[3][3]];
    return corners.includes(max)?Math.log2(max)*3:0;
  }
  function evaluateBoard(b){
    const values=b.flat(), max=Math.max(...values), logs=values.map(v=>v?Math.log2(v):0);
    return emptyCount(b)*2.7 + smoothness(b)*0.15 + monotonicity(b)*1.0 + cornerBonus(b) + (max?Math.log2(max)*1.5:0);
  }
  function expectimax(b, depth){
    if(depth<=0) return evaluateBoard(b);
    let best=-Infinity;
    for(const dir of DIRS){
      const m=move(b,dir); if(!m.changed)continue;
      let value=evaluateBoard(m.board);
      if(depth>1){
        const empties=[];
        for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(!m.board[r][c])empties.push([r,c]);
        if(empties.length){
          let chance=0;
          const sample=empties.length>6?empties.filter((_,i)=>i%Math.ceil(empties.length/6)===0).slice(0,6):empties;
          for(const [r,c] of sample){
            const b2=clone(m.board);b2[r][c]=2;
            const b4=clone(m.board);b4[r][c]=4;
            chance += 0.9*expectimax(b2,depth-1)+0.1*expectimax(b4,depth-1);
          }
          value += chance/sample.length*0.9;
        }
      }
      best=Math.max(best,value);
    }
    return best===-Infinity?evaluateBoard(b)-1000:best;
  }
  function chooseMove(){
    let bestDir=null,best=-Infinity;
    for(const dir of DIRS){
      const m=move(board,dir); if(!m.changed)continue;
      let value=expectimax(m.board,2)+m.gained*0.05;
      if(value>best){best=value;bestDir=dir;}
    }
    return {dir:bestDir,value:best};
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
    nextMove.textContent=decision.dir;evaluation.textContent=decision.value.toFixed(2);decisionText.textContent="Simulating candidate futures";
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