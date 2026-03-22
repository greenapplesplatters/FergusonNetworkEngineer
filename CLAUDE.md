# Project Notes for Claude

## Socratic Mode — Phase 2: Rolling Summarization

**Status:** Phase 1 shipped. Phase 2 is the next task.

### What Phase 1 did (already live)
- Server `MAX_HISTORY_LENGTH` raised: 40 → 80 (`api/socratic.js`)
- Client `SESSION_MAX_MESSAGES` raised: 36 → 76 (`src/components/SocraticMode.jsx`)
- `buildApiHistory()` helper keeps first message + most recent tail when trimming

### Why Phase 2 is needed
Phase 1 delays context loss but doesn't eliminate it. After 76 messages the model silently drops middle-session exchanges. For a long Socratic session the user loses continuity.

### Phase 2 Goal
When a session exceeds a threshold, compress the oldest messages into a summary injected at position 0. Sessions run indefinitely with full context.

---

## Phase 2 Implementation

### Step 1 — Create `api/summarize.js`

```js
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { topic, messages } = req.body;
  if (!topic || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request.' });
  }

  const transcript = messages
    .map(m => `${m.role === 'user' ? 'Student' : 'Guide'}: ${m.content}`)
    .join('\n\n');

  const prompt = `Summarize this Socratic dialogue about "${topic}" in 3-4 sentences. Cover: what the student demonstrated they understand, any misconceptions that were corrected, and where the conversation left off. Be specific — this summary replaces the actual messages in future context.\n\n${transcript}`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const summary = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ summary });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
```

### Step 2 — Update `src/components/SocraticMode.jsx`

**Add constant** near the other constants at the top:
```js
const SUMMARIZE_THRESHOLD = 50;
```

**Add helper** after `buildApiHistory`:
```js
async function summarizeHistory(topic, messages) {
  try {
    const response = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, messages }),
    });
    if (!response.ok) return null;
    const { summary } = await response.json();
    return summary || null;
  } catch {
    return null;
  }
}
```

**Update `buildApiHistory`** to accept and inject a summary:
```js
function buildApiHistory(msgs, summary = null) {
  const mapped = msgs.map(m => ({ role: m.role, content: m.content }));
  if (mapped.length <= SESSION_MAX_MESSAGES) return mapped;
  const tail = mapped.slice(-(SESSION_MAX_MESSAGES - 1));
  const anchor = summary
    ? { role: 'assistant', content: `[Earlier context] ${summary}` }
    : mapped[0];
  return [anchor, ...tail];
}
```

**Add `summaryRef`** in the component (alongside other refs):
```js
const summaryRef = useRef(null);
```

**Add `useEffect`** to pre-compute summary in the background (alongside other useEffects):
```js
useEffect(() => {
  if (messages.length === SUMMARIZE_THRESHOLD && !summaryRef.current) {
    const toSummarize = messages.slice(0, SUMMARIZE_THRESHOLD - 20);
    summarizeHistory(topic, toSummarize).then(s => {
      if (s) summaryRef.current = s;
    });
  }
}, [messages.length]);
```

**Update `handleSend`** call (pass summary):
```js
await askAI(buildApiHistory(updatedHistory, summaryRef.current), topic);
```

---

## Repos that need the same changes

This pattern is identical across all 5 apps:

| Repo | api/summarize.js | SocraticMode.jsx |
|------|-----------------|-----------------|
| `learnwithme-generic` | create | update |
| `FergusonNetworkEngineer` | create | update |
| `smithfield-foods-interview-prep` | create | update |
| `learnwithmeapp` (awsStudyGuide) | create | update |
| `learnwithmeapp` (skillGapGuide) | create | update |

The `api/summarize.js` file is identical in all repos except `learnwithmeapp` uses a shared env var — no code difference needed.
