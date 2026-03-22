import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import lessons from '../data/lessons.json';
import feedCards from '../data/feed.json';
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

function buildSystemPrompt(topic) {
  const lesson = lessons.find(l => l.topic === topic);
  const cards = feedCards.filter(c => c.topic === topic);

  let knowledgeBase = '';

  if (lesson) {
    knowledgeBase += `## Lesson: ${lesson.headline}\n`;
    lesson.lesson_pages.forEach(p => {
      knowledgeBase += `### ${p.title}\n${p.body}\n\n`;
    });
  }

  if (cards.length > 0) {
    knowledgeBase += `## Key Concepts\n`;
    cards.forEach(c => {
      if (c.quiz_format) {
        knowledgeBase += `- Q: ${c.quiz_format.question}\n`;
        knowledgeBase += `  A: ${c.quiz_format.explanation}\n`;
      }
      if (c.rule_format?.statement) {
        knowledgeBase += `- Rule: ${c.rule_format.statement}\n`;
      }
    });
  }

  return `You are a Socratic tutor helping a senior network engineer prepare for a technical interview, specifically the topic: "${topic}".

The student is a 3rd-level escalation engineer with deep hands-on experience across BGP, OSPF, DMVPN, MPLS, QoS, Cisco Nexus, Versa SD-WAN, SOX ITGC, and PCI DSS. They worked at Ferguson Enterprises supporting 1,700+ branch locations, distributed retail, ISP circuit management, POS systems, and voice over WAN. They are refreshing and sharpening — not learning from scratch.

Your teaching style:
- Ask ONE focused question at a time — never lecture or explain upfront
- Frame questions like a senior network engineer interviewer would ask them
- When they answer correctly, affirm briefly and probe deeper ("Good — now what happens when...")
- When they answer incorrectly or partially, don't correct directly — ask a question that exposes the gap ("What would you see in the routing table if that were true?")
- Keep responses concise (2–4 sentences max) — you're in a dialogue, not giving a lecture
- Never reveal the full answer outright; always leave something for them to figure out
- Build complexity gradually: start with core mechanics, then failure modes, then real-world troubleshooting at scale
- Always connect concepts back to the Ferguson environment: 1,700 branches, distributed retail, ISP circuit management, POS systems, voice over WAN
- For Versa SD-WAN: keep framing honest — POC/pilot participation, not production ownership
- Be direct. No encouragement filler. Tell them when an answer is weak or would raise a red flag in a real interview.

Your knowledge base for this topic:
${knowledgeBase}

Start immediately by asking the student your first Socratic question about "${topic}". Do not introduce yourself or explain the process — just ask the question.`;
}

export default function SocraticMode({ onExit }) {
  const [topic, setTopic] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const clientRef = useRef(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey) {
      clientRef.current = new GoogleGenAI({ apiKey });
    }
  }, []);

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
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setError('No API key found. Add VITE_GEMINI_API_KEY to your .env file.');
      return;
    }

    setStreaming(true);
    setError(null);

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const systemPrompt = buildSystemPrompt(selectedTopic || topic);

      // Build Gemini-format contents from history
      const contents = history.length > 0
        ? history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
        : [{ role: 'user', parts: [{ text: 'Begin.' }] }];

      const stream = await clientRef.current.models.generateContentStream({
        model: 'gemini-3.1-flash-lite-preview',
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 300,
        },
        contents,
      });

      let full = '';
      for await (const chunk of stream) {
        const text = chunk.text ?? '';
        full += text;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: full };
          return updated;
        });
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Check your API key.');
      setMessages(prev => prev.slice(0, -1)); // remove empty bubble
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function handleSend() {
    if (!input.trim() || streaming) return;

    const userMessage = { role: 'user', content: input.trim() };
    const updatedHistory = [...messages, userMessage];

    setMessages(updatedHistory);
    setInput('');

    // Build history for API (exclude the initial "Begin." trigger)
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
