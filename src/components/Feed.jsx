import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import StudyCard from './StudyCard.jsx';
import ProgressHUD from './ProgressHUD.jsx';
import { buildAdaptiveFeed, getWeakTopics } from '../utils/adaptiveFeed.js';
import { recordAnswer, recordView } from '../utils/mastery.js';
import rawConcepts from '../data/feed.json';
import './Feed.css';

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const Feed = ({ cards = rawConcepts, onExit }) => {
  const [feed, setFeed] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTopic, setActiveTopic] = useState('All');
  const [shuffled, setShuffled] = useState(false);
  const feedRef = useRef(null);

  // Session stats
  const [sessionCorrect, setSessionCorrect]   = useState(0);
  const [sessionAnswered, setSessionAnswered] = useState(0);
  const [sessionStreak, setSessionStreak]     = useState(0);

  useEffect(() => {
    setFeed(buildAdaptiveFeed(cards));
  }, [cards]);

  // Unique topics in adaptive feed order
  const topics = useMemo(() => {
    const seen = new Set();
    const list = [];
    feed.forEach(c => { if (c.topic && !seen.has(c.topic)) { seen.add(c.topic); list.push(c.topic); } });
    return list;
  }, [feed]);

  // Filtered + optionally shuffled view
  const visibleFeed = useMemo(() => {
    const filtered = activeTopic === 'All' ? feed : feed.filter(c => c.topic === activeTopic);
    return shuffled ? shuffleArr(filtered) : filtered;
  }, [feed, activeTopic, shuffled]);

  // Scroll back to top when topic or shuffle changes
  useEffect(() => {
    setCurrentIndex(0);
    if (feedRef.current) feedRef.current.scrollTop = 0;
  }, [activeTopic, shuffled]);

  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    const idx = Math.round(feedRef.current.scrollTop / window.innerHeight);
    if (idx !== currentIndex && idx >= 0 && idx <= visibleFeed.length) {
      setCurrentIndex(idx);
    }
  }, [currentIndex, visibleFeed.length]);

  const handleAnswer = useCallback((conceptId, isCorrect, format) => {
    recordAnswer(conceptId, isCorrect, format);
    setSessionAnswered(n => n + 1);
    if (isCorrect) { setSessionCorrect(n => n + 1); setSessionStreak(n => n + 1); }
    else { setSessionStreak(0); }
    setFeed(prev => prev.map(c =>
      c.concept_id === conceptId
        ? { ...c, mastery: { ...c.mastery, score: Math.max(0, Math.min(100, (c.mastery?.score || 0) + (isCorrect ? 10 : -5))) } }
        : c
    ));
  }, []);

  const handleView = useCallback((conceptId) => { recordView(conceptId); }, []);

  if (feed.length === 0) return <div className="loading">Loading study materials...</div>;

  const weakTopics = getWeakTopics(rawConcepts);

  return (
    <>
      {onExit && <button className="feed-back-btn" onClick={onExit}>← Modes</button>}

      <ProgressHUD correct={sessionCorrect} answered={sessionAnswered} streak={sessionStreak} />

      {/* Topic filter + shuffle */}
      <div className="topic-filter-bar">
        <button
          className={`topic-chip shuffle-chip ${shuffled ? 'active' : ''}`}
          onClick={() => setShuffled(v => !v)}
        >
          🔀 {shuffled ? 'Shuffled' : 'Shuffle'}
        </button>
        <div className="chip-divider" />
        {['All', ...topics].map(t => (
          <button
            key={t}
            className={`topic-chip ${activeTopic === t ? 'active' : ''}`}
            onClick={() => setActiveTopic(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="feed-container" ref={feedRef} onScroll={handleScroll}>
        {visibleFeed.map((card, index) => (
          <StudyCard
            key={card.concept_id}
            data={card}
            isActive={index === currentIndex}
            onAnswer={(isCorrect, fmt) => handleAnswer(card.concept_id, isCorrect, fmt)}
            onView={() => handleView(card.concept_id)}
            onNext={() => {
              if (index < visibleFeed.length - 1) {
                setCurrentIndex(index + 1);
                feedRef.current?.children[index + 1]?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          />
        ))}

        <div className="end-of-feed">
          <h2>Session Complete</h2>
          <p className="end-sub">
            {sessionAnswered > 0
              ? `${sessionCorrect}/${sessionAnswered} correct · ${Math.round((sessionCorrect / sessionAnswered) * 100)}% accuracy`
              : 'No questions answered yet.'}
          </p>
          {weakTopics.length > 0 && (
            <div className="weak-topics">
              <p className="weak-title">Focus areas:</p>
              {weakTopics.slice(0, 3).map(({ topic, avg }) => (
                <div key={topic} className="weak-row">
                  <span>{topic}</span>
                  <span className="weak-score" style={{ color: avg >= 70 ? '#10b981' : avg >= 35 ? '#f59e0b' : '#ef4444' }}>
                    {avg}%
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="end-cta">Scroll up to keep drilling.</p>
        </div>
      </div>
    </>
  );
};

export default Feed;
