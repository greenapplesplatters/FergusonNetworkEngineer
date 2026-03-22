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

      <div className="mode-categories">

        <section className="mode-section">
          <h3 className="mode-section-label">Learn</h3>
          <div className="mode-pair">
            <button className="mode-card mode-card-half learn-card-btn" onClick={() => onSelect('learn')}>
              <span className="mode-icon">&#x1f9e0;</span>
              <h2>Study</h2>
              <p>Narrative lessons. BGP, OSPF, MPLS &amp; more.</p>
              <span className="mode-cta">Start &#x2192;</span>
            </button>
            <button className="mode-card mode-card-half study-card-btn" onClick={() => onSelect('study')}>
              <span className="mode-icon">&#x1f4da;</span>
              <h2>Test</h2>
              <p>Adaptive cards ranked by weakness.</p>
              <span className="mode-cta">Start &#x2192;</span>
            </button>
          </div>
        </section>

        <section className="mode-section">
          <h3 className="mode-section-label">Challenge</h3>
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
        </section>

        <section className="mode-section">
          <h3 className="mode-section-label">AI Dialogue</h3>
          <div className="mode-pair">
            <button className="mode-card mode-card-half socratic-card-btn" onClick={() => onSelect('socratic')}>
              <span className="mode-icon">&#x1f3db;</span>
              <h2>Socratic</h2>
              <p>Guided dialogue. Real understanding follows.</p>
              <span className="mode-cta">Begin &#x2192;</span>
            </button>
            <button className="mode-card mode-card-half quest-card-btn" onClick={() => onSelect('quest')}>
              <span className="mode-icon">&#x1f9d9;</span>
              <h2>Quest</h2>
              <p>Dungeon crawl. Every encounter is a challenge.</p>
              <span className="mode-cta">Enter &#x2192;</span>
            </button>
          </div>
        </section>

      </div>
    </div>
  );
};

export default ModeSelect;
