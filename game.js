import React, { useState, useEffect, useRef } from 'react';

// v0.5.5: Fix start button position for landscape, optimize overview mode (remove fog of war)
// Commit: v0.5.5: Fix start button position for landscape, optimize overview mode (remove fog of war)

const MazeBattleGame = () => {
  const [gameState, setGameState] = useState('menu');
  const [maze, setMaze] = useState([]);
  const [mazeSize, setMazeSize] = useState(43);
  const [player1, setPlayer1] = useState({ x: 1, y: 1 });
  const [player2, setPlayer2] = useState({ x: 11, y: 11 });
  const [direction1, setDirection1] = useState({ dx: 1, dy: 0 });
  const [direction2, setDirection2] = useState({ dx: -1, dy: 0 });
  const [footprintPath1, setFootprintPath1] = useState([]);
  const [footprintPath2, setFootprintPath2] = useState([]);
  const [wallBreaks1, setWallBreaks1] = useState(3);
  const [wallBreaks2, setWallBreaks2] = useState(3);
  const [brokenWalls, setBrokenWalls] = useState(new Set());
  const [particles, setParticles] = useState([]);
  const [winner, setWinner] = useState(null);
  const [gamepadDebug, setGamepadDebug] = useState('');
  const [pressedKeys, setPressedKeys] = useState(new Set());
  const [cellSize, setCellSize] = useState(18);
  const [touchHolding, setTouchHolding] = useState({ p1: null, p2: null });
  const [debugMessages, setDebugMessages] = useState([]);
  const [viewMode, setViewMode] = useState('circle');
  const [lastViewModeToggle, setLastViewModeToggle] = useState(0);
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastMoveRef = useRef({ p1: 0, p2: 0 });
  const audioContextRef = useRef(null);

  const VISIBILITY = 5;
  const MOVE_DELAY = 180;
  const VIEW_MODE_TOGGLE_DELAY = 200;

  const MAZE_SIZE_OPTIONS = [
    { name: '小 (Dev)', size: 13, nodes: 49, time: '~2分' },
    { name: '中 (推奨)', size: 31, nodes: 225, time: '~8分' },
    { name: '大 (長期戦)', size: 43, nodes: 441, time: '~15分' }
  ];

  const VIEW_MODES = [
    { id: 'square', name: '四角', icon: '□' },
    { id: 'circle', name: '円形', icon: '○' },
    { id: 'overview', name: '全体', icon: '🗺️' }
  ];

  const canvasSize = viewMode === 'overview' 
    ? { width: mazeSize * cellSize, height: mazeSize * cellSize }
    : { width: ((VISIBILITY * 2 + 1) * cellSize) * 2 + 30, height: (VISIBILITY * 2 + 1) * cellSize };

  const addDebugLog = (message) => {
    setDebugMessages(prev => {
      const newMessages = [...prev, `${new Date().toLocaleTimeString()}: ${message}`];
      return newMessages.slice(-5);
    });
  };

  const generateMaze = (size) => {
    const maze = Array(size).fill().map(() => Array(size).fill(1));
    const stack = [];
    const startX = 1;
    const startY = 1;
    maze[startY][startX] = 0;
    stack.push([startX, startY]);
    const directions = [[0, -2], [2, 0], [0, 2], [-2, 0]];

    while (stack.length > 0) {
      const [x, y] = stack[stack.length - 1];
      const validDirs = [];

      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && maze[ny][nx] === 1) {
          validDirs.push([dx, dy]);
        }
      }

      if (validDirs.length > 0) {
        const [dx, dy] = validDirs[Math.floor(Math.random() * validDirs.length)];
        const nx = x + dx;
        const ny = y + dy;
        maze[ny][nx] = 0;
        maze[y + dy / 2][x + dx / 2] = 0;
        stack.push([nx, ny]);
      } else {
        stack.pop();
      }
    }

    return maze;
  };

  const startGame = () => {
    setPlayer1({ x: 1, y: 1 });
    setPlayer2({ x: 1, y: 1 });
    
    const newMaze = generateMaze(mazeSize);
    setMaze(newMaze);
    const goalPos = mazeSize - 2;
    
    setPlayer2({ x: goalPos, y: goalPos });
    setDirection1({ dx: 1, dy: 0 });
    setDirection2({ dx: -1, dy: 0 });
    setFootprintPath1([{ x: 1, y: 1 }]);
    setFootprintPath2([{ x: goalPos, y: goalPos }]);
    setWallBreaks1(3);
    setWallBreaks2(3);
    setBrokenWalls(new Set());
    setParticles([]);
    setWinner(null);
    setPressedKeys(new Set());
    setTouchHolding({ p1: null, p2: null });
    setShowRetireConfirm(false);
    setGameState('playing');
    addDebugLog(`Game started: ${mazeSize}x${mazeSize} maze`);
  };

  const handleRetire = () => {
    setShowRetireConfirm(true);
  };

  const confirmRetire = () => {
    setPressedKeys(new Set());
    setTouchHolding({ p1: null, p2: null });
    setGameState('menu');
    setShowRetireConfirm(false);
    addDebugLog('Game retired - returning to menu');
  };

  const cancelRetire = () => {
    setShowRetireConfirm(false);
  };

  const cycleViewMode = () => {
    const now = Date.now();
    if (now - lastViewModeToggle < VIEW_MODE_TOGGLE_DELAY) return;
    
    setViewMode(prev => {
      const currentIndex = VIEW_MODES.findIndex(mode => mode.id === prev);
      const nextIndex = (currentIndex + 1) % VIEW_MODES.length;
      addDebugLog(`View mode: ${VIEW_MODES[nextIndex].name}`);
      return VIEW_MODES[nextIndex].id;
    });
    setLastViewModeToggle(now);
  };

  const movePlayer = (player, setPlayer, dx, dy, playerNum, setDirection) => {
    const goalPos = mazeSize - 2;
    const goalX = playerNum === 1 ? goalPos : 1;
    const goalY = playerNum === 1 ? goalPos : 1;

    setDirection({ dx, dy });

    const newX = player.x + dx;
    const newY = player.y + dy;

    if (newX >= 0 && newX < mazeSize && newY >= 0 && newY < mazeSize && maze[newY][newX] === 0) {
      setPlayer({ x: newX, y: newY });

      const now = Date.now();
      if (playerNum === 1) {
        setFootprintPath1(prev => [...prev, { x: newX, y: newY }]);
        lastMoveRef.current.p1 = now;
      } else {
        setFootprintPath2(prev => [...prev, { x: newX, y: newY }]);
        lastMoveRef.current.p2 = now;
      }

      if (newX === goalX && newY === goalY) {
        setWinner(playerNum);
        setGameState('finished');
        setPressedKeys(new Set());
        setTouchHolding({ p1: null, p2: null });
      }
    }
  };

  const breakWall = (player, direction, playerNum) => {
    const wallBreaks = playerNum === 1 ? wallBreaks1 : wallBreaks2;
    if (wallBreaks <= 0) return;

    const wallX = player.x + direction.dx;
    const wallY = player.y + direction.dy;

    if (wallX > 0 && wallX < mazeSize - 1 && wallY > 0 && wallY < mazeSize - 1 && maze[wallY][wallX] === 1) {
      maze[wallY][wallX] = 0;
      setBrokenWalls(prev => new Set([...prev, `${wallX},${wallY}`]));

      if (playerNum === 1) {
        setWallBreaks1(prev => prev - 1);
      } else {
        setWallBreaks2(prev => prev - 1);
      }

      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const speed = 2 + Math.random() * 2;
        setParticles(prev => [...prev, {
          x: wallX * cellSize + cellSize / 2,
          y: wallY * cellSize + cellSize / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          life: 30,
          color: `rgb(${139 + Math.random() * 50}, ${90 + Math.random() * 30}, ${43 + Math.random() * 20})`
        }]);
      }

      if (audioContextRef.current) {
        const osc = audioContextRef.current.createOscillator();
        const gain = audioContextRef.current.createGain();
        osc.connect(gain);
        gain.connect(audioContextRef.current.destination);
        osc.frequency.value = 200;
        gain.gain.setValueAtTime(0.1, audioContextRef.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.1);
        osc.start();
        osc.stop(audioContextRef.current.currentTime + 0.1);
      }
    }
  };

  const DPadButton = ({ direction, onStart, onEnd, style, buttonId }) => {
    const [isPressed, setIsPressed] = useState(false);

    const handlePointerDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.target.setPointerCapture) {
        e.target.setPointerCapture(e.pointerId);
      }
      setIsPressed(true);
      onStart();
    };

    const handlePointerUp = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsPressed(false);
      onEnd();
    };

    const handlePointerCancel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsPressed(false);
      onEnd();
    };

    return (
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className={`w-12 h-12 rounded flex items-center justify-center text-white font-bold select-none transition-all ${
          isPressed ? 'bg-gray-500 scale-95' : 'bg-gray-700'
        }`}
        style={{ ...style, touchAction: 'none' }}
      >
        {direction === 'up' && '▲'}
        {direction === 'down' && '▼'}
        {direction === 'left' && '◄'}
        {direction === 'right' && '►'}
      </button>
    );
  };

  const ControlPanel = ({ playerNum, wallBreaks }) => {
    const handleDPadStart = (dx, dy) => {
      const key = playerNum === 1 ? 'p1' : 'p2';
      setTouchHolding(prev => ({ ...prev, [key]: { dx, dy } }));
      addDebugLog(`DPad Start: P${playerNum} (${dx}, ${dy})`);
    };

    const handleDPadEnd = () => {
      const key = playerNum === 1 ? 'p1' : 'p2';
      setTouchHolding(prev => ({ ...prev, [key]: null }));
      addDebugLog(`DPad End: P${playerNum}`);
    };

    const handleBreakWall = () => {
      if (playerNum === 1) {
        breakWall(player1, direction1, 1);
      } else {
        breakWall(player2, direction2, 2);
      }
    };

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="text-sm font-bold" style={{ color: playerNum === 1 ? '#FF6B6B' : '#6B9BFF' }}>
          {playerNum === 1 ? '🔴 Player 1' : '🔵 Player 2'}
        </div>
        <div className="text-xs">
          💣 破壊: {wallBreaks}回
        </div>
        <div className="grid grid-cols-3 gap-1">
          <div></div>
          <DPadButton direction="up" onStart={() => handleDPadStart(0, -1)} onEnd={handleDPadEnd} buttonId={`p${playerNum}_up`} />
          <div></div>
          <DPadButton direction="left" onStart={() => handleDPadStart(-1, 0)} onEnd={handleDPadEnd} buttonId={`p${playerNum}_left`} />
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              handleBreakWall();
            }}
            className="w-12 h-12 bg-red-700 active:bg-red-500 rounded flex items-center justify-center text-2xl select-none"
            style={{ touchAction: 'none' }}
          >
            💣
          </button>
          <DPadButton direction="right" onStart={() => handleDPadStart(1, 0)} onEnd={handleDPadEnd} buttonId={`p${playerNum}_right`} />
          <div></div>
          <DPadButton direction="down" onStart={() => handleDPadStart(0, 1)} onEnd={handleDPadEnd} buttonId={`p${playerNum}_down`} />
          <div></div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const checkAllInputs = () => {
      const now = Date.now();
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const debugInfo = [];

      pressedKeys.forEach(key => {
        if ((key === 'w' || key === 'W') && now - lastMoveRef.current.p1 >= MOVE_DELAY) {
          movePlayer(player1, setPlayer1, 0, -1, 1, setDirection1);
        }
        if ((key === 's' || key === 'S') && now - lastMoveRef.current.p1 >= MOVE_DELAY) {
          movePlayer(player1, setPlayer1, 0, 1, 1, setDirection1);
        }
        if ((key === 'a' || key === 'A') && now - lastMoveRef.current.p1 >= MOVE_DELAY) {
          movePlayer(player1, setPlayer1, -1, 0, 1, setDirection1);
        }
        if ((key === 'd' || key === 'D') && now - lastMoveRef.current.p1 >= MOVE_DELAY) {
          movePlayer(player1, setPlayer1, 1, 0, 1, setDirection1);
        }

        if ((key === 'ArrowUp' || key === 'i' || key === 'I') && now - lastMoveRef.current.p2 >= MOVE_DELAY) {
          movePlayer(player2, setPlayer2, 0, -1, 2, setDirection2);
        }
        if ((key === 'ArrowDown' || key === 'k' || key === 'K') && now - lastMoveRef.current.p2 >= MOVE_DELAY) {
          movePlayer(player2, setPlayer2, 0, 1, 2, setDirection2);
        }
        if ((key === 'ArrowLeft' || key === 'j' || key === 'J') && now - lastMoveRef.current.p2 >= MOVE_DELAY) {
          movePlayer(player2, setPlayer2, -1, 0, 2, setDirection2);
        }
        if ((key === 'ArrowRight' || key === 'l' || key === 'L') && now - lastMoveRef.current.p2 >= MOVE_DELAY) {
          movePlayer(player2, setPlayer2, 1, 0, 2, setDirection2);
        }
      });

      if (touchHolding.p1 && now - lastMoveRef.current.p1 >= MOVE_DELAY) {
        movePlayer(player1, setPlayer1, touchHolding.p1.dx, touchHolding.p1.dy, 1, setDirection1);
      }
      if (touchHolding.p2 && now - lastMoveRef.current.p2 >= MOVE_DELAY) {
        movePlayer(player2, setPlayer2, touchHolding.p2.dx, touchHolding.p2.dy, 2, setDirection2);
      }

      for (let gpIndex = 0; gpIndex < 4; gpIndex++) {
        const gp = gamepads[gpIndex];
        if (!gp) continue;
        
        let gpInfo = `[GP${gpIndex}] ${gp.id.substring(0, 15)}`;
        gpInfo += ` | Axes:`;
        for (let i = 0; i < gp.axes.length; i++) {
          gpInfo += ` ${gp.axes[i].toFixed(2)}`;
        }
        gpInfo += ` | Btns:`;
        for (let i = 0; i < gp.buttons.length; i++) {
          if (gp.buttons[i].pressed) {
            gpInfo += ` B${i}`;
          }
        }
        debugInfo.push(gpInfo);
      }
      
      if (gamepads[0]) {
        const gp = gamepads[0];
        const threshold = 0.5;
        
        const axes01 = [gp.axes[0] || 0, gp.axes[1] || 0];
        if (Math.abs(axes01[0]) > threshold || Math.abs(axes01[1]) > threshold) {
          const dx = Math.abs(axes01[0]) > Math.abs(axes01[1]) ? (axes01[0] > 0 ? 1 : -1) : 0;
          const dy = Math.abs(axes01[1]) > Math.abs(axes01[0]) ? (axes01[1] > 0 ? 1 : -1) : 0;
          if (now - lastMoveRef.current.p1 >= MOVE_DELAY) {
            movePlayer(player1, setPlayer1, dx, dy, 1, setDirection1);
          }
        }
        
        if (gp.buttons[12]?.pressed && now - lastMoveRef.current.p1 >= MOVE_DELAY) 
          movePlayer(player1, setPlayer1, 0, -1, 1, setDirection1);
        if (gp.buttons[13]?.pressed && now - lastMoveRef.current.p1 >= MOVE_DELAY) 
          movePlayer(player1, setPlayer1, 0, 1, 1, setDirection1);
        if (gp.buttons[14]?.pressed && now - lastMoveRef.current.p1 >= MOVE_DELAY) 
          movePlayer(player1, setPlayer1, -1, 0, 1, setDirection1);
        if (gp.buttons[15]?.pressed && now - lastMoveRef.current.p1 >= MOVE_DELAY) 
          movePlayer(player1, setPlayer1, 1, 0, 1, setDirection1);

        if (gp.axes.length > 3) {
          const axes23 = [gp.axes[2] || 0, gp.axes[3] || 0];
          if (Math.abs(axes23[0]) > threshold || Math.abs(axes23[1]) > threshold) {
            const dx = Math.abs(axes23[0]) > Math.abs(axes23[1]) ? (axes23[0] > 0 ? 1 : -1) : 0;
            const dy = Math.abs(axes23[1]) > Math.abs(axes23[0]) ? (axes23[1] > 0 ? 1 : -1) : 0;
            if (now - lastMoveRef.current.p2 >= MOVE_DELAY) {
              movePlayer(player2, setPlayer2, dx, dy, 2, setDirection2);
            }
          }
        }
        
        if (gp.buttons[0]?.pressed && now - lastMoveRef.current.p2 >= MOVE_DELAY) 
          movePlayer(player2, setPlayer2, 1, 0, 2, setDirection2);
        if (gp.buttons[1]?.pressed && now - lastMoveRef.current.p2 >= MOVE_DELAY) 
          movePlayer(player2, setPlayer2, 0, 1, 2, setDirection2);
        if (gp.buttons[2]?.pressed && now - lastMoveRef.current.p2 >= MOVE_DELAY) 
          movePlayer(player2, setPlayer2, 0, -1, 2, setDirection2);
        if (gp.buttons[3]?.pressed && now - lastMoveRef.current.p2 >= MOVE_DELAY) 
          movePlayer(player2, setPlayer2, -1, 0, 2, setDirection2);

        if (gp.buttons[4]?.pressed) breakWall(player1, direction1, 1);
        if (gp.buttons[5]?.pressed) breakWall(player2, direction2, 2);
        if (gp.buttons[8]?.pressed) handleRetire();
      }

      if (debugInfo.length > 0) {
        setGamepadDebug(debugInfo.join('\n'));
      }

      animationRef.current = requestAnimationFrame(checkAllInputs);
    };

    animationRef.current = requestAnimationFrame(checkAllInputs);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, pressedKeys, touchHolding, player1, player2, maze, direction1, direction2, cellSize, mazeSize]);

  useEffect(() => {
    if (gameState === 'menu' || gameState === 'finished') {
      const handleMenuKey = (e) => {
        if (e.key === 'Enter') {
          if (gameState === 'menu') {
            startGame();
          } else {
            setGameState('menu');
          }
        }
      };
      window.addEventListener('keydown', handleMenuKey, true);
      return () => window.removeEventListener('keydown', handleMenuKey, true);
    }

    if (gameState !== 'playing') return;

    const handleKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Escape'].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'v' || e.key === 'V') {
        cycleViewMode();
        e.preventDefault();
        return;
      }

      setPressedKeys(prev => new Set([...prev, e.key]));
      
      if (e.key === 'e' || e.key === 'E') {
        breakWall(player1, direction1, 1);
        e.preventDefault();
      }
      if (e.key === 'u' || e.key === 'U' || e.key === 'Shift') {
        breakWall(player2, direction2, 2);
        e.preventDefault();
      }

      if (e.key === 'Escape') {
        handleRetire();
        e.preventDefault();
      }
    };

    const handleKeyUp = (e) => {
      setPressedKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(e.key);
        return newSet;
      });
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [gameState, player1, player2, maze, direction1, direction2, viewMode]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const updateParticles = () => {
      setParticles(prev => {
        return prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.1,
            life: p.life - 1
          }))
          .filter(p => p.life > 0);
      });
    };

    const interval = setInterval(updateParticles, 1000 / 60);
    return () => clearInterval(interval);
  }, [gameState]);

  useEffect(() => {
    if (gameState !== 'playing' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (viewMode === 'overview') {
      // 全体モード: フォグオブウォー無し、全体を明るく表示
      for (let y = 0; y < mazeSize; y++) {
        for (let x = 0; x < mazeSize; x++) {
          const screenX = x * cellSize;
          const screenY = y * cellSize;

          const checkerSize = 3;
          const isLightTile = (Math.floor(x / checkerSize) + Math.floor(y / checkerSize)) % 2 === 0;

          if (maze[y][x] === 1) {
            if (brokenWalls.has(`${x},${y}`)) {
              ctx.fillStyle = '#4a3019';
            } else {
              ctx.fillStyle = '#5a5a5a';
              ctx.fillRect(screenX, screenY, cellSize, cellSize);

              ctx.strokeStyle = '#3a3a3a';
              ctx.lineWidth = 1;
              for (let i = 0; i < 3; i++) {
                const offsetX = Math.random() * cellSize * 0.6 + cellSize * 0.2;
                const offsetY = Math.random() * cellSize * 0.6 + cellSize * 0.2;
                const length = Math.random() * cellSize * 0.3 + cellSize * 0.1;
                const angle = Math.random() * Math.PI;
                ctx.beginPath();
                ctx.moveTo(screenX + offsetX, screenY + offsetY);
                ctx.lineTo(screenX + offsetX + Math.cos(angle) * length, screenY + offsetY + Math.sin(angle) * length);
                ctx.stroke();
              }
              continue;
            }
          } else {
            const baseColor = isLightTile ? 210 : 190;
            ctx.fillStyle = `rgb(${baseColor}, ${baseColor - 30}, ${baseColor - 80})`;
          }
          ctx.fillRect(screenX, screenY, cellSize, cellSize);

          if ((x === 1 && y === 1) || (x === mazeSize - 2 && y === mazeSize - 2)) {
            ctx.fillStyle = x === 1 ? 'rgba(220, 20, 60, 0.3)' : 'rgba(65, 105, 225, 0.3)';
            ctx.fillRect(screenX, screenY, cellSize, cellSize);
          }
        }
      }

      // 足跡
      const drawTrail = (path, color) => {
        if (path.length < 2) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(path[0].x * cellSize + cellSize / 2, path[0].y * cellSize + cellSize / 2);
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x * cellSize + cellSize / 2, path[i].y * cellSize + cellSize / 2);
        }
        ctx.stroke();
      };

      drawTrail(footprintPath1, 'rgba(255, 80, 80, 0.5)');
      drawTrail(footprintPath2, 'rgba(80, 120, 255, 0.5)');

      // プレイヤー描画
      const drawPlayerWithEyes = (player, color, direction) => {
        const screenX = player.x * cellSize + cellSize / 2;
        const screenY = player.y * cellSize + cellSize / 2;
        const radius = Math.max(cellSize / 2.5, 5);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fill();

        const eyeOffsetX = direction.dx * radius * 0.3;
        const eyeOffsetY = direction.dy * radius * 0.3;
        const eyeSize = Math.max(radius * 0.25, 2);
        const eyeSpacing = Math.max(radius * 0.4, 3);

        ctx.fillStyle = 'white';
        if (direction.dx !== 0) {
          ctx.beginPath();
          ctx.arc(screenX + eyeOffsetX, screenY - eyeSpacing / 2, eyeSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(screenX + eyeOffsetX, screenY + eyeSpacing / 2, eyeSize, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(screenX - eyeSpacing / 2, screenY + eyeOffsetY, eyeSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(screenX + eyeSpacing / 2, screenY + eyeOffsetY, eyeSize, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = 'black';
        const pupilSize = Math.max(eyeSize * 0.5, 1);
        if (direction.dx !== 0) {
          ctx.beginPath();
          ctx.arc(screenX + eyeOffsetX + direction.dx * eyeSize * 0.3, screenY - eyeSpacing / 2, pupilSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(screenX + eyeOffsetX + direction.dx * eyeSize * 0.3, screenY + eyeSpacing / 2, pupilSize, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(screenX - eyeSpacing / 2, screenY + eyeOffsetY + direction.dy * eyeSize * 0.3, pupilSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(screenX + eyeSpacing / 2, screenY + eyeOffsetY + direction.dy * eyeSize * 0.3, pupilSize, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      drawPlayerWithEyes(player1, '#DC143C', direction1);
      drawPlayerWithEyes(player2, '#4169E1', direction2);

    } else {
      // 個別視点モード (square/circle)
      const drawPlayerView = (player, otherPlayer, otherDirection, footprintPath, offsetX, playerNum, direction) => {
        const otherFootprintPath = playerNum === 1 ? footprintPath2 : footprintPath1;
        const goalX = playerNum === 1 ? mazeSize - 2 : 1;
        const goalY = playerNum === 1 ? mazeSize - 2 : 1;

        const viewWidth = (VISIBILITY * 2 + 1) * cellSize;
        const viewHeight = (VISIBILITY * 2 + 1) * cellSize;

        ctx.save();
        ctx.translate(offsetX, 0);

        if (viewMode === 'circle') {
          ctx.beginPath();
          ctx.arc(viewWidth / 2, viewHeight / 2, VISIBILITY * cellSize + cellSize / 2, 0, Math.PI * 2);
          ctx.clip();
        }

        for (let dy = -VISIBILITY; dy <= VISIBILITY; dy++) {
          for (let dx = -VISIBILITY; dx <= VISIBILITY; dx++) {
            const worldX = player.x + dx;
            const worldY = player.y + dy;
            if (worldX < 0 || worldX >= mazeSize || worldY < 0 || worldY >= mazeSize) continue;

            const screenX = (dx + VISIBILITY) * cellSize;
            const screenY = (dy + VISIBILITY) * cellSize;

            const checkerSize = 3;
            const isLightTile = (Math.floor(worldX / checkerSize) + Math.floor(worldY / checkerSize)) % 2 === 0;

            if (maze[worldY][worldX] === 1) {
              if (brokenWalls.has(`${worldX},${worldY}`)) {
                ctx.fillStyle = '#4a3019';
              } else {
                ctx.fillStyle = '#5a5a5a';
                ctx.fillRect(screenX, screenY, cellSize, cellSize);

                ctx.strokeStyle = '#3a3a3a';
                ctx.lineWidth = 1;
                for (let i = 0; i < 3; i++) {
                  const offsetX = Math.random() * cellSize * 0.6 + cellSize * 0.2;
                  const offsetY = Math.random() * cellSize * 0.6 + cellSize * 0.2;
                  const length = Math.random() * cellSize * 0.3 + cellSize * 0.1;
                  const angle = Math.random() * Math.PI;
                  ctx.beginPath();
                  ctx.moveTo(screenX + offsetX, screenY + offsetY);
                  ctx.lineTo(screenX + offsetX + Math.cos(angle) * length, screenY + offsetY + Math.sin(angle) * length);
                  ctx.stroke();
                }
                continue;
              }
            } else {
              const baseColor = isLightTile ? 210 : 190;
              ctx.fillStyle = `rgb(${baseColor}, ${baseColor - 30}, ${baseColor - 80})`;
            }

            ctx.fillRect(screenX, screenY, cellSize, cellSize);

            if (worldX === goalX && worldY === goalY) {
              ctx.fillStyle = playerNum === 1 ? 'rgba(65, 105, 225, 0.3)' : 'rgba(220, 20, 60, 0.3)';
              ctx.fillRect(screenX, screenY, cellSize, cellSize);
            }
          }
        }

        otherFootprintPath.forEach(pos => {
          const dx = pos.x - player.x;
          const dy = pos.y - player.y;
          if (Math.abs(dx) <= VISIBILITY && Math.abs(dy) <= VISIBILITY) {
            const screenX = (dx + VISIBILITY) * cellSize + cellSize / 2;
            const screenY = (dy + VISIBILITY) * cellSize + cellSize / 2;
            ctx.fillStyle = playerNum === 1 ? 'rgba(100, 150, 255, 0.3)' : 'rgba(255, 100, 100, 0.3)';
            ctx.beginPath();
            ctx.arc(screenX, screenY, cellSize / 4, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        const otherDx = otherPlayer.x - player.x;
        const otherDy = otherPlayer.y - player.y;
        if (Math.abs(otherDx) <= VISIBILITY && Math.abs(otherDy) <= VISIBILITY) {
          const screenX = (otherDx + VISIBILITY) * cellSize + cellSize / 2;
          const screenY = (otherDy + VISIBILITY) * cellSize + cellSize / 2;

          ctx.fillStyle = playerNum === 1 ? '#4169E1' : '#DC143C';
          ctx.beginPath();
          ctx.arc(screenX, screenY, cellSize / 2, 0, Math.PI * 2);
          ctx.fill();

          const eyeOffsetX = otherDirection.dx * cellSize * 0.15;
          const eyeOffsetY = otherDirection.dy * cellSize * 0.15;
          const eyeSize = cellSize * 0.12;
          const eyeSpacing = cellSize * 0.2;

          ctx.fillStyle = 'white';
          if (otherDirection.dx !== 0) {
            ctx.beginPath();
            ctx.arc(screenX + eyeOffsetX, screenY - eyeSpacing, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(screenX + eyeOffsetX, screenY + eyeSpacing, eyeSize, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(screenX - eyeSpacing, screenY + eyeOffsetY, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(screenX + eyeSpacing, screenY + eyeOffsetY, eyeSize, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.fillStyle = 'black';
          const pupilSize = eyeSize * 0.5;
          if (otherDirection.dx !== 0) {
            ctx.beginPath();
            ctx.arc(screenX + eyeOffsetX + otherDirection.dx * eyeSize * 0.3, screenY - eyeSpacing, pupilSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(screenX + eyeOffsetX + otherDirection.dx * eyeSize * 0.3, screenY + eyeSpacing, pupilSize, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(screenX - eyeSpacing, screenY + eyeOffsetY + otherDirection.dy * eyeSize * 0.3, pupilSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(screenX + eyeSpacing, screenY + eyeOffsetY + otherDirection.dy * eyeSize * 0.3, pupilSize, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.fillStyle = playerNum === 1 ? '#DC143C' : '#4169E1';
        ctx.beginPath();
        ctx.arc(viewWidth / 2, viewHeight / 2, cellSize / 2, 0, Math.PI * 2);
        ctx.fill();

        const eyeOffsetX = direction.dx * cellSize * 0.15;
        const eyeOffsetY = direction.dy * cellSize * 0.15;
        const eyeSize = cellSize * 0.12;
        const eyeSpacing = cellSize * 0.2;

        ctx.fillStyle = 'white';
        if (direction.dx !== 0) {
          ctx.beginPath();
          ctx.arc(viewWidth / 2 + eyeOffsetX, viewHeight / 2 - eyeSpacing, eyeSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(viewWidth / 2 + eyeOffsetX, viewHeight / 2 + eyeSpacing, eyeSize, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(viewWidth / 2 - eyeSpacing, viewHeight / 2 + eyeOffsetY, eyeSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(viewWidth / 2 + eyeSpacing, viewHeight / 2 + eyeOffsetY, eyeSize, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = 'black';
        const pupilSize = eyeSize * 0.5;
        if (direction.dx !== 0) {
          ctx.beginPath();
          ctx.arc(viewWidth / 2 + eyeOffsetX + direction.dx * eyeSize * 0.3, viewHeight / 2 - eyeSpacing, pupilSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(viewWidth / 2 + eyeOffsetX + direction.dx * eyeSize * 0.3, viewHeight / 2 + eyeSpacing, pupilSize, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(viewWidth / 2 - eyeSpacing, viewHeight / 2 + eyeOffsetY + direction.dy * eyeSize * 0.3, pupilSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(viewWidth / 2 + eyeSpacing, viewHeight / 2 + eyeOffsetY + direction.dy * eyeSize * 0.3, pupilSize, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      };

      const viewWidth = (VISIBILITY * 2 + 1) * cellSize;
      drawPlayerView(player1, player2, direction2, footprintPath1, 0, 1, direction1);
      drawPlayerView(player2, player1, direction1, footprintPath2, viewWidth + 30, 2, direction2);
    }

    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
    });

  }, [gameState, maze, player1, player2, direction1, direction2, footprintPath1, footprintPath2, brokenWalls, particles, cellSize, mazeSize, viewMode]);

  const currentViewMode = VIEW_MODES.find(mode => mode.id === viewMode);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-black text-white p-4 pt-2">
      {gameState === 'menu' && (
        <div className="text-center w-full max-w-2xl">
          <div className="text-xs mb-2 text-gray-400">v0.5.5</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{color: '#FFD700', textShadow: '3px 3px 0 #8B4513'}}>
            迷路バトル
          </h1>
          
          <div className="mb-3 bg-gray-900 p-3 rounded-lg border-2 border-gray-700">
            <h3 className="text-base font-bold mb-2" style={{color: '#FFD700'}}>迷路サイズ:</h3>
            <div className="flex flex-col gap-2">
              {MAZE_SIZE_OPTIONS.map(option => (
                <button
                  key={option.size}
                  onClick={() => setMazeSize(option.size)}
                  className={`px-3 py-2 rounded-lg font-bold transition-all text-left text-sm ${
                    mazeSize === option.size 
                      ? 'bg-blue-600 border-2 border-yellow-500 shadow-lg' 
                      : 'bg-gray-700 border-2 border-gray-600'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{option.name}</span>
                    <span className="text-xs text-gray-300">{option.time}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {option.size}×{option.size} ({option.nodes}ノード)
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3 bg-gray-900 p-3 rounded-lg border-2 border-gray-700">
            <h3 className="text-base font-bold mb-2" style={{color: '#FFD700'}}>視界モード:</h3>
            <div className="flex gap-2 justify-center">
              {VIEW_MODES.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id)}
                  className={`px-4 py-2 rounded-lg font-bold transition-all text-sm ${
                    viewMode === mode.id 
                      ? 'bg-blue-600 border-2 border-yellow-500 shadow-lg' 
                      : 'bg-gray-700 border-2 border-gray-600'
                  }`}
                >
                  {mode.icon} {mode.name}
                </button>
              ))}
            </div>
          </div>
          
          <div className="mb-3 text-left bg-gray-900 p-4 rounded-lg border-4 border-yellow-600">
            <h2 className="text-base font-bold mb-2" style={{color: '#FFD700'}}>ルール:</h2>
            <ul className="space-y-1 text-xs">
              <li>🔴 Player 1: 左上スタート → 右下ゴールで勝利</li>
              <li>🔵 Player 2: 右下スタート → 左上ゴールで勝利</li>
              <li>📱 タッチ: 画面の十字ボタン / 爆弾タップで破壊</li>
              <li>⌨️ キーボード: WASD / 矢印キーorIJKL (押しっぱなしOK)</li>
              <li>🎮 Joy-Con(L+R): レバー、ボタン全対応</li>
              <li>💣 破壊: P1はE/Lボタン / P2はU/Shift/Rボタン (各3回)</li>
              <li>🚪 リタイア: Escキー / Joy-Conマイナスボタン</li>
              <li>👁️ 視界切替: Vキーまたは画面タップ (□ ⇔ ○ ⇔ 🗺️)</li>
              <li>👣 足跡が相手に見える!</li>
              <li>👀 視界内なら相手も見える!</li>
            </ul>
          </div>
          <button
            onClick={startGame}
            className="px-6 py-3 rounded-lg text-lg font-bold"
            style={{
              background: '#1E90FF',
              border: '4px solid #FFD700',
              boxShadow: '0 4px 0 #8B4513'
            }}
          >
            ゲーム開始 (Enter)
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-xs text-gray-400">v0.5.5</div>
            <button
              onClick={cycleViewMode}
              className="text-sm px-3 py-1 rounded transition-all bg-blue-600 hover:bg-blue-700 active:bg-blue-800 border border-yellow-500"
              style={{ touchAction: 'manipulation' }}
            >
              {currentViewMode?.icon} {currentViewMode?.name}
            </button>
            <div className="text-xs text-gray-400">
              {MAZE_SIZE_OPTIONS.find(opt => opt.size === mazeSize)?.name}
            </div>
          </div>
          
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="rounded"
          />
          <div className="flex gap-8 mt-4 w-full justify-center">
            <ControlPanel playerNum={1} wallBreaks={wallBreaks1} />
            <ControlPanel playerNum={2} wallBreaks={wallBreaks2} />
          </div>
          <div className="mt-4 text-center text-xs space-y-1 w-full max-w-4xl">
            <p style={{color: '#FF6B6B'}}>🔴 P1: WASD / Joy-Con(L) | 破壊: E/Lボタン</p>
            <p style={{color: '#6B9BFF'}}>🔵 P2: 矢印/IJKL / Joy-Con(R) | 破壊: U/Shift/Rボタン</p>
            <p style={{color: '#888'}}>🚪 リタイア: Escキー / マイナスボタン | 👁️ 視界切替: Vキーまたは画面タップ</p>
          </div>
        </div>
      )}
      
      {showRetireConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg border-4 border-red-600 max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-center text-red-400">リタイアしますか？</h2>
            <p className="text-sm mb-6 text-center text-gray-300">ゲームを中断してメニューに戻ります</p>
            <div className="flex gap-4">
              <button
                onClick={cancelRetire}
                className="flex-1 px-6 py-3 rounded-lg font-bold bg-gray-700 hover:bg-gray-600 border-2 border-gray-600"
              >
                いいえ
              </button>
              <button
                onClick={confirmRetire}
                className="flex-1 px-6 py-3 rounded-lg font-bold bg-red-600 hover:bg-red-700 border-2 border-red-500"
              >
                はい
              </button>
            </div>
          </div>
        </div>
      )}

      {gameState === 'finished' && (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-xs text-gray-400">v0.5.5</div>
          </div>
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="rounded opacity-30"
          />
          
          <div className="mt-4 bg-gray-900 p-6 rounded-lg border-4 border-yellow-600 shadow-2xl">
            <h1 className="text-4xl font-bold mb-4 text-center" style={{
              color: winner === 1 ? '#FF6B6B' : '#6B9BFF',
              textShadow: '3px 3px 0 #000'
            }}>
              {winner === 1 ? '🔴 Player 1' : '🔵 Player 2'} の勝利!
            </h1>
            <button
              onClick={() => setGameState('menu')}
              className="w-full px-8 py-3 rounded-lg text-xl font-bold"
              style={{
                background: '#32CD32',
                border: '4px solid #FFD700',
                boxShadow: '0 4px 0 #228B22'
              }}
            >
              タイトルに戻る (Enter)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MazeBattleGame;