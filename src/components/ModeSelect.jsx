import React from 'react';
import { getChallengeScores } from '../utils/challengeScore.js';
import './ModeSelect.css';

const ModeSelect = ({ onSelect }) => {
  const { high, last } = getChallengeScores();

  return (
    <div className="mode-select">
      <div className="mode-logo">
        <span className="mode-logo-icon">&#x1f310;</span>
        <h1>Ferguson Prep</h1>
        <p>Network Engineering</p>
      </div>

      <div className="mode-cards">

        <button className="mode-card learn-card-btn" onClick={() => onSelect('learn')}>
          <span className="mode-icon">&#x1f9e0;</span>
          <h2>Study Mode</h2>
          <p>Real-world network incidents and narrative lessons. BGP, OSPF, DMVPN, MPLS, and more.</p>
          <span className="mode-cta">Start Learning &#x2192;</span>
        </button>

        <button className="mode-card study-card-btn" onClick={() => onSelect('study')}>
          <span className="mode-icon">&#x1f4da;</span>
          <h2>Test Mode</h2>
          <p>Adaptive cards ranked by your weakest topics. Tracks mastery over time.</p>
          <span className="mode-cta">Start Studying &#x2192;</span>
        </button>

        <button className="mode-card challenge-card-btn" onClick={() => onSelect('challenge')}>
          <span className="mode-icon">&#x1f480;</span>
          <h2>Challenge Mode</h2>
          <p>4 hearts. Every wrong answer costs you one. How far can you go?</p>
          <div className="challenge-stats">
            {high > 0 && (
              <span className="stat-pill high">&#x1f3c6; Best: {high}</span>
            )}
            {last !== null && (
              <span className="stat-pill last">Last: {last}</span>
            )}
          </div>
          <span className="mode-cta">Accept Challenge &#x2192;</span>
        </button>

        <button className="mode-card socratic-card-btn" onClick={() => onSelect('socratic')}>
          <span className="mode-icon">&#x1f3db;</span>
          <h2>Socratic Mode</h2>
          <p>Conversational learning. An AI tutor asks you questions and guides you to discover answers yourself.</p>
          <span className="mode-cta">Start Dialogue &#x2192;</span>
        </button>

      </div>
    </div>
  );
};

export default ModeSelect;
