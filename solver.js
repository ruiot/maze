import React, { useState, useEffect, useRef } from 'react';

// v1.5.0: Fix Pledge 2x2 loop bug, improve Tremaux visualization, reduce Random timeout
// Commit: v1.5.0: Fix Pledge 2x2 loop bug, improve Tremaux visualization, reduce Random timeout

const MazeSolverDemo = () => {
  const [mazeSize, setMazeSize] = useState(43);
  const [maze, setMaze] = useState([]);
  const [solverStates, setSolverStates] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(50);
  const [statistics, setStatistics] = useState({});
  const [algorithmType, setAlgorithmType] = useState('pathfinding'); // 'pathfinding' or 'robot'
  
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  const SIZE_OPTIONS = [
    { name: '小', size: 21 },
    { name: '中', size: 43 },
    { name: '大', size: 61 },
    { name: '特大', size: 81 }
  ];

  // 迷路生成（Recursive Backtracker + 6箇所壁破壊）
  const generateMaze = () => {
    const size = mazeSize;
    const newMaze = Array(size).fill(null).map(() => Array(size).fill(1));
    
    const stack = [[1, 1]];
    newMaze[1][1] = 0;
    const visited = new Set(['1,1']);

    const directions = [[0, -2], [2, 0], [0, 2], [-2, 0]];
    const wallOffsets = [[0, -1], [1, 0], [0, 1], [-1, 0]];

    while (stack.length > 0) {
      const [x, y] = stack[stack.length - 1];
      
      const unvisited = directions
        .map((dir, i) => ({ dir, wall: wallOffsets[i] }))
        .filter(({ dir }) => {
          const nx = x + dir[0];
          const ny = y + dir[1];
          return nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && 
                 !visited.has(`${nx},${ny}`);
        });

      if (unvisited.length === 0) {
        stack.pop();
      } else {
        const { dir, wall } = unvisited[Math.floor(Math.random() * unvisited.length)];
        const nx = x + dir[0];
        const ny = y + dir[1];
        const wx = x + wall[0];
        const wy = y + wall[1];

        newMaze[ny][nx] = 0;
        newMaze[wy][wx] = 0;
        visited.add(`${nx},${ny}`);
        stack.push([nx, ny]);
      }
    }
    
    // 6箇所の壁をランダムに破壊（ループ作成）
    const walls = [];
    for (let y = 2; y < size - 2; y++) {
      for (let x = 2; x < size - 2; x++) {
        if (newMaze[y][x] === 1) {
          // この壁の上下左右に通路があるかチェック
          const hasPath = 
            (newMaze[y-1][x] === 0 || newMaze[y+1][x] === 0) &&
            (newMaze[y][x-1] === 0 || newMaze[y][x+1] === 0);
          if (hasPath) {
            walls.push([x, y]);
          }
        }
      }
    }
    
    // ランダムに6箇所選んで破壊
    const numBreaks = Math.min(6, walls.length);
    for (let i = 0; i < numBreaks; i++) {
      const index = Math.floor(Math.random() * walls.length);
      const [x, y] = walls[index];
      newMaze[y][x] = 0;
      walls.splice(index, 1);
    }

    setMaze(newMaze);
    setSolverStates({});
    setStatistics({});
    setIsRunning(false);
  };

  // ソルバーアルゴリズム定義
  const pathfindingSolvers = {
    bfs: {
      name: 'BFS',
      fullName: '幅優先探索',
      color: '#4169E1',
      
      init: (maze, start, goal) => ({
        maze,
        start,
        goal,
        queue: [start],
        visited: new Set([`${start[0]},${start[1]}`]),
        parent: {},
        current: start,
        path: null,
        stepCount: 0,
        isComplete: false
      }),
      
      step: (state) => {
        if (state.isComplete || state.queue.length === 0) {
          return { ...state, isComplete: true, current: null };
        }
        
        const { maze, queue, visited, parent, goal } = state;
        const current = queue.shift();
        const [x, y] = current;
        
        if (x === goal[0] && y === goal[1]) {
          const path = [];
          let node = `${x},${y}`;
          while (node) {
            const [nx, ny] = node.split(',').map(Number);
            path.unshift([nx, ny]);
            node = parent[node];
          }
          
          return {
            ...state,
            queue: [],
            current: [x, y],
            path,
            stepCount: state.stepCount + 1,
            isComplete: true
          };
        }
        
        const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        const newQueue = [...queue];
        const newVisited = new Set(visited);
        const newParent = { ...parent };
        
        for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;
          const key = `${nx},${ny}`;
          
          if (nx >= 0 && nx < maze.length && ny >= 0 && ny < maze.length &&
              maze[ny][nx] === 0 && !newVisited.has(key)) {
            newQueue.push([nx, ny]);
            newVisited.add(key);
            newParent[key] = `${x},${y}`;
          }
        }
        
        return {
          ...state,
          queue: newQueue,
          visited: newVisited,
          parent: newParent,
          current: [x, y],
          stepCount: state.stepCount + 1
        };
      }
    },
    
    dfs: {
      name: 'DFS',
      fullName: '深さ優先探索',
      color: '#DC143C',
      
      init: (maze, start, goal) => ({
        maze,
        start,
        goal,
        stack: [start],
        visited: new Set([`${start[0]},${start[1]}`]),
        parent: {},
        current: start,
        path: null,
        stepCount: 0,
        isComplete: false
      }),
      
      step: (state) => {
        if (state.isComplete || state.stack.length === 0) {
          return { ...state, isComplete: true, current: null };
        }
        
        const { maze, stack, visited, parent, goal } = state;
        const current = stack.pop();
        const [x, y] = current;
        
        if (x === goal[0] && y === goal[1]) {
          const path = [];
          let node = `${x},${y}`;
          while (node) {
            const [nx, ny] = node.split(',').map(Number);
            path.unshift([nx, ny]);
            node = parent[node];
          }
          
          return {
            ...state,
            stack: [],
            current: [x, y],
            path,
            stepCount: state.stepCount + 1,
            isComplete: true
          };
        }
        
        const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        const newStack = [...stack];
        const newVisited = new Set(visited);
        const newParent = { ...parent };
        
        for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;
          const key = `${nx},${ny}`;
          
          if (nx >= 0 && nx < maze.length && ny >= 0 && ny < maze.length &&
              maze[ny][nx] === 0 && !newVisited.has(key)) {
            newStack.push([nx, ny]);
            newVisited.add(key);
            newParent[key] = `${x},${y}`;
          }
        }
        
        return {
          ...state,
          stack: newStack,
          visited: newVisited,
          parent: newParent,
          current: [x, y],
          stepCount: state.stepCount + 1
        };
      }
    },
    
    astar: {
      name: 'A*',
      fullName: 'A* 探索',
      color: '#32CD32',
      
      init: (maze, start, goal) => ({
        maze,
        start,
        goal,
        openSet: [start],
        closedSet: new Set(),
        gScore: { [`${start[0]},${start[1]}`]: 0 },
        fScore: { [`${start[0]},${start[1]}`]: Math.abs(goal[0] - start[0]) + Math.abs(goal[1] - start[1]) },
        parent: {},
        current: start,
        path: null,
        stepCount: 0,
        isComplete: false
      }),
      
      step: (state) => {
        if (state.isComplete || state.openSet.length === 0) {
          return { ...state, isComplete: true, current: null };
        }
        
        const { maze, openSet, closedSet, gScore, fScore, parent, goal } = state;
        
        // fScoreが最小のノードを選択
        let current = openSet[0];
        let minF = fScore[`${current[0]},${current[1]}`] || Infinity;
        let minIndex = 0;
        
        for (let i = 1; i < openSet.length; i++) {
          const f = fScore[`${openSet[i][0]},${openSet[i][1]}`] || Infinity;
          if (f < minF) {
            minF = f;
            current = openSet[i];
            minIndex = i;
          }
        }
        
        const [x, y] = current;
        
        if (x === goal[0] && y === goal[1]) {
          const path = [];
          let node = `${x},${y}`;
          while (node) {
            const [nx, ny] = node.split(',').map(Number);
            path.unshift([nx, ny]);
            node = parent[node];
          }
          
          return {
            ...state,
            openSet: [],
            current: [x, y],
            path,
            stepCount: state.stepCount + 1,
            isComplete: true
          };
        }
        
        const newOpenSet = [...openSet];
        newOpenSet.splice(minIndex, 1);
        const newClosedSet = new Set(closedSet);
        newClosedSet.add(`${x},${y}`);
        const newGScore = { ...gScore };
        const newFScore = { ...fScore };
        const newParent = { ...parent };
        
        const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        
        for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;
          const key = `${nx},${ny}`;
          
          if (nx >= 0 && nx < maze.length && ny >= 0 && ny < maze.length &&
              maze[ny][nx] === 0 && !newClosedSet.has(key)) {
            
            const tentativeG = newGScore[`${x},${y}`] + 1;
            
            const inOpenSet = newOpenSet.some(([ox, oy]) => ox === nx && oy === ny);
            
            if (!inOpenSet || tentativeG < (newGScore[key] || Infinity)) {
              newParent[key] = `${x},${y}`;
              newGScore[key] = tentativeG;
              newFScore[key] = tentativeG + Math.abs(goal[0] - nx) + Math.abs(goal[1] - ny);
              
              if (!inOpenSet) {
                newOpenSet.push([nx, ny]);
              }
            }
          }
        }
        
        return {
          ...state,
          openSet: newOpenSet,
          closedSet: newClosedSet,
          gScore: newGScore,
          fScore: newFScore,
          parent: newParent,
          current: [x, y],
          stepCount: state.stepCount + 1
        };
      }
    }
  };

  // 探索ロボットアルゴリズム定義
  const robotSolvers = {
    pledge: {
      name: 'Pledge',
      fullName: 'Pledge Algorithm',
      color: '#FF6347',
      
      init: (maze, start, goal) => ({
        maze,
        start,
        goal,
        current: start,
        direction: 1, // 0:上, 1:右, 2:下, 3:左
        totalAngle: 0, // 累積回転角度
        visited: new Set([`${start[0]},${start[1]}`]),
        visitCount: { [`${start[0]},${start[1]}`]: 1 },
        path: [start],
        stepCount: 0,
        isComplete: false,
        stuck: false
      }),
      
      step: (state) => {
        if (state.isComplete || state.stuck) {
          return state;
        }
        
        const { maze, current, direction, totalAngle, visited, visitCount, path, goal } = state;
        const [x, y] = current;
        
        // ゴール到達チェック
        if (x === goal[0] && y === goal[1]) {
          return {
            ...state,
            isComplete: true,
            stepCount: state.stepCount + 1
          };
        }
        
        // 方向ベクトル: 0:上, 1:右, 2:下, 3:左
        const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        
        let newDir = direction;
        let newPos = current;
        let angleDelta = 0;
        let moved = false;
        
        // 2x2ループ検出: 累積角度が360度以上でスタック
        const stuckInLoop = Math.abs(totalAngle) >= 720 && visitCount[`${x},${y}`] > 3;
        
        if (totalAngle === 0 || stuckInLoop) {
          // まっすぐゴール方向へ進もうとする
          const dx = goal[0] - x;
          const dy = goal[1] - y;
          
          // 優先方向を決定
          let preferredDir = direction;
          if (Math.abs(dx) > Math.abs(dy)) {
            preferredDir = dx > 0 ? 1 : 3; // 右 or 左
          } else {
            preferredDir = dy > 0 ? 2 : 0; // 下 or 上
          }
          
          // 優先方向に進めるかチェック
          const [pdx, pdy] = dirs[preferredDir];
          const px = x + pdx;
          const py = y + pdy;
          
          if (px >= 0 && px < maze.length && py >= 0 && py < maze.length && maze[py][px] === 0) {
            newPos = [px, py];
            newDir = preferredDir;
            moved = true;
            // スタック脱出時は角度をリセット
            if (stuckInLoop) {
              angleDelta = -totalAngle;
            }
          }
        }
        
        // totalAngle != 0 または壁にぶつかった場合、右手法を使用
        if (!moved) {
          const checkOrder = [
            (direction + 1) % 4, // 右
            direction,            // 前
            (direction + 3) % 4, // 左
            (direction + 2) % 4  // 後ろ
          ];
          
          for (let i = 0; i < checkOrder.length; i++) {
            const d = checkOrder[i];
            const [dx, dy] = dirs[d];
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < maze.length && ny >= 0 && ny < maze.length && maze[ny][nx] === 0) {
              newPos = [nx, ny];
              newDir = d;
              moved = true;
              
              // 回転角度を計算
              const turn = (d - direction + 4) % 4;
              if (turn === 1) angleDelta = 90;      // 右折
              else if (turn === 3) angleDelta = -90; // 左折
              else if (turn === 2) angleDelta = 180; // 後ろ
              // turn === 0 なら直進（angleDelta = 0）
              
              break;
            }
          }
        }
        
        if (!moved) {
          return { ...state, stuck: true };
        }
        
        const key = `${newPos[0]},${newPos[1]}`;
        const newVisited = new Set(visited);
        newVisited.add(key);
        
        const newVisitCount = { ...visitCount };
        newVisitCount[key] = (newVisitCount[key] || 0) + 1;
        
        // 無限ループ検出
        if (state.stepCount > maze.length * maze.length * 2) {
          return { ...state, stuck: true };
        }
        
        return {
          ...state,
          current: newPos,
          direction: newDir,
          totalAngle: totalAngle + angleDelta,
          visited: newVisited,
          visitCount: newVisitCount,
          path: [...path, newPos],
          stepCount: state.stepCount + 1
        };
      }
    },
    
    tremaux: {
      name: 'Tremaux',
      fullName: "Tremaux's Algorithm",
      color: '#9370DB',
      
      init: (maze, start, goal) => ({
        maze,
        start,
        goal,
        current: start,
        previous: null,
        visited: new Set([`${start[0]},${start[1]}`]),
        visitCount: { [`${start[0]},${start[1]}`]: 1 },
        path: [start],
        stepCount: 0,
        isComplete: false,
        stuck: false
      }),
      
      step: (state) => {
        if (state.isComplete || state.stuck) {
          return state;
        }
        
        const { maze, current, previous, visited, visitCount, path, goal } = state;
        const [x, y] = current;
        
        if (x === goal[0] && y === goal[1]) {
          return {
            ...state,
            isComplete: true,
            stepCount: state.stepCount + 1
          };
        }
        
        const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        const neighbors = [];
        
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < maze.length && ny >= 0 && ny < maze.length && maze[ny][nx] === 0) {
            const key = `${nx},${ny}`;
            const count = visitCount[key] || 0;
            const isPrevious = previous && nx === previous[0] && ny === previous[1];
            neighbors.push({ pos: [nx, ny], count, isPrevious });
          }
        }
        
        if (neighbors.length === 0) {
          return { ...state, stuck: true };
        }
        
        // Tremauxのルール:
        // 1. 未訪問の道があれば選ぶ
        // 2. なければ1回通った道を選ぶ（来た道以外）
        // 3. それもなければ来た道を戻る
        
        let nextMove = null;
        
        // 未訪問の道を探す
        const unvisited = neighbors.filter(n => n.count === 0);
        if (unvisited.length > 0) {
          nextMove = unvisited[Math.floor(Math.random() * unvisited.length)];
        } else {
          // 1回通った道（来た道以外）
          const onceVisited = neighbors.filter(n => n.count === 1 && !n.isPrevious);
          if (onceVisited.length > 0) {
            nextMove = onceVisited[0];
          } else {
            // 来た道を戻る、または最も訪問回数が少ない道
            neighbors.sort((a, b) => a.count - b.count);
            nextMove = neighbors[0];
          }
        }
        
        if (!nextMove) {
          return { ...state, stuck: true };
        }
        
        const newPos = nextMove.pos;
        const key = `${newPos[0]},${newPos[1]}`;
        const newVisited = new Set(visited);
        newVisited.add(key);
        
        const newVisitCount = { ...visitCount };
        newVisitCount[key] = (newVisitCount[key] || 0) + 1;
        
        // 無限ループ検出を緩和（迷路サイズの4倍まで許容）
        const maxVisits = Math.max(100, maze.length * 4);
        if (state.stepCount > maze.length * maze.length * 2) {
          return { ...state, stuck: true };
        }
        
        return {
          ...state,
          current: newPos,
          previous: current,
          visited: newVisited,
          visitCount: newVisitCount,
          path: [...path, newPos],
          stepCount: state.stepCount + 1
        };
      }
    },
    
    random: {
      name: 'Random',
      fullName: 'Random Walk',
      color: '#FFD700',
      
      init: (maze, start, goal) => ({
        maze,
        start,
        goal,
        current: start,
        visited: new Set([`${start[0]},${start[1]}`]),
        visitCount: { [`${start[0]},${start[1]}`]: 1 },
        path: [start],
        stepCount: 0,
        isComplete: false,
        stuck: false
      }),
      
      step: (state) => {
        if (state.isComplete || state.stuck) {
          return state;
        }
        
        const { maze, current, visited, visitCount, path, goal } = state;
        const [x, y] = current;
        
        if (x === goal[0] && y === goal[1]) {
          return {
            ...state,
            isComplete: true,
            stepCount: state.stepCount + 1
          };
        }
        
        const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        const neighbors = [];
        
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < maze.length && ny >= 0 && ny < maze.length && maze[ny][nx] === 0) {
            const key = `${nx},${ny}`;
            const count = visitCount[key] || 0;
            neighbors.push({ pos: [nx, ny], count });
          }
        }
        
        if (neighbors.length === 0) {
          return { ...state, stuck: true };
        }
        
        // 完全ランダムに選択
        const nextMove = neighbors[Math.floor(Math.random() * neighbors.length)];
        const newPos = nextMove.pos;
        const key = `${newPos[0]},${newPos[1]}`;
        const newVisited = new Set(visited);
        newVisited.add(key);
        
        const newVisitCount = { ...visitCount };
        newVisitCount[key] = (newVisitCount[key] || 0) + 1;
        
        // 無限ループ検出（ランダムウォークは諦めを早く）
        if (state.stepCount > maze.length * maze.length * 3) {
          return { ...state, stuck: true };
        }
        
        return {
          ...state,
          current: newPos,
          visited: newVisited,
          visitCount: newVisitCount,
          path: [...path, newPos],
          stepCount: state.stepCount + 1
        };
      }
    }
  };

  const solvers = algorithmType === 'pathfinding' ? pathfindingSolvers : robotSolvers;

  // ソルバー初期化
  const initSolvers = () => {
    if (!maze.length) return;
    
    const start = [1, 1];
    const goal = [mazeSize - 2, mazeSize - 2];
    
    const startTime = Date.now();
    
    const newStates = {};
    const newStats = {};
    Object.keys(solvers).forEach(key => {
      newStates[key] = solvers[key].init(maze, start, goal);
      newStats[key] = { startTime };
    });
    
    setSolverStates(newStates);
    setStatistics(newStats);
    setIsRunning(true);
  };

  // アニメーションループ
  useEffect(() => {
    if (!isRunning) return;
    
    const step = () => {
      setSolverStates(prev => {
        const newStates = {};
        let allComplete = true;
        
        Object.keys(prev).forEach(key => {
          if (prev[key].isComplete) {
            newStates[key] = prev[key];
          } else {
            newStates[key] = solvers[key].step(prev[key]);
            allComplete = false;
            
            // 完了時に統計更新
            if (newStates[key].isComplete && !prev[key].isComplete) {
              setStatistics(s => ({
                ...s,
                [key]: {
                  ...s[key],
                  endTime: Date.now(),
                  steps: newStates[key].stepCount,
                  pathLength: newStates[key].path?.length || 0
                }
              }));
            }
          }
        });
        
        if (allComplete) {
          setIsRunning(false);
        }
        
        return newStates;
      });
      
      animationRef.current = setTimeout(step, 101 - speed);
    };
    
    animationRef.current = setTimeout(step, 101 - speed);
    
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [isRunning, speed]);

  // Canvas描画
  useEffect(() => {
    if (!maze.length || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const size = maze.length;
    
    const availableWidth = Math.min(window.innerWidth - 40, 1200);
    const panelWidth = Math.floor(availableWidth / 3);
    const cellSize = Math.floor(panelWidth / size);
    
    canvas.width = panelWidth * 3;
    canvas.height = size * cellSize;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const solverKeys = Object.keys(solvers);
    
    solverKeys.forEach((key, index) => {
      const state = solverStates[key];
      const offsetX = index * panelWidth;
      
      // 迷路描画
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const screenX = offsetX + x * cellSize;
          const screenY = y * cellSize;
          
          if (maze[y][x] === 1) {
            ctx.fillStyle = '#4a4a4a';
          } else {
            ctx.fillStyle = '#8B7355';
          }
          ctx.fillRect(screenX, screenY, cellSize, cellSize);
        }
      }
      
      if (!state) return;
      
      // 訪問済みセル（訪問回数で色の濃さを変える）
      if (state.visitCount && algorithmType === 'robot') {
        Object.entries(state.visitCount).forEach(([k, count]) => {
          const [x, y] = k.split(',').map(Number);
          // Tremauxの場合、訪問回数で色を変える
          if (key === 'tremaux') {
            if (count === 1) {
              ctx.fillStyle = 'rgba(147, 112, 219, 0.4)'; // 1回訪問: 薄い紫
            } else if (count === 2) {
              ctx.fillStyle = 'rgba(147, 112, 219, 0.6)'; // 2回訪問: 中程度の紫
            } else {
              ctx.fillStyle = 'rgba(147, 112, 219, 0.8)'; // 3回以上: 濃い紫
            }
          } else {
            // 他のアルゴリズムは従来通り
            const alpha = Math.min(0.3 + count * 0.1, 0.8);
            ctx.fillStyle = `rgba(100, 150, 255, ${alpha})`;
          }
          ctx.fillRect(offsetX + x * cellSize, y * cellSize, cellSize, cellSize);
        });
      } else if (state.visited) {
        // 通常の訪問済み表示
        state.visited.forEach(k => {
          const [x, y] = k.split(',').map(Number);
          ctx.fillStyle = 'rgba(100, 150, 255, 0.3)';
          ctx.fillRect(offsetX + x * cellSize, y * cellSize, cellSize, cellSize);
        });
      }
      
      if (state.closedSet) {
        state.closedSet.forEach(k => {
          const [x, y] = k.split(',').map(Number);
          ctx.fillStyle = 'rgba(100, 150, 255, 0.3)';
          ctx.fillRect(offsetX + x * cellSize, y * cellSize, cellSize, cellSize);
        });
      }
      
      // 最終経路（探索完了時のみ）
      if (state.path && state.isComplete) {
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = Math.max(2, cellSize / 3);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        const [sx, sy] = state.path[0];
        ctx.moveTo(offsetX + sx * cellSize + cellSize / 2, sy * cellSize + cellSize / 2);
        
        for (let i = 1; i < state.path.length; i++) {
          const [px, py] = state.path[i];
          ctx.lineTo(offsetX + px * cellSize + cellSize / 2, py * cellSize + cellSize / 2);
        }
        
        ctx.stroke();
      }
      
      // スタート
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(offsetX + 1 * cellSize, 1 * cellSize, cellSize, cellSize);
      
      // ゴール
      ctx.fillStyle = '#FF00FF';
      const gx = mazeSize - 2;
      const gy = mazeSize - 2;
      ctx.fillRect(offsetX + gx * cellSize, gy * cellSize, cellSize, cellSize);
      
      // 現在位置（ロボット）
      if (state.current && !state.isComplete) {
        const [cx, cy] = state.current;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(
          offsetX + cx * cellSize + cellSize / 2,
          cy * cellSize + cellSize / 2,
          Math.max(cellSize / 3, 2),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    });
  }, [maze, solverStates, mazeSize, algorithmType, solvers]);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white p-2 sm:p-4">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-3">
          <div className="text-xs text-gray-400">v1.5.0</div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: '#FFD700' }}>
            迷路ソルバー比較デモ
          </h1>
        </div>

        {/* アルゴリズムタイプ切り替え */}
        <div className="bg-gray-800 p-3 rounded-lg border-2 border-gray-700 mb-3">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setAlgorithmType('pathfinding');
                setSolverStates({});
                setStatistics({});
              }}
              disabled={isRunning}
              className={`flex-1 px-4 py-2 rounded font-bold ${
                algorithmType === 'pathfinding'
                  ? 'bg-blue-600'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              経路探索（BFS/DFS/A*）
            </button>
            <button
              onClick={() => {
                setAlgorithmType('robot');
                setSolverStates({});
                setStatistics({});
              }}
              disabled={isRunning}
              className={`flex-1 px-4 py-2 rounded font-bold ${
                algorithmType === 'robot'
                  ? 'bg-purple-600'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              探索ロボット（Pledge/Tremaux/Random）
            </button>
          </div>
        </div>

        {/* アルゴリズム名ヘッダー */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          {Object.keys(solvers).map(key => (
            <div
              key={key}
              className="text-center font-bold py-2 rounded"
              style={{ color: solvers[key].color, backgroundColor: 'rgba(0,0,0,0.3)' }}
            >
              {solvers[key].name}
            </div>
          ))}
        </div>

        <div className="bg-gray-800 p-2 sm:p-4 rounded-lg border-2 border-gray-700 mb-3">
          <canvas
            ref={canvasRef}
            className="rounded mx-auto"
            style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
          />
        </div>

        {/* コントロール */}
        <div className="bg-gray-800 p-3 sm:p-4 rounded-lg border-2 border-gray-700 mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-2">迷路サイズ</label>
              <div className="flex gap-2">
                {SIZE_OPTIONS.map(opt => (
                  <button
                    key={opt.size}
                    onClick={() => setMazeSize(opt.size)}
                    disabled={isRunning}
                    className={`flex-1 px-4 py-2 rounded font-bold ${
                      mazeSize === opt.size
                        ? 'bg-yellow-600'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {opt.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">速度</label>
              <input
                type="range"
                min="1"
                max="100"
                value={speed}
                onChange={(e) => setSpeed(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-gray-400 text-center">遅い ← → 速い</div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={generateMaze}
              disabled={isRunning}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded font-bold disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              迷路生成
            </button>
            <button
              onClick={initSolvers}
              disabled={!maze.length || isRunning}
              className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 rounded font-bold disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              ソルバー実行
            </button>
          </div>
        </div>

        {/* 統計 */}
        {Object.keys(statistics).length > 0 && (
          <div className="bg-gray-800 p-3 sm:p-4 rounded-lg border-2 border-gray-700 mb-3">
            <h3 className="text-lg font-bold mb-3">統計</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Object.keys(solvers).map(key => {
                const stat = statistics[key];
                const solver = solvers[key];
                const time = stat?.endTime ? ((stat.endTime - stat.startTime) / 1000).toFixed(2) : '-';
                
                return (
                  <div key={key} className="bg-gray-700 p-3 rounded">
                    <div className="font-bold mb-2" style={{ color: solver.color }}>
                      {solver.fullName}
                    </div>
                    <div className="text-sm space-y-1">
                      <div>探索ステップ: <span className="font-bold">{stat?.steps || '-'}</span></div>
                      <div>経路長: <span className="font-bold">{stat?.pathLength || '-'}</span></div>
                      <div>実行時間: <span className="font-bold">{time}秒</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 説明 */}
        <div className="bg-gray-800 p-3 sm:p-4 rounded-lg border-2 border-gray-700">
          <h3 className="text-lg font-bold mb-2">アルゴリズム説明</h3>
          <div className="space-y-2 text-sm">
            {algorithmType === 'pathfinding' ? (
              <>
                <div>
                  <span className="font-bold" style={{ color: '#4169E1' }}>BFS (幅優先探索)</span>
                  <span className="text-gray-400">: キューを使用。必ず最短経路を見つける。全方向に均等に探索を広げる。</span>
                </div>
                <div>
                  <span className="font-bold" style={{ color: '#DC143C' }}>DFS (深さ優先探索)</span>
                  <span className="text-gray-400">: スタックを使用。一つの道を最後まで進んでから戻る。最短経路とは限らない。</span>
                </div>
                <div>
                  <span className="font-bold" style={{ color: '#32CD32' }}>A* 探索</span>
                  <span className="text-gray-400">: ヒューリスティック関数でゴールに近い方向を優先。効率的に最短経路を見つける。</span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="font-bold" style={{ color: '#FF6347' }}>Pledge Algorithm</span>
                  <span className="text-gray-400">: 右手法の改良版。累積回転角度を記録。角度が0のときゴール方向へ直進し、ループから脱出できる。</span>
                </div>
                <div>
                  <span className="font-bold" style={{ color: '#9370DB' }}>Tremaux's Algorithm</span>
                  <span className="text-gray-400">: 各マスの訪問回数を記録。未訪問→1回訪問→2回訪問の順で選択。袋小路に入ったらバックトラック。色の濃さ=訪問回数。</span>
                </div>
                <div>
                  <span className="font-bold" style={{ color: '#FFD700' }}>Random Walk</span>
                  <span className="text-gray-400">: 完全ランダムに移動。戦略なし。運次第だがいつかはゴールに到達する。最も原始的な探索方法。</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MazeSolverDemo;
