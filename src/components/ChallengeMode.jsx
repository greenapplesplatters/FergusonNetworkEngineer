import React, { useState, useMemo } from 'react';
import { getChallengeScores, saveChallengeScore } from '../utils/challengeScore.js';
import { loadMastery } from '../utils/mastery.js';
import { resolveVariant } from '../utils/adaptiveFeed.js';
import './ChallengeMode.css';

const MAX_HEARTS = 4;
const BASE_POINTS = 10;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Score for a correct answer: base + 2 per current streak (capped at +20)
function calcPoints(streak) {
  return BASE_POINTS + Math.min(streak * 2, 20);
}

const formatText = (text) => {
  if (!text) return null;
  return text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="ch-highlight">{part.slice(2, -2)}</strong>
      : part
  );
};

// ─── Game Over Screen ────────────────────────────────────────────────────────

const GameOver = ({ score, result, onRestart, onExit }) => {
  const icon = result.isNew ? '🏆' : score === 0 ? '💀' : '💪';
  const title = result.isNew ? 'NEW HIGH SCORE!' : 'Game Over';

  return (
    <div className="gameover-container">
      <div className={`gameover-card ${result.isNew ? 'is-new-high' : ''}`}>

        <div className="gameover-icon">{icon}</div>
        <h1 className={`gameover-title ${result.isNew ? 'gold' : ''}`}>{title}</h1>

        {result.isNew && (
          <p className="gameover-sub">You crushed your previous best! 🎉</p>
        )}

        <div className="score-breakdown">
          <div className="score-row highlight-row">
            <span>Final Score</span>
            <span className={result.isNew ? 'score-gold' : 'score-white'}>{score}</span>
          </div>
          <div className="score-row">
            <span>Previous Game</span>
            <span>{result.last !== score ? result.last ?? '—' : '—'}</span>
          </div>
          <div className="score-row">
            <span>All-Time Best</span>
            <span className="score-gold">🏆 {result.high}</span>
          </div>
        </div>

        <div className="gameover-actions">
          <button className="btn-restart" onClick={onRestart}>Play Again</button>
          <button className="btn-exit" onClick={onExit}>Test Mode</button>
        </div>

      </div>
    </div>
  );
};

// ─── Challenge Mode ──────────────────────────────────────────────────────────

const ChallengeMode = ({ onExit, cards }) => {
  const questions = useMemo(() => {
    const masteryData = loadMastery();
    return shuffle(cards.map(c => {
      const resolved = resolveVariant(c, masteryData[c.concept_id] || {});
      const shuffleOpts = (fmt) => fmt ? { ...fmt, options: shuffle(fmt.options || []) } : fmt;
      return {
        ...resolved,
        quiz_format:     shuffleOpts(resolved.quiz_format),
        scenario_format: shuffleOpts(resolved.scenario_format),
      };
    }));
  }, [cards]);

  const [qIndex, setQIndex]       = useState(0);
  const [hearts, setHearts]       = useState(MAX_HEARTS);
  const [score, setScore]         = useState(0);
  const [streak, setStreak]       = useState(0);
  const [selected, setSelected]   = useState(null);
  // 'question' | 'revealed' | 'explanation'
  const [face, setFace]           = useState('question');
  const [shaking, setShaking]     = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [earnedPts, setEarnedPts] = useState(0);

  const current = questions[qIndex];
  const { question, options = [], explanation } = current?.quiz_format || {};
  const total = questions.length;
  const isLastQuestion = qIndex + 1 >= total;
  const outOfHearts = hearts <= 0;

  const handleSelect = (opt, i) => {
    if (face !== 'question') return;
    setSelected(i);
    setFace('revealed');

    if (opt.correct) {
      const pts = calcPoints(streak);
      setEarnedPts(pts);
      setScore(s => s + pts);
      setStreak(s => s + 1);
    } else {
      setEarnedPts(0);
      const newHearts = hearts - 1;
      setHearts(newHearts);
      setStreak(0);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
  };

  const handleNext = (currentScore) => {
    if (outOfHearts || isLastQuestion) {
      const result = saveChallengeScore(currentScore);
      setGameResult(result);
      return;
    }
    setTransitioning(true);
    setTimeout(() => {
      setQIndex(i => i + 1);
      setSelected(null);
      setFace('question');
      setTransitioning(false);
    }, 180);
  };

  if (gameResult) {
    return (
      <GameOver
        score={score}
        result={gameResult}
        onRestart={() => window.location.reload()}
        onExit={onExit}
      />
    );
  }

  const nextLabel = outOfHearts ? '💀 See Results' : isLastQuestion ? '🏆 Finish' : 'Next →';
  const picked = options[selected];
  const correctIdx = options.findIndex(o => o.correct);

  return (
    <div className="challenge-container">

      {/* HUD */}
      <div className="challenge-hud">
        <div className={`hearts-row ${shaking ? 'shake' : ''}`}>
          {Array.from({ length: MAX_HEARTS }).map((_, i) => (
            <span key={i} className={`heart-icon ${i < hearts ? 'alive' : 'lost'}`}>
              {i < hearts ? '❤️' : '🖤'}
            </span>
          ))}
        </div>
        <div className="hud-score">
          <span className="hud-score-label">SCORE</span>
          <span className="hud-score-value">{score}</span>
        </div>
        <div className="hud-progress">
          {qIndex + 1}<span>/{total}</span>
        </div>
      </div>

      {/* ── Explanation face ── */}
      {face === 'explanation' && (
        <div className={`challenge-card ch-exp-card ${transitioning ? 'slide-out' : 'slide-in'}`}>
          <button className="ch-exp-back" onClick={() => setFace('revealed')}>← Back</button>

          <div className={`ch-verdict ${picked?.correct ? 'verdict-correct' : 'verdict-wrong'}`}>
            <span className="ch-verdict-label">
              {picked?.correct ? '✓ Correct' : '✗ Wrong'}
            </span>
            <span className="ch-verdict-option">
              You picked {String.fromCharCode(65 + selected)}: {picked?.text}
            </span>
            {!picked?.correct && (
              <span className="ch-verdict-right">
                ✓ Correct was {String.fromCharCode(65 + correctIdx)}: {options[correctIdx]?.text}
              </span>
            )}
          </div>

          {explanation && (
            <div className="ch-exp-body">
              <p className="ch-exp-label">WHY:</p>
              <p className="ch-exp-text">{formatText(explanation)}</p>
            </div>
          )}

          <button className="ch-next-btn" onClick={() => handleNext(score)}>{nextLabel}</button>
        </div>
      )}

      {/* ── Question / Revealed face ── */}
      {face !== 'explanation' && (
        <div className={`challenge-card ${transitioning ? 'slide-out' : 'slide-in'}`}>
          <div className="ch-topic-badge">{current?.topic}</div>

          {streak >= 3 && face === 'question' && (
            <div className="streak-banner">
              🔥 {streak} streak · next correct = +{calcPoints(streak)} pts
            </div>
          )}

          <p className="ch-question">{question}</p>

          <div className="ch-options">
            {options.map((opt, i) => {
              let cls = 'ch-option';
              if (face === 'revealed') {
                if (opt.correct) cls += ' correct';
                else if (selected === i) cls += ' wrong';
                else cls += ' dimmed';
              }
              const label = face === 'revealed'
                ? opt.correct ? '✓' : selected === i ? '✗' : String.fromCharCode(65 + i)
                : String.fromCharCode(65 + i);
              return (
                <button key={i} className={cls} onClick={() => handleSelect(opt, i)}>
                  <span className="ch-letter">{label}</span>
                  <span className="ch-opt-text">{opt.text}</span>
                </button>
              );
            })}
          </div>

          {face === 'revealed' && (
            <div className={`ch-flip-bar ${picked?.correct ? 'bar-correct' : 'bar-wrong'}`}>
              <div className="ch-result-summary">
                {picked?.correct
                  ? <span className="ch-correct-msg">✓ Correct! <span className="pts-earned">+{earnedPts} pts</span></span>
                  : <span className="ch-wrong-msg">✗ Wrong. {outOfHearts ? 'Out of hearts!' : `${hearts} heart${hearts !== 1 ? 's' : ''} left.`}</span>
                }
              </div>
              <div className="ch-flip-actions">
                <button className="ch-why-btn" onClick={() => setFace('explanation')}>↻ Why?</button>
                <button className="ch-skip-btn" onClick={() => handleNext(score)}>{nextLabel}</button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default ChallengeMode;
