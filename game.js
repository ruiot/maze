import React, { useState, useEffect, useRef } from 'react';

// v0.4.1: Add E key for P1 break, R button for P2 break, XYBA+axes[2][3] for P2 move, render outer walls in view, fix global checker pattern

const MazeBattleGame = () => {
  const [gameState, setGameState] = useState('menu');
  const [maze, setMaze] = useState([]);
  const [player1, setPlayer1] = useState({ x: 1, y: 1 });
  const [player2, setPlayer2] = useState({ x: 41, y: 41 });
  const [direction1, setDirection1] = useState({ dx: 1, dy: 0 });
  const [direction2, setDirection2] = useState({ dx: -1, dy: 0 });
  const [footprints1, setFootprints1] = useState(new Set());
  const [footprints2, setFootprints2] = useState(new Set());
  const [wallBreaks1, setWallBreaks1] = useState(3);
  const [wallBreaks2, setWallBreaks2] = useState(3);
  const [particles, setParticles] = useState([]);
  const [winner, setWinner] = useState(null);
  const [touchStart1, setTouchStart1] = useState(null);
  const [touchStart2, setTouchStart2] = useState(null);
  const [gamepadDebug, setGamepadDebug] = useState('');
  
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastMoveRef = useRef({ p1: 0, p2: 0 });

  const MAZE_SIZE = 43;
  const CELL_SIZE = 18;
  const VISIBILITY = 5;
  const MOVE_DELAY = 120;

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
    setFootprints1(new Set(['1,1']));
    setFootprints2(new Set(['41,41']));
    setWallBreaks1(3);
    setWallBreaks2(3);
    setParticles([]);
    setWinner(null);
    setGameState('playing');
    lastMoveRef.current = { p1: Date.now(), p2: Date.now() };
  };

  const movePlayer = (player, setPlayer, dx, dy, playerNum, setDirection) => {
    const now = Date.now();
    const lastMove = playerNum === 1 ? lastMoveRef.current.p1 : lastMoveRef.current.p2;
    if (now - lastMove < MOVE_DELAY) return;

    const newX = player.x + dx;
    const newY = player.y + dy;

    if (newX >= 0 && newX < MAZE_SIZE && newY >= 0 && newY < MAZE_SIZE && maze[newY][newX] === 0) {
      const goalX = playerNum === 1 ? 41 : 1;
      const goalY = playerNum === 1 ? 41 : 1;

      setPlayer({ x: newX, y: newY });
      setDirection({ dx, dy });

      if (playerNum === 1) {
        setFootprints1(prev => new Set([...prev, `${newX},${newY}`]));
        lastMoveRef.current.p1 = now;
      } else {
        setFootprints2(prev => new Set([...prev, `${newX},${newY}`]));
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

      if (playerNum === 1) {
        setWallBreaks1(breaks - 1);
      } else {
        setWallBreaks2(breaks - 1);
      }

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

  useEffect(() => {
    if (gameState !== 'playing') return;

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
      
      // Player 1: Joy-Con(L)
      if (gamepads[0]) {
        const gp = gamepads[0];
        const axes = [gp.axes[0] || 0, gp.axes[1] || 0];
        const threshold = 0.5;
        
        if (Math.abs(axes[0]) > threshold || Math.abs(axes[1]) > threshold) {
          const dx = Math.abs(axes[0]) > Math.abs(axes[1]) ? (axes[0] > 0 ? 1 : -1) : 0;
          const dy = Math.abs(axes[1]) > Math.abs(axes[0]) ? (axes[1] > 0 ? 1 : -1) : 0;
          movePlayer(player1, setPlayer1, dx, dy, 1, setDirection1);
        }
        
        if (gp.buttons[12]?.pressed) movePlayer(player1, setPlayer1, 0, -1, 1, setDirection1);
        if (gp.buttons[13]?.pressed) movePlayer(player1, setPlayer1, 0, 1, 1, setDirection1);
        if (gp.buttons[14]?.pressed) movePlayer(player1, setPlayer1, -1, 0, 1, setDirection1);
        if (gp.buttons[15]?.pressed) movePlayer(player1, setPlayer1, 1, 0, 1, setDirection1);
        
        if (gp.buttons[4]?.pressed) breakWall(player1, direction1, 1); // L button
      }

      // Player 2: Joy-Con(R)
      if (gamepads[1]) {
        const gp = gamepads[1];
        const threshold = 0.5;
        let moved = false;
        
        // axes[0], axes[1] をチェック
        const axes01 = [gp.axes[0] || 0, gp.axes[1] || 0];
        if (Math.abs(axes01[0]) > threshold || Math.abs(axes01[1]) > threshold) {
          const dx = Math.abs(axes01[0]) > Math.abs(axes01[1]) ? (axes01[0] > 0 ? 1 : -1) : 0;
          const dy = Math.abs(axes01[1]) > Math.abs(axes01[0]) ? (axes01[1] > 0 ? 1 : -1) : 0;
          movePlayer(player2, setPlayer2, dx, dy, 2, setDirection2);
          moved = true;
        }
        
        // axes[2], axes[3] もチェック（Joy-Con R の下側スティック）
        if (!moved && gp.axes.length > 3) {
          const axes23 = [gp.axes[2] || 0, gp.axes[3] || 0];
          if (Math.abs(axes23[0]) > threshold || Math.abs(axes23[1]) > threshold) {
            const dx = Math.abs(axes23[0]) > Math.abs(axes23[1]) ? (axes23[0] > 0 ? 1 : -1) : 0;
            const dy = Math.abs(axes23[1]) > Math.abs(axes23[0]) ? (axes23[1] > 0 ? 1 : -1) : 0;
            movePlayer(player2, setPlayer2, dx, dy, 2, setDirection2);
            moved = true;
          }
        }
        
        // XYBA ボタン（X:上 Y:左 B:下 A:右）
        if (gp.buttons[0]?.pressed) movePlayer(player2, setPlayer2, 1, 0, 2, setDirection2);  // A (右)
        if (gp.buttons[1]?.pressed) movePlayer(player2, setPlayer2, 0, 1, 2, setDirection2);  // B (下)
        if (gp.buttons[2]?.pressed) movePlayer(player2, setPlayer2, 0, -1, 2, setDirection2); // X (上)
        if (gp.buttons[3]?.pressed) movePlayer(player2, setPlayer2, -1, 0, 2, setDirection2); // Y (左)
        
        // 十字ボタン
        if (gp.buttons[12]?.pressed) movePlayer(player2, setPlayer2, 0, -1, 2, setDirection2);
        if (gp.buttons[13]?.pressed) movePlayer(player2, setPlayer2, 0, 1, 2, setDirection2);
        if (gp.buttons[14]?.pressed) movePlayer(player2, setPlayer2, -1, 0, 2, setDirection2);
        if (gp.buttons[15]?.pressed) movePlayer(player2, setPlayer2, 1, 0, 2, setDirection2);
        
        // 破壊: R ボタン (button 5)
        if (gp.buttons[5]?.pressed) breakWall(player2, direction2, 2);
      }

      if (debugInfo.length > 0) {
        setGamepadDebug(debugInfo.join('\n'));
      }

      animationRef.current = requestAnimationFrame(checkGamepad);
    };

    animationRef.current = requestAnimationFrame(checkGamepad);
    return () => cancelAnimationFrame(animationRef.current);
  }, [gameState, player1, player2, maze, direction1, direction2]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const handleKeyDown = (e) => {
      let handled = false;

      // Player 1 movement
      if (e.key === 'w' || e.key === 'W') { movePlayer(player1, setPlayer1, 0, -1, 1, setDirection1); handled = true; }
      if (e.key === 's' || e.key === 'S') { movePlayer(player1, setPlayer1, 0, 1, 1, setDirection1); handled = true; }
      if (e.key === 'a' || e.key === 'A') { movePlayer(player1, setPlayer1, -1, 0, 1, setDirection1); handled = true; }
      if (e.key === 'd' || e.key === 'D') { movePlayer(player1, setPlayer1, 1, 0, 1, setDirection1); handled = true; }
      
      // Player 1 break: Shift or E
      if (e.key === 'Shift' || e.key === 'e' || e.key === 'E') { breakWall(player1, direction1, 1); handled = true; }

      // Player 2 movement
      if (e.key === 'ArrowUp' || e.key === 'i' || e.key === 'I') { movePlayer(player2, setPlayer2, 0, -1, 2, setDirection2); handled = true; }
      if (e.key === 'ArrowDown' || e.key === 'k' || e.key === 'K') { movePlayer(player2, setPlayer2, 0, 1, 2, setDirection2); handled = true; }
      if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') { movePlayer(player2, setPlayer2, -1, 0, 2, setDirection2); handled = true; }
      if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') { movePlayer(player2, setPlayer2, 1, 0, 2, setDirection2); handled = true; }
      
      // Player 2 break: U or Space
      if (e.key === 'u' || e.key === 'U' || e.key === ' ') { breakWall(player2, direction2, 2); handled = true; }

      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [gameState, player1, player2, maze, direction1, direction2]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const handleTouch = (e) => {
      e.preventDefault();
      e.stopPropagation();

      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const isLeftSide = touch.clientX < window.innerWidth / 2;

        if (e.type === 'touchstart') {
          if (isLeftSide) {
            setTouchStart1({ x: touch.clientX, y: touch.clientY });
          } else {
            setTouchStart2({ x: touch.clientX, y: touch.clientY });
          }
        } else if (e.type === 'touchmove') {
          const start = isLeftSide ? touchStart1 : touchStart2;
          if (!start) continue;

          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          const threshold = 30;

          if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
            if (Math.abs(dx) > Math.abs(dy)) {
              movePlayer(
                isLeftSide ? player1 : player2,
                isLeftSide ? setPlayer1 : setPlayer2,
                dx > 0 ? 1 : -1,
                0,
                isLeftSide ? 1 : 2,
                isLeftSide ? setDirection1 : setDirection2
              );
            } else {
              movePlayer(
                isLeftSide ? player1 : player2,
                isLeftSide ? setPlayer1 : setPlayer2,
                0,
                dy > 0 ? 1 : -1,
                isLeftSide ? 1 : 2,
                isLeftSide ? setDirection1 : setDirection2
              );
            }

            if (isLeftSide) {
              setTouchStart1({ x: touch.clientX, y: touch.clientY });
            } else {
              setTouchStart2({ x: touch.clientX, y: touch.clientY });
            }
          }
        }
      }
    };

    const handleTouchEnd = (e) => {
      e.preventDefault();
      if (e.touches.length === 0) {
        setTouchStart1(null);
        setTouchStart2(null);
      }
    };

    document.addEventListener('touchstart', handleTouch, { passive: false });
    document.addEventListener('touchmove', handleTouch, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouch);
      document.removeEventListener('touchmove', handleTouch);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gameState, player1, player2, maze, touchStart1, touchStart2]);

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

    const drawPlayerView = (player, otherPlayer, footprints, offsetX, playerNum, direction) => {
      const otherFootprints = playerNum === 1 ? footprints2 : footprints1;
      const goalX = playerNum === 1 ? 41 : 1;
      const goalY = playerNum === 1 ? 41 : 1;

      for (let dy = -VISIBILITY; dy <= VISIBILITY; dy++) {
        for (let dx = -VISIBILITY; dx <= VISIBILITY; dx++) {
          const x = player.x + dx;
          const y = player.y + dy;

          const screenX = offsetX + (dx + VISIBILITY) * CELL_SIZE;
          const screenY = (dy + VISIBILITY) * CELL_SIZE;

          // 範囲外または壁
          const isOutOfBounds = x < 0 || x >= MAZE_SIZE || y < 0 || y >= MAZE_SIZE;
          const isWall = isOutOfBounds || maze[y][x] === 1;
          
          if (isWall) {
            // 壁（ひび割れた岩風グラフィック）
            const gradient = ctx.createLinearGradient(screenX, screenY, screenX + CELL_SIZE, screenY + CELL_SIZE);
            gradient.addColorStop(0, '#5a5a5a');
            gradient.addColorStop(0.5, '#3a3a3a');
            gradient.addColorStop(1, '#2a2a2a');
            ctx.fillStyle = gradient;
            ctx.fillRect(screenX, screenY, CELL_SIZE, CELL_SIZE);
            
            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 0.5;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(screenX + 2, screenY + 1);
            ctx.lineTo(screenX + CELL_SIZE - 3, screenY + CELL_SIZE - 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(screenX + CELL_SIZE - 2, screenY + 3);
            ctx.lineTo(screenX + 1, screenY + CELL_SIZE - 1);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
          } else {
            // 床（グローバル市松模様）
            const checkerSize = 3;
            for (let cy = 0; cy < CELL_SIZE; cy += checkerSize) {
              for (let cx = 0; cx < CELL_SIZE; cx += checkerSize) {
                // グローバル座標を考慮した市松模様
                const globalX = x * CELL_SIZE + cx;
                const globalY = y * CELL_SIZE + cy;
                const isCheckerDark = ((Math.floor(globalX / checkerSize) + Math.floor(globalY / checkerSize)) % 2) === 0;
                ctx.fillStyle = isCheckerDark ? '#6B4423' : '#8B5A2B';
                ctx.fillRect(screenX + cx, screenY + cy, checkerSize, checkerSize);
              }
            }

            // 足跡
            if (footprints.has(`${x},${y}`)) {
              const gradient = ctx.createRadialGradient(
                screenX + CELL_SIZE / 2, screenY + CELL_SIZE / 2, 0,
                screenX + CELL_SIZE / 2, screenY + CELL_SIZE / 2, CELL_SIZE / 2
              );
              gradient.addColorStop(0, playerNum === 1 ? 'rgba(255, 80, 80, 0.7)' : 'rgba(80, 80, 255, 0.7)');
              gradient.addColorStop(1, playerNum === 1 ? 'rgba(255, 80, 80, 0.2)' : 'rgba(80, 80, 255, 0.2)');
              ctx.fillStyle = gradient;
              ctx.fillRect(screenX + 3, screenY + 3, CELL_SIZE - 6, CELL_SIZE - 6);
            }
            if (otherFootprints.has(`${x},${y}`)) {
              const gradient = ctx.createRadialGradient(
                screenX + CELL_SIZE / 2, screenY + CELL_SIZE / 2, 0,
                screenX + CELL_SIZE / 2, screenY + CELL_SIZE / 2, CELL_SIZE / 2
              );
              gradient.addColorStop(0, playerNum === 1 ? 'rgba(80, 80, 255, 0.7)' : 'rgba(255, 80, 80, 0.7)');
              gradient.addColorStop(1, playerNum === 1 ? 'rgba(80, 80, 255, 0.2)' : 'rgba(255, 80, 80, 0.2)');
              ctx.fillStyle = gradient;
              ctx.fillRect(screenX + 3, screenY + 3, CELL_SIZE - 6, CELL_SIZE - 6);
            }

            // ゴール
            if (x === goalX && y === goalY) {
              ctx.fillStyle = '#FFD700';
              ctx.fillRect(screenX + 4, screenY + 4, CELL_SIZE - 8, CELL_SIZE - 8);
              ctx.fillStyle = '#FFA500';
              ctx.fillRect(screenX + 6, screenY + 6, CELL_SIZE - 12, CELL_SIZE - 12);
            }
          }
        }
      }

      // 相手プレイヤー
      const otherDx = otherPlayer.x - player.x;
      const otherDy = otherPlayer.y - player.y;
      if (Math.abs(otherDx) <= VISIBILITY && Math.abs(otherDy) <= VISIBILITY) {
        const otherScreenX = offsetX + (otherDx + VISIBILITY) * CELL_SIZE;
        const otherScreenY = (otherDy + VISIBILITY) * CELL_SIZE;
        
        ctx.fillStyle = playerNum === 1 ? '#4169E1' : '#DC143C';
        ctx.beginPath();
        ctx.arc(otherScreenX + CELL_SIZE / 2, otherScreenY + CELL_SIZE / 2 + 2, CELL_SIZE / 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#FFF';
        ctx.fillRect(otherScreenX + CELL_SIZE / 3, otherScreenY + CELL_SIZE / 3, 3, 3);
        ctx.fillRect(otherScreenX + CELL_SIZE * 2 / 3 - 3, otherScreenY + CELL_SIZE / 3, 3, 3);
      }

      // 自分のプレイヤー
      const playerScreenX = offsetX + VISIBILITY * CELL_SIZE;
      const playerScreenY = VISIBILITY * CELL_SIZE;
      
      ctx.fillStyle = playerNum === 1 ? '#DC143C' : '#4169E1';
      ctx.beginPath();
      ctx.arc(playerScreenX + CELL_SIZE / 2, playerScreenY + CELL_SIZE / 2 + 2, CELL_SIZE / 2.5, 0, Math.PI * 2);
      ctx.fill();
      
      // 目の向き
      ctx.fillStyle = '#FFF';
      const eyeSize = 3;
      const eyeOffset = CELL_SIZE / 4;
      
      const centerX = playerScreenX + CELL_SIZE / 2;
      const centerY = playerScreenY + CELL_SIZE / 2;
      
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

    const viewWidth = (VISIBILITY * 2 + 1) * CELL_SIZE;
    drawPlayerView(player1, player2, footprints1, 0, 1, direction1);
    drawPlayerView(player2, player1, footprints2, viewWidth + 30, 2, direction2);

    // パーティクル描画
    particles.forEach(p => {
      const dx = p.x - (p.playerNum === 1 ? player1.x : player2.x);
      const dy = p.y - (p.playerNum === 1 ? player1.y : player2.y);
      
      if (Math.abs(dx) <= VISIBILITY && Math.abs(dy) <= VISIBILITY) {
        const offsetX = p.playerNum === 1 ? 0 : viewWidth + 30;
        const screenX = offsetX + (dx + VISIBILITY) * CELL_SIZE + p.vx * 2;
        const screenY = (dy + VISIBILITY) * CELL_SIZE + p.vy * 2;
        
        ctx.fillStyle = p.playerNum === 1 ? `rgba(255, 100, 100, ${p.life / 30})` : `rgba(100, 100, 255, ${p.life / 30})`;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, [gameState, player1, player2, direction1, direction2, footprints1, footprints2, maze, particles]);

  const canvasWidth = ((VISIBILITY * 2 + 1) * CELL_SIZE) * 2 + 30;
  const canvasHeight = (VISIBILITY * 2 + 1) * CELL_SIZE;

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
              <li>📱 タッチ: 画面左半分/右半分をスワイプ</li>
              <li>⌨️ キーボード: WASD / 矢印キー or IJKL</li>
              <li>🎮 Joy-Con(L): レバー、十字、Lボタン</li>
              <li>🎮 Joy-Con(R): レバー、XYBA、十字、Rボタン</li>
              <li>💣 破壊: P1はShift/E/L / P2はU/Space/R</li>
              <li>👣 足跡が相手に見える!</li>
              <li>👀 視界内なら相手も見える!</li>
            </ul>
          </div>
          <button
            onClick={startGame}
            className="px-8 py-3 rounded-lg text-xl font-bold"
            style={{
              background: '#1E90FF',
              border: '4px solid #FFD700',
              boxShadow: '0 4px 0 #8B4513'
            }}
          >
            ゲーム開始
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="flex flex-col items-center">
          <div className="text-xs mb-2 text-gray-400">v0.4.1</div>
          <div className="flex gap-12 mb-2 text-sm">
            <div style={{color: '#FF6B6B'}}>🔴 破壊: {wallBreaks1}</div>
            <div style={{color: '#6B9BFF'}}>🔵 破壊: {wallBreaks2}</div>
          </div>
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="rounded"
            style={{border: '6px solid #8B4513', boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)'}}
          />
          <div className="mt-4 text-center text-sm space-y-1 w-full">
            <p style={{color: '#FF6B6B'}}>🔴 P1: WASD / 画面左 / Joy-Con(L) | 破壊: Shift/E/L</p>
            <p style={{color: '#6B9BFF'}}>🔵 P2: 矢印/IJKL / 画面右 / Joy-Con(R) | 破壊: U/Space/R</p>
            {gamepadDebug && (
              <div className="mt-3 p-3 bg-gray-900 rounded border border-gray-700 text-xs text-white font-mono">
                <div style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{gamepadDebug}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {gameState === 'finished' && (
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-8" style={{
            color: winner === 1 ? '#FF6B6B' : '#6B9BFF',
            textShadow: '4px 4px 0 #000'
          }}>
            {winner === 1 ? '🔴 Player 1' : '🔵 Player 2'}<br/>の勝利!
          </h1>
          <button
            onClick={startGame}
            className="px-8 py-3 rounded-lg text-xl font-bold"
            style={{
              background: '#32CD32',
              border: '4px solid #FFD700',
              boxShadow: '0 4px 0 #228B22'
            }}
          >
            もう一度プレイ
          </button>
        </div>
      )}
    </div>
  );
};

export default MazeBattleGame;
