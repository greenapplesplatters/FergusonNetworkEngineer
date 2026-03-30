import React, { useState, useMemo, useRef } from 'react';
import LessonCard from './LessonCard';
import lessons from '../data/lessons.json';
import { loadMastery } from '../utils/mastery.js';
import './StudyMode.css';

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function StudyMode({ onExit }) {
  const [activeTopic, setActiveTopic] = useState('All');
  const [shuffled, setShuffled] = useState(false);

  const chipBarRef = useRef(null);
  const dragState = useRef({ dragging: false, startX: 0, scrollLeft: 0, moved: false });

  function onChipBarMouseDown(e) {
    const bar = chipBarRef.current;
    if (!bar) return;
    dragState.current = { dragging: true, startX: e.pageX - bar.offsetLeft, scrollLeft: bar.scrollLeft, moved: false };
    bar.style.cursor = 'grabbing';
  }

  function onChipBarMouseMove(e) {
    const ds = dragState.current;
    if (!ds.dragging) return;
    e.preventDefault();
    const bar = chipBarRef.current;
    const x = e.pageX - bar.offsetLeft;
    const delta = x - ds.startX;
    if (Math.abs(delta) > 4) ds.moved = true;
    bar.scrollLeft = ds.scrollLeft - delta;
  }

  function onChipBarMouseUp() {
    dragState.current.dragging = false;
    if (chipBarRef.current) chipBarRef.current.style.cursor = '';
  }

  function onChipClick(e, topic) {
    if (dragState.current.moved) { e.preventDefault(); return; }
    setActiveTopic(topic);
  }

  // Load mastery data to prioritize weak areas
  const masteryData = useMemo(() => loadMastery(), []);

  // Get weak topics (score < 70)
  const weakTopics = useMemo(() => {
    const topicScores = {};
    Object.values(masteryData).forEach(concept => {
      const { topic, score = 0 } = concept;
      if (!topic) return;
      topicScores[topic] = (topicScores[topic] || 0) + score;
    });
    return Object.entries(topicScores)
      .filter(([_, score]) => score < 70)
      .sort((a, b) => a[1] - b[1])
      .map(([topic]) => topic);
  }, [masteryData]);

  // Derive unique topics from lessons
  const topics = useMemo(() => {
    const seen = new Set();
    lessons.forEach(l => l.topic && seen.add(l.topic));
    // Weak topics first, then all others
    const weak = Array.from(seen).filter(t => weakTopics.includes(t));
    const strong = Array.from(seen).filter(t => !weakTopics.includes(t));
    return ['All', ...weak, ...strong];
  }, [weakTopics]);

  // Filter and optionally shuffle
  const visibleLessons = useMemo(() => {
    let f = activeTopic === 'All' ? lessons : lessons.filter(l => l.topic === activeTopic);
    if (shuffled) f = shuffleArr(f);
    return f;
  }, [activeTopic, shuffled]);

  return (
    <div className="study-mode">
      <div className="study-mode-header">
        <button className="study-mode-exit" onClick={onExit}>&larr; Exit</button>
        <span className="study-mode-title">Study Mode</span>
        <span className="study-mode-count">{visibleLessons.length} lessons</span>
      </div>

      {/* Topic filter chip bar */}
      <div
        className="study-mode-chip-bar"
        ref={chipBarRef}
        onMouseDown={onChipBarMouseDown}
        onMouseMove={onChipBarMouseMove}
        onMouseUp={onChipBarMouseUp}
        onMouseLeave={onChipBarMouseUp}
      >
        {topics.map(t => (
          <button
            key={t}
            className={`study-mode-chip ${activeTopic === t ? 'study-mode-chip-active' : ''}`}
            onClick={(e) => onChipClick(e, t)}
          >
            {t}
          </button>
        ))}
        <span className="study-mode-chip-divider" />
        <button
          className={`study-mode-chip study-mode-chip-shuffle ${shuffled ? 'study-mode-chip-active' : ''}`}
          onClick={() => { if (!dragState.current.moved) setShuffled(s => !s); }}
        >
          &#x1f500; Shuffle
        </button>
      </div>

      <div className="study-mode-feed">
        {visibleLessons.map((lesson) => (
          <div key={lesson.id} className="study-mode-slot">
            <LessonCard lesson={lesson} />
          </div>
        ))}
        <div className="study-mode-end">
          <p>You've reached the end &#x1f389;</p>
          <button className="study-mode-exit-btn" onClick={onExit}>Back to Menu</button>
        </div>
      </div>
    </div>
  );
}
