import React, { useState, useEffect, useRef } from 'react';

// v0.5.0: Add 3-player mode with yellow player and mode selection screen
// Commit: v0.5.0: Add 3-player mode with yellow player and mode selection screen

const MazeBattleGame = () => {
  const [gameState, setGameState] = useState('mode_select');
  const [playerCount, setPlayerCount] = useState(2);
  const [selectedMode, setSelectedMode] = useState(2);
  const [maze, setMaze] = useState([]);
  const [player1, setPlayer1] = useState({ x: 1, y: 1 });
  const [player2, setPlayer2] = useState({ x: 41, y: 41 });
  const [player3, setPlayer3] = useState({ x: 1, y: 41 });
  const [direction1, setDirection1] = useState({ dx: 1, dy: 0 });
  const [direction2, setDirection2] = useState({ dx: -1, dy: 0 });
  const [direction3, setDirection3] = useState({ dx: 1, dy: 0 });
  const [footprintPath1, setFootprintPath1] = useState([]);
  const [footprintPath2, setFootprintPath2] = useState([]);
  const [footprintPath3, setFootprintPath3] = useState([]);
  const [wallBreaks1, setWallBreaks1] = useState(3);
  const [wallBreaks2, setWallBreaks2] = useState(3);
  const [wallBreaks3, setWallBreaks3] = useState(3);
  const [brokenWalls, setBrokenWalls] = useState(new Set());
  const [particles, setParticles] = useState([]);
  const [winner, setWinner] = useState(null);
  const [touchStart1, setTouchStart1] = useState(null);
  const [touchStart2, setTouchStart2] = useState(null);
  const [gamepadDebug, setGamepadDebug] = useState('');
  const [pressedKeys, setPressedKeys] = useState(new Set());
  const [cellSize, setCellSize] = useState(18);
  const [showFullMaze, setShowFullMaze] = useState(false);
  const [touchHolding, setTouchHolding] = useState({ p1: null, p2: null, p3: null });
  
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastMoveRef = useRef({ p1: 0, p2: 0, p3: 0 });
  const audioContextRef = useRef(null);
  const touchIntervalRef = useRef({ p1: null, p2: null, p3: null });

  const MAZE_SIZE = 43;
  const VISIBILITY = 5;
  const MOVE_DELAY = 120;

  // Dynamic cell size calculation
  useEffect(() => {
    const updateCellSize = () => {
      const availableHeight = window.innerHeight - 250;
      const availableWidth = window.innerWidth - 100;
      const viewSize = (VISIBILITY * 2 + 1);
      const maxCellSizeByHeight = Math.floor(availableHeight / viewSize);
      const maxCellSizeByWidth = Math.floor(availableWidth / (viewSize * playerCount));
      const newCellSize = Math.max(18, Math.min(maxCellSizeByHeight, maxCellSizeByWidth, 32));
      setCellSize(newCellSize);
    };

    updateCellSize();
    window.addEventListener('resize', updateCellSize);
    return () => window.removeEventListener('resize', updateCellSize);
  }, [playerCount]);

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

  const startGame = (mode) => {
    const newMaze = generateMaze();
    setMaze(newMaze);
    setPlayerCount(mode);
    setPlayer1({ x: 1, y: 1 });
    setPlayer2({ x: 41, y: 41 });
    setPlayer3({ x: 1, y: 41 });
    setDirection1({ dx: 1, dy: 0 });
    setDirection2({ dx: -1, dy: 0 });
    setDirection3({ dx: 1, dy: 0 });
    setFootprintPath1([{ x: 1, y: 1 }]);
    setFootprintPath2([{ x: 41, y: 41 }]);
    setFootprintPath3([{ x: 1, y: 41 }]);
    setWallBreaks1(3);
    setWallBreaks2(3);
    setWallBreaks3(3);
    setBrokenWalls(new Set());
    setParticles([]);
    setWinner(null);
    setShowFullMaze(false);
    setGameState('playing');
    lastMoveRef.current = { p1: Date.now(), p2: Date.now(), p3: Date.now() };
  };

  const movePlayer = (player, setPlayer, dx, dy, playerNum, setDirection) => {
    const now = Date.now();
    const lastMove = playerNum === 1 ? lastMoveRef.current.p1 : playerNum === 2 ? lastMoveRef.current.p2 : lastMoveRef.current.p3;
    if (now - lastMove < MOVE_DELAY) return;

    setDirection({ dx, dy });

    const newX = player.x + dx;
    const newY = player.y + dy;

    if (newX >= 0 && newX < MAZE_SIZE && newY >= 0 && newY < MAZE_SIZE && maze[newY][newX] === 0) {
      const goalX = playerNum === 1 ? 41 : playerNum === 2 ? 1 : 41;
      const goalY = playerNum === 1 ? 41 : playerNum === 2 ? 1 : 1;

      setPlayer({ x: newX, y: newY });

      if (playerNum === 1) {
        setFootprintPath1(prev => [...prev, { x: newX, y: newY }]);
        lastMoveRef.current.p1 = now;
      } else if (playerNum === 2) {
        setFootprintPath2(prev => [...prev, { x: newX, y: newY }]);
        lastMoveRef.current.p2 = now;
      } else {
        setFootprintPath3(prev => [...prev, { x: newX, y: newY }]);
        lastMoveRef.current.p3 = now;
      }

      if (newX === goalX && newY === goalY) {
        setWinner(playerNum);
        setGameState('finished');
      }
    }
  };

  const breakWall = (player, direction, playerNum) => {
    const breaks = playerNum === 1 ? wallBreaks1 : playerNum === 2 ? wallBreaks2 : wallBreaks3;
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
      } else if (playerNum === 2) {
        setWallBreaks2(breaks - 1);
      } else {
        setWallBreaks3(breaks - 1);
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

  // Gamepad input - mode selection and game control
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
      
      if (gameState === 'mode_select' && gamepads[0]) {
        const gp = gamepads[0];
        const threshold = 0.5;
        
        // Lever up/down or ABXY for selection
        const axes01 = [gp.axes[0] || 0, gp.axes[1] || 0];
        if (axes01[1] < -threshold || gp.buttons[2]?.pressed) { // Up or X
          setSelectedMode(2);
        } else if (axes01[1] > threshold || gp.buttons[1]?.pressed) { // Down or B
          setSelectedMode(3);
        }
        
        // + or - button for start
        if (gp.buttons[9]?.pressed || gp.buttons[8]?.pressed) { // + or -
          startGame(selectedMode);
        }
      }
      
      if (gameState === 'playing') {
        if (gamepads[0]) {
          const gp = gamepads[0];
          const threshold = 0.5;
          
          // Player 1: Joy-Con(L)
          const axes01 = [gp.axes[0] || 0, gp.axes[1] || 0];
          if (Math.abs(axes01[0]) > threshold || Math.abs(axes01[1]) > threshold) {
            const dx = Math.abs(axes01[0]) > Math.abs(axes01[1]) ? (axes01[0] > 0 ? 1 : -1) : 0;
            const dy = Math.abs(axes01[1]) > Math.abs(axes01[0]) ? (axes01[1] > 0 ? 1 : -1) : 0;
            movePlayer(player1, setPlayer1, dx, dy, 1, setDirection1);
          }
          
          if (gp.buttons[12]?.pressed) movePlayer(player1, setPlayer1, 0, -1, 1, setDirection1);
          if (gp.buttons[13]?.pressed) movePlayer(player1, setPlayer1, 0, 1, 1, setDirection1);
          if (gp.buttons[14]?.pressed) movePlayer(player1, setPlayer1, -1, 0, 1, setDirection1);
          if (gp.buttons[15]?.pressed) movePlayer(player1, setPlayer1, 1, 0, 1, setDirection1);
          
          if (gp.buttons[4]?.pressed) breakWall(player1, direction1, 1);
          
          // Player 2: Joy-Con(R)
          if (gp.axes.length > 3) {
            const axes23 = [gp.axes[2] || 0, gp.axes[3] || 0];
            if (Math.abs(axes23[0]) > threshold || Math.abs(axes23[1]) > threshold) {
              const dx = Math.abs(axes23[0]) > Math.abs(axes23[1]) ? (axes23[0] > 0 ? 1 : -1) : 0;
              const dy = Math.abs(axes23[1]) > Math.abs(axes23[0]) ? (axes23[1] > 0 ? 1 : -1) : 0;
              movePlayer(player2, setPlayer2, dx, dy, 2, setDirection2);
            }
          }
          
          if (gp.buttons[0]?.pressed) movePlayer(player2, setPlayer2, 1, 0, 2, setDirection2);
          if (gp.buttons[1]?.pressed) movePlayer(player2, setPlayer2, 0, 1, 2, setDirection2);
          if (gp.buttons[2]?.pressed) movePlayer(player2, setPlayer2, 0, -1, 2, setDirection2);
          if (gp.buttons[3]?.pressed) movePlayer(player2, setPlayer2, -1, 0, 2, setDirection2);
          
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
  }, [gameState, selectedMode, player1, player2, player3, maze, direction1, direction2, direction3, cellSize]);

  // Keyboard input - mode selection and game control
  useEffect(() => {
    if (gameState === 'mode_select') {
      const handleModeKey = (e) => {
        if (e.key === '2') {
          startGame(2);
        } else if (e.key === '3') {
          startGame(3);
        } else if (e.key === 'ArrowUp') {
          setSelectedMode(2);
        } else if (e.key === 'ArrowDown') {
          setSelectedMode(3);
        } else if (e.key === 'Enter') {
          startGame(selectedMode);
        }
      };
      window.addEventListener('keydown', handleModeKey);
      return () => window.removeEventListener('keydown', handleModeKey);
    }

    if (gameState === 'finished') {
      const handleFinishKey = (e) => {
        if (e.key === 'Enter') {
          setGameState('mode_select');
        }
      };
      window.addEventListener('keydown', handleFinishKey);
      return () => window.removeEventListener('keydown', handleFinishKey);
    }

    if (gameState !== 'playing') return;

    const handleKeyDown = (e) => {
      setPressedKeys(prev => new Set([...prev, e.key]));
      
      if (e.key === 'Shift' || e.key === 'e' || e.key === 'E') {
        breakWall(player1, direction1, 1);
        e.preventDefault();
      }
      if (e.key === 'u' || e.key === 'U') {
        breakWall(player2, direction2, 2);
        e.preventDefault();
      }
      if (e.key === ' ') {
        breakWall(player3, direction3, 3);
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
  }, [gameState, selectedMode, player1, player2, player3, maze, direction1, direction2, direction3]);

  // Continuous key movement
  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      pressedKeys.forEach(key => {
        if (key === 'w' || key === 'W') movePlayer(player1, setPlayer1, 0, -1, 1, setDirection1);
        if (key === 's' || key === 'S') movePlayer(player1, setPlayer1, 0, 1, 1, setDirection1);
        if (key === 'a' || key === 'A') movePlayer(player1, setPlayer1, -1, 0, 1, setDirection1);
        if (key === 'd' || key === 'D') movePlayer(player1, setPlayer1, 1, 0, 1, setDirection1);
        
        if (key === 'i' || key === 'I') movePlayer(player2, setPlayer2, 0, -1, 2, setDirection2);
        if (key === 'k' || key === 'K') movePlayer(player2, setPlayer2, 0, 1, 2, setDirection2);
        if (key === 'j' || key === 'J') movePlayer(player2, setPlayer2, -1, 0, 2, setDirection2);
        if (key === 'l' || key === 'L') movePlayer(player2, setPlayer2, 1, 0, 2, setDirection2);
        
        if (key === 'ArrowUp') movePlayer(player3, setPlayer3, 0, -1, 3, setDirection3);
        if (key === 'ArrowDown') movePlayer(player3, setPlayer3, 0, 1, 3, setDirection3);
        if (key === 'ArrowLeft') movePlayer(player3, setPlayer3, -1, 0, 3, setDirection3);
        if (key === 'ArrowRight') movePlayer(player3, setPlayer3, 1, 0, 3, setDirection3);
      });
    }, MOVE_DELAY);

    return () => clearInterval(interval);
  }, [gameState, pressedKeys, player1, player2, player3, maze, direction1, direction2, direction3]);

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

    const drawPlayerView = (player, otherPlayers, otherDirections, footprintPaths, offsetX, playerNum, direction) => {
      const goalX = playerNum === 1 ? 41 : playerNum === 2 ? 1 : 41;
      const goalY = playerNum === 1 ? 41 : playerNum === 2 ? 1 : 1;

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
              const color = playerNum === 1 ? 'rgba(220, 20, 60, 0.5)' : playerNum === 2 ? 'rgba(65, 105, 225, 0.5)' : 'rgba(255, 215, 0, 0.5)';
              ctx.fillStyle = color;
              ctx.fillRect(screenX + 2, screenY + 2, cellSize - 4, cellSize - 4);
            }
          }
        }
      }

      // Draw footprint trails
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

      // Own footprints
      const ownColor = playerNum === 1 ? 'rgba(255, 80, 80, ALPHA)' : playerNum === 2 ? 'rgba(80, 80, 255, ALPHA)' : 'rgba(255, 215, 0, ALPHA)';
      drawFootprintTrail(footprintPaths[playerNum - 1], ownColor);
      
      // Other players' footprints
      footprintPaths.forEach((path, idx) => {
        if (idx !== playerNum - 1) {
          const otherColor = idx === 0 ? 'rgba(255, 80, 80, ALPHA)' : idx === 1 ? 'rgba(80, 80, 255, ALPHA)' : 'rgba(255, 215, 0, ALPHA)';
          drawFootprintTrail(path, otherColor);
        }
      });

      // Draw other players
      otherPlayers.forEach((otherPlayer, idx) => {
        const otherDx = otherPlayer.x - player.x;
        const otherDy = otherPlayer.y - player.y;
        if (Math.abs(otherDx) <= VISIBILITY && Math.abs(otherDy) <= VISIBILITY) {
          const otherScreenX = offsetX + (otherDx + VISIBILITY) * cellSize;
          const otherScreenY = (otherDy + VISIBILITY) * cellSize;
          
          const otherPlayerNum = idx >= playerNum - 1 ? idx + 2 : idx + 1;
          const color = otherPlayerNum === 1 ? '#DC143C' : otherPlayerNum === 2 ? '#4169E1' : '#FFD700';
          
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(otherScreenX + cellSize / 2, otherScreenY + cellSize / 2 + 2, cellSize / 2.5, 0, Math.PI * 2);
          ctx.fill();
          
          // Eyes
          const otherDir = otherDirections[idx];
          ctx.fillStyle = '#FFF';
          const eyeSize = 3;
          const eyeOffset = cellSize / 4;
          const otherCenterX = otherScreenX + cellSize / 2;
          const otherCenterY = otherScreenY + cellSize / 2;
          
          let oeye1X, oeye1Y, oeye2X, oeye2Y;
          
          if (otherDir.dx === 1 && otherDir.dy === 0) {
            oeye1X = otherCenterX + eyeOffset; oeye1Y = otherCenterY - eyeSize;
            oeye2X = otherCenterX + eyeOffset; oeye2Y = otherCenterY + eyeSize;
          } else if (otherDir.dx === -1 && otherDir.dy === 0) {
            oeye1X = otherCenterX - eyeOffset; oeye1Y = otherCenterY - eyeSize;
            oeye2X = otherCenterX - eyeOffset; oeye2Y = otherCenterY + eyeSize;
          } else if (otherDir.dx === 0 && otherDir.dy === -1) {
            oeye1X = otherCenterX - eyeSize; oeye1Y = otherCenterY - eyeOffset;
            oeye2X = otherCenterX + eyeSize; oeye2Y = otherCenterY - eyeOffset;
          } else {
            oeye1X = otherCenterX - eyeSize; oeye1Y = otherCenterY + eyeOffset;
            oeye2X = otherCenterX + eyeSize; oeye2Y = otherCenterY + eyeOffset;
          }
          
          ctx.fillRect(oeye1X - eyeSize / 2, oeye1Y - eyeSize / 2, eyeSize, eyeSize);
          ctx.fillRect(oeye2X - eyeSize / 2, oeye2Y - eyeSize / 2, eyeSize, eyeSize);
        }
      });

      // Self player
      const playerScreenX = offsetX + VISIBILITY * cellSize;
      const playerScreenY = VISIBILITY * cellSize;
      
      const selfColor = playerNum === 1 ? '#DC143C' : playerNum === 2 ? '#4169E1' : '#FFD700';
      ctx.fillStyle = selfColor;
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
        eye1X = centerX + eyeOffset; eye1Y = centerY - eyeSize;
        eye2X = centerX + eyeOffset; eye2Y = centerY + eyeSize;
      } else if (direction.dx === -1 && direction.dy === 0) {
        eye1X = centerX - eyeOffset; eye1Y = centerY - eyeSize;
        eye2X = centerX - eyeOffset; eye2Y = centerY + eyeSize;
      } else if (direction.dx === 0 && direction.dy === -1) {
        eye1X = centerX - eyeSize; eye1Y = centerY - eyeOffset;
        eye2X = centerX + eyeSize; eye2Y = centerY - eyeOffset;
      } else {
        eye1X = centerX - eyeSize; eye1Y = centerY + eyeOffset;
        eye2X = centerX + eyeSize; eye2Y = centerY + eyeOffset;
      }
      
      ctx.fillRect(eye1X - eyeSize / 2, eye1Y - eyeSize / 2, eyeSize, eyeSize);
      ctx.fillRect(eye2X - eyeSize / 2, eye2Y - eyeSize / 2, eyeSize, eyeSize);
    };

    const viewWidth = (VISIBILITY * 2 + 1) * cellSize;
    const margin = 10;
    
    const allPlayers = [player1, player2, player3];
    const allDirections = [direction1, direction2, direction3];
    const allFootprints = [footprintPath1, footprintPath2, footprintPath3];
    
    for (let i = 0; i < playerCount; i++) {
      const offsetX = i * (viewWidth + margin);
      const otherPlayers = allPlayers.filter((_, idx) => idx !== i).slice(0, playerCount - 1);
      const otherDirections = allDirections.filter((_, idx) => idx !== i).slice(0, playerCount - 1);
      
      drawPlayerView(
        allPlayers[i],
        otherPlayers,
        otherDirections,
        allFootprints,
        offsetX,
        i + 1,
        allDirections[i]
      );
    }

    // Particles
    particles.forEach(p => {
      const playerIdx = p.playerNum - 1;
      if (playerIdx >= playerCount) return;
      
      const currentPlayer = allPlayers[playerIdx];
      const dx = p.x - currentPlayer.x;
      const dy = p.y - currentPlayer.y;
      
      if (Math.abs(dx) <= VISIBILITY && Math.abs(dy) <= VISIBILITY) {
        const offsetX = playerIdx * (viewWidth + margin);
        const screenX = offsetX + (dx + VISIBILITY) * cellSize + p.vx * 2;
        const screenY = (dy + VISIBILITY) * cellSize + p.vy * 2;
        
        const color = p.playerNum === 1 ? 'rgba(255, 100, 100, ALPHA)' : p.playerNum === 2 ? 'rgba(100, 100, 255, ALPHA)' : 'rgba(255, 215, 0, ALPHA)';
        ctx.fillStyle = color.replace('ALPHA', (p.life / 30).toString());
        ctx.beginPath();
        ctx.arc(screenX, screenY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, [gameState, player1, player2, player3, direction1, direction2, direction3, footprintPath1, footprintPath2, footprintPath3, maze, particles, brokenWalls, cellSize, playerCount]);

  const handleDPad = (dx, dy, playerNum) => {
    if (playerNum === 1) {
      movePlayer(player1, setPlayer1, dx, dy, 1, setDirection1);
    } else if (playerNum === 2) {
      movePlayer(player2, setPlayer2, dx, dy, 2, setDirection2);
    } else {
      movePlayer(player3, setPlayer3, dx, dy, 3, setDirection3);
    }
  };

  const handleBreakButton = (playerNum) => {
    if (playerNum === 1) {
      breakWall(player1, direction1, 1);
    } else if (playerNum === 2) {
      breakWall(player2, direction2, 2);
    } else {
      breakWall(player3, direction3, 3);
    }
  };

  const handleDPadStart = (dx, dy, playerNum) => {
    handleDPad(dx, dy, playerNum);
    
    const key = `p${playerNum}`;
    if (touchIntervalRef.current[key]) {
      clearInterval(touchIntervalRef.current[key]);
    }
    
    touchIntervalRef.current[key] = setInterval(() => {
      handleDPad(dx, dy, playerNum);
    }, MOVE_DELAY);
    
    setTouchHolding(prev => ({ ...prev, [key]: { dx, dy } }));
  };

  const handleDPadEnd = (playerNum) => {
    const key = `p${playerNum}`;
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
      if (touchIntervalRef.current.p3) clearInterval(touchIntervalRef.current.p3);
    };
  }, []);

  const viewWidth = (VISIBILITY * 2 + 1) * cellSize;
  const margin = 10;
  const canvasWidth = viewWidth * playerCount + margin * (playerCount - 1);
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

  const Modal = ({ children }) => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg border-4 border-yellow-600 max-w-full max-h-full overflow-auto relative">
        {children}
      </div>
    </div>
  );

  const playerColors = ['#DC143C', '#4169E1', '#FFD700'];
  const playerEmojis = ['🔴', '🔵', '🟡'];
  const playerNames = ['Player 1', 'Player 2', 'Player 3'];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      {gameState === 'mode_select' && (
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-6" style={{color: '#FFD700', textShadow: '3px 3px 0 #8B4513'}}>
            迷路バトル
          </h1>
          <div className="text-xs mb-6 text-gray-400">v0.5.0</div>
          <div className="mb-6 space-y-4">
            <button
              onClick={() => startGame(2)}
              onMouseEnter={() => setSelectedMode(2)}
              className={`px-12 py-4 rounded-lg text-2xl font-bold transition-all ${
                selectedMode === 2 ? 'scale-110' : 'scale-100'
              }`}
              style={{
                background: selectedMode === 2 ? '#1E90FF' : '#666',
                border: '4px solid ' + (selectedMode === 2 ? '#FFD700' : '#888'),
                boxShadow: selectedMode === 2 ? '0 4px 0 #8B4513' : '0 2px 0 #444'
              }}
            >
              2人プレイ (2)
            </button>
            <br/>
            <button
              onClick={() => startGame(3)}
              onMouseEnter={() => setSelectedMode(3)}
              className={`px-12 py-4 rounded-lg text-2xl font-bold transition-all ${
                selectedMode === 3 ? 'scale-110' : 'scale-100'
              }`}
              style={{
                background: selectedMode === 3 ? '#1E90FF' : '#666',
                border: '4px solid ' + (selectedMode === 3 ? '#FFD700' : '#888'),
                boxShadow: selectedMode === 3 ? '0 4px 0 #8B4513' : '0 2px 0 #444'
              }}
            >
              3人プレイ (3)
            </button>
          </div>
          <div className="text-sm text-gray-400 mb-4">
            <p>キーボード: 2 または 3 / 矢印キー + Enter</p>
            <p>Joy-Con: レバー/ABXY + ＋/－ボタン</p>
          </div>
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
          <div className="text-xs mb-2 text-gray-400">v0.5.0</div>
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="rounded"
          />
          <div className="flex gap-8 mt-4 w-full justify-center">
            <ControlPanel playerNum={1} wallBreaks={wallBreaks1} color="#DC143C" />
            <ControlPanel playerNum={2} wallBreaks={wallBreaks2} color="#4169E1" />
            {playerCount === 3 && <ControlPanel playerNum={3} wallBreaks={wallBreaks3} color="#FFD700" />}
          </div>
          <div className="mt-4 text-center text-xs space-y-1 w-full max-w-4xl">
            <p style={{color: '#FF6B6B'}}>🔴 P1: WASD / Joy-Con(L) | 破壊: Shift/E/Lボタン</p>
            <p style={{color: '#6B9BFF'}}>🔵 P2: IJKL / Joy-Con(R) | 破壊: U/Rボタン</p>
            {playerCount === 3 && <p style={{color: '#FFD700'}}>🟡 P3: 矢印キー | 破壊: Space</p>}
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
                color: playerColors[winner - 1],
                textShadow: '4px 4px 0 #000'
              }}>
                {playerEmojis[winner - 1]} {playerNames[winner - 1]}<br/>の勝利!
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
                onClick={() => setGameState('mode_select')}
                className="px-8 py-3 rounded-lg text-xl font-bold"
                style={{
                  background: '#32CD32',
                  border: '4px solid #FFD700',
                  boxShadow: '0 4px 0 #228B22'
                }}
              >
                モード選択へ (Enter)
              </button>
            </div>
          </Modal>
          
          {showFullMaze && (
            <Modal>
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
                          
                          // Start positions
                          if ((x === 1 && y === 1) || (x === 41 && y === 41) || (playerCount === 3 && x === 1 && y === 41)) {
                            const color = (x === 1 && y === 1) ? 'rgba(220, 20, 60, 0.7)' : (x === 41 && y === 41) ? 'rgba(65, 105, 225, 0.7)' : 'rgba(255, 215, 0, 0.7)';
                            ctx.fillStyle = color;
                            ctx.fillRect(screenX, screenY, miniCellSize, miniCellSize);
                          }
                        }
                      }
                      
                      // Player paths
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
                      if (playerCount === 3) drawMiniTrail(footprintPath3, 'rgba(255, 215, 0, 0.7)');
                      
                      ctx.fillStyle = '#DC143C';
                      ctx.beginPath();
                      ctx.arc(player1.x * miniCellSize + miniCellSize/2, player1.y * miniCellSize + miniCellSize/2, miniCellSize/2, 0, Math.PI * 2);
                      ctx.fill();
                      
                      ctx.fillStyle = '#4169E1';
                      ctx.beginPath();
                      ctx.arc(player2.x * miniCellSize + miniCellSize/2, player2.y * miniCellSize + miniCellSize/2, miniCellSize/2, 0, Math.PI * 2);
                      ctx.fill();
                      
                      if (playerCount === 3) {
                        ctx.fillStyle = '#FFD700';
                        ctx.beginPath();
                        ctx.arc(player3.x * miniCellSize + miniCellSize/2, player3.y * miniCellSize + miniCellSize/2, miniCellSize/2, 0, Math.PI * 2);
                        ctx.fill();
                      }
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