import React from 'react';
import './ProgressHUD.css';

const ProgressHUD = ({ correct, answered, streak }) => {
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : null;

  return (
    <div className="progress-hud">
      {streak >= 3 && (
        <span className="hud-streak">🔥 {streak}</span>
      )}
      {accuracy !== null && (
        <span className="hud-accuracy">{accuracy}%</span>
      )}
      {answered > 0 && (
        <span className="hud-count">{correct}/{answered}</span>
      )}
    </div>
  );
};

export default ProgressHUD;
