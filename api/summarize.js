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
