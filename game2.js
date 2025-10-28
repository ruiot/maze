import React, { useState, useEffect, useRef } from 'react';

// v0.7.5: 4-player mode, P4 controls (TFGH+R, GP1 right stick), full floor paint
// Commit: Add 4-player mode, P4 controls (TFGH+R, GP1 right stick), full floor paint

const MazeBattleGame = () => {
  const [gameState, setGameState] = useState('menu');
  const [gameMode, setGameMode] = useState(2); // 2, 3, or 4 players
  const [maze, setMaze] = useState([]);
  const [mazeSize] = useState(31); // Fixed to 31x31
  const [floorPaint, setFloorPaint] = useState([]); // Bitmask array for floor colors
  
  // Structured player data
  const [players, setPlayers] = useState([]);
  const [rankings, setRankings] = useState([]); // Track finish order [playerId1, playerId2, ...]
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
  const [inputActivity, setInputActivity] = useState({});
  
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const renderLoopRef = useRef(null);
  const lastMoveRef = useRef({});
  const audioContextRef = useRef(null);
  const lastButtonStateRef = useRef({});
  
  // Refs to prevent requestAnimationFrame loop duplication
  const playersRef = useRef([]);
  const pressedKeysRef = useRef(new Set());
  const touchHoldingRef = useRef({});
  const mazeRef = useRef([]);
  const mazeSizeRef = useRef(31);
  const gameModeRef = useRef(2);
  const particlesRef = useRef([]);
  const brokenWallsRef = useRef(new Set());
  const viewModeRef = useRef('circle');
  const cellSizeRef = useRef(18);
  const floorPaintRef = useRef([]);

  const MOVE_DELAY = 300;
  const VIEW_MODE_TOGGLE_DELAY = 100;

  const VIEW_MODES = [
    { id: 'circle', icon: '○', name: '円形' },
    { id: 'overview', icon: '🗺️', name: '全体' }
  ];

  // Player configurations with CUD-friendly colors
  const PLAYER_CONFIGS = [
    {
      id: 1,
      startX: 1,
      startY: 1,
      color: '#FF6347', // 赤橙 (Tomato) - CUD friendly
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
      color: '#4169E1', // 青 (RoyalBlue) - CUD friendly
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
      color: '#FFD700', // 黄 (Gold) - CUD friendly
      emoji: '🟡',
      keys: {
        up: ['ArrowUp'],
        down: ['ArrowDown'],
        left: ['ArrowLeft'],
        right: ['ArrowRight'],
        break: ['Shift']
      }
    },
    {
      id: 4,
      startX: 1,
      startY: 29,
      color: '#32CD32', // 緑 (LimeGreen) - CUD friendly
      emoji: '🟢',
      keys: {
        up: ['t', 'T'],
        down: ['g', 'G'],
        left: ['f', 'F'],
        right: ['h', 'H'],
        break: ['r', 'R']
      }
    }
  ];

  const addDebugLog = (message) => {
    setDebugMessages(prev => {
      const newMessages = [...prev, `${new Date().toLocaleTimeString()}: ${message}`];
      return newMessages.slice(-5);
    });
  };

  // Sync refs with state
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { pressedKeysRef.current = pressedKeys; }, [pressedKeys]);
  useEffect(() => { touchHoldingRef.current = touchHolding; }, [touchHolding]);
  useEffect(() => { mazeRef.current = maze; }, [maze]);
  useEffect(() => { mazeSizeRef.current = mazeSize; }, [mazeSize]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { particlesRef.current = particles; }, [particles]);
  useEffect(() => { brokenWallsRef.current = brokenWalls; }, [brokenWalls]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { cellSizeRef.current = cellSize; }, [cellSize]);
  useEffect(() => { floorPaintRef.current = floorPaint; }, [floorPaint]);

  useEffect(() => {
    const updateCellSize = () => {
      const availableHeight = window.innerHeight - 250;
      const availableWidth = window.innerWidth - 100;
      const divisor = gameMode === 4 ? 48 : gameMode === 3 ? 36 : 24;
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
    
    // Randomize start position (must be odd coordinates)
    const oddCoords = [];
    for (let i = 1; i < size - 1; i += 2) {
      for (let j = 1; j < size - 1; j += 2) {
        oddCoords.push([i, j]);
      }
    }
    const randomStart = oddCoords[Math.floor(Math.random() * oddCoords.length)];
    const [startX, startY] = randomStart;
    
    const stack = [];
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
      footprintPath: [{ x: config.startX, y: config.startY }], // Keep for victory check
      wallBreaks: 3,
      visitedBases: {},
      visibility: 5,
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

  // Calculate mixed color from bitmask
  const getMixedColor = (bitmask, activePlayers) => {
    if (bitmask === 0) return null;
    
    const colors = [];
    activePlayers.forEach(player => {
      if (bitmask & (1 << (player.id - 1))) {
        colors.push(player.color);
      }
    });
    
    if (colors.length === 0) return null;
    if (colors.length === 1) return colors[0];
    
    // Mix colors by averaging RGB
    let r = 0, g = 0, b = 0;
    colors.forEach(color => {
      const rgb = parseInt(color.slice(1), 16);
      r += (rgb >> 16) & 0xff;
      g += (rgb >> 8) & 0xff;
      b += rgb & 0xff;
    });
    
    r = Math.floor(r / colors.length);
    g = Math.floor(g / colors.length);
    b = Math.floor(b / colors.length);
    
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  const startGame = () => {
    const newMaze = generateMaze(mazeSize);
    setMaze(newMaze);
    
    // Initialize floor paint (0 = no paint)
    const newFloorPaint = Array(mazeSize).fill().map(() => Array(mazeSize).fill(0));
    setFloorPaint(newFloorPaint);
    
    const newPlayers = initializePlayers(gameMode);
    setPlayers(newPlayers);
    
    // Paint starting positions
    newPlayers.forEach(player => {
      newFloorPaint[player.y][player.x] |= (1 << (player.id - 1));
    });
    
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
    
    // Initialize button state tracking
    lastButtonStateRef.current = {};
    
    // Explicitly update gameModeRef
    gameModeRef.current = gameMode;
    
    setBrokenWalls(new Set());
    setParticles([]);
    setRankings([]);
    setWinner(null);
    setDebugMessages([]);
    setGameState('playing');
  };

  const checkVisitedBase = (player, newX, newY) => {
    const updatedPlayer = { ...player };
    let baseVisited = false;
    
    playersRef.current.forEach(otherPlayer => {
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
      
      // Don't move if player has already won
      if (player.hasWon) return prevPlayers;
      
      const newX = player.x + dx;
      const newY = player.y + dy;

      // Update direction
      player.direction = { dx, dy };

      // Check bounds and walls
      if (newX < 0 || newX >= mazeSizeRef.current || newY < 0 || newY >= mazeSizeRef.current || mazeRef.current[newY][newX] === 1) {
        return prevPlayers;
      }

      // Move player
      const newPlayers = [...prevPlayers];
      newPlayers[playerIndex] = { ...player, x: newX, y: newY };
      
      // Update footprint (keep for victory check)
      newPlayers[playerIndex].footprintPath = [...player.footprintPath, { x: newX, y: newY }];
      
      // Paint floor with bitmask
      setFloorPaint(prevPaint => {
        const newPaint = prevPaint.map(row => [...row]);
        newPaint[newY][newX] |= (1 << (playerId - 1));
        return newPaint;
      });
      
      // Check for base visits
      const { updatedPlayer, baseVisited } = checkVisitedBase(newPlayers[playerIndex], newX, newY);
      if (baseVisited) {
        newPlayers[playerIndex] = updatedPlayer;
      }
      
      // Check victory condition
      if (checkVictoryCondition(newPlayers[playerIndex]) && !player.hasWon) {
        newPlayers[playerIndex].hasWon = true;
        
        // Add to rankings
        setRankings(prev => {
          const newRankings = [...prev, playerId];
          
          // Check if all players have finished
          if (newRankings.length === gameModeRef.current) {
            setWinner(newRankings[0]); // First place
            setViewMode('overview');
            setGameState('finished');
            setPressedKeys(new Set());
            setTouchHolding({});
            addDebugLog(`All players finished! Winner: Player ${newRankings[0]}`);
          } else {
            addDebugLog(`Player ${playerId} finished! Rank ${newRankings.length}`);
          }
          
          return newRankings;
        });
      }
      
      // Update last move time
      lastMoveRef.current[`p${playerId}`] = Date.now();
      
      return newPlayers;
    });
  };

  const breakWall = (playerId) => {
    const player = playersRef.current.find(p => p.id === playerId);
    if (!player || player.wallBreaks <= 0) return;

    const wallX = player.x + player.direction.dx;
    const wallY = player.y + player.direction.dy;

    // Additional safety checks
    if (!mazeRef.current || !Array.isArray(mazeRef.current) || mazeRef.current.length === 0) {
      console.error('Maze is invalid');
      return;
    }

    if (wallX < 0 || wallX >= mazeSizeRef.current || wallY < 0 || wallY >= mazeSizeRef.current) {
      return;
    }

    if (!mazeRef.current[wallY] || mazeRef.current[wallY][wallX] !== 1) {
      return;
    }

    const newMaze = mazeRef.current.map(row => [...row]);
    newMaze[wallY][wallX] = 0;
    setMaze(newMaze);
    setBrokenWalls(prev => new Set([...prev, `${wallX},${wallY}`]));

    setPlayers(prevPlayers => 
      prevPlayers.map(p => 
        p.id === playerId ? { 
          ...p, 
          wallBreaks: p.wallBreaks - 1,
          visibility: Math.max(2, p.visibility - 1)
        } : p
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
    
    addDebugLog(`Player ${playerId} visibility now: ${Math.max(2, player.visibility - 1)}`);
  };

  const handleRetire = () => {
    setPressedKeys(new Set());
    setTouchHolding({});
    setGameState('menu');
    addDebugLog('Game retired - returning to menu');
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

  // Menu screen input detection
  useEffect(() => {
    if (gameState !== 'menu') return;

    const detectInputs = () => {
      const activity = {
        p1_keyboard: false,
        p1_gamepad: false,
        p2_keyboard: false,
        p2_gamepad: false,
        p3_keyboard: false,
        p3_gamepad: false,
        p4_keyboard: false,
        p4_gamepad: false
      };

      const gamepads = navigator.getGamepads();
      const threshold = 0.3;

      // Check keyboard
      const configs = PLAYER_CONFIGS.slice(0, gameModeRef.current);
      configs.forEach(config => {
        const allKeys = [
          ...config.keys.up,
          ...config.keys.down,
          ...config.keys.left,
          ...config.keys.right,
          ...config.keys.break
        ];
        
        // Check if any key for this player is currently pressed
        for (const key of allKeys) {
          if (pressedKeysRef.current.has(key)) {
            activity[`p${config.id}_keyboard`] = true;
            break;
          }
        }
      });

      // Check Gamepad 0 (P1 & P2)
      if (gamepads[0]) {
        const gp = gamepads[0];
        
        // P1 - Left stick or D-pad
        if (Math.abs(gp.axes[0]) > threshold || Math.abs(gp.axes[1]) > threshold ||
            gp.buttons[12]?.pressed || gp.buttons[13]?.pressed || 
            gp.buttons[14]?.pressed || gp.buttons[15]?.pressed ||
            gp.buttons[4]?.pressed) {
          activity.p1_gamepad = true;
        }
        
        // P2 - Right stick or face buttons
        if (gp.axes.length > 3) {
          if (Math.abs(gp.axes[2]) > threshold || Math.abs(gp.axes[3]) > threshold ||
              gp.buttons[0]?.pressed || gp.buttons[1]?.pressed ||
              gp.buttons[2]?.pressed || gp.buttons[3]?.pressed ||
              gp.buttons[5]?.pressed) {
            activity.p2_gamepad = true;
          }
        }
      }

      // Check Gamepad 1 (P3 & P4)
      if (gamepads[1] && gameModeRef.current >= 3) {
        const gp = gamepads[1];
        
        // P3 - Left stick or D-pad
        if (Math.abs(gp.axes[0]) > threshold || Math.abs(gp.axes[1]) > threshold ||
            gp.buttons[12]?.pressed || gp.buttons[13]?.pressed || 
            gp.buttons[14]?.pressed || gp.buttons[15]?.pressed ||
            gp.buttons[4]?.pressed) {
          activity.p3_gamepad = true;
        }
        
        // P4 - Right stick (4-player mode only)
        if (gameModeRef.current === 4 && gp.axes.length > 3) {
          if (Math.abs(gp.axes[2]) > threshold || Math.abs(gp.axes[3]) > threshold ||
              gp.buttons[5]?.pressed) {
            activity.p4_gamepad = true;
          }
        }
      }

      setInputActivity(activity);
      requestAnimationFrame(detectInputs);
    };

    const rafId = requestAnimationFrame(detectInputs);
    return () => cancelAnimationFrame(rafId);
  }, [gameState]);

  // Unified input handling with requestAnimationFrame
  useEffect(() => {
    if (gameState !== 'playing') return;

    const checkAllInputs = () => {
      const now = Date.now();
      const gamepads = navigator.getGamepads();
      let debugInfo = [];

      // Keyboard input for all players
      playersRef.current.forEach(player => {
        if (player.hasWon) return; // Skip if already won
        
        const timingKey = `p${player.id}`;
        if (now - lastMoveRef.current[timingKey] >= MOVE_DELAY) {
          pressedKeysRef.current.forEach(key => {
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
      playersRef.current.forEach(player => {
        if (player.hasWon) return; // Skip if already won
        
        const holdingKey = `p${player.id}`;
        const timingKey = `p${player.id}`;
        if (touchHoldingRef.current[holdingKey] && now - lastMoveRef.current[timingKey] >= MOVE_DELAY) {
          movePlayer(player.id, touchHoldingRef.current[holdingKey].dx, touchHoldingRef.current[holdingKey].dy);
        }
      });

      // Gamepad input
      // Player 1 & 2 on gamepad[0]
      if (gamepads[0]) {
        const gp = gamepads[0];
        const threshold = 0.5;
        
        // Player 1 - Left stick/D-pad
        const p1 = playersRef.current.find(p => p.id === 1);
        if (p1 && !p1.hasWon) {
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

          // Wall break with debounce
          const p1BreakKey = 'gp0_p1_break';
          if (gp.buttons[4]?.pressed && !lastButtonStateRef.current[p1BreakKey]) {
            breakWall(1);
          }
          lastButtonStateRef.current[p1BreakKey] = gp.buttons[4]?.pressed;
        }

        // Player 2 - Right stick/Face buttons
        const p2 = playersRef.current.find(p => p.id === 2);
        if (p2 && !p2.hasWon) {
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

          // Wall break with debounce
          const p2BreakKey = 'gp0_p2_break';
          if (gp.buttons[5]?.pressed && !lastButtonStateRef.current[p2BreakKey]) {
            breakWall(2);
          }
          lastButtonStateRef.current[p2BreakKey] = gp.buttons[5]?.pressed;
        }
        
        // Retire - + and - simultaneously
        if (gp.buttons[8]?.pressed && gp.buttons[9]?.pressed) {
          handleRetire();
        }
      }

      // Player 3 & 4 on gamepad[1] (2nd Joy-Con pair)
      if (gamepads[1] && gameModeRef.current >= 3) {
        const gp = gamepads[1];
        const threshold = 0.5;
        
        // Player 3 - Left stick/D-pad
        const p3 = playersRef.current.find(p => p.id === 3);
        if (p3 && !p3.hasWon) {
          // Left stick
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
          
          // Wall break with debounce
          const p3BreakKey = 'gp1_p3_break';
          if (gp.buttons[4]?.pressed && !lastButtonStateRef.current[p3BreakKey]) {
            breakWall(3);
          }
          lastButtonStateRef.current[p3BreakKey] = gp.buttons[4]?.pressed;
        }
        
        // Player 4 - Right stick (4-player mode only)
        const p4 = playersRef.current.find(p => p.id === 4);
        if (p4 && !p4.hasWon && gameModeRef.current === 4) {
          if (gp.axes.length > 3) {
            const axes23 = [gp.axes[2] || 0, gp.axes[3] || 0];
            if ((Math.abs(axes23[0]) > threshold || Math.abs(axes23[1]) > threshold) &&
                now - lastMoveRef.current.p4 >= MOVE_DELAY) {
              const dx = Math.abs(axes23[0]) > Math.abs(axes23[1]) ? (axes23[0] > 0 ? 1 : -1) : 0;
              const dy = Math.abs(axes23[1]) > Math.abs(axes23[0]) ? (axes23[1] > 0 ? 1 : -1) : 0;
              movePlayer(4, dx, dy);
            }
          }
          
          // Wall break with debounce
          const p4BreakKey = 'gp1_p4_break';
          if (gp.buttons[5]?.pressed && !lastButtonStateRef.current[p4BreakKey]) {
            breakWall(4);
          }
          lastButtonStateRef.current[p4BreakKey] = gp.buttons[5]?.pressed;
        }
        
        // Debug info for Gamepad 1
        let gpInfo = `[GP1] ${gp.id.substring(0, 20)}`;
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
  }, [gameState]);

  // Keyboard event handlers
  useEffect(() => {
    if (gameState === 'menu') {
      const handleMenuKey = (e) => {
        // Update pressedKeys for menu input detection
        setPressedKeys(prev => new Set([...prev, e.key]));
        
        if (e.key === 'Enter') {
          e.preventDefault();
          startGame();
        }
      };
      
      const handleMenuKeyUp = (e) => {
        setPressedKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(e.key);
          return newSet;
        });
      };
      
      // Add gamepad check for Plus button to start game
      const checkGamepadStart = () => {
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
          const gp = gamepads[i];
          if (gp && gp.buttons[9]?.pressed) {  // Button 9 is Plus on Joy-Con
            startGame();
            return;
          }
        }
        requestAnimationFrame(checkGamepadStart);
      };
      
      window.addEventListener('keydown', handleMenuKey, true);
      window.addEventListener('keyup', handleMenuKeyUp, true);
      const rafId = requestAnimationFrame(checkGamepadStart);
      
      return () => {
        window.removeEventListener('keydown', handleMenuKey, true);
        window.removeEventListener('keyup', handleMenuKeyUp, true);
        cancelAnimationFrame(rafId);
      };
    }
    
    if (gameState === 'finished') {
      const handleFinishedKey = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          setGameState('menu');
        }
        if (e.key === 'v' || e.key === 'V') {
          cycleViewMode();
          e.preventDefault();
        }
      };
      window.addEventListener('keydown', handleFinishedKey, true);
      return () => window.removeEventListener('keydown', handleFinishedKey, true);
    }

    if (gameState !== 'playing') return;

    const handleKeyDown = (e) => {
      const relevantKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Escape', 'Shift'];
      if (relevantKeys.includes(e.key)) {
        e.preventDefault();
      }

      setPressedKeys(prev => new Set([...prev, e.key]));
      
      // Handle wall breaks
      playersRef.current.forEach(player => {
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
  }, [gameState]);

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

  // Canvas rendering with RAF loop
  useEffect(() => {
    if ((gameState !== 'playing' && gameState !== 'finished') || !canvasRef.current) return;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentPlayers = playersRef.current;
      const currentMaze = mazeRef.current;
      const currentParticles = particlesRef.current;
      const currentBrokenWalls = brokenWallsRef.current;
      const currentViewMode = viewModeRef.current;
      const currentCellSize = cellSizeRef.current;
      const currentMazeSize = mazeSizeRef.current;
      const currentFloorPaint = floorPaintRef.current;

      if (currentViewMode === 'overview') {
        // Overview mode rendering
        const availableSize = Math.min(window.innerWidth - 100, window.innerHeight - 350);
        const miniCellSize = Math.floor(availableSize / currentMazeSize);
        
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw maze
        for (let y = 0; y < currentMazeSize; y++) {
          for (let x = 0; x < currentMazeSize; x++) {
            const screenX = x * miniCellSize;
            const screenY = y * miniCellSize;
            
            const isWall = currentMaze[y][x] === 1;
            
            if (isWall) {
              const gradient = ctx.createLinearGradient(screenX, screenY, screenX + miniCellSize, screenY + miniCellSize);
              gradient.addColorStop(0, '#5a5a5a');
              gradient.addColorStop(0.5, '#3a3a3a');
              gradient.addColorStop(1, '#2a2a2a');
              ctx.fillStyle = gradient;
              ctx.fillRect(screenX, screenY, miniCellSize, miniCellSize);
            } else {
              const isBroken = currentBrokenWalls.has(`${x},${y}`);
              const checkerSize = Math.max(1, Math.floor(miniCellSize / 6));
              
              // Base floor color
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
              
              // Draw floor paint (player trails) - full cell, no margin
              if (currentFloorPaint[y] && currentFloorPaint[y][x]) {
                const paintColor = getMixedColor(currentFloorPaint[y][x], currentPlayers);
                if (paintColor) {
                  ctx.fillStyle = paintColor + '66'; // Semi-transparent
                  ctx.fillRect(screenX, screenY, miniCellSize, miniCellSize);
                }
              }
              
              // Draw home bases
              currentPlayers.forEach(player => {
                if (x === player.homeX && y === player.homeY) {
                  ctx.fillStyle = player.color + '33';
                  ctx.fillRect(screenX, screenY, miniCellSize, miniCellSize);
                }
              });
            }
          }
        }
        
        // Draw players
        currentPlayers.forEach(player => {
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
        // Circle view mode
        const MAX_VISIBILITY = 5;
        const fixedViewWidth = (MAX_VISIBILITY * 2 + 1) * currentCellSize;
        const margin = 30;
        
        currentPlayers.forEach((player, index) => {
          const VISIBILITY = player.visibility;
          
          // Calculate fixed center position
          const centerX = index * (fixedViewWidth + margin) + (MAX_VISIBILITY * currentCellSize) + currentCellSize / 2;
          const centerY = (MAX_VISIBILITY * currentCellSize) + currentCellSize / 2;
          const radius = VISIBILITY * currentCellSize + currentCellSize / 2;
          
          // Set up circular clipping
          ctx.save();
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.clip();
          
          // Draw maze from player's perspective
          for (let dy = -VISIBILITY; dy <= VISIBILITY; dy++) {
            for (let dx = -VISIBILITY; dx <= VISIBILITY; dx++) {
              const x = player.x + dx;
              const y = player.y + dy;

              // Position relative to fixed center
              const screenX = centerX + (dx * currentCellSize) - currentCellSize / 2;
              const screenY = centerY + (dy * currentCellSize) - currentCellSize / 2;

              const isOutOfBounds = x < 0 || x >= currentMazeSize || y < 0 || y >= currentMazeSize;
              const isWall = isOutOfBounds || currentMaze[y][x] === 1;
              
              if (isWall) {
                const gradient = ctx.createLinearGradient(screenX, screenY, screenX + currentCellSize, screenY + currentCellSize);
                gradient.addColorStop(0, '#5a5a5a');
                gradient.addColorStop(0.5, '#3a3a3a');
                gradient.addColorStop(1, '#2a2a2a');
                ctx.fillStyle = gradient;
                ctx.fillRect(screenX, screenY, currentCellSize, currentCellSize);
              } else {
                const isBroken = currentBrokenWalls.has(`${x},${y}`);
                const checkerSize = 3;
                
                // Base floor
                for (let cy = 0; cy < currentCellSize; cy += checkerSize) {
                  for (let cx = 0; cx < currentCellSize; cx += checkerSize) {
                    const globalX = x * currentCellSize + cx;
                    const globalY = y * currentCellSize + cy;
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

                // Draw floor paint - full cell, no margin
                if (!isOutOfBounds && currentFloorPaint[y] && currentFloorPaint[y][x]) {
                  const paintColor = getMixedColor(currentFloorPaint[y][x], currentPlayers);
                  if (paintColor) {
                    ctx.fillStyle = paintColor + '88'; // More visible in circle view
                    ctx.fillRect(screenX, screenY, currentCellSize, currentCellSize);
                  }
                }

                // Highlight home bases
                currentPlayers.forEach(otherPlayer => {
                  if (x === otherPlayer.homeX && y === otherPlayer.homeY) {
                    ctx.fillStyle = otherPlayer.color + '33';
                    ctx.fillRect(screenX, screenY, currentCellSize, currentCellSize);
                  }
                });
              }
            }
          }

          // Draw other players if visible
          currentPlayers.forEach(otherPlayer => {
            if (otherPlayer.id === player.id) return;
            
            const otherDx = otherPlayer.x - player.x;
            const otherDy = otherPlayer.y - player.y;
            
            if (Math.abs(otherDx) <= VISIBILITY && Math.abs(otherDy) <= VISIBILITY) {
              const otherScreenX = centerX + (otherDx * currentCellSize);
              const otherScreenY = centerY + (otherDy * currentCellSize);
              
              ctx.fillStyle = otherPlayer.color;
              ctx.beginPath();
              ctx.arc(otherScreenX, otherScreenY + 2, currentCellSize / 2.5, 0, Math.PI * 2);
              ctx.fill();
              
              // Draw eyes for other player
              ctx.fillStyle = '#FFF';
              const eyeSize = 3;
              const eyeOffset = currentCellSize / 4;
              
              let oeye1X, oeye1Y, oeye2X, oeye2Y;
              const { dx, dy } = otherPlayer.direction;
              
              if (dx === 1 && dy === 0) {
                oeye1X = otherScreenX + eyeOffset;
                oeye1Y = otherScreenY - eyeSize;
                oeye2X = otherScreenX + eyeOffset;
                oeye2Y = otherScreenY + eyeSize;
              } else if (dx === -1 && dy === 0) {
                oeye1X = otherScreenX - eyeOffset;
                oeye1Y = otherScreenY - eyeSize;
                oeye2X = otherScreenX - eyeOffset;
                oeye2Y = otherScreenY + eyeSize;
              } else if (dx === 0 && dy === -1) {
                oeye1X = otherScreenX - eyeSize;
                oeye1Y = otherScreenY - eyeOffset;
                oeye2X = otherScreenX + eyeSize;
                oeye2Y = otherScreenY - eyeOffset;
              } else if (dx === 0 && dy === 1) {
                oeye1X = otherScreenX - eyeSize;
                oeye1Y = otherScreenY + eyeOffset;
                oeye2X = otherScreenX + eyeSize;
                oeye2Y = otherScreenY + eyeOffset;
              }
              
              ctx.fillRect(oeye1X - eyeSize / 2, oeye1Y - eyeSize / 2, eyeSize, eyeSize);
              ctx.fillRect(oeye2X - eyeSize / 2, oeye2Y - eyeSize / 2, eyeSize, eyeSize);
            }
          });

          // Draw current player
          ctx.fillStyle = player.color;
          ctx.beginPath();
          ctx.arc(centerX, centerY + 2, currentCellSize / 2.5, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw player eyes
          ctx.fillStyle = '#FFF';
          const eyeSize = 3;
          const eyeOffset = currentCellSize / 4;
          
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
      currentParticles.forEach(p => {
        const player = currentPlayers.find(pl => pl.id === p.playerNum);
        if (!player) return;
        
        if (currentViewMode === 'overview') {
          const availableSize = Math.min(window.innerWidth - 100, window.innerHeight - 350);
          const miniCellSize = Math.floor(availableSize / currentMazeSize);
          const screenX = p.x * miniCellSize + p.vx * 2;
          const screenY = p.y * miniCellSize + p.vy * 2;
          
          ctx.fillStyle = player.color + Math.floor((p.life / 30) * 255).toString(16).padStart(2, '0');
          ctx.beginPath();
          ctx.arc(screenX, screenY, 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const MAX_VISIBILITY = 5;
          const fixedViewWidth = (MAX_VISIBILITY * 2 + 1) * currentCellSize;
          const margin = 30;
          
          currentPlayers.forEach((viewPlayer, index) => {
            const VISIBILITY = viewPlayer.visibility;
            const dx = p.x - viewPlayer.x;
            const dy = p.y - viewPlayer.y;
            
            if (Math.abs(dx) <= VISIBILITY && Math.abs(dy) <= VISIBILITY) {
              const centerX = index * (fixedViewWidth + margin) + (MAX_VISIBILITY * currentCellSize) + currentCellSize / 2;
              const centerY = (MAX_VISIBILITY * currentCellSize) + currentCellSize / 2;
              const screenX = centerX + (dx * currentCellSize) + p.vx * 2;
              const screenY = centerY + (dy * currentCellSize) + p.vy * 2;
              
              ctx.fillStyle = player.color + Math.floor((p.life / 30) * 255).toString(16).padStart(2, '0');
              ctx.beginPath();
              ctx.arc(screenX, screenY, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          });
        }
      });

      renderLoopRef.current = requestAnimationFrame(render);
    };

    renderLoopRef.current = requestAnimationFrame(render);
    return () => {
      if (renderLoopRef.current) {
        cancelAnimationFrame(renderLoopRef.current);
      }
    };
  }, [gameState]);

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
      const MAX_VISIBILITY = 5;
      const fixedViewWidth = (MAX_VISIBILITY * 2 + 1) * cellSize;
      const fixedViewHeight = (MAX_VISIBILITY * 2 + 1) * cellSize;
      const margin = 30;
      const totalWidth = players.length * fixedViewWidth + (players.length - 1) * margin;
      
      return {
        width: totalWidth,
        height: fixedViewHeight
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
            // Show own icon - light up when returning home after all visits
            const allBasesVisited = Object.values(player.visitedBases).every(v => v === true);
            const atHome = player.x === player.homeX && player.y === player.homeY;
            const shouldLight = allBasesVisited && atHome;
            return (
              <span key={otherPlayer.id} style={{ 
                opacity: shouldLight ? 1.0 : 0.3, 
                fontSize: '20px',
                filter: shouldLight ? 'none' : 'grayscale(100%)'
              }}>
                {player.emoji}
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

  const InputIndicator = ({ active }) => (
    <span className="ml-2 text-sm">
      {active ? <span className="text-green-400">🟢 反応中</span> : <span className="text-gray-500">待機中</span>}
    </span>
  );

  const currentViewMode = VIEW_MODES.find(mode => mode.id === viewMode);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      {gameState === 'menu' && (
        <div className="text-center">
          <div className="text-xs mb-2 text-gray-400">v0.7.5</div>
          <h1 className="text-5xl font-bold mb-6" style={{color: '#FFD700', textShadow: '3px 3px 0 #8B4513'}}>
            迷路バトル
          </h1>
          
          {/* Player mode selection */}
          <div className="mb-4 bg-gray-900 p-4 rounded-lg max-w-md border-2 border-gray-700 mx-auto">
            <h3 className="text-lg font-bold mb-3" style={{color: '#FFD700'}}>プレイ人数:</h3>
            <div className="flex gap-3 justify-center flex-wrap">
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
              <button
                onClick={() => setGameMode(4)}
                className={`px-6 py-3 rounded-lg font-bold transition-all ${
                  gameMode === 4
                    ? 'bg-blue-600 border-2 border-yellow-500 shadow-lg scale-105' 
                    : 'bg-gray-700 border-2 border-gray-600 hover:bg-gray-600'
                }`}
              >
                👥👥 4人プレイ
              </button>
            </div>
          </div>

          {/* Input detection display */}
          <div className="mb-4 bg-gray-900 p-4 rounded-lg max-w-md border-2 border-blue-600 mx-auto">
            <h3 className="text-lg font-bold mb-3" style={{color: '#FFD700'}}>入力確認:</h3>
            <div className="space-y-2 text-left text-sm">
              <div className="flex items-center">
                <span className="text-red-400 font-bold">🔴 Player 1:</span>
                <span className="ml-2">KB: WASD</span>
                <InputIndicator active={inputActivity.p1_keyboard} />
              </div>
              <div className="flex items-center">
                <span className="text-red-400 font-bold ml-4">GP[0]:</span>
                <span className="ml-2">左スティック/D-pad</span>
                <InputIndicator active={inputActivity.p1_gamepad} />
              </div>
              
              <div className="flex items-center mt-2">
                <span className="text-blue-400 font-bold">🔵 Player 2:</span>
                <span className="ml-2">KB: IJKL</span>
                <InputIndicator active={inputActivity.p2_keyboard} />
              </div>
              <div className="flex items-center">
                <span className="text-blue-400 font-bold ml-4">GP[0]:</span>
                <span className="ml-2">右スティック/ABXY</span>
                <InputIndicator active={inputActivity.p2_gamepad} />
              </div>
              
              {gameMode >= 3 && (
                <>
                  <div className="flex items-center mt-2">
                    <span className="text-yellow-400 font-bold">🟡 Player 3:</span>
                    <span className="ml-2">KB: 矢印</span>
                    <InputIndicator active={inputActivity.p3_keyboard} />
                  </div>
                  <div className="flex items-center">
                    <span className="text-yellow-400 font-bold ml-4">GP[1]:</span>
                    <span className="ml-2">左スティック/D-pad</span>
                    <InputIndicator active={inputActivity.p3_gamepad} />
                  </div>
                </>
              )}
              
              {gameMode === 4 && (
                <>
                  <div className="flex items-center mt-2">
                    <span className="text-green-400 font-bold">🟢 Player 4:</span>
                    <span className="ml-2">KB: TFGH</span>
                    <InputIndicator active={inputActivity.p4_keyboard} />
                  </div>
                  <div className="flex items-center">
                    <span className="text-green-400 font-bold ml-4">GP[1]:</span>
                    <span className="ml-2">右スティック</span>
                    <InputIndicator active={inputActivity.p4_gamepad} />
                  </div>
                </>
              )}
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
            ゲーム開始 (Enter / Joy-Con +)
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
              <li>🏆 <b>NEW</b>: 4人プレイ対応！順位付き(1〜{gameMode}位)</li>
              <li>👁️ 壁破壊で視界縮小(5→2、円の中心固定)</li>
              <li>🎨 床ペイント方式、CUD対応色</li>
              <li>🔴 Player 1: 左上スタート (WASD + E)</li>
              <li>🔵 Player 2: 右下スタート (IJKL + U)</li>
              {gameMode >= 3 && <li>🟡 Player 3: 右上スタート (矢印 + Shift)</li>}
              {gameMode === 4 && <li>🟢 Player 4: 左下スタート (TFGH + R)</li>}
              <li>📱 タッチ: 画面の十字ボタン / 爆弾タップで破壊</li>
              <li>🎮 Joy-Con: P1/P2は1台目、P3{gameMode === 4 && '/P4'}は2台目</li>
              <li>💣 壁破壊: 各プレイヤー3回まで</li>
              <li>🚪 リタイア: Escキー / Joy-Con +と-同時</li>
              <li>👁️ 視界切替: Vキー(ゲーム中・終了後も可)</li>
              <li>🗺️ 迷路: 31×31、始点ランダム、毎回違う形</li>
            </ul>
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-xs text-gray-400">v0.7.5</div>
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
          
          {/* Rankings display */}
          {rankings.length > 0 && (
            <div className="text-sm mb-2 bg-gray-900 px-4 py-2 rounded border border-yellow-500">
              {rankings.map((playerId, index) => {
                const player = PLAYER_CONFIGS.find(p => p.id === playerId);
                return (
                  <span key={playerId} className="mr-3" style={{ color: player.color }}>
                    {index + 1}位: {player.emoji}
                  </span>
                );
              })}
            </div>
          )}
          
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
          
          <div className={`flex ${gameMode === 4 ? 'gap-2' : gameMode === 3 ? 'gap-4' : 'gap-8'} mt-4 w-full justify-center flex-wrap`}>
            {players.map(player => (
              <ControlPanel key={player.id} player={player} />
            ))}
          </div>
          
          <div className="mt-4 text-center text-xs space-y-1 w-full max-w-4xl">
            <p style={{color: '#FF6347'}}>🔴 P1: WASD / 破壊: E</p>
            <p style={{color: '#4169E1'}}>🔵 P2: IJKL / 破壊: U</p>
            {gameMode >= 3 && <p style={{color: '#FFD700'}}>🟡 P3: 矢印 / 破壊: Shift</p>}
            {gameMode === 4 && <p style={{color: '#32CD32'}}>🟢 P4: TFGH / 破壊: R</p>}
            <p style={{color: '#888'}}>🚪 リタイア: Esc | 👁️ 視界切替: V</p>
          </div>
        </div>
      )}

      {gameState === 'finished' && (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-xs text-gray-400">v0.7.5</div>
            <button
              onClick={cycleViewMode}
              className="text-sm px-3 py-1 rounded transition-all bg-blue-600 hover:bg-blue-700 active:bg-blue-800 border border-yellow-500"
              style={{ touchAction: 'manipulation' }}
            >
              {currentViewMode?.icon} {currentViewMode?.name}
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="rounded"
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
                {/* Show full rankings */}
                {rankings.length > 1 && (
                  <div className="text-center mb-4">
                    <p className="text-lg font-bold mb-2" style={{color: '#FFD700'}}>最終順位</p>
                    {rankings.map((playerId, index) => {
                      const player = PLAYER_CONFIGS.find(p => p.id === playerId);
                      const medals = ['🥇', '🥈', '🥉', '4️⃣'];
                      return (
                        <p key={playerId} className="text-lg" style={{ color: player.color }}>
                          {medals[index] || `${index + 1}位`} {player.emoji} Player {playerId}
                        </p>
                      );
                    })}
                  </div>
                )}
                <p className="text-sm text-center mb-4 text-gray-300">
                  全ての敵陣地を訪問して自陣に帰還しました!
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