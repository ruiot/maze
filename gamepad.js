import React, { useState, useEffect, useRef } from 'react';

const GamepadViewer = () => {
  const [gamepads, setGamepads] = useState({});

  useEffect(() => {
    const updateGamepads = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const data = {};
      for (let i = 0; i < pads.length; i++) {
        const pad = pads[i];
        if (pad) {
          data[pad.index] = {
            id: pad.id,
            buttons: pad.buttons.map((b) => b.value),
            axes: pad.axes.map((a) => a.toFixed(2)),
          };
        }
      }
      setGamepads(data);
    };

    window.addEventListener("gamepadconnected", updateGamepads);
    window.addEventListener("gamepaddisconnected", updateGamepads);

    const interval = setInterval(updateGamepads, 100);
    return () => {
      clearInterval(interval);
      window.removeEventListener("gamepadconnected", updateGamepads);
      window.removeEventListener("gamepaddisconnected", updateGamepads);
    };
  }, []);

  return (
    <div style={{ fontFamily: "monospace", padding: 20 }}>
      <h2>🎮 Gamepad 状態ビューア</h2>
      {Object.keys(gamepads).length === 0 && <p>コントローラを接続してください</p>}
      {Object.entries(gamepads).map(([index, pad]) => (
        <div key={index} style={{ marginBottom: 20 }}>
          <h3>{pad.id}</h3>
          <div>
            <strong>Buttons:</strong>{" "}
            {pad.buttons.map((v, i) => (
              <span key={i} style={{ marginRight: 4, color: v > 0 ? "limegreen" : "gray" }}>
                [{i}:{v.toFixed(1)}]
              </span>
            ))}
          </div>
          <div>
            <strong>Axes:</strong>{" "}
            {pad.axes.map((a, i) => (
              <span key={i} style={{ marginRight: 4 }}>
                {i}:{a}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default GamepadViewer;