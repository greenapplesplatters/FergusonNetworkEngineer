import React, { useState, useEffect, useMemo } from 'react';

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
import { Heart, Bookmark } from 'lucide-react';
import './StudyCard.css';

const formatText = (text) => {
  if (!text) return null;
  return text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="highlight">{part.slice(2, -2)}</strong>
      : part
  );
};

const FORMAT_META = {
  quiz:     { label: 'CONCEPT CHECK', icon: '⚠️', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.35)' },
  scenario: { label: 'EXAM SCENARIO', icon: '🧨', color: '#ef4444', borderColor: 'rgba(239,68,68,0.35)'  },
  rule:     { label: 'MENTAL MODEL',  icon: '⚡', color: '#8b5cf6', borderColor: 'rgba(139,92,246,0.35)' },
};

const HOOK_LINES = {
  quiz:     ['Senior engineers ask this in interviews.', 'Classic routing trap.', 'Most candidates fumble this.', "Don't blow this one."],
  scenario: ['1,700 branches depend on this.', 'Two options look identical. Pick right.', 'Real-world escalation scenario.', 'This crashed production at scale.'],
  rule:     ['Commit this to memory.', "You'll thank yourself in the interview.", 'Print this on your brain.', 'Explain this like a 3rd-level engineer.'],
};

function getHookLine(format, conceptId) {
  const arr = HOOK_LINES[format] || HOOK_LINES.rule;
  return arr[(conceptId || '').charCodeAt(0) % arr.length];
}

// ─── Quiz / Scenario card ────────────────────────────────────────────────────
// Three faces:
//   'question'    — unanswered, tap to answer
//   'revealed'    — correct/wrong shown on options, no explanation yet
//   'explanation' — full explanation on the card back

const QuizCard = ({ data, format, onAnswer, onNext }) => {
  const [selected, setSelected] = useState(null);
  const [face, setFace] = useState('question'); // 'question' | 'revealed' | 'explanation'
  const [expPage, setExpPage] = useState(0);
  const [touchStart, setTouchStart] = useState(null);

  const formatData = data[`${format}_format`] || data.quiz_format;
  const rawOptions = formatData?.options || [];

  // Shuffle options once per card — stable until concept or format changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const options = useMemo(() => shuffleArr(rawOptions), [data.concept_id, format]);

  if (!formatData) return <div className="card-error">No content available.</div>;

  const { question, explanation } = formatData;
  const meta = FORMAT_META[format];

  // Split long explanations into ~400 char pages
  const expPages = useMemo(() => {
    if (!explanation) return [];
    const sentences = explanation.split(/(?<=[.!?])\s+/);
    const pages = [];
    let current = '';
    sentences.forEach(sent => {
      if ((current + sent).length > 400 && current) {
        pages.push(current.trim());
        current = sent;
      } else {
        current += (current ? ' ' : '') + sent;
      }
    });
    if (current) pages.push(current.trim());
    return pages.length > 0 ? pages : [explanation];
  }, [explanation]);

  const handleSelect = (opt, i) => {
    if (face !== 'question') return;
    setSelected(i);
    setFace('revealed');
    onAnswer(opt.correct, format);
  };

  const handleTouchStart = (e) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = (e) => {
    if (!touchStart) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchStart.x;
    const deltaY = endY - touchStart.y;

    // Swipe up (more vertical than horizontal, moving up)
    if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY < -50) {
      if (onNext) onNext();
      return;
    }

    // Only process horizontal swipe on explanation face
    if (face !== 'explanation' || Math.abs(deltaX) < 50) {
      setTouchStart(null);
      return;
    }

    // Swipe left (next page)
    if (deltaX < -50 && expPage < expPages.length - 1) {
      setExpPage(expPage + 1);
    }
    // Swipe right (prev page)
    else if (deltaX > 50 && expPage > 0) {
      setExpPage(expPage - 1);
    }

    setTouchStart(null);
  };

  // ── Explanation face ────────────────────────────────────────────────────────
  if (face === 'explanation') {
    const picked = options[selected];
    const correctIdx = options.findIndex(o => o.correct);
    return (
      <div className="card-content exp-face" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <button className="exp-back-btn" onClick={() => setFace('revealed')}>← Back</button>

        <div className={`exp-verdict ${picked?.correct ? 'verdict-correct' : 'verdict-wrong'}`}>
          <span className="verdict-label">
            {picked?.correct ? '✓ Correct' : '✗ Wrong'}
          </span>
          <span className="verdict-option">
            You picked {String.fromCharCode(65 + selected)}: {picked?.text}
          </span>
          {!picked?.correct && (
            <span className="verdict-right">
              ✓ Correct was {String.fromCharCode(65 + correctIdx)}: {options[correctIdx]?.text}
            </span>
          )}
        </div>

        {explanation && (
          <div className="exp-body">
            <p className="exp-label">WHY:</p>
            <p className="exp-text">{formatText(expPages[expPage])}</p>
          </div>
        )}

        {expPages.length > 1 && (
          <div className="exp-page-indicator">
            {expPages.map((_, i) => (
              <span key={i} className={`exp-dot ${i === expPage ? 'active' : ''}`} />
            ))}
          </div>
        )}

        <p className="exp-scroll-hint">{expPage < expPages.length - 1 ? '→ swipe for more' : '↑ swipe to next'}</p>
      </div>
    );
  }

  // ── Question / Revealed face ────────────────────────────────────────────────
  return (
    <div className="card-content quiz-content">
      <div className="format-badge" style={{ color: meta.color, borderColor: meta.borderColor }}>
        {meta.icon} {meta.label}
      </div>
      <p className="hook-line">{getHookLine(format, data.concept_id)}</p>
      <p className="question-text">{question}</p>

      <div className="options-list">
        {options.map((opt, i) => {
          let cls = 'option-btn';
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
              <span className="opt-letter">{label}</span>
              <span className="opt-text">{opt.text}</span>
            </button>
          );
        })}
      </div>

      {face === 'revealed' && (
        <div className="flip-bar">
          <button className="flip-btn" onClick={() => setFace('explanation')}>
            ↻ Why? →
          </button>
          <span className="skip-hint">↓ scroll to skip</span>
        </div>
      )}
    </div>
  );
};

// ─── Rule card ───────────────────────────────────────────────────────────────

const RuleCard = ({ data, onView }) => {
  useEffect(() => { onView(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ruleData = data.rule_format;
  if (!ruleData) return <div className="card-error">No rule content.</div>;

  const meta = FORMAT_META.rule;
  const score = data.mastery?.score || 0;

  return (
    <div className="card-content rule-content">
      <div className="format-badge" style={{ color: meta.color, borderColor: meta.borderColor }}>
        {meta.icon} {meta.label}
      </div>
      <p className="hook-line">{getHookLine('rule', data.concept_id)}</p>
      {score >= 70 && <div className="mastery-badge">🏆 {score}% Mastered</div>}
      <div className="rule-statement">
        <p>{formatText(ruleData.statement)}</p>
      </div>
      <p className="rule-source">Based on: {data.question_text}</p>
    </div>
  );
};

// ─── Root card wrapper ────────────────────────────────────────────────────────

const StudyCard = ({ data, isActive, onAnswer, onView, onNext }) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  const format = data.format || 'quiz';
  const score = data.mastery?.score ?? 0;
  const scoreColor = score >= 70 ? '#4ade80' : score >= 35 ? '#f59e0b' : '#f87171';

  return (
    <div className={`study-card-wrapper ${isActive ? 'active' : ''}`}>
      <div className="study-card">
        <div className="card-header">
          <span className="topic-badge">{data.topic || 'Networking'}</span>
          <div className="mastery-pill">
            <span className="mastery-dot" style={{ background: scoreColor }} />
            <span className="mastery-pct">{score}%</span>
          </div>
        </div>

        {format === 'rule'
          ? <RuleCard data={data} onView={onView} />
          : <QuizCard data={data} format={format} onAnswer={onAnswer} onNext={onNext} />
        }

        <div className="card-actions">
          <button className={`action-btn ${liked ? 'liked' : ''}`} onClick={() => setLiked(v => !v)}>
            <Heart fill={liked ? '#f43f5e' : 'none'} color={liked ? '#f43f5e' : 'white'} size={20} />
          </button>
          <button className={`action-btn ${saved ? 'saved' : ''}`} onClick={() => setSaved(v => !v)}>
            <Bookmark fill={saved ? '#fbbf24' : 'none'} color={saved ? '#fbbf24' : 'white'} size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudyCard;
