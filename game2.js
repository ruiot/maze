import React, { useState, useEffect, useRef } from 'react';

// v0.6.0: Add 3-player mode with structured player data and new victory conditions

const MazeBattleGame = () => {
  const [gameState, setGameState] = useState('menu');
  const [gameMode, setGameMode] = useState(2); // 2 or 3 players
  const [maze, setMaze] = useState([]);
  const [mazeSize] = useState(31); // Fixed to 31x31
  
  // Structured player data
  const [players, setPlayers] = useState([]);
  const [winner, setWinner] = useState(null);
  const [brokenWalls, setBrokenWalls] = useState(new Set());
  const [particles, setParticles] = useState([]);
  const [gamepadDebug, setGamepadDebug] = useState('');
  const [pressedKeys, setPressedKeys] = useState(new Set());
  const [cellSize, setCellSize] = useState(18);
  const [touchHolding, setTouchHolding] = useState({});
  const [debugMessages, setDebugMessages] = useState([]);
  const [viewMode, setViewMode] = useState('circle');
  const [lastViewModeToggle, setLastViewModeToggle] = useState(0);
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastMoveRef = useRef({});
  const audioContextRef = useRef(null);

  const VISIBILITY = 5;
  const MOVE_DELAY = 300;
  const VIEW_MODE_TOGGLE_DELAY = 200;

  const VIEW_MODES = [
    { id: 'circle', icon: '○', name: '円形' },
    { id: 'overview', icon: '🗺️', name: '全体' }
  ];

  // Player configurations
  const PLAYER_CONFIGS = [
    {
      id: 1,
      startX: 1,
      startY: 1,
      color: '#DC143C',
      emoji: '🔴',
      keys: {
        up: ['w', 'W'],
        down: ['s', 'S'],
        left: ['a', 'A'],
        right: ['d', 'D'],
        break: ['e', 'E']
      }
    },
    {
      id: 2,
      startX: 29,
      startY: 29,
      color: '#4169E1',
      emoji: '🔵',
      keys: {
        up: ['i', 'I'],
        down: ['k', 'K'],
        left: ['j', 'J'],
        right: ['l', 'L'],
        break: ['u', 'U']
      }
    },
    {
      id: 3,
      startX: 29,
      startY: 1,
      color: '#FFD700',
      emoji: '🟡',
      keys: {
        up: ['ArrowUp'],
        down: ['ArrowDown'],
        left: ['ArrowLeft'],
        right: ['ArrowRight'],
        break: ['Shift']
      }
    }
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
      const divisor = gameMode === 3 ? 36 : 24; // More space needed for 3 players
      const maxCellSize = Math.min(
        Math.floor(availableHeight / 11),
        Math.floor(availableWidth / divisor)
      );
      const newCellSize = Math.max(18, Math.min(maxCellSize, 32));
      setCellSize(newCellSize);
    };

    updateCellSize();
    window.addEventListener('resize', updateCellSize);
    return () => window.removeEventListener('resize', updateCellSize);
  }, [gameMode]);

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

  const initializePlayers = (playerCount) => {
    const activePlayers = PLAYER_CONFIGS.slice(0, playerCount).map(config => ({
      id: config.id,
      x: config.startX,
      y: config.startY,
      homeX: config.startX,
      homeY: config.startY,
      direction: { dx: config.id === 2 ? -1 : 1, dy: 0 },
      footprintPath: [{ x: config.startX, y: config.startY }],
      wallBreaks: 3,
      visitedBases: {},
      color: config.color,
      emoji: config.emoji,
      keys: config.keys,
      hasWon: false
    }));

    // Initialize visited bases for each player
    activePlayers.forEach(player => {
      activePlayers.forEach(otherPlayer => {
        if (player.id !== otherPlayer.id) {
          player.visitedBases[otherPlayer.id] = false;
        }
      });
    });

    return activePlayers;
  };

  const startGame = () => {
    const newMaze = generateMaze(mazeSize);
    setMaze(newMaze);
    
    const newPlayers = initializePlayers(gameMode);
    setPlayers(newPlayers);
    
    // Initialize lastMoveRef for all players
    const moveTimings = {};
    newPlayers.forEach(p => {
      moveTimings[`p${p.id}`] = Date.now();
    });
    lastMoveRef.current = moveTimings;
    
    // Initialize touch holdings
    const holdings = {};
    newPlayers.forEach(p => {
      holdings[`p${p.id}`] = null;
    });
    setTouchHolding(holdings);
    
    setBrokenWalls(new Set());
    setParticles([]);
    setWinner(null);
    setDebugMessages([]);
    setGameState('playing');
  };

  const checkVisitedBase = (player, newX, newY) => {
    const updatedPlayer = { ...player };
    let baseVisited = false;
    
    players.forEach(otherPlayer => {
      if (otherPlayer.id !== player.id) {
        if (newX === otherPlayer.homeX && newY === otherPlayer.homeY && !player.visitedBases[otherPlayer.id]) {
          updatedPlayer.visitedBases[otherPlayer.id] = true;
          baseVisited = true;
          addDebugLog(`Player ${player.id} visited ${otherPlayer.emoji} base!`);
        }
      }
    });
    
    return { updatedPlayer, baseVisited };
  };

  const checkVictoryCondition = (player) => {
    // Check if all bases are visited
    const allBasesVisited = Object.values(player.visitedBases).every(visited => visited === true);
    
    // Check if player returned home
    const atHome = player.x === player.homeX && player.y === player.homeY;
    
    return allBasesVisited && atHome;
  };

  const movePlayer = (playerId, dx, dy) => {
    setPlayers(prevPlayers => {
      const playerIndex = prevPlayers.findIndex(p => p.id === playerId);
      if (playerIndex === -1) return prevPlayers;
      
      const player = prevPlayers[playerIndex];
      const newX = player.x + dx;
      const newY = player.y + dy;

      // Update direction
      player.direction = { dx, dy };

      // Check bounds and walls
      if (newX < 0 || newX >= mazeSize || newY < 0 || newY >= mazeSize || maze[newY][newX] === 1) {
        return prevPlayers;
      }

      // Move player
      const newPlayers = [...prevPlayers];
      newPlayers[playerIndex] = { ...player, x: newX, y: newY };
      
      // Update footprint
      newPlayers[playerIndex].footprintPath = [...player.footprintPath, { x: newX, y: newY }];
      
      // Check for base visits
      const { updatedPlayer, baseVisited } = checkVisitedBase(newPlayers[playerIndex], newX, newY);
      if (baseVisited) {
        newPlayers[playerIndex] = updatedPlayer;
      }
      
      // Check victory condition
      if (checkVictoryCondition(newPlayers[playerIndex]) && !player.hasWon) {
        newPlayers[playerIndex].hasWon = true;
        setWinner(playerId);
        setViewMode('overview');
        setGameState('finished');
        setPressedKeys(new Set());
        setTouchHolding({});
        addDebugLog(`Player ${playerId} wins!`);
      }
      
      // Update last move time
      lastMoveRef.current[`p${playerId}`] = Date.now();
      
      return newPlayers;
    });
  };

  const breakWall = (playerId) => {
    const player = players.find(p => p.id === playerId);
    if (!player || player.wallBreaks <= 0) return;

    const wallX = player.x + player.direction.dx;
    const wallY = player.y + player.direction.dy;

    if (wallX >= 0 && wallX < mazeSize && wallY >= 0 && wallY < mazeSize && maze[wallY][wallX] === 1) {
      const newMaze = maze.map(row => [...row]);
      newMaze[wallY][wallX] = 0;
      setMaze(newMaze);
      setBrokenWalls(prev => new Set([...prev, `${wallX},${wallY}`]));

      setPlayers(prevPlayers => 
        prevPlayers.map(p => 
          p.id === playerId ? { ...p, wallBreaks: p.wallBreaks - 1 } : p
        )
      );

      playBreakSound();

      // Create particles
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
          playerNum: playerId
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
    setTouchHolding({});
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

  // Unified input handling with requestAnimationFrame
  useEffect(() => {
    if (gameState !== 'playing') return;

    const checkAllInputs = () => {
      const now = Date.now();
      const gamepads = navigator.getGamepads();
      let debugInfo = [];

      // Keyboard input for all players
      players.forEach(player => {
        const timingKey = `p${player.id}`;
        if (now - lastMoveRef.current[timingKey] >= MOVE_DELAY) {
          pressedKeys.forEach(key => {
            if (player.keys.up.includes(key)) {
              movePlayer(player.id, 0, -1);
            } else if (player.keys.down.includes(key)) {
              movePlayer(player.id, 0, 1);
            } else if (player.keys.left.includes(key)) {
              movePlayer(player.id, -1, 0);
            } else if (player.keys.right.includes(key)) {
              movePlayer(player.id, 1, 0);
            }
          });
        }
      });

      // Touch input for all players
      players.forEach(player => {
        const holdingKey = `p${player.id}`;
        const timingKey = `p${player.id}`;
        if (touchHolding[holdingKey] && now - lastMoveRef.current[timingKey] >= MOVE_DELAY) {
          movePlayer(player.id, touchHolding[holdingKey].dx, touchHolding[holdingKey].dy);
        }
      });

      // Gamepad input
      // Player 1 & 2 on gamepad[0]
      if (gamepads[0]) {
        const gp = gamepads[0];
        const threshold = 0.5;
        
        // Player 1 - Left stick/D-pad
        const axes01 = [gp.axes[0] || 0, gp.axes[1] || 0];
        if ((Math.abs(axes01[0]) > threshold || Math.abs(axes01[1]) > threshold) && 
            now - lastMoveRef.current.p1 >= MOVE_DELAY) {
          const dx = Math.abs(axes01[0]) > Math.abs(axes01[1]) ? (axes01[0] > 0 ? 1 : -1) : 0;
          const dy = Math.abs(axes01[1]) > Math.abs(axes01[0]) ? (axes01[1] > 0 ? 1 : -1) : 0;
          movePlayer(1, dx, dy);
        }
        
        // D-pad for Player 1
        if (gp.buttons[12]?.pressed && now - lastMoveRef.current.p1 >= MOVE_DELAY) 
          movePlayer(1, 0, -1);
        if (gp.buttons[13]?.pressed && now - lastMoveRef.current.p1 >= MOVE_DELAY) 
          movePlayer(1, 0, 1);
        if (gp.buttons[14]?.pressed && now - lastMoveRef.current.p1 >= MOVE_DELAY) 
          movePlayer(1, -1, 0);
        if (gp.buttons[15]?.pressed && now - lastMoveRef.current.p1 >= MOVE_DELAY) 
          movePlayer(1, 1, 0);

        // Player 2 - Right stick/Face buttons  
        if (gp.axes.length > 3) {
          const axes23 = [gp.axes[2] || 0, gp.axes[3] || 0];
          if ((Math.abs(axes23[0]) > threshold || Math.abs(axes23[1]) > threshold) &&
              now - lastMoveRef.current.p2 >= MOVE_DELAY) {
            const dx = Math.abs(axes23[0]) > Math.abs(axes23[1]) ? (axes23[0] > 0 ? 1 : -1) : 0;
            const dy = Math.abs(axes23[1]) > Math.abs(axes23[0]) ? (axes23[1] > 0 ? 1 : -1) : 0;
            movePlayer(2, dx, dy);
          }
        }
        
        // Face buttons for Player 2
        if (gp.buttons[0]?.pressed && now - lastMoveRef.current.p2 >= MOVE_DELAY) 
          movePlayer(2, 1, 0);
        if (gp.buttons[1]?.pressed && now - lastMoveRef.current.p2 >= MOVE_DELAY) 
          movePlayer(2, 0, 1);
        if (gp.buttons[2]?.pressed && now - lastMoveRef.current.p2 >= MOVE_DELAY) 
          movePlayer(2, 0, -1);
        if (gp.buttons[3]?.pressed && now - lastMoveRef.current.p2 >= MOVE_DELAY) 
          movePlayer(2, -1, 0);

        // Wall breaks
        if (gp.buttons[4]?.pressed) breakWall(1);
        if (gp.buttons[5]?.pressed) breakWall(2);
        
        // Retire
        if (gp.buttons[8]?.pressed && gp.buttons[9]?.pressed) handleRetire();
      }

      // Player 3 on gamepad[1] (2nd Joy-Con L)
      if (gamepads[1] && gameMode === 3) {
        const gp = gamepads[1];
        const threshold = 0.5;
        
        // Check if this is a single Joy-Con L (has different button mapping)
        const isSingleJoyConL = gp.id.toLowerCase().includes('joy-con (l)');
        
        if (isSingleJoyConL) {
          // Single Joy-Con L button mapping
          // When held sideways: SL/SR become shoulders, stick becomes primary
          const axes = [gp.axes[0] || 0, gp.axes[1] || 0];
          if ((Math.abs(axes[0]) > threshold || Math.abs(axes[1]) > threshold) &&
              now - lastMoveRef.current.p3 >= MOVE_DELAY) {
            // Note: axes might be rotated when held sideways
            const dx = Math.abs(axes[1]) > Math.abs(axes[0]) ? (axes[1] > 0 ? 1 : -1) : 0;
            const dy = Math.abs(axes[0]) > Math.abs(axes[1]) ? (axes[0] < 0 ? 1 : -1) : 0;
            movePlayer(3, dx, dy);
          }
          
          // Face buttons (when held sideways, these map differently)
          if (gp.buttons[0]?.pressed && now - lastMoveRef.current.p3 >= MOVE_DELAY) 
            movePlayer(3, 0, -1);
          if (gp.buttons[1]?.pressed && now - lastMoveRef.current.p3 >= MOVE_DELAY) 
            movePlayer(3, 1, 0);
          if (gp.buttons[2]?.pressed && now - lastMoveRef.current.p3 >= MOVE_DELAY) 
            movePlayer(3, 0, 1);
          if (gp.buttons[3]?.pressed && now - lastMoveRef.current.p3 >= MOVE_DELAY) 
            movePlayer(3, -1, 0);
          
          // Wall break - SL or SR button
          if (gp.buttons[4]?.pressed || gp.buttons[5]?.pressed) breakWall(3);
        } else {
          // Standard controller or Joy-Con pair
          const axes = [gp.axes[0] || 0, gp.axes[1] || 0];
          if ((Math.abs(axes[0]) > threshold || Math.abs(axes[1]) > threshold) &&
              now - lastMoveRef.current.p3 >= MOVE_DELAY) {
            const dx = Math.abs(axes[0]) > Math.abs(axes[1]) ? (axes[0] > 0 ? 1 : -1) : 0;
            const dy = Math.abs(axes[1]) > Math.abs(axes[0]) ? (axes[1] > 0 ? 1 : -1) : 0;
            movePlayer(3, dx, dy);
          }
          
          // D-pad
          if (gp.buttons[12]?.pressed && now - lastMoveRef.current.p3 >= MOVE_DELAY) 
            movePlayer(3, 0, -1);
          if (gp.buttons[13]?.pressed && now - lastMoveRef.current.p3 >= MOVE_DELAY) 
            movePlayer(3, 0, 1);
          if (gp.buttons[14]?.pressed && now - lastMoveRef.current.p3 >= MOVE_DELAY) 
            movePlayer(3, -1, 0);
          if (gp.buttons[15]?.pressed && now - lastMoveRef.current.p3 >= MOVE_DELAY) 
            movePlayer(3, 1, 0);
          
          // Wall break
          if (gp.buttons[4]?.pressed) breakWall(3);
        }
        
        // Debug info for Player 3 gamepad
        let gpInfo = `[GP1/P3] ${gp.id.substring(0, 20)}`;
        debugInfo.push(gpInfo);
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
  }, [gameState, pressedKeys, touchHolding, players, maze, mazeSize]);

  // Keyboard event handlers
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
      const relevantKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Escape', 'Shift'];
      if (relevantKeys.includes(e.key)) {
        e.preventDefault();
      }

      setPressedKeys(prev => new Set([...prev, e.key]));
      
      // Handle wall breaks
      players.forEach(player => {
        if (player.keys.break.includes(e.key)) {
          breakWall(player.id);
          e.preventDefault();
        }
      });

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
  }, [gameState, players, maze]);

  // Particle update effect
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

  // Canvas rendering
  useEffect(() => {
    if (gameState !== 'playing' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (viewMode === 'overview') {
      // Overview mode rendering (unchanged for all player counts)
      const availableSize = Math.min(window.innerWidth - 100, window.innerHeight - 350);
      const miniCellSize = Math.floor(availableSize / mazeSize);
      
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw maze
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
            
            // Draw home bases
            players.forEach(player => {
              if (x === player.homeX && y === player.homeY) {
                ctx.fillStyle = player.color + '33'; // 20% opacity
                ctx.fillRect(screenX + 1, screenY + 1, miniCellSize - 2, miniCellSize - 2);
              }
            });
          }
        }
      }
      
      // Draw trails
      players.forEach(player => {
        if (player.footprintPath.length < 2) return;
        
        for (let i = 0; i < player.footprintPath.length - 1; i++) {
          const p0 = player.footprintPath[i];
          const p1 = player.footprintPath[i + 1];
          
          const screenX0 = p0.x * miniCellSize + miniCellSize / 2;
          const screenY0 = p0.y * miniCellSize + miniCellSize / 2;
          const screenX1 = p1.x * miniCellSize + miniCellSize / 2;
          const screenY1 = p1.y * miniCellSize + miniCellSize / 2;
          
          const alpha = 0.3 + (i / player.footprintPath.length) * 0.4;
          ctx.strokeStyle = player.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
          ctx.lineWidth = Math.max(2, miniCellSize / 6);
          ctx.lineCap = 'round';
          
          ctx.beginPath();
          ctx.moveTo(screenX0, screenY0);
          ctx.lineTo(screenX1, screenY1);
          ctx.stroke();
        }
      });
      
      // Draw players
      players.forEach(player => {
        const centerX = player.x * miniCellSize + miniCellSize / 2;
        const centerY = player.y * miniCellSize + miniCellSize / 2;
        const radius = Math.max(3, miniCellSize / 3);
        
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw eyes
        ctx.fillStyle = '#FFF';
        const eyeSize = Math.max(1, miniCellSize / 12);
        const eyeOffset = radius / 2;
        
        let eye1X, eye1Y, eye2X, eye2Y;
        const { dx, dy } = player.direction;
        
        if (dx === 1 && dy === 0) {
          eye1X = centerX + eyeOffset;
          eye1Y = centerY - eyeSize;
          eye2X = centerX + eyeOffset;
          eye2Y = centerY + eyeSize;
        } else if (dx === -1 && dy === 0) {
          eye1X = centerX - eyeOffset;
          eye1Y = centerY - eyeSize;
          eye2X = centerX - eyeOffset;
          eye2Y = centerY + eyeSize;
        } else if (dx === 0 && dy === -1) {
          eye1X = centerX - eyeSize;
          eye1Y = centerY - eyeOffset;
          eye2X = centerX + eyeSize;
          eye2Y = centerY - eyeOffset;
        } else if (dx === 0 && dy === 1) {
          eye1X = centerX - eyeSize;
          eye1Y = centerY + eyeOffset;
          eye2X = centerX + eyeSize;
          eye2Y = centerY + eyeOffset;
        }
        
        ctx.fillRect(eye1X - eyeSize / 2, eye1Y - eyeSize / 2, eyeSize, eyeSize);
        ctx.fillRect(eye2X - eyeSize / 2, eye2Y - eyeSize / 2, eyeSize, eyeSize);
      });
      
    } else {
      // Circle view mode - show each player's perspective
      const viewWidth = (VISIBILITY * 2 + 1) * cellSize;
      const margin = 30;
      
      players.forEach((player, index) => {
        const offsetX = index * (viewWidth + margin);
        
        // Set up circular clipping
        ctx.save();
        const centerX = offsetX + (VISIBILITY * cellSize) + cellSize / 2;
        const centerY = (VISIBILITY * cellSize) + cellSize / 2;
        const radius = VISIBILITY * cellSize + cellSize / 2;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.clip();
        
        // Draw maze from player's perspective
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

              // Highlight home bases
              players.forEach(otherPlayer => {
                if (x === otherPlayer.homeX && y === otherPlayer.homeY) {
                  ctx.fillStyle = otherPlayer.color + '33'; // 20% opacity
                  ctx.fillRect(screenX + 2, screenY + 2, cellSize - 4, cellSize - 4);
                }
              });
            }
          }
        }

        // Draw all trails visible to this player
        players.forEach(trailPlayer => {
          if (trailPlayer.footprintPath.length < 2) return;
          
          for (let i = 0; i < trailPlayer.footprintPath.length - 1; i++) {
            const p0 = trailPlayer.footprintPath[i];
            const p1 = trailPlayer.footprintPath[i + 1];
            
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
              
              const alpha = 0.2 + (i / trailPlayer.footprintPath.length) * 0.5;
              const baseWidth = 4;
              const wavyWidth = baseWidth + Math.sin(i * 0.3) * 1.5;
              
              const cpX = (screenX0 + screenX1) / 2 + Math.sin(i * 0.5) * 2;
              const cpY = (screenY0 + screenY1) / 2 + Math.cos(i * 0.5) * 2;
              
              ctx.strokeStyle = trailPlayer.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
              ctx.lineWidth = wavyWidth;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              
              ctx.beginPath();
              ctx.moveTo(screenX0, screenY0);
              ctx.quadraticCurveTo(cpX, cpY, screenX1, screenY1);
              ctx.stroke();
            }
          }
        });

        // Draw other players if visible
        players.forEach(otherPlayer => {
          if (otherPlayer.id === player.id) return;
          
          const otherDx = otherPlayer.x - player.x;
          const otherDy = otherPlayer.y - player.y;
          
          if (Math.abs(otherDx) <= VISIBILITY && Math.abs(otherDy) <= VISIBILITY) {
            const otherScreenX = offsetX + (otherDx + VISIBILITY) * cellSize;
            const otherScreenY = (otherDy + VISIBILITY) * cellSize;
            
            ctx.fillStyle = otherPlayer.color;
            ctx.beginPath();
            ctx.arc(otherScreenX + cellSize / 2, otherScreenY + cellSize / 2 + 2, cellSize / 2.5, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw eyes for other player
            ctx.fillStyle = '#FFF';
            const eyeSize = 3;
            const eyeOffset = cellSize / 4;
            
            const otherCenterX = otherScreenX + cellSize / 2;
            const otherCenterY = otherScreenY + cellSize / 2;
            
            let oeye1X, oeye1Y, oeye2X, oeye2Y;
            const { dx, dy } = otherPlayer.direction;
            
            if (dx === 1 && dy === 0) {
              oeye1X = otherCenterX + eyeOffset;
              oeye1Y = otherCenterY - eyeSize;
              oeye2X = otherCenterX + eyeOffset;
              oeye2Y = otherCenterY + eyeSize;
            } else if (dx === -1 && dy === 0) {
              oeye1X = otherCenterX - eyeOffset;
              oeye1Y = otherCenterY - eyeSize;
              oeye2X = otherCenterX - eyeOffset;
              oeye2Y = otherCenterY + eyeSize;
            } else if (dx === 0 && dy === -1) {
              oeye1X = otherCenterX - eyeSize;
              oeye1Y = otherCenterY - eyeOffset;
              oeye2X = otherCenterX + eyeSize;
              oeye2Y = otherCenterY - eyeOffset;
            } else if (dx === 0 && dy === 1) {
              oeye1X = otherCenterX - eyeSize;
              oeye1Y = otherCenterY + eyeOffset;
              oeye2X = otherCenterX + eyeSize;
              oeye2Y = otherCenterY + eyeOffset;
            }
            
            ctx.fillRect(oeye1X - eyeSize / 2, oeye1Y - eyeSize / 2, eyeSize, eyeSize);
            ctx.fillRect(oeye2X - eyeSize / 2, oeye2Y - eyeSize / 2, eyeSize, eyeSize);
          }
        });

        // Draw current player
        const playerScreenX = offsetX + VISIBILITY * cellSize;
        const playerScreenY = VISIBILITY * cellSize;
        
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(playerScreenX + cellSize / 2, playerScreenY + cellSize / 2 + 2, cellSize / 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw player eyes
        ctx.fillStyle = '#FFF';
        const eyeSize = 3;
        const eyeOffset = cellSize / 4;
        
        const centerX = playerScreenX + cellSize / 2;
        const centerY = playerScreenY + cellSize / 2;
        
        let eye1X, eye1Y, eye2X, eye2Y;
        const { dx, dy } = player.direction;
        
        if (dx === 1 && dy === 0) {
          eye1X = centerX + eyeOffset;
          eye1Y = centerY - eyeSize;
          eye2X = centerX + eyeOffset;
          eye2Y = centerY + eyeSize;
        } else if (dx === -1 && dy === 0) {
          eye1X = centerX - eyeOffset;
          eye1Y = centerY - eyeSize;
          eye2X = centerX - eyeOffset;
          eye2Y = centerY + eyeSize;
        } else if (dx === 0 && dy === -1) {
          eye1X = centerX - eyeSize;
          eye1Y = centerY - eyeOffset;
          eye2X = centerX + eyeSize;
          eye2Y = centerY - eyeOffset;
        } else if (dx === 0 && dy === 1) {
          eye1X = centerX - eyeSize;
          eye1Y = centerY + eyeOffset;
          eye2X = centerX + eyeSize;
          eye2Y = centerY + eyeOffset;
        }
        
        ctx.fillRect(eye1X - eyeSize / 2, eye1Y - eyeSize / 2, eyeSize, eyeSize);
        ctx.fillRect(eye2X - eyeSize / 2, eye2Y - eyeSize / 2, eyeSize, eyeSize);
        
        ctx.restore();
      });
    }
    
    // Draw particles
    particles.forEach(p => {
      const player = players.find(pl => pl.id === p.playerNum);
      if (!player) return;
      
      if (viewMode === 'overview') {
        const availableSize = Math.min(window.innerWidth - 100, window.innerHeight - 350);
        const miniCellSize = Math.floor(availableSize / mazeSize);
        const screenX = p.x * miniCellSize + p.vx * 2;
        const screenY = p.y * miniCellSize + p.vy * 2;
        
        ctx.fillStyle = player.color + Math.floor((p.life / 30) * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(screenX, screenY, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Show particles in each player's view if visible
        const viewWidth = (VISIBILITY * 2 + 1) * cellSize;
        const margin = 30;
        
        players.forEach((viewPlayer, index) => {
          const dx = p.x - viewPlayer.x;
          const dy = p.y - viewPlayer.y;
          
          if (Math.abs(dx) <= VISIBILITY && Math.abs(dy) <= VISIBILITY) {
            const offsetX = index * (viewWidth + margin);
            const screenX = offsetX + (dx + VISIBILITY) * cellSize + p.vx * 2;
            const screenY = (dy + VISIBILITY) * cellSize + p.vy * 2;
            
            ctx.fillStyle = player.color + Math.floor((p.life / 30) * 255).toString(16).padStart(2, '0');
            ctx.beginPath();
            ctx.arc(screenX, screenY, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }
    });
    
  }, [gameState, players, maze, particles, brokenWalls, cellSize, viewMode, mazeSize]);

  const handleBreakButton = (playerId) => {
    breakWall(playerId);
  };

  const getCanvasSize = () => {
    if (viewMode === 'overview') {
      const availableSize = Math.min(window.innerWidth - 100, window.innerHeight - 350);
      const miniCellSize = Math.floor(availableSize / mazeSize);
      const size = mazeSize * miniCellSize;
      return { width: size, height: size };
    } else {
      const viewWidth = (VISIBILITY * 2 + 1) * cellSize;
      const totalWidth = players.length * viewWidth + (players.length - 1) * 30;
      return {
        width: totalWidth,
        height: (VISIBILITY * 2 + 1) * cellSize
      };
    }
  };

  const canvasSize = getCanvasSize();

  // Touch control components
  const DPadButton = ({ direction, playerId, dx, dy, style }) => {
    const [isPointerDown, setIsPointerDown] = useState(false);

    const handlePointerDown = (e) => {
      e.preventDefault();
      setIsPointerDown(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      
      const key = `p${playerId}`;
      setTouchHolding(prev => ({ ...prev, [key]: { dx, dy } }));
      addDebugLog(`Touch start: Player ${playerId} (${dx}, ${dy})`);
    };

    const handlePointerUp = (e) => {
      e.preventDefault();
      setIsPointerDown(false);
      
      const key = `p${playerId}`;
      setTouchHolding(prev => ({ ...prev, [key]: null }));
      addDebugLog(`Touch end: Player ${playerId}`);
    };

    const handlePointerCancel = (e) => {
      e.preventDefault();
      setIsPointerDown(false);
      
      const key = `p${playerId}`;
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

  const ControlPanel = ({ player }) => (
    <div className="flex flex-col items-center gap-2">
      {/* Base visit indicators */}
      <div className="flex gap-2 mb-2">
        {players.map(otherPlayer => {
          if (otherPlayer.id === player.id) {
            // Show home icon for own base
            return (
              <span key={otherPlayer.id} style={{ opacity: 0.3, fontSize: '20px' }}>
                🏠
              </span>
            );
          } else {
            // Show other player's emoji
            const visited = player.visitedBases[otherPlayer.id];
            return (
              <span 
                key={otherPlayer.id} 
                style={{ 
                  opacity: visited ? 1.0 : 0.3, 
                  fontSize: '20px',
                  filter: visited ? 'none' : 'grayscale(100%)'
                }}
              >
                {otherPlayer.emoji}
              </span>
            );
          }
        })}
      </div>
      
      {/* D-pad controls */}
      <div className="relative w-40 h-40">
        <DPadButton 
          direction="up" 
          playerId={player.id}
          dx={0}
          dy={-1}
          style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }} 
        />
        <DPadButton 
          direction="down" 
          playerId={player.id}
          dx={0}
          dy={1}
          style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)' }} 
        />
        <DPadButton 
          direction="left" 
          playerId={player.id}
          dx={-1}
          dy={0}
          style={{ position: 'absolute', top: '50%', left: 0, transform: 'translateY(-50%)' }} 
        />
        <DPadButton 
          direction="right" 
          playerId={player.id}
          dx={1}
          dy={0}
          style={{ position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)' }} 
        />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-gray-800 rounded"></div>
      </div>
      
      {/* Wall break buttons */}
      <div className="flex gap-1">
        {[...Array(player.wallBreaks)].map((_, i) => (
          <button
            key={i}
            onTouchStart={(e) => { e.preventDefault(); handleBreakButton(player.id); }}
            onClick={() => handleBreakButton(player.id)}
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
          <div className="text-xs mb-2 text-gray-400">v0.6.0</div>
          <h1 className="text-5xl font-bold mb-6" style={{color: '#FFD700', textShadow: '3px 3px 0 #8B4513'}}>
            迷路バトル
          </h1>
          
          {/* Player mode selection */}
          <div className="mb-4 bg-gray-900 p-4 rounded-lg max-w-md border-2 border-gray-700 mx-auto">
            <h3 className="text-lg font-bold mb-3" style={{color: '#FFD700'}}>プレイ人数:</h3>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setGameMode(2)}
                className={`px-6 py-3 rounded-lg font-bold transition-all ${
                  gameMode === 2
                    ? 'bg-blue-600 border-2 border-yellow-500 shadow-lg scale-105' 
                    : 'bg-gray-700 border-2 border-gray-600 hover:bg-gray-600'
                }`}
              >
                👥 2人プレイ
              </button>
              <button
                onClick={() => setGameMode(3)}
                className={`px-6 py-3 rounded-lg font-bold transition-all ${
                  gameMode === 3
                    ? 'bg-blue-600 border-2 border-yellow-500 shadow-lg scale-105' 
                    : 'bg-gray-700 border-2 border-gray-600 hover:bg-gray-600'
                }`}
              >
                👥👤 3人プレイ
              </button>
            </div>
          </div>
          
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
              <li>🎯 <b>勝利条件</b>: 全相手陣地を訪問→自陣に戻る</li>
              <li>🔴 Player 1: 左上スタート (WASD + E)</li>
              <li>🔵 Player 2: 右下スタート (IJKL + U)</li>
              {gameMode === 3 && <li>🟡 Player 3: 右上スタート (矢印 + Shift)</li>}
              <li>📱 タッチ: 画面の十字ボタン / 爆弾タップで破壊</li>
              <li>🎮 Joy-Con: P1/P2は1台目、P3は2台目</li>
              <li>💣 壁破壊: 各プレイヤー3回まで</li>
              <li>🚪 リタイア: Escキー / Joy-Con +と-同時</li>
              <li>👁️ 視界切替: Vキーまたは画面タップ</li>
              <li>🗺️ 迷路サイズ: 31×31</li>
            </ul>
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-xs text-gray-400">v0.6.0</div>
            <button
              onClick={cycleViewMode}
              className="text-sm px-3 py-1 rounded transition-all bg-blue-600 hover:bg-blue-700 active:bg-blue-800 border border-yellow-500"
              style={{ touchAction: 'manipulation' }}
            >
              {currentViewMode?.icon} {currentViewMode?.name}
            </button>
            <div className="text-xs text-gray-400">
              31×31 | {gameMode}P
            </div>
          </div>
          
          {/* Debug info */}
          {debugMessages.length > 0 && (
            <div className="text-xs mb-2 font-mono bg-gray-900 px-3 py-1 rounded border border-yellow-600 max-w-full overflow-x-auto">
              {debugMessages[debugMessages.length - 1]}
            </div>
          )}
          
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="rounded"
          />
          
          <div className={`flex ${gameMode === 3 ? 'gap-4' : 'gap-8'} mt-4 w-full justify-center flex-wrap`}>
            {players.map(player => (
              <ControlPanel key={player.id} player={player} />
            ))}
          </div>
          
          <div className="mt-4 text-center text-xs space-y-1 w-full max-w-4xl">
            <p style={{color: '#FF6B6B'}}>🔴 P1: WASD / 破壊: E</p>
            <p style={{color: '#6B9BFF'}}>🔵 P2: IJKL / 破壊: U</p>
            {gameMode === 3 && <p style={{color: '#FFD700'}}>🟡 P3: 矢印 / 破壊: Shift</p>}
            <p style={{color: '#888'}}>🚪 リタイア: Esc | 👁️ 視界切替: V</p>
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
            <div className="text-xs text-gray-400">v0.6.0</div>
          </div>
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="rounded opacity-30"
          />
          
          <div className="mt-4 bg-gray-900 p-6 rounded-lg border-4 border-yellow-600 shadow-2xl">
            {winner ? (
              <>
                <h1 className="text-4xl font-bold mb-4 text-center" style={{
                  color: PLAYER_CONFIGS[winner - 1].color,
                  textShadow: '3px 3px 0 #000'
                }}>
                  {PLAYER_CONFIGS[winner - 1].emoji} Player {winner} の勝利!
                </h1>
                <p className="text-sm text-center mb-4 text-gray-300">
                  全ての敵陣地を訪問して自陣に帰還しました！
                </p>
              </>
            ) : (
              <h1 className="text-3xl font-bold mb-4 text-center text-gray-400">
                ゲーム中断
              </h1>
            )}
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
