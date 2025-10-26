import React, { useState, useEffect, useRef } from 'react';

// v0.5.15: Fix start button position, remove fog-of-war clipping, set maze size to 31x31

const MazeBattleGame = () => {
  const [gameState, setGameState] = useState('menu');
  const [maze, setMaze] = useState([]);
  const [mazeSize] = useState(31); // Fixed to 31x31
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
  const MOVE_DELAY = 250;
  const VIEW_MODE_TOGGLE_DELAY = 200;

  const VIEW_MODES = [
    { id: 'square', icon: '□', name: '四角' },
    { id: 'circle', icon: '○', name: '円形' },
    { id: 'overview', icon: '🗺️', name: '全体' }
  ];

  const addDebugLog = (message) => {
    setDebugMessages(prev => {
      const newMessages = [...prev, `${new Date().toLocaleTimeString()}: ${message}`];
      return newMessages.slice(-5);
    });
  };

  useEffect(() => {
    const updateCellSize = () => {
      const availableHeight = window.innerHeight - 250;
      const availableWidth = window.innerWidth - 100;
      const maxCellSize = Math.min(
        Math.floor(availableHeight / 11),
        Math.floor(availableWidth / 24)
      );
      const newCellSize = Math.max(18, Math.min(maxCellSize, 32));
      setCellSize(newCellSize);
    };

    updateCellSize();
    window.addEventListener('resize', updateCellSize);
    return () => window.removeEventListener('resize', updateCellSize);
  }, []);

  const playBreakSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = 150;
    oscillator.type = 'sawtooth';
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
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
    // Reset coordinates first to clear any previous game state
    setPlayer1({ x: 1, y: 1 });
    setPlayer2({ x: 1, y: 1 });
    
    const newMaze = generateMaze(mazeSize);
    setMaze(newMaze);
    const goalPos = mazeSize - 2;
    
    // Set correct positions
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
    setDebugMessages([]);
    setGameState('playing');
    lastMoveRef.current = { p1: Date.now(), p2: Date.now() };
  };

  const movePlayer = (player, setPlayer, dx, dy, playerNum, setDirection) => {
    setDirection({ dx, dy });

    const newX = player.x + dx;
    const newY = player.y + dy;

    if (newX >= 0 && newX < mazeSize && newY >= 0 && newY < mazeSize && maze[newY][newX] === 0) {
      const goalPos = mazeSize - 2;
      const goalX = playerNum === 1 ? goalPos : 1;
      const goalY = playerNum === 1 ? goalPos : 1;

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
    const breaks = playerNum === 1 ? wallBreaks1 : wallBreaks2;
    if (breaks <= 0) return;

    const wallX = player.x + direction.dx;
    const wallY = player.y + direction.dy;

    if (wallX >= 0 && wallX < mazeSize && wallY >= 0 && wallY < mazeSize && maze[wallY][wallX] === 1) {
      const newMaze = maze.map(row => [...row]);
      newMaze[wallY][wallX] = 0;
      setMaze(newMaze);
      setBrokenWalls(prev => new Set([...prev, `${wallX},${wallY}`]));

      if (playerNum === 1) {
        setWallBreaks1(breaks - 1);
      } else {
        setWallBreaks2(breaks - 1);
      }

      playBreakSound();

      const newParticles = [];
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const speed = 2 + Math.random() * 2;
        newParticles.push({
          x: wallX,
          y: wallY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 30,
          playerNum
        });
      }
      setParticles(prev => [...prev, ...newParticles]);
    }
  };

  const handleRetire = () => {
    setShowRetireConfirm(true);
  };
  
  const confirmRetire = () => {
    setShowRetireConfirm(false);
    setPressedKeys(new Set());
    setTouchHolding({ p1: null, p2: null });
    setGameState('menu');
    addDebugLog('Game retired - returning to menu');
  };
  
  const cancelRetire = () => {
    setShowRetireConfirm(false);
  };

  const cycleViewMode = () => {
    const now = Date.now();
    if (now - lastViewModeToggle < VIEW_MODE_TOGGLE_DELAY) return;
    
    setLastViewModeToggle(now);
    const currentIndex = VIEW_MODES.findIndex(mode => mode.id === viewMode);
    const nextIndex = (currentIndex + 1) % VIEW_MODES.length;
    const newMode = VIEW_MODES[nextIndex].id;
    setViewMode(newMode);
    addDebugLog(`View mode: ${VIEW_MODES[nextIndex].name}`);
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const checkAllInputs = () => {
      const now = Date.now();
      const gamepads = navigator.getGamepads();
      let debugInfo = [];

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
        if (gp.buttons[8]?.pressed && gp.buttons[9]?.pressed) handleRetire();
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
          e.preventDefault();
          if (gameState === 'finished') {
            setGameState('menu');
          } else {
            startGame();
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

      if (e.key === 'v' || e.key === 'V') {
        cycleViewMode();
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
  }, [gameState, player1, player2, maze, direction1, direction2]);

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
      const availableSize = Math.min(window.innerWidth - 100, window.innerHeight - 350);
      const miniCellSize = Math.floor(availableSize / mazeSize);
      
      const goalPos = mazeSize - 2;
      
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw full maze without fog-of-war clipping
      for (let y = 0; y < mazeSize; y++) {
        for (let x = 0; x < mazeSize; x++) {
          const screenX = x * miniCellSize;
          const screenY = y * miniCellSize;
          
          const isWall = maze[y][x] === 1;
          
          if (isWall) {
            const gradient = ctx.createLinearGradient(screenX, screenY, screenX + miniCellSize, screenY + miniCellSize);
            gradient.addColorStop(0, '#5a5a5a');
            gradient.addColorStop(0.5, '#3a3a3a');
            gradient.addColorStop(1, '#2a2a2a');
            ctx.fillStyle = gradient;
            ctx.fillRect(screenX, screenY, miniCellSize, miniCellSize);
          } else {
            const isBroken = brokenWalls.has(`${x},${y}`);
            const checkerSize = Math.max(1, Math.floor(miniCellSize / 6));
            
            for (let cy = 0; cy < miniCellSize; cy += checkerSize) {
              for (let cx = 0; cx < miniCellSize; cx += checkerSize) {
                const globalX = x * miniCellSize + cx;
                const globalY = y * miniCellSize + cy;
                const isCheckerDark = ((Math.floor(globalX / checkerSize) + Math.floor(globalY / checkerSize)) % 2) === 0;
                
                let darkColor, lightColor;
                if (isBroken) {
                  darkColor = '#4a3019';
                  lightColor = '#5a3a1f';
                } else {
                  darkColor = '#6B4423';
                  lightColor = '#8B5A2B';
                }
                
                ctx.fillStyle = isCheckerDark ? darkColor : lightColor;
                ctx.fillRect(screenX + cx, screenY + cy, checkerSize, checkerSize);
              }
            }
            
            if ((x === 1 && y === 1) || (x === goalPos && y === goalPos)) {
              ctx.fillStyle = x === 1 ? 'rgba(220, 20, 60, 0.5)' : 'rgba(65, 105, 225, 0.5)';
              ctx.fillRect(screenX + 1, screenY + 1, miniCellSize - 2, miniCellSize - 2);
            }
          }
        }
      }
      
      const drawMiniTrail = (path, color) => {
        if (path.length < 2) return;
        
        for (let i = 0; i < path.length - 1; i++) {
          const p0 = path[i];
          const p1 = path[i + 1];
          
          const screenX0 = p0.x * miniCellSize + miniCellSize / 2;
          const screenY0 = p0.y * miniCellSize + miniCellSize / 2;
          const screenX1 = p1.x * miniCellSize + miniCellSize / 2;
          const screenY1 = p1.y * miniCellSize + miniCellSize / 2;
          
          const alpha = 0.3 + (i / path.length) * 0.4;
          ctx.strokeStyle = color.replace('ALPHA', alpha.toFixed(2));
          ctx.lineWidth = Math.max(2, miniCellSize / 6);
          ctx.lineCap = 'round';
          
          ctx.beginPath();
          ctx.moveTo(screenX0, screenY0);
          ctx.lineTo(screenX1, screenY1);
          ctx.stroke();
        }
      };
      
      drawMiniTrail(footprintPath1, 'rgba(255, 80, 80, ALPHA)');
      drawMiniTrail(footprintPath2, 'rgba(80, 80, 255, ALPHA)');
      
      const drawPlayerWithEyes = (player, direction, color) => {
        const centerX = player.x * miniCellSize + miniCellSize / 2;
        const centerY = player.y * miniCellSize + miniCellSize / 2;
        const radius = Math.max(3, miniCellSize / 3);
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#FFF';
        const eyeSize = Math.max(1, miniCellSize / 12);
        const eyeOffset = radius / 2;
        
        let eye1X, eye1Y, eye2X, eye2Y;
        
        if (direction.dx === 1 && direction.dy === 0) {
          eye1X = centerX + eyeOffset;
          eye1Y = centerY - eyeSize;
          eye2X = centerX + eyeOffset;
          eye2Y = centerY + eyeSize;
        } else if (direction.dx === -1 && direction.dy === 0) {
          eye1X = centerX - eyeOffset;
          eye1Y = centerY - eyeSize;
          eye2X = centerX - eyeOffset;
          eye2Y = centerY + eyeSize;
        } else if (direction.dx === 0 && direction.dy === -1) {
          eye1X = centerX - eyeSize;
          eye1Y = centerY - eyeOffset;
          eye2X = centerX + eyeSize;
          eye2Y = centerY - eyeOffset;
        } else if (direction.dx === 0 && direction.dy === 1) {
          eye1X = centerX - eyeSize;
          eye1Y = centerY + eyeOffset;
          eye2X = centerX + eyeSize;
          eye2Y = centerY + eyeOffset;
        }
        
        ctx.fillRect(eye1X - eyeSize / 2, eye1Y - eyeSize / 2, eyeSize, eyeSize);
        ctx.fillRect(eye2X - eyeSize / 2, eye2Y - eyeSize / 2, eyeSize, eyeSize);
      };
      
      drawPlayerWithEyes(player1, direction1, '#DC143C');
      drawPlayerWithEyes(player2, direction2, '#4169E1');
      
    } else {
      const drawPlayerView = (player, otherPlayer, otherDirection, footprintPath, offsetX, playerNum, direction) => {
        const otherFootprintPath = playerNum === 1 ? footprintPath2 : footprintPath1;
        const goalPos = mazeSize - 2;
        const goalX = playerNum === 1 ? goalPos : 1;
        const goalY = playerNum === 1 ? goalPos : 1;

        if (viewMode === 'circle') {
          ctx.save();
          const centerX = offsetX + (VISIBILITY * cellSize) + cellSize / 2;
          const centerY = (VISIBILITY * cellSize) + cellSize / 2;
          const radius = VISIBILITY * cellSize + cellSize / 2;
          
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.clip();
        }

        for (let dy = -VISIBILITY; dy <= VISIBILITY; dy++) {
          for (let dx = -VISIBILITY; dx <= VISIBILITY; dx++) {
            const x = player.x + dx;
            const y = player.y + dy;

            const screenX = offsetX + (dx + VISIBILITY) * cellSize;
            const screenY = (dy + VISIBILITY) * cellSize;

            const isOutOfBounds = x < 0 || x >= mazeSize || y < 0 || y >= mazeSize;
            const isWall = isOutOfBounds || maze[y][x] === 1;
            
            if (isWall) {
              const gradient = ctx.createLinearGradient(screenX, screenY, screenX + cellSize, screenY + cellSize);
              gradient.addColorStop(0, '#5a5a5a');
              gradient.addColorStop(0.5, '#3a3a3a');
              gradient.addColorStop(1, '#2a2a2a');
              ctx.fillStyle = gradient;
              ctx.fillRect(screenX, screenY, cellSize, cellSize);
              
              ctx.strokeStyle = '#1a1a1a';
              ctx.lineWidth = 0.5;
              ctx.globalAlpha = 0.6;
              ctx.beginPath();
              ctx.moveTo(screenX + 2, screenY + 1);
              ctx.lineTo(screenX + cellSize - 3, screenY + cellSize - 2);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(screenX + cellSize - 2, screenY + 3);
              ctx.lineTo(screenX + 1, screenY + cellSize - 1);
              ctx.stroke();
              ctx.globalAlpha = 1.0;
            } else {
              const isBroken = brokenWalls.has(`${x},${y}`);
              const checkerSize = 3;
              for (let cy = 0; cy < cellSize; cy += checkerSize) {
                for (let cx = 0; cx < cellSize; cx += checkerSize) {
                  const globalX = x * cellSize + cx;
                  const globalY = y * cellSize + cy;
                  const isCheckerDark = ((Math.floor(globalX / checkerSize) + Math.floor(globalY / checkerSize)) % 2) === 0;
                  
                  let darkColor, lightColor;
                  if (isBroken) {
                    darkColor = '#4a3019';
                    lightColor = '#5a3a1f';
                  } else {
                    darkColor = '#6B4423';
                    lightColor = '#8B5A2B';
                  }
                  
                  ctx.fillStyle = isCheckerDark ? darkColor : lightColor;
                  ctx.fillRect(screenX + cx, screenY + cy, checkerSize, checkerSize);
                }
              }

              if (x === goalX && y === goalY) {
                ctx.fillStyle = playerNum === 1 ? 'rgba(220, 20, 60, 0.5)' : 'rgba(65, 105, 225, 0.5)';
                ctx.fillRect(screenX + 2, screenY + 2, cellSize - 4, cellSize - 4);
              }
            }
          }
        }

        const drawFootprintTrail = (path, colorBase) => {
          if (path.length < 2) return;
          
          for (let i = 0; i < path.length - 1; i++) {
            const p0 = path[i];
            const p1 = path[i + 1];
            
            const dx0 = p0.x - player.x;
            const dy0 = p0.y - player.y;
            const dx1 = p1.x - player.x;
            const dy1 = p1.y - player.y;
            
            if (Math.abs(dx0) <= VISIBILITY && Math.abs(dy0) <= VISIBILITY &&
                Math.abs(dx1) <= VISIBILITY && Math.abs(dy1) <= VISIBILITY) {
              
              const screenX0 = offsetX + (dx0 + VISIBILITY) * cellSize + cellSize / 2;
              const screenY0 = (dy0 + VISIBILITY) * cellSize + cellSize / 2;
              const screenX1 = offsetX + (dx1 + VISIBILITY) * cellSize + cellSize / 2;
              const screenY1 = (dy1 + VISIBILITY) * cellSize + cellSize / 2;
              
              const alpha = 0.2 + (i / path.length) * 0.5;
              const baseWidth = 4;
              const wavyWidth = baseWidth + Math.sin(i * 0.3) * 1.5;
              
              const cpX = (screenX0 + screenX1) / 2 + Math.sin(i * 0.5) * 2;
              const cpY = (screenY0 + screenY1) / 2 + Math.cos(i * 0.5) * 2;
              
              ctx.strokeStyle = colorBase.replace('ALPHA', alpha.toFixed(2));
              ctx.lineWidth = wavyWidth;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              
              ctx.beginPath();
              ctx.moveTo(screenX0, screenY0);
              ctx.quadraticCurveTo(cpX, cpY, screenX1, screenY1);
              ctx.stroke();
            }
          }
        };

        const ownColor = playerNum === 1 ? 'rgba(255, 80, 80, ALPHA)' : 'rgba(80, 80, 255, ALPHA)';
        drawFootprintTrail(footprintPath, ownColor);
        
        const otherColor = playerNum === 1 ? 'rgba(80, 80, 255, ALPHA)' : 'rgba(255, 80, 80, ALPHA)';
        drawFootprintTrail(otherFootprintPath, otherColor);

        const otherDx = otherPlayer.x - player.x;
        const otherDy = otherPlayer.y - player.y;
        if (Math.abs(otherDx) <= VISIBILITY && Math.abs(otherDy) <= VISIBILITY) {
          const otherScreenX = offsetX + (otherDx + VISIBILITY) * cellSize;
          const otherScreenY = (otherDy + VISIBILITY) * cellSize;
          
          ctx.fillStyle = playerNum === 1 ? '#4169E1' : '#DC143C';
          ctx.beginPath();
          ctx.arc(otherScreenX + cellSize / 2, otherScreenY + cellSize / 2 + 2, cellSize / 2.5, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = '#FFF';
          const eyeSize = 3;
          const eyeOffset = cellSize / 4;
          
          const otherCenterX = otherScreenX + cellSize / 2;
          const otherCenterY = otherScreenY + cellSize / 2;
          
          let oeye1X, oeye1Y, oeye2X, oeye2Y;
          
          if (otherDirection.dx === 1 && otherDirection.dy === 0) {
            oeye1X = otherCenterX + eyeOffset;
            oeye1Y = otherCenterY - eyeSize;
            oeye2X = otherCenterX + eyeOffset;
            oeye2Y = otherCenterY + eyeSize;
          } else if (otherDirection.dx === -1 && otherDirection.dy === 0) {
            oeye1X = otherCenterX - eyeOffset;
            oeye1Y = otherCenterY - eyeSize;
            oeye2X = otherCenterX - eyeOffset;
            oeye2Y = otherCenterY + eyeSize;
          } else if (otherDirection.dx === 0 && otherDirection.dy === -1) {
            oeye1X = otherCenterX - eyeSize;
            oeye1Y = otherCenterY - eyeOffset;
            oeye2X = otherCenterX + eyeSize;
            oeye2Y = otherCenterY - eyeOffset;
          } else if (otherDirection.dx === 0 && otherDirection.dy === 1) {
            oeye1X = otherCenterX - eyeSize;
            oeye1Y = otherCenterY + eyeOffset;
            oeye2X = otherCenterX + eyeSize;
            oeye2Y = otherCenterY + eyeOffset;
          }
          
          ctx.fillRect(oeye1X - eyeSize / 2, oeye1Y - eyeSize / 2, eyeSize, eyeSize);
          ctx.fillRect(oeye2X - eyeSize / 2, oeye2Y - eyeSize / 2, eyeSize, eyeSize);
        }

        const playerScreenX = offsetX + VISIBILITY * cellSize;
        const playerScreenY = VISIBILITY * cellSize;
        
        ctx.fillStyle = playerNum === 1 ? '#DC143C' : '#4169E1';
        ctx.beginPath();
        ctx.arc(playerScreenX + cellSize / 2, playerScreenY + cellSize / 2 + 2, cellSize / 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#FFF';
        const eyeSize = 3;
        const eyeOffset = cellSize / 4;
        
        const centerX = playerScreenX + cellSize / 2;
        const centerY = playerScreenY + cellSize / 2;
        
        let eye1X, eye1Y, eye2X, eye2Y;
        
        if (direction.dx === 1 && direction.dy === 0) {
          eye1X = centerX + eyeOffset;
          eye1Y = centerY - eyeSize;
          eye2X = centerX + eyeOffset;
          eye2Y = centerY + eyeSize;
        } else if (direction.dx === -1 && direction.dy === 0) {
          eye1X = centerX - eyeOffset;
          eye1Y = centerY - eyeSize;
          eye2X = centerX - eyeOffset;
          eye2Y = centerY + eyeSize;
        } else if (direction.dx === 0 && direction.dy === -1) {
          eye1X = centerX - eyeSize;
          eye1Y = centerY - eyeOffset;
          eye2X = centerX + eyeSize;
          eye2Y = centerY - eyeOffset;
        } else if (direction.dx === 0 && direction.dy === 1) {
          eye1X = centerX - eyeSize;
          eye1Y = centerY + eyeOffset;
          eye2X = centerX + eyeSize;
          eye2Y = centerY + eyeOffset;
        }
        
        ctx.fillRect(eye1X - eyeSize / 2, eye1Y - eyeSize / 2, eyeSize, eyeSize);
        ctx.fillRect(eye2X - eyeSize / 2, eye2Y - eyeSize / 2, eyeSize, eyeSize);

        if (viewMode === 'circle') {
          ctx.restore();
        }
      };

      const viewWidth = (VISIBILITY * 2 + 1) * cellSize;
      drawPlayerView(player1, player2, direction2, footprintPath1, 0, 1, direction1);
      drawPlayerView(player2, player1, direction1, footprintPath2, viewWidth + 30, 2, direction2);

      particles.forEach(p => {
        const dx = p.x - (p.playerNum === 1 ? player1.x : player2.x);
        const dy = p.y - (p.playerNum === 1 ? player1.y : player2.y);
        
        if (Math.abs(dx) <= VISIBILITY && Math.abs(dy) <= VISIBILITY) {
          const offsetX = p.playerNum === 1 ? 0 : viewWidth + 30;
          const screenX = offsetX + (dx + VISIBILITY) * cellSize + p.vx * 2;
          const screenY = (dy + VISIBILITY) * cellSize + p.vy * 2;
          
          ctx.fillStyle = p.playerNum === 1 ? `rgba(255, 100, 100, ${p.life / 30})` : `rgba(100, 100, 255, ${p.life / 30})`;
          ctx.beginPath();
          ctx.arc(screenX, screenY, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }, [gameState, player1, player2, direction1, direction2, footprintPath1, footprintPath2, maze, particles, brokenWalls, cellSize, viewMode, mazeSize]);

  const handleBreakButton = (playerNum) => {
    if (playerNum === 1) {
      breakWall(player1, direction1, 1);
    } else {
      breakWall(player2, direction2, 2);
    }
  };

  const getCanvasSize = () => {
    if (viewMode === 'overview') {
      const availableSize = Math.min(window.innerWidth - 100, window.innerHeight - 350);
      const miniCellSize = Math.floor(availableSize / mazeSize);
      const size = mazeSize * miniCellSize;
      return { width: size, height: size };
    } else {
      const viewWidth = (VISIBILITY * 2 + 1) * cellSize;
      return {
        width: viewWidth * 2 + 30,
        height: (VISIBILITY * 2 + 1) * cellSize
      };
    }
  };

  const canvasSize = getCanvasSize();

  const DPadButton = ({ direction, playerNum, dx, dy, style }) => {
    const [isPointerDown, setIsPointerDown] = useState(false);

    const handlePointerDown = (e) => {
      e.preventDefault();
      setIsPointerDown(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      
      const key = playerNum === 1 ? 'p1' : 'p2';
      setTouchHolding(prev => ({ ...prev, [key]: { dx, dy } }));
    };

    const handlePointerUp = (e) => {
      e.preventDefault();
      setIsPointerDown(false);
      
      const key = playerNum === 1 ? 'p1' : 'p2';
      setTouchHolding(prev => ({ ...prev, [key]: null }));
    };

    const handlePointerCancel = (e) => {
      e.preventDefault();
      setIsPointerDown(false);
      
      const key = playerNum === 1 ? 'p1' : 'p2';
      setTouchHolding(prev => ({ ...prev, [key]: null }));
    };

    return (
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="w-12 h-12 bg-gray-700 active:bg-gray-500 rounded flex items-center justify-center text-white font-bold select-none"
        style={{ ...style, touchAction: 'none' }}
      >
        {direction === 'up' && '▲'}
        {direction === 'down' && '▼'}
        {direction === 'left' && '◀'}
        {direction === 'right' && '▶'}
      </button>
    );
  };

  const ControlPanel = ({ playerNum, wallBreaks }) => (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-40 h-40">
        <DPadButton 
          direction="up" 
          playerNum={playerNum}
          dx={0}
          dy={-1}
          style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }} 
        />
        <DPadButton 
          direction="down" 
          playerNum={playerNum}
          dx={0}
          dy={1}
          style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)' }} 
        />
        <DPadButton 
          direction="left" 
          playerNum={playerNum}
          dx={-1}
          dy={0}
          style={{ position: 'absolute', top: '50%', left: 0, transform: 'translateY(-50%)' }} 
        />
        <DPadButton 
          direction="right" 
          playerNum={playerNum}
          dx={1}
          dy={0}
          style={{ position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)' }} 
        />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-gray-800 rounded"></div>
      </div>
      <div className="flex gap-1">
        {[...Array(wallBreaks)].map((_, i) => (
          <button
            key={i}
            onTouchStart={(e) => { e.preventDefault(); handleBreakButton(playerNum); }}
            onClick={() => handleBreakButton(playerNum)}
            className="text-2xl active:scale-90 transition-transform select-none"
          >
            🧨
          </button>
        ))}
      </div>
    </div>
  );

  const currentViewMode = VIEW_MODES.find(mode => mode.id === viewMode);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      {gameState === 'menu' && (
        <div className="text-center">
          <div className="text-xs mb-2 text-gray-400">v0.5.15</div>
          <h1 className="text-5xl font-bold mb-6" style={{color: '#FFD700', textShadow: '3px 3px 0 #8B4513'}}>
            迷路バトル
          </h1>
          
          <button
            onClick={startGame}
            className="px-8 py-3 rounded-lg text-xl font-bold mb-6"
            style={{
              background: '#1E90FF',
              border: '4px solid #FFD700',
              boxShadow: '0 4px 0 #8B4513'
            }}
          >
            ゲーム開始 (Enter)
          </button>

          <div className="mb-4 bg-gray-900 p-4 rounded-lg max-w-md border-2 border-gray-700 mx-auto">
            <h3 className="text-lg font-bold mb-2" style={{color: '#FFD700'}}>視界モード:</h3>
            <div className="flex gap-3 justify-center">
              {VIEW_MODES.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id)}
                  className={`px-6 py-2 rounded-lg font-bold transition-all ${
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
          
          <div className="mb-6 text-left bg-gray-900 p-6 rounded-lg max-w-md border-4 border-yellow-600 mx-auto">
            <h2 className="text-xl font-bold mb-3" style={{color: '#FFD700'}}>ルール:</h2>
            <ul className="space-y-2 text-sm">
              <li>🔴 Player 1: 左上スタート → 右下ゴールで勝利</li>
              <li>🔵 Player 2: 右下スタート → 左上ゴールで勝利</li>
              <li>📱 タッチ: 画面の十字ボタン / 爆弾タップで破壊</li>
              <li>⌨️ キーボード: WASD / 矢印キーorIJKL (押しっぱなしOK)</li>
              <li>🎮 Joy-Con(L+R): レバー、ボタン全対応</li>
              <li>💣 破壊: P1はE/Lボタン / P2はU/Shift/Rボタン (各3回)</li>
              <li>🚪 リタイア: Escキー / Joy-Conプラス+マイナス同時押し</li>
              <li>👁️ 視界切替: Vキーまたは画面タップ (□ ⇔ ○ ⇔ 🗺️)</li>
              <li>👣 足跡が相手に見える!</li>
              <li>👀 視界内なら相手も見える!</li>
              <li>🗺️ 迷路サイズ: 31×31 (225ノード)</li>
            </ul>
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-xs text-gray-400">v0.5.15</div>
            <button
              onClick={cycleViewMode}
              className="text-sm px-3 py-1 rounded transition-all bg-blue-600 hover:bg-blue-700 active:bg-blue-800 border border-yellow-500"
              style={{ touchAction: 'manipulation' }}
            >
              {currentViewMode?.icon} {currentViewMode?.name}
            </button>
            <div className="text-xs text-gray-400">
              31×31
            </div>
          </div>
          
          {/* DEBUG: Coordinate display */}
          <div className="text-xs mb-2 font-mono bg-gray-900 px-3 py-1 rounded border border-yellow-600">
            <span style={{color: '#FF6B6B'}}>P1:({player1.x},{player1.y})</span>
            {' | '}
            <span style={{color: '#6B9BFF'}}>P2:({player2.x},{player2.y})</span>
            {' | '}
            <span style={{color: '#FFD700'}}>Maze:{mazeSize}x{mazeSize}</span>
            {' | '}
            <span style={{color: '#88FF88'}}>
              P2@maze={maze[player2.y]?.[player2.x] !== undefined ? maze[player2.y][player2.x] : 'OOB'}
            </span>
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
            <div className="text-xs text-gray-400">v0.5.15</div>
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