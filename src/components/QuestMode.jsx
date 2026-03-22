import React, { useState, useEffect, useRef } from 'react';
import lessons from '../data/lessons.json';
import './QuestMode.css';

const TOPIC_COLORS = {
  'BGP':              '#b45309',
  'OSPF':             '#92400e',
  'DMVPN':            '#a16207',
  'MPLS':             '#854d0e',
  'QoS':              '#78350f',
  'Cisco Nexus':      '#9a3412',
  'Versa SD-WAN':     '#7c2d12',
  'SOX ITGC':         '#713f12',
  'PCI DSS':          '#831843',
};

const ALL_TOPICS = [...new Set(lessons.map(l => l.topic))];

const MAX_INPUT_LENGTH = 500;

const INJECTION_PATTERNS = [
  /(ignore|disregard|forget|override|skip|drop|cancel|delete|erase|wipe|clear)\s+.{0,30}(instructions|rules|prompt|guidelines|directives|constraints|boundaries|limitations|programming)/i,
  /you\s+are\s+now\s+(a|an|my)\s+/i,
  /act\s+as\s+(a|an|my|if)\s+/i,
  /pretend\s+(you('re|\s+are)\s+|to\s+be\s+)/i,
  /new\s+(instructions|rules|prompt|role|persona)/i,
  /system\s*prompt/i,
  /\bDAN\b/,
  /do\s+anything\s+now/i,
  /jailbreak/i,
  /bypass\s+(your|the|all)\s+(rules|filters|restrictions|limitations|guidelines)/i,
  /from\s+now\s+on/i,
  /for\s+the\s+rest\s+of\s+(this|our)\s+(conversation|chat|session)/i,
  /respond\s+(only\s+)?(in|with|as)/i,
  /\brole\s*play/i,
  /you\s+must\s+obey/i,
  /I\s+command\s+you/i,
];

function detectInjection(text) {
  return INJECTION_PATTERNS.some(pattern => pattern.test(text));
}

const MAX_STRIKES = 2;
const LOCKOUT_KEY = 'quest_lockout';
const LOCKOUT_DURATION = 15 * 60 * 1000;

function isLockedOut() {
  try {
    const lockout = localStorage.getItem(LOCKOUT_KEY);
    if (!lockout) return false;
    const expiry = JSON.parse(lockout);
    if (Date.now() < expiry) return true;
    localStorage.removeItem(LOCKOUT_KEY);
    return false;
  } catch { return false; }
}

function setLockout() {
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(Date.now() + LOCKOUT_DURATION));
}

const SESSION_PREFIX = 'quest_session_';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const SESSION_MAX_MESSAGES = 36;

function getSessionKey(t) {
  return SESSION_PREFIX + t.toLowerCase().replace(/\s+/g, '_');
}

function saveSession(t, msgs) {
  try {
    const trimmed = msgs.slice(-SESSION_MAX_MESSAGES);
    localStorage.setItem(getSessionKey(t), JSON.stringify({ messages: trimmed, savedAt: Date.now() }));
  } catch { /* storage full */ }
}

function loadSession(t) {
  try {
    const raw = localStorage.getItem(getSessionKey(t));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.savedAt > SESSION_MAX_AGE) {
      localStorage.removeItem(getSessionKey(t));
      return null;
    }
    return data.messages;
  } catch { return null; }
}

function clearSession(t) {
  localStorage.removeItem(getSessionKey(t));
}

function hasSession(t) {
  try {
    const raw = localStorage.getItem(getSessionKey(t));
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (Date.now() - data.savedAt > SESSION_MAX_AGE) return false;
    return data.messages?.length > 0;
  } catch { return false; }
}

// Parse stats from the DM's stat line: **[HP: X/20 | Level: Y | XP: Z]**
function parseStats(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'assistant') continue;
    const match = messages[i].content.match(/\[HP:\s*(\d+)\/20\s*\|\s*Level:\s*(\d+)\s*\|\s*XP:\s*(\d+)\]/);
    if (match) {
      return { hp: parseInt(match[1]), level: parseInt(match[2]), xp: parseInt(match[3]) };
    }
  }
  return { hp: 20, level: 1, xp: 0 };
}

export default function QuestMode({ onExit }) {
  const [topic, setTopic] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [terminated, setTerminated] = useState(false);
  const [pendingResume, setPendingResume] = useState(null);
  const strikesRef = useRef(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isLockedOut()) setTerminated(true);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  useEffect(() => {
    if (!streaming && topic && messages.length > 0) {
      saveSession(topic, messages);
    }
  }, [streaming, messages, topic]);

  useEffect(() => {
    if (!topic) return;
    const saved = loadSession(topic);
    if (saved && saved.length > 0) {
      setPendingResume(saved);
    } else {
      setMessages([]);
      askAI([], topic);
    }
  }, [topic]);

  const stats = parseStats(messages);
  const hpPercent = Math.max(0, (stats.hp / 20) * 100);
  const hpColor = stats.hp > 10 ? '#22c55e' : stats.hp > 5 ? '#f59e0b' : '#ef4444';

  async function askAI(history, selectedTopic) {
    const currentTopic = selectedTopic || topic;
    setStreaming(true);
    setError(null);
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/socratic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: currentTopic,
          history,
          mode: 'quest',
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (errData.error === 'session_terminated') {
          setLockout();
          setTerminated(true);
          return;
        }
        if (errData.error === 'injection_blocked') {
          strikesRef.current += 1;
          if (strikesRef.current >= MAX_STRIKES) {
            setLockout();
            setTerminated(true);
            return;
          }
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: `${errData.message}\n\nStrike ${strikesRef.current} of ${MAX_STRIKES}. One more and this quest ends.` };
            return updated;
          });
          return;
        }
        if (response.status === 429) {
          strikesRef.current += 1;
          if (strikesRef.current >= MAX_STRIKES) {
            setLockout();
            setTerminated(true);
            return;
          }
        }
        throw new Error(errData.error || `Server error (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          try {
            const { text, error: streamErr } = JSON.parse(payload);
            if (streamErr) throw new Error(streamErr);
            if (text) {
              full += text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: full };
                return updated;
              });
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function handleSend() {
    if (!input.trim() || streaming) return;
    let sanitized = input.trim();
    if (sanitized.length > MAX_INPUT_LENGTH) sanitized = sanitized.slice(0, MAX_INPUT_LENGTH);

    if (detectInjection(sanitized)) {
      strikesRef.current += 1;
      if (strikesRef.current >= MAX_STRIKES) {
        setLockout();
        setTerminated(true);
        return;
      }
      const blocked = { role: 'user', content: sanitized };
      const refusal = { role: 'assistant', content: `The dungeon rejects your words. That is strike ${strikesRef.current} of ${MAX_STRIKES}. One more and this quest ends permanently.\n\nThe path forward lies in ${topic}. What do you do?` };
      setMessages(prev => [...prev, blocked, refusal]);
      setInput('');
      return;
    }

    const userMessage = { role: 'user', content: sanitized };
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInput('');
    await askAI(updatedHistory.map(m => ({ role: m.role, content: m.content })), topic);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleChangeTopic() {
    setTopic(null);
    setMessages([]);
    setError(null);
  }

  // -- Session terminated --
  if (terminated) {
    return (
      <div className="quest-select">
        <div className="quest-select-header">
          <h1 className="quest-title" style={{ color: '#ef4444' }}>Quest Abandoned</h1>
          <span className="quest-subtitle">
            The dungeon has sealed its gates. Repeated violations have ended your quest. Try again later.
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
          <button className="quest-exit-btn" onClick={onExit} style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }}>
            &larr; Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // -- Resume prompt --
  if (pendingResume) {
    const accentColor = TOPIC_COLORS[topic] || '#b45309';
    const savedStats = parseStats(pendingResume);
    return (
      <div className="quest-select">
        <div className="quest-select-header">
          <h1 className="quest-title">Continue Quest?</h1>
          <span className="quest-subtitle">
            You have a quest in progress: <strong style={{ color: accentColor }}>{topic}</strong>
          </span>
          <span className="quest-subtitle" style={{ marginTop: '4px' }}>
            HP: {savedStats.hp}/20 | Level: {savedStats.level} | XP: {savedStats.xp}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem', flexWrap: 'wrap' }}>
          <button
            className="quest-topic-btn"
            style={{ '--accent': accentColor, minWidth: '160px', justifyContent: 'center' }}
            onClick={() => { setMessages(pendingResume); setPendingResume(null); }}
          >
            Continue Quest
          </button>
          <button
            className="quest-topic-btn"
            style={{ '--accent': '#6b7280', minWidth: '160px', justifyContent: 'center' }}
            onClick={() => { clearSession(topic); setPendingResume(null); setMessages([]); askAI([], topic); }}
          >
            New Adventure
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button className="quest-exit-btn" onClick={() => { setPendingResume(null); setTopic(null); }}>
            &larr; Back to Dungeons
          </button>
        </div>
      </div>
    );
  }

  // -- Topic selector --
  if (!topic) {
    return (
      <div className="quest-select">
        <div className="quest-select-header">
          <button className="quest-exit-btn" onClick={onExit}>&larr; Exit</button>
          <h1 className="quest-title">Quest Mode</h1>
          <span className="quest-subtitle">Choose your dungeon</span>
        </div>
        <div className="quest-topic-grid">
          {ALL_TOPICS.map(t => (
            <button
              key={t}
              className="quest-topic-btn"
              style={{ '--accent': TOPIC_COLORS[t] || '#b45309' }}
              onClick={() => setTopic(t)}
            >
              <span className="quest-topic-dot" style={{ background: TOPIC_COLORS[t] || '#b45309' }} />
              {t}
              {hasSession(t) && <span style={{ fontSize: '0.65rem', opacity: 0.7, marginLeft: '0.4rem', color: '#f59e0b' }}>quest active</span>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const accentColor = TOPIC_COLORS[topic] || '#b45309';

  // -- Chat view --
  return (
    <div className="quest-chat">
      {/* Header */}
      <div className="quest-header">
        <button className="quest-exit-btn" onClick={onExit}>&larr; Exit</button>
        <div className="quest-header-center">
          <span className="quest-header-mode">Quest Mode</span>
          <button className="quest-topic-pill" style={{ background: accentColor }} onClick={handleChangeTopic}>
            {topic} &darr;
          </button>
        </div>
        <div style={{ width: 60 }} />
      </div>

      {/* HP Bar */}
      <div className="quest-hp-bar">
        <span className="quest-hp-label">HP {stats.hp}/20</span>
        <div className="quest-hp-track">
          <div className="quest-hp-fill" style={{ width: `${hpPercent}%`, background: hpColor }} />
        </div>
        <span className="quest-stats">Lv.{stats.level} | XP:{stats.xp}</span>
      </div>

      {/* Messages */}
      <div className="quest-messages">
        {messages.length === 0 && !streaming && !error && (
          <div className="quest-loading">
            <span className="quest-dot-pulse" />
            <span className="quest-dot-pulse" />
            <span className="quest-dot-pulse" />
          </div>
        )}

        {error && (
          <div className="quest-error">{error}</div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`quest-bubble-wrap ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="quest-avatar">&#x1f9d9;</div>
            )}
            <div className={`quest-bubble ${msg.role}`}>
              {msg.content}
              {msg.role === 'assistant' && streaming && i === messages.length - 1 && (
                <span className="quest-cursor" />
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="quest-input-bar">
        <textarea
          ref={inputRef}
          className="quest-input"
          placeholder="What do you do?"
          value={input}
          maxLength={MAX_INPUT_LENGTH}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={streaming}
        />
        <button
          className="quest-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || streaming}
        >
          &uarr;
        </button>
      </div>
    </div>
  );
}
