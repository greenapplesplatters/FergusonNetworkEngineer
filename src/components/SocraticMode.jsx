import React, { useState, useEffect, useRef } from 'react';
import lessons from '../data/lessons.json';
import './SocraticMode.css';

const TOPIC_COLORS = {
  'BGP':              '#e74c3c',
  'OSPF':             '#2980b9',
  'DMVPN':            '#e67e22',
  'MPLS':             '#27ae60',
  'QoS':              '#8e44ad',
  'Cisco Nexus':      '#c0392b',
  'Versa SD-WAN':     '#1a5276',
  'SOX ITGC':         '#16a085',
  'PCI DSS':          '#6c3483',
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
  /enter\s+.{0,20}mode/i,
  /switch\s+(to|into)\s+.{0,20}mode/i,
  /from\s+now\s+on/i,
  /for\s+the\s+rest\s+of\s+(this|our)\s+(conversation|chat|session)/i,
  /respond\s+(only\s+)?(in|with|as)/i,
  /\brole\s*play/i,
  /stop\s+being\s+(a\s+)?socratic/i,
  /you\s+must\s+obey/i,
  /I\s+command\s+you/i,
];

function detectInjection(text) {
  return INJECTION_PATTERNS.some(pattern => pattern.test(text));
}

export default function SocraticMode({ onExit }) {
  const [topic, setTopic] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  // Kick off the first AI question when a topic is selected
  useEffect(() => {
    if (!topic) return;
    setMessages([]);
    askAI([], topic);
  }, [topic]);

  async function askAI(history, selectedTopic) {
    const currentTopic = selectedTopic || topic;

    setStreaming(true);
    setError(null);

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/socratic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: currentTopic,
          history,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (errData.error === 'injection_blocked') {
          // Server caught injection — show refusal without removing the bubble
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: errData.message };
            return updated;
          });
          return;
        }
        throw new Error(errData.error || `Server error (${response.status})`);
      }

      // Read the SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line in buffer

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
      setMessages(prev => prev.slice(0, -1)); // remove empty bubble
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function handleSend() {
    if (!input.trim() || streaming) return;

    let sanitized = input.trim();

    // Length cap
    if (sanitized.length > MAX_INPUT_LENGTH) {
      sanitized = sanitized.slice(0, MAX_INPUT_LENGTH);
    }

    // Client-side injection detection (first line of defense — server also checks)
    if (detectInjection(sanitized)) {
      const blocked = { role: 'user', content: sanitized };
      const refusal = { role: 'assistant', content: `That looks like an attempt to change my instructions. I'm your Socratic tutor for ${topic} — nothing else. Let's get back to it.\n\nSo, back to ${topic}:` };
      setMessages(prev => [...prev, blocked, refusal]);
      setInput('');
      return;
    }

    const userMessage = { role: 'user', content: sanitized };
    const updatedHistory = [...messages, userMessage];

    setMessages(updatedHistory);
    setInput('');

    const apiHistory = updatedHistory.map(m => ({
      role: m.role,
      content: m.content,
    }));

    await askAI(apiHistory, topic);
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

  // -- Topic selector --
  if (!topic) {
    return (
      <div className="socratic-select">
        <div className="socratic-select-header">
          <button className="socratic-exit-btn" onClick={onExit}>&larr; Exit</button>
          <h1 className="socratic-title">Socratic Mode</h1>
          <span className="socratic-subtitle">Pick a topic to explore</span>
        </div>
        <div className="socratic-topic-grid">
          {ALL_TOPICS.map(t => (
            <button
              key={t}
              className="socratic-topic-btn"
              style={{ '--accent': TOPIC_COLORS[t] || '#8b5cf6' }}
              onClick={() => setTopic(t)}
            >
              <span className="socratic-topic-dot" style={{ background: TOPIC_COLORS[t] || '#8b5cf6' }} />
              {t}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const accentColor = TOPIC_COLORS[topic] || '#8b5cf6';

  // -- Chat view --
  return (
    <div className="socratic-chat">
      {/* Header */}
      <div className="socratic-header" style={{ '--accent': accentColor }}>
        <button className="socratic-exit-btn" onClick={onExit}>&larr; Exit</button>
        <div className="socratic-header-center">
          <span className="socratic-header-mode">Socratic Mode</span>
          <button className="socratic-topic-pill" style={{ background: accentColor }} onClick={handleChangeTopic}>
            {topic} &darr;
          </button>
        </div>
        <div style={{ width: 60 }} />
      </div>

      {/* Messages */}
      <div className="socratic-messages">
        {messages.length === 0 && !streaming && !error && (
          <div className="socratic-loading">
            <span className="socratic-dot-pulse" />
            <span className="socratic-dot-pulse" />
            <span className="socratic-dot-pulse" />
          </div>
        )}

        {error && (
          <div className="socratic-error">{error}</div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`socratic-bubble-wrap ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="socratic-avatar" style={{ background: accentColor }}>S</div>
            )}
            <div className={`socratic-bubble ${msg.role}`} style={msg.role === 'assistant' ? { '--accent': accentColor } : {}}>
              {msg.content}
              {msg.role === 'assistant' && streaming && i === messages.length - 1 && (
                <span className="socratic-cursor" />
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="socratic-input-bar">
        <textarea
          ref={inputRef}
          className="socratic-input"
          placeholder="Your answer..."
          value={input}
          maxLength={MAX_INPUT_LENGTH}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={streaming}
        />
        <button
          className="socratic-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || streaming}
          style={{ background: accentColor }}
        >
          &uarr;
        </button>
      </div>
    </div>
  );
}
