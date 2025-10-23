import React, { useState, useEffect, useRef } from 'react';

// v1.3.0: Stable maze generation visualizer (solver removed)
// Commit: v1.3.0: Remove solver features, keep only maze generation algorithms

const MazeVisualizer = () => {
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('recursiveBacktracker');
  const [mazeSize, setMazeSize] = useState(21);
  const [generationState, setGenerationState] = useState(null);
  const [history, setHistory] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(100);
  const [showDescription, setShowDescription] = useState(false);
  
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  const SIZE_OPTIONS = [
    { name: '小', size: 13 },
    { name: '中', size: 21 },
    { name: '大', size: 31 },
    { name: '特大', size: 43 }
  ];

  const algorithms = {
    recursiveBacktracker: {
      name: 'Recursive Backtracker',
      description: '深さ優先探索。長い一本道ができやすい。最もポピュラーな迷路生成アルゴリズム。',
      
      init: (size) => {
        const maze = Array(size).fill(null).map(() => Array(size).fill(1));
        const stack = [[1, 1]];
        maze[1][1] = 0;
        
        return {
          maze,
          stack,
          visited: new Set(['1,1']),
          current: [1, 1],
          stepCount: 0,
          isComplete: false
        };
      },
      
      step: (state) => {
        if (state.isComplete || state.stack.length === 0) {
          return { ...state, isComplete: true, current: null };
        }
        
        const { maze, stack, visited } = state;
        const current = stack[stack.length - 1];
        const [x, y] = current;
        const size = maze.length;
        
        const directions = [
          [0, -2], [2, 0], [0, 2], [-2, 0]
        ].map((d, i) => ({ dir: d, wall: [[0, -1], [1, 0], [0, 1], [-1, 0]][i] }));
        
        const unvisited = directions.filter(({ dir }) => {
          const nx = x + dir[0];
          const ny = y + dir[1];
          return nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && 
                 !visited.has(`${nx},${ny}`);
        });
        
        if (unvisited.length === 0) {
          const newStack = stack.slice(0, -1);
          return {
            ...state,
            stack: newStack,
            current: newStack[newStack.length - 1] || null,
            stepCount: state.stepCount + 1,
            isComplete: newStack.length === 0
          };
        }
        
        const { dir, wall } = unvisited[Math.floor(Math.random() * unvisited.length)];
        const nx = x + dir[0];
        const ny = y + dir[1];
        const wx = x + wall[0];
        const wy = y + wall[1];
        
        const newMaze = maze.map(row => [...row]);
        newMaze[ny][nx] = 0;
        newMaze[wy][wx] = 0;
        
        const newVisited = new Set(visited);
        newVisited.add(`${nx},${ny}`);
        
        const newStack = [...stack, [nx, ny]];
        
        return {
          maze: newMaze,
          stack: newStack,
          visited: newVisited,
          current: [nx, ny],
          stepCount: state.stepCount + 1,
          isComplete: false
        };
      }
    },
    
    prims: {
      name: "Prim's Algorithm",
      description: 'ランダムなフロンティアから選択。バランスの取れた分岐が多い。',
      
      init: (size) => {
        const maze = Array(size).fill(null).map(() => Array(size).fill(1));
        const startX = 1;
        const startY = 1;
        maze[startY][startX] = 0;
        
        const frontier = [];
        [[0, -2], [2, 0], [0, 2], [-2, 0]].forEach(([dx, dy]) => {
          const nx = startX + dx;
          const ny = startY + dy;
          if (nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1) {
            frontier.push([nx, ny]);
          }
        });
        
        return {
          maze,
          frontier,
          visited: new Set([`${startX},${startY}`]),
          current: [startX, startY],
          stepCount: 0,
          isComplete: false
        };
      },
      
      step: (state) => {
        if (state.isComplete || state.frontier.length === 0) {
          return { ...state, isComplete: true, current: null };
        }
        
        const { maze, frontier, visited } = state;
        const size = maze.length;
        
        const randIndex = Math.floor(Math.random() * frontier.length);
        const [x, y] = frontier[randIndex];
        
        const neighbors = [[0, -2], [2, 0], [0, 2], [-2, 0]]
          .map(([dx, dy]) => [x + dx, y + dy])
          .filter(([nx, ny]) => visited.has(`${nx},${ny}`));
        
        if (neighbors.length === 0) {
          const newFrontier = frontier.filter((_, i) => i !== randIndex);
          return {
            ...state,
            frontier: newFrontier,
            stepCount: state.stepCount + 1,
            isComplete: newFrontier.length === 0
          };
        }
        
        const [nx, ny] = neighbors[Math.floor(Math.random() * neighbors.length)];
        const wx = Math.floor((x + nx) / 2);
        const wy = Math.floor((y + ny) / 2);
        
        const newMaze = maze.map(row => [...row]);
        newMaze[y][x] = 0;
        newMaze[wy][wx] = 0;
        
        const newVisited = new Set(visited);
        newVisited.add(`${x},${y}`);
        
        const newFrontier = frontier.filter((_, i) => i !== randIndex);
        [[0, -2], [2, 0], [0, 2], [-2, 0]].forEach(([dx, dy]) => {
          const fx = x + dx;
          const fy = y + dy;
          if (fx > 0 && fx < size - 1 && fy > 0 && fy < size - 1 && 
              !newVisited.has(`${fx},${fy}`) && 
              !newFrontier.some(([ffx, ffy]) => ffx === fx && ffy === fy)) {
            newFrontier.push([fx, fy]);
          }
        });
        
        return {
          maze: newMaze,
          frontier: newFrontier,
          visited: newVisited,
          current: [x, y],
          stepCount: state.stepCount + 1,
          isComplete: newFrontier.length === 0
        };
      }
    },
    
    binaryTree: {
      name: 'Binary Tree',
      description: '各セルで北か東に壁を削除。高速だがバイアスあり。',
      
      init: (size) => {
        const maze = Array(size).fill(null).map(() => Array(size).fill(1));
        const cells = [];
        
        for (let y = 1; y < size - 1; y += 2) {
          for (let x = 1; x < size - 1; x += 2) {
            maze[y][x] = 0;
            cells.push([x, y]);
          }
        }
        
        return {
          maze,
          cells,
          currentIndex: 0,
          current: null,
          stepCount: 0,
          isComplete: false
        };
      },
      
      step: (state) => {
        if (state.isComplete || state.currentIndex >= state.cells.length) {
          return { ...state, isComplete: true, current: null };
        }
        
        const { maze, cells, currentIndex } = state;
        const [x, y] = cells[currentIndex];
        const size = maze.length;
        
        const directions = [];
        if (y > 1) directions.push([0, -1, 0, -2]);
        if (x < size - 2) directions.push([1, 0, 2, 0]);
        
        if (directions.length > 0) {
          const [wx, wy, nx, ny] = directions[Math.floor(Math.random() * directions.length)];
          const newMaze = maze.map(row => [...row]);
          newMaze[y + wy][x + wx] = 0;
          
          return {
            ...state,
            maze: newMaze,
            currentIndex: currentIndex + 1,
            current: [x, y],
            stepCount: state.stepCount + 1,
            isComplete: currentIndex + 1 >= cells.length
          };
        }
        
        return {
          ...state,
          currentIndex: currentIndex + 1,
          current: [x, y],
          stepCount: state.stepCount + 1,
          isComplete: currentIndex + 1 >= cells.length
        };
      }
    },
    
    wilsons: {
      name: "Wilson's Algorithm",
      description: 'ループイレース付きランダムウォーク。均等分布で偏りなし。',
      
      init: (size) => {
        const maze = Array(size).fill(null).map(() => Array(size).fill(1));
        const unvisited = [];
        
        for (let y = 1; y < size - 1; y += 2) {
          for (let x = 1; x < size - 1; x += 2) {
            maze[y][x] = 0;
            unvisited.push([x, y]);
          }
        }
        
        const firstIndex = Math.floor(Math.random() * unvisited.length);
        const first = unvisited[firstIndex];
        const visited = new Set([`${first[0]},${first[1]}`]);
        unvisited.splice(firstIndex, 1);
        
        const startIndex = Math.floor(Math.random() * unvisited.length);
        const walkStart = unvisited[startIndex];
        
        return {
          maze,
          visited,
          unvisited,
          walkPath: [walkStart],
          current: walkStart,
          stepCount: 0,
          isComplete: false
        };
      },
      
      step: (state) => {
        if (state.isComplete || state.unvisited.length === 0) {
          return { ...state, isComplete: true, current: null };
        }
        
        const { maze, visited, unvisited, walkPath } = state;
        const size = maze.length;
        const current = walkPath[walkPath.length - 1];
        const [x, y] = current;
        const currentKey = `${x},${y}`;
        
        if (visited.has(currentKey)) {
          const newMaze = maze.map(row => [...row]);
          const newVisited = new Set(visited);
          
          for (let i = 0; i < walkPath.length - 1; i++) {
            const [x1, y1] = walkPath[i];
            const [x2, y2] = walkPath[i + 1];
            const wx = Math.floor((x1 + x2) / 2);
            const wy = Math.floor((y1 + y2) / 2);
            newMaze[wy][wx] = 0;
            newVisited.add(`${x1},${y1}`);
          }
          newVisited.add(currentKey);
          
          const newUnvisited = unvisited.filter(([ux, uy]) => 
            !newVisited.has(`${ux},${uy}`)
          );
          
          if (newUnvisited.length === 0) {
            return {
              ...state,
              maze: newMaze,
              visited: newVisited,
              unvisited: [],
              walkPath: [],
              current: null,
              stepCount: state.stepCount + 1,
              isComplete: true
            };
          }
          
          const nextIndex = Math.floor(Math.random() * newUnvisited.length);
          const nextStart = newUnvisited[nextIndex];
          
          return {
            ...state,
            maze: newMaze,
            visited: newVisited,
            unvisited: newUnvisited,
            walkPath: [nextStart],
            current: nextStart,
            stepCount: state.stepCount + 1
          };
        }
        
        const directions = [[0, -2], [2, 0], [0, 2], [-2, 0]];
        const validDirections = directions.filter(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          return nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1;
        });
        
        const [dx, dy] = validDirections[Math.floor(Math.random() * validDirections.length)];
        const next = [x + dx, y + dy];
        const nextKey = `${next[0]},${next[1]}`;
        
        const loopIndex = walkPath.findIndex(([wx, wy]) => wx === next[0] && wy === next[1]);
        
        let newWalkPath;
        if (loopIndex !== -1) {
          newWalkPath = walkPath.slice(0, loopIndex + 1);
        } else {
          newWalkPath = [...walkPath, next];
        }
        
        return {
          ...state,
          walkPath: newWalkPath,
          current: next,
          stepCount: state.stepCount + 1
        };
      }
    },
    
    kruskals: {
      name: "Kruskal's Algorithm",
      description: 'Union-Findでエッジをランダムに追加。均等な複雑さ。',
      
      init: (size) => {
        const maze = Array(size).fill(null).map(() => Array(size).fill(1));
        const parent = {};
        const edges = [];
        
        for (let y = 1; y < size - 1; y += 2) {
          for (let x = 1; x < size - 1; x += 2) {
            maze[y][x] = 0;
            parent[`${x},${y}`] = `${x},${y}`;
            
            if (x + 2 < size - 1) {
              edges.push([[x, y], [x + 2, y], [x + 1, y]]);
            }
            if (y + 2 < size - 1) {
              edges.push([[x, y], [x, y + 2], [x, y + 1]]);
            }
          }
        }
        
        for (let i = edges.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [edges[i], edges[j]] = [edges[j], edges[i]];
        }
        
        return {
          maze,
          edges,
          parent,
          processed: 0,
          current: null,
          stepCount: 0,
          isComplete: false
        };
      },
      
      step: (state) => {
        if (state.isComplete || state.processed >= state.edges.length) {
          return { ...state, isComplete: true, current: null };
        }
        
        const { maze, edges, parent, processed } = state;
        const [[x1, y1], [x2, y2], [wx, wy]] = edges[processed];
        
        const find = (key) => {
          if (parent[key] !== key) {
            parent[key] = find(parent[key]);
          }
          return parent[key];
        };
        
        const key1 = `${x1},${y1}`;
        const key2 = `${x2},${y2}`;
        const root1 = find(key1);
        const root2 = find(key2);
        
        let newMaze = maze;
        
        if (root1 !== root2) {
          newMaze = maze.map(row => [...row]);
          newMaze[wy][wx] = 0;
          parent[root2] = root1;
        }
        
        return {
          maze: newMaze,
          edges,
          parent,
          processed: processed + 1,
          current: [wx, wy],
          stepCount: state.stepCount + 1,
          isComplete: processed + 1 >= edges.length
        };
      }
    }
  };

  const initMaze = () => {
    const algo = algorithms[selectedAlgorithm];
    const initialState = algo.init(mazeSize);
    setGenerationState(initialState);
    setHistory([initialState]);
    setIsPlaying(false);
  };

  useEffect(() => {
    initMaze();
  }, [selectedAlgorithm, mazeSize]);

  useEffect(() => {
    if (isPlaying && generationState && !generationState.isComplete) {
      animationRef.current = setTimeout(() => {
        stepForward();
      }, speed);
    }
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [isPlaying, generationState, speed]);

  const stepForward = () => {
    if (!generationState || generationState.isComplete) return;
    
    const algo = algorithms[selectedAlgorithm];
    const newState = algo.step(generationState);
    setGenerationState(newState);
    setHistory(prev => [...prev, newState]);
  };

  const stepBackward = () => {
    if (history.length <= 1) return;
    
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    setGenerationState(newHistory[newHistory.length - 1]);
    setIsPlaying(false);
  };

  const runToCompletion = () => {
    setIsPlaying(false);
    if (!generationState) return;
    
    let state = generationState;
    const algo = algorithms[selectedAlgorithm];
    const newHistory = [...history];
    
    while (!state.isComplete) {
      state = algo.step(state);
      newHistory.push(state);
    }
    
    setGenerationState(state);
    setHistory(newHistory);
  };

  const togglePlay = () => {
    if (generationState?.isComplete) {
      initMaze();
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    if (!canvasRef.current || !generationState) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { maze, current, stack, frontier } = generationState;
    const size = maze.length;
    
    const availableSize = Math.min(window.innerWidth - 40, window.innerHeight - 400);
    const cellSize = Math.floor(availableSize / size);
    
    canvas.width = size * cellSize;
    canvas.height = size * cellSize;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const screenX = x * cellSize;
        const screenY = y * cellSize;
        
        if (maze[y][x] === 1) {
          ctx.fillStyle = '#4a4a4a';
        } else {
          ctx.fillStyle = '#d4a574';
        }
        
        ctx.fillRect(screenX, screenY, cellSize, cellSize);
      }
    }

    if (selectedAlgorithm === 'recursiveBacktracker' && stack) {
      stack.forEach(([x, y]) => {
        ctx.fillStyle = 'rgba(100, 150, 255, 0.3)';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      });
    }
    
    if (selectedAlgorithm === 'prims' && frontier) {
      frontier.forEach(([x, y]) => {
        ctx.fillStyle = 'rgba(255, 150, 100, 0.3)';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      });
    }
    
    if (selectedAlgorithm === 'wilsons') {
      const { visited, walkPath } = generationState;
      
      if (visited) {
        visited.forEach(key => {
          const [x, y] = key.split(',').map(Number);
          ctx.fillStyle = 'rgba(100, 255, 100, 0.2)';
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        });
      }
      
      if (walkPath && walkPath.length > 1) {
        ctx.strokeStyle = 'rgba(255, 100, 255, 0.8)';
        ctx.lineWidth = Math.max(2, cellSize / 3);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(walkPath[0][0] * cellSize + cellSize / 2, walkPath[0][1] * cellSize + cellSize / 2);
        
        for (let i = 1; i < walkPath.length; i++) {
          const [x, y] = walkPath[i];
          ctx.lineTo(x * cellSize + cellSize / 2, y * cellSize + cellSize / 2);
        }
        
        ctx.stroke();
        
        walkPath.forEach(([x, y]) => {
          ctx.fillStyle = 'rgba(255, 100, 255, 0.3)';
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        });
      }
    }

    if (current) {
      const [x, y] = current;
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= size; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, size * cellSize);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(size * cellSize, i * cellSize);
      ctx.stroke();
    }
  }, [generationState, selectedAlgorithm]);

  const totalCells = Math.floor(((mazeSize - 2) / 2) * ((mazeSize - 2) / 2));
  const progress = generationState ? Math.min(100, Math.round((generationState.stepCount / totalCells) * 100)) : 0;

  const getStatusText = () => {
    if (!generationState) return '';
    
    if (generationState.isComplete) {
      return '完成!';
    }
    
    switch (selectedAlgorithm) {
      case 'binaryTree':
        const totalCells = generationState.cells?.length || 0;
        const processedCells = generationState.currentIndex || 0;
        return `処理済み: ${processedCells}/${totalCells}`;
      case 'recursiveBacktracker':
        return `スタックサイズ: ${generationState.stack?.length || 0}`;
      case 'prims':
        return `フロンティア: ${generationState.frontier?.length || 0}`;
      case 'kruskals':
        return `処理済みエッジ: ${generationState.processed}/${generationState.edges?.length || 0}`;
      case 'wilsons':
        const unvisitedCount = generationState.unvisited?.length || 0;
        const walkLength = generationState.walkPath?.length || 0;
        return `未訪問: ${unvisitedCount} | ウォーク長: ${walkLength}`;
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white p-2 sm:p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-3">
          <div className="text-xs text-gray-400">v1.3.0</div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: '#FFD700' }}>
            迷路生成ビジュアライザー
          </h1>
        </div>

        <div className="bg-gray-800 p-2 sm:p-4 rounded-lg border-2 border-gray-700 mb-3">
          <canvas
            ref={canvasRef}
            className="rounded mx-auto"
            style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
          />
        </div>

        <div className="bg-gray-800 p-3 sm:p-4 rounded-lg border-2 border-gray-700 mb-3">
          <div className="flex justify-between items-center mb-3 text-xs sm:text-sm">
            <div>
              <span className="text-gray-400">ステップ: </span>
              <span className="font-bold text-yellow-400">{generationState?.stepCount || 0}</span>
            </div>
            <div>
              <span className="text-gray-400">完成度: </span>
              <span className="font-bold text-green-400">{progress}%</span>
            </div>
            <div className="text-gray-400 hidden sm:block">
              {getStatusText()}
            </div>
          </div>

          <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: '#FFD700' }}>
                アルゴリズム:
              </label>
              <select
                value={selectedAlgorithm}
                onChange={(e) => setSelectedAlgorithm(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded bg-gray-700 border border-gray-600 text-white"
              >
                {Object.entries(algorithms).map(([key, algo]) => (
                  <option key={key} value={key}>
                    {algo.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: '#FFD700' }}>
                サイズ:
              </label>
              <div className="flex gap-1">
                {SIZE_OPTIONS.map(option => (
                  <button
                    key={option.size}
                    onClick={() => setMazeSize(option.size)}
                    className={`flex-1 px-2 py-1.5 text-sm rounded font-bold transition-all ${
                      mazeSize === option.size
                        ? 'bg-blue-600 border border-yellow-500'
                        : 'bg-gray-700 border border-gray-600'
                    }`}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-3">
            <button
              onClick={() => setShowDescription(!showDescription)}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              {showDescription ? '▼' : '▶'} アルゴリズム説明
            </button>
            {showDescription && (
              <div className="mt-2 bg-gray-700 p-2 rounded text-xs text-gray-300">
                {algorithms[selectedAlgorithm].description}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={stepBackward}
              disabled={history.length <= 1}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded font-bold"
            >
              ◀
            </button>
            
            <button
              onClick={togglePlay}
              className={`flex-1 px-4 py-1.5 text-sm rounded font-bold ${
                isPlaying
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {generationState?.isComplete ? '🔄' : isPlaying ? '⏸' : '▶'}
            </button>
            
            <button
              onClick={stepForward}
              disabled={!generationState || generationState.isComplete}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded font-bold"
            >
              ▶
            </button>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-bold mb-1" style={{ color: '#FFD700' }}>
                速度: {speed}ms
              </label>
              <input
                type="range"
                min="20"
                max="500"
                step="20"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex gap-2 items-end">
              <button
                onClick={initMaze}
                className="px-4 py-1.5 text-sm bg-orange-600 hover:bg-orange-700 rounded font-bold whitespace-nowrap"
              >
                🔄
              </button>
              <button
                onClick={runToCompletion}
                disabled={!generationState || generationState.isComplete}
                className="px-4 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 disabled:text-gray-600 rounded font-bold whitespace-nowrap"
              >
                ⚡
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-3 rounded-lg border-2 border-gray-700">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-gray-700 border border-gray-500 flex-shrink-0"></div>
              <span>壁</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 flex-shrink-0" style={{ background: '#d4a574' }}></div>
              <span>通路</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 flex-shrink-0" style={{ background: '#FFD700' }}></div>
              <span>処理中</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 flex-shrink-0" style={{ background: 'rgba(100, 150, 255, 0.5)' }}></div>
              <span>候補</span>
            </div>
          </div>
          {selectedAlgorithm === 'wilsons' && (
            <div className="grid grid-cols-2 gap-2 text-xs mt-2 pt-2 border-t border-gray-700">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 flex-shrink-0" style={{ background: 'rgba(100, 255, 100, 0.3)' }}></div>
                <span>訪問済み</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 flex-shrink-0" style={{ background: 'rgba(255, 100, 255, 0.5)' }}></div>
                <span>ウォーク中</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MazeVisualizer;
