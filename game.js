import React, { useState, useEffect, useRef } from 'react';

// v0.4.4: Add continuous footprint trails with Bezier curves, clarify button labels, remove canvas border
// Commit: v0.4.4: Add continuous footprint trails with Bezier curves, clarify button labels, remove canvas border

const MazeBattleGame = () => {
  const [gameState, setGameState] = useState('menu');
  const [maze, setMaze] = useState([]);
  const [player1, setPlayer1] = useState({ x: 1, y: 1 });
  const [player2, setPlayer2] = useState({ x: 41, y: 41 });
  const [direction1, setDirection1] = useState({ dx: 1, dy: 0 });
  const [direction2, setDirection2] = useState({ dx: -1, dy: 0 });
  const [footprintPath1, setFootprintPath1] = useState([]);
  const [footprintPath2, setFootprintPath2] = useState([]);
  const [wallBreaks1, setWallBreaks1] = useState(3);
  const [wallBreaks2, setWallBreaks2] = useState(3);
  const [brokenWalls, setBrokenWalls] = useState(new Set());
  const [particles, setParticles] = useState([]);
  const [winner, setWinner] = useState(null);
  const [touchStart1, setTouchStart1] = useState(null);
  const [touchStart2, setTouchStart2] = useState(null);
  const [gamepadDebug, setGamepadDebug] = useState('');
  const [pressedKeys, setPressedKeys] = useState(new Set());
  const [cellSize, setCellSize] = useState(18);
  const [showFullMaze, setShowFullMaze] = useState(false);
  const [touchHolding, setTouchHolding] = useState({ p1: null, p2: null });
  
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastMoveRef = useRef({ p1: 0, p2: 0 });
  const audioContextRef = useRef(null);
  const touchIntervalRef = useRef({ p1: null, p2: null });

  const MAZE_SIZE = 43;
  const VISIBILITY = 5;
  const MOVE_DELAY = 120;

  // Dynamic cell size calculation
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

  // Sound effect
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

  const generateMaze = () => {
    const maze = Array(MAZE_SIZE).fill().map(() => Array(MAZE_SIZE).fill(1));
    
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
        if (nx > 0 && nx < MAZE_SIZE - 1 && ny > 0 && ny < MAZE_SIZE - 1 && maze[ny][nx] === 1) {
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
    const newMaze = generateMaze();
    setMaze(newMaze);
    setPlayer1({ x: 1, y: 1 });
    setPlayer2({ x: 41, y: 41 });
    setDirection1({ dx: 1, dy: 0 });
    setDirection2({ dx: -1, dy: 0 });
    setFootprintPath1([{ x: 1, y: 1 }]);
    setFootprintPath2([{ x: 41, y: 41 }]);
    setWallBreaks1(3);
    setWallBreaks2(3);
    setBrokenWalls(new Set());
    setParticles([]);
    setWinner(null);
    setShowFullMaze(false);
    setGameState('playing');
    lastMoveRef.current = { p1: Date.now(), p2: Date.now() };
  };

  const movePlayer = (player, setPlayer, dx, dy, playerNum, setDirection) => {
    const now = Date.now();
    const lastMove = playerNum === 1 ? lastMoveRef.current.p1 : lastMoveRef.current.p2;
    if (now - lastMove < MOVE_DELAY) return;

    // Always update direction
    setDirection({ dx, dy });

    const newX = player.x + dx;
    const newY = player.y + dy;

    if (newX >= 0 && newX < MAZE_SIZE && newY >= 0 && newY < MAZE_SIZE && maze[newY][newX] === 0) {
      const goalX = playerNum === 1 ? 41 : 1;
      const goalY = playerNum === 1 ? 41 : 1;

      setPlayer({ x: newX, y: newY });

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
      }
    }
  };

  const breakWall = (player, direction, playerNum) => {
    const breaks = playerNum === 1 ? wallBreaks1 : wallBreaks2;
    if (breaks <= 0) return;

    const wallX = player.x + direction.dx;
    const wallY = player.y + direction.dy;

    if (wallX >= 0 && wallX < MAZE_SIZE && wallY >= 0 && wallY < MAZE_SIZE && maze[wallY][wallX] === 1) {
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

  // Gamepad input - unified Joy-Con handling
  useEffect(() => {
    const checkGamepad = () => {
      const gamepads = navigator.getGamepads();
      let debugInfo = [];
      
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
      
      if (gameState === 'playing') {
        // Unified Joy-Con handling (both L and R on gamepads[0])
        if (gamepads[0]) {
          const gp = gamepads[0];
          const threshold = 0.5;
          
          // Player 1: Joy-Con(L) - axes[0], axes[1] and L-side buttons
          const axes01 = [gp.axes[0] || 0, gp.axes[1] || 0];
          if (Math.abs(axes01[0]) > threshold || Math.abs(axes01[1]) > threshold) {
            const dx = Math.abs(axes01[0]) > Math.abs(axes01[1]) ? (axes01[0] > 0 ? 1 : -1) : 0;
            const dy = Math.abs(axes01[1]) > Math.abs(axes01[0]) ? (axes01[1] > 0 ? 1 : -1) : 0;
            movePlayer(player1, setPlayer1, dx, dy, 1, setDirection1);
          }
          
          // Player 1: D-pad (buttons 12-15)
          if (gp.buttons[12]?.pressed) movePlayer(player1, setPlayer1, 0, -1, 1, setDirection1);
          if (gp.buttons[13]?.pressed) movePlayer(player1, setPlayer1, 0, 1, 1, setDirection1);
          if (gp.buttons[14]?.pressed) movePlayer(player1, setPlayer1, -1, 0, 1, setDirection1);
          if (gp.buttons[15]?.pressed) movePlayer(player1, setPlayer1, 1, 0, 1, setDirection1);
          
          // Player 1: L button for break
          if (gp.buttons[4]?.pressed) breakWall(player1, direction1, 1);
          
          // Player 2: Joy-Con(R) - axes[2], axes[3] and R-side buttons
          if (gp.axes.length > 3) {
            const axes23 = [gp.axes[2] || 0, gp.axes[3] || 0];
            if (Math.abs(axes23[0]) > threshold || Math.abs(axes23[1]) > threshold) {
              const dx = Math.abs(axes23[0]) > Math.abs(axes23[1]) ? (axes23[0] > 0 ? 1 : -1) : 0;
              const dy = Math.abs(axes23[1]) > Math.abs(axes23[0]) ? (axes23[1] > 0 ? 1 : -1) : 0;
              movePlayer(player2, setPlayer2, dx, dy, 2, setDirection2);
            }
          }
          
          // Player 2: XYBA buttons (0-3)
          if (gp.buttons[0]?.pressed) movePlayer(player2, setPlayer2, 1, 0, 2, setDirection2);  // A
          if (gp.buttons[1]?.pressed) movePlayer(player2, setPlayer2, 0, 1, 2, setDirection2);  // B
          if (gp.buttons[2]?.pressed) movePlayer(player2, setPlayer2, 0, -1, 2, setDirection2); // X
          if (gp.buttons[3]?.pressed) movePlayer(player2, setPlayer2, -1, 0, 2, setDirection2); // Y
          
          // Player 2: R button for break
          if (gp.buttons[5]?.pressed) breakWall(player2, direction2, 2);
        }
      }

      if (debugInfo.length > 0) {
        setGamepadDebug(debugInfo.join('\n'));
      }

      animationRef.current = requestAnimationFrame(checkGamepad);
    };

    animationRef.current = requestAnimationFrame(checkGamepad);
    return () => cancelAnimationFrame(animationRef.current);
  }, [gameState, player1, player2, maze, direction1, direction2, cellSize]);

  // Keyboard input with key repeat
  useEffect(() => {
    if (gameState === 'menu' || gameState === 'finished') {
      const handleMenuKey = (e) => {
        if (e.key === 'Enter') {
          startGame();
        }
      };
      window.addEventListener('keydown', handleMenuKey);
      return () => window.removeEventListener('keydown', handleMenuKey);
    }

    if (gameState !== 'playing') return;

    const handleKeyDown = (e) => {
      setPressedKeys(prev => new Set([...prev, e.key]));
      
      // Immediate break action
      if (e.key === 'Shift' || e.key === 'e' || e.key === 'E') {
        breakWall(player1, direction1, 1);
        e.preventDefault();
      }
      if (e.key === 'u' || e.key === 'U' || e.key === ' ') {
        breakWall(player2, direction2, 2);
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

  // Continuous key movement
  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      pressedKeys.forEach(key => {
        if (key === 'w' || key === 'W') movePlayer(player1, setPlayer1, 0, -1, 1, setDirection1);
        if (key === 's' || key === 'S') movePlayer(player1, setPlayer1, 0, 1, 1, setDirection1);
        if (key === 'a' || key === 'A') movePlayer(player1, setPlayer1, -1, 0, 1, setDirection1);
        if (key === 'd' || key === 'D') movePlayer(player1, setPlayer1, 1, 0, 1, setDirection1);
        
        if (key === 'ArrowUp' || key === 'i' || key === 'I') movePlayer(player2, setPlayer2, 0, -1, 2, setDirection2);
        if (key === 'ArrowDown' || key === 'k' || key === 'K') movePlayer(player2, setPlayer2, 0, 1, 2, setDirection2);
        if (key === 'ArrowLeft' || key === 'j' || key === 'J') movePlayer(player2, setPlayer2, -1, 0, 2, setDirection2);
        if (key === 'ArrowRight' || key === 'l' || key === 'L') movePlayer(player2, setPlayer2, 1, 0, 2, setDirection2);
      });
    }, MOVE_DELAY);

    return () => clearInterval(interval);
  }, [gameState, pressedKeys, player1, player2, maze, direction1, direction2]);

  // Particle update
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

    const drawPlayerView = (player, otherPlayer, otherDirection, footprintPath, offsetX, playerNum, direction) => {
      const otherFootprintPath = playerNum === 1 ? footprintPath2 : footprintPath1;
      const goalX = playerNum === 1 ? 41 : 1;
      const goalY = playerNum === 1 ? 41 : 1;

      for (let dy = -VISIBILITY; dy <= VISIBILITY; dy++) {
        for (let dx = -VISIBILITY; dx <= VISIBILITY; dx++) {
          const x = player.x + dx;
          const y = player.y + dy;

          const screenX = offsetX + (dx + VISIBILITY) * cellSize;
          const screenY = (dy + VISIBILITY) * cellSize;

          const isOutOfBounds = x < 0 || x >= MAZE_SIZE || y < 0 || y >= MAZE_SIZE;
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
            // Floor with darker color for broken walls
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

            // Goal floor with player color
            if (x === goalX && y === goalY) {
              ctx.fillStyle = playerNum === 1 ? 'rgba(220, 20, 60, 0.5)' : 'rgba(65, 105, 225, 0.5)';
              ctx.fillRect(screenX + 2, screenY + 2, cellSize - 4, cellSize - 4);
            }
          }
        }
      }

      // Draw footprint trails with Bezier curves
      const drawFootprintTrail = (path, colorBase) => {
        if (path.length < 2) return;
        
        for (let i = 0; i < path.length - 1; i++) {
          const p0 = path[i];
          const p1 = path[i + 1];
          
          // Check if both points are in visibility range
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
            
            // Calculate alpha (older = more transparent)
            const alpha = 0.2 + (i / path.length) * 0.5;
            
            // Calculate wavy width
            const baseWidth = 4;
            const wavyWidth = baseWidth + Math.sin(i * 0.3) * 1.5;
            
            // Control point for quadratic curve (midpoint with slight offset)
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

      // Draw own footprints
      const ownColor = playerNum === 1 ? 'rgba(255, 80, 80, ALPHA)' : 'rgba(80, 80, 255, ALPHA)';
      drawFootprintTrail(footprintPath, ownColor);
      
      // Draw other player's footprints
      const otherColor = playerNum === 1 ? 'rgba(80, 80, 255, ALPHA)' : 'rgba(255, 80, 80, ALPHA)';
      drawFootprintTrail(otherFootprintPath, otherColor);

      // Other player with direction
      const otherDx = otherPlayer.x - player.x;
      const otherDy = otherPlayer.y - player.y;
      if (Math.abs(otherDx) <= VISIBILITY && Math.abs(otherDy) <= VISIBILITY) {
        const otherScreenX = offsetX + (otherDx + VISIBILITY) * cellSize;
        const otherScreenY = (otherDy + VISIBILITY) * cellSize;
        
        ctx.fillStyle = playerNum === 1 ? '#4169E1' : '#DC143C';
        ctx.beginPath();
        ctx.arc(otherScreenX + cellSize / 2, otherScreenY + cellSize / 2 + 2, cellSize / 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Other player's eyes direction
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

      // Self player
      const playerScreenX = offsetX + VISIBILITY * cellSize;
      const playerScreenY = VISIBILITY * cellSize;
      
      ctx.fillStyle = playerNum === 1 ? '#DC143C' : '#4169E1';
      ctx.beginPath();
      ctx.arc(playerScreenX + cellSize / 2, playerScreenY + cellSize / 2 + 2, cellSize / 2.5, 0, Math.PI * 2);
      ctx.fill();
      
      // Eyes direction
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
    };

    const viewWidth = (VISIBILITY * 2 + 1) * cellSize;
    drawPlayerView(player1, player2, direction2, footprintPath1, 0, 1, direction1);
    drawPlayerView(player2, player1, direction1, footprintPath2, viewWidth + 30, 2, direction2);

    // Particles
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
  }, [gameState, player1, player2, direction1, direction2, footprintPath1, footprintPath2, maze, particles, brokenWalls, cellSize]);

  const handleDPad = (dx, dy, playerNum) => {
    if (playerNum === 1) {
      movePlayer(player1, setPlayer1, dx, dy, 1, setDirection1);
    } else {
      movePlayer(player2, setPlayer2, dx, dy, 2, setDirection2);
    }
  };

  const handleBreakButton = (playerNum) => {
    if (playerNum === 1) {
      breakWall(player1, direction1, 1);
    } else {
      breakWall(player2, direction2, 2);
    }
  };

  const handleDPadStart = (dx, dy, playerNum) => {
    handleDPad(dx, dy, playerNum);
    
    const key = playerNum === 1 ? 'p1' : 'p2';
    if (touchIntervalRef.current[key]) {
      clearInterval(touchIntervalRef.current[key]);
    }
    
    touchIntervalRef.current[key] = setInterval(() => {
      handleDPad(dx, dy, playerNum);
    }, MOVE_DELAY);
    
    setTouchHolding(prev => ({ ...prev, [key]: { dx, dy } }));
  };

  const handleDPadEnd = (playerNum) => {
    const key = playerNum === 1 ? 'p1' : 'p2';
    if (touchIntervalRef.current[key]) {
      clearInterval(touchIntervalRef.current[key]);
      touchIntervalRef.current[key] = null;
    }
    setTouchHolding(prev => ({ ...prev, [key]: null }));
  };

  useEffect(() => {
    return () => {
      if (touchIntervalRef.current.p1) clearInterval(touchIntervalRef.current.p1);
      if (touchIntervalRef.current.p2) clearInterval(touchIntervalRef.current.p2);
    };
  }, []);

  const canvasWidth = ((VISIBILITY * 2 + 1) * cellSize) * 2 + 30;
  const canvasHeight = (VISIBILITY * 2 + 1) * cellSize;

  const DPadButton = ({ direction, onClick, onStart, onEnd, style }) => (
    <button
      onTouchStart={(e) => { e.preventDefault(); onStart(); }}
      onTouchEnd={(e) => { e.preventDefault(); onEnd(); }}
      onMouseDown={(e) => { e.preventDefault(); onStart(); }}
      onMouseUp={(e) => { e.preventDefault(); onEnd(); }}
      onMouseLeave={(e) => { e.preventDefault(); onEnd(); }}
      className="w-12 h-12 bg-gray-700 active:bg-gray-500 rounded flex items-center justify-center text-white font-bold select-none"
      style={style}
    >
      {direction === 'up' && '▲'}
      {direction === 'down' && '▼'}
      {direction === 'left' && '◀'}
      {direction === 'right' && '▶'}
    </button>
  );

  const ControlPanel = ({ playerNum, wallBreaks, color }) => (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-40 h-40">
        <DPadButton 
          direction="up" 
          onStart={() => handleDPadStart(0, -1, playerNum)}
          onEnd={() => handleDPadEnd(playerNum)}
          style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }} 
        />
        <DPadButton 
          direction="down" 
          onStart={() => handleDPadStart(0, 1, playerNum)}
          onEnd={() => handleDPadEnd(playerNum)}
          style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)' }} 
        />
        <DPadButton 
          direction="left" 
          onStart={() => handleDPadStart(-1, 0, playerNum)}
          onEnd={() => handleDPadEnd(playerNum)}
          style={{ position: 'absolute', top: '50%', left: 0, transform: 'translateY(-50%)' }} 
        />
        <DPadButton 
          direction="right" 
          onStart={() => handleDPadStart(1, 0, playerNum)}
          onEnd={() => handleDPadEnd(playerNum)}
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

  const Modal = ({ children, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg border-4 border-yellow-600 max-w-full max-h-full overflow-auto relative">
        {children}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      {gameState === 'menu' && (
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-6" style={{color: '#FFD700', textShadow: '3px 3px 0 #8B4513'}}>
            迷路バトル
          </h1>
          <div className="mb-6 text-left bg-gray-900 p-6 rounded-lg max-w-md border-4 border-yellow-600">
            <h2 className="text-xl font-bold mb-3" style={{color: '#FFD700'}}>ルール:</h2>
            <ul className="space-y-2 text-sm">
              <li>🔴 Player 1: 左上スタート → 右下ゴールで勝利</li>
              <li>🔵 Player 2: 右下スタート → 左上ゴールで勝利</li>
              <li>📱 タッチ: 画面の十字ボタン / 爆弾タップで破壊</li>
              <li>⌨️ キーボード: WASD / 矢印キー or IJKL (押しっぱなしOK)</li>
              <li>🎮 Joy-Con(L+R): レバー、ボタン全対応</li>
              <li>💣 破壊: P1はShift/E/Lボタン / P2はU/Space/Rボタン (各3回)</li>
              <li>👣 足跡が相手に見える!</li>
              <li>👀 視界内なら相手も見える!</li>
            </ul>
          </div>
          <button
            onClick={startGame}
            className="px-8 py-3 rounded-lg text-xl font-bold mb-4"
            style={{
              background: '#1E90FF',
              border: '4px solid #FFD700',
              boxShadow: '0 4px 0 #8B4513'
            }}
          >
            ゲーム開始 (Enter)
          </button>
          {gamepadDebug && (
            <div className="mt-4 p-3 bg-gray-900 rounded border border-gray-700 text-xs text-white font-mono max-w-2xl mx-auto">
              <div className="text-yellow-500 mb-1">Joy-Con状態:</div>
              <div style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{gamepadDebug}</div>
            </div>
          )}
        </div>
      )}

      {gameState === 'playing' && (
        <div className="flex flex-col items-center">
          <div className="text-xs mb-2 text-gray-400">v0.4.4</div>
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="rounded"
          />
          <div className="flex gap-8 mt-4 w-full justify-center">
            <ControlPanel playerNum={1} wallBreaks={wallBreaks1} color="#DC143C" />
            <ControlPanel playerNum={2} wallBreaks={wallBreaks2} color="#4169E1" />
          </div>
          <div className="mt-4 text-center text-xs space-y-1 w-full max-w-4xl">
            <p style={{color: '#FF6B6B'}}>🔴 P1: WASD / Joy-Con(L) | 破壊: Shift/E/Lボタン</p>
            <p style={{color: '#6B9BFF'}}>🔵 P2: 矢印/IJKL / Joy-Con(R) | 破壊: U/Space/Rボタン</p>
            {gamepadDebug && (
              <div className="mt-3 p-3 bg-gray-900 rounded border border-gray-700 text-xs text-white font-mono">
                <div style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{gamepadDebug}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {gameState === 'finished' && (
        <>
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="rounded opacity-50"
          />
          <Modal>
            <div className="text-center p-8">
              <h1 className="text-6xl font-bold mb-6" style={{
                color: winner === 1 ? '#FF6B6B' : '#6B9BFF',
                textShadow: '4px 4px 0 #000'
              }}>
                {winner === 1 ? '🔴 Player 1' : '🔵 Player 2'}<br/>の勝利!
              </h1>
              <button
                onClick={() => setShowFullMaze(!showFullMaze)}
                className="px-6 py-2 rounded-lg text-lg font-bold mb-4"
                style={{
                  background: '#FFA500',
                  border: '3px solid #FFD700',
                  boxShadow: '0 3px 0 #CC8400'
                }}
              >
                {showFullMaze ? '閉じる' : '迷路全体を見る'}
              </button>
              <br/>
              <button
                onClick={startGame}
                className="px-8 py-3 rounded-lg text-xl font-bold"
                style={{
                  background: '#32CD32',
                  border: '4px solid #FFD700',
                  boxShadow: '0 4px 0 #228B22'
                }}
              >
                もう一度プレイ (Enter)
              </button>
            </div>
          </Modal>
          
          {showFullMaze && (
            <Modal onClose={() => setShowFullMaze(false)}>
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-4 text-center" style={{color: '#FFD700'}}>迷路全体</h2>
                <div style={{maxWidth: '90vw', maxHeight: '70vh', overflow: 'auto'}}>
                  <canvas
                    ref={(canvas) => {
                      if (!canvas || !maze.length) return;
                      const ctx = canvas.getContext('2d');
                      const miniCellSize = 8;
                      ctx.clearRect(0, 0, canvas.width, canvas.height);
                      
                      for (let y = 0; y < MAZE_SIZE; y++) {
                        for (let x = 0; x < MAZE_SIZE; x++) {
                          const screenX = x * miniCellSize;
                          const screenY = y * miniCellSize;
                          
                          if (maze[y][x] === 1) {
                            ctx.fillStyle = '#5a5a5a';
                          } else if (brokenWalls.has(`${x},${y}`)) {
                            ctx.fillStyle = '#4a3019';
                          } else {
                            ctx.fillStyle = '#8B5A2B';
                          }
                          ctx.fillRect(screenX, screenY, miniCellSize, miniCellSize);
                          
                          if ((x === 1 && y === 1) || (x === 41 && y === 41)) {
                            ctx.fillStyle = x === 1 ? 'rgba(220, 20, 60, 0.7)' : 'rgba(65, 105, 225, 0.7)';
                            ctx.fillRect(screenX, screenY, miniCellSize, miniCellSize);
                          }
                        }
                      }
                      
                      // Player paths (continuous trails)
                      const drawMiniTrail = (path, color) => {
                        if (path.length < 2) return;
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 2;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.beginPath();
                        ctx.moveTo(path[0].x * miniCellSize + miniCellSize/2, path[0].y * miniCellSize + miniCellSize/2);
                        for (let i = 1; i < path.length; i++) {
                          ctx.lineTo(path[i].x * miniCellSize + miniCellSize/2, path[i].y * miniCellSize + miniCellSize/2);
                        }
                        ctx.stroke();
                      };
                      
                      drawMiniTrail(footprintPath1, 'rgba(255, 80, 80, 0.7)');
                      drawMiniTrail(footprintPath2, 'rgba(80, 80, 255, 0.7)');
                      
                      ctx.fillStyle = '#DC143C';
                      ctx.beginPath();
                      ctx.arc(player1.x * miniCellSize + miniCellSize/2, player1.y * miniCellSize + miniCellSize/2, miniCellSize/2, 0, Math.PI * 2);
                      ctx.fill();
                      
                      ctx.fillStyle = '#4169E1';
                      ctx.beginPath();
                      ctx.arc(player2.x * miniCellSize + miniCellSize/2, player2.y * miniCellSize + miniCellSize/2, miniCellSize/2, 0, Math.PI * 2);
                      ctx.fill();
                    }}
                    width={MAZE_SIZE * 8}
                    height={MAZE_SIZE * 8}
                    className="border-2 border-gray-600"
                  />
                </div>
                <button
                  onClick={() => setShowFullMaze(false)}
                  className="mt-4 px-6 py-2 rounded-lg font-bold w-full"
                  style={{
                    background: '#666',
                    border: '3px solid #888'
                  }}
                >
                  閉じる
                </button>
              </div>
            </Modal>
          )}
        </>
      )}
    </div>
  );
};

export default MazeBattleGame;