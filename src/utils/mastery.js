const STORAGE_KEY = 'ferguson_net_mastery_v1';

export function loadMastery() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveMastery(mastery) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mastery));
}

export function getMastery(conceptId) {
  const mastery = loadMastery();
  return mastery[conceptId] || { score: 0, attempts: 0, correct: 0, lastSeen: null, nextReview: null };
}

// Call when user answers a quiz or scenario question
export function recordAnswer(conceptId, isCorrect, format) {
  const mastery = loadMastery();
  const cm = mastery[conceptId] || { score: 0, attempts: 0, correct: 0, lastSeen: null, nextReview: null };

  cm.attempts += 1;
  cm.lastSeen = Date.now();
  if (isCorrect) cm.correct = (cm.correct || 0) + 1;

  // Score delta by format: scenario is harder so rewards/penalizes more
  let delta;
  if (format === 'scenario') {
    delta = isCorrect ? 15 : -10;
  } else {
    delta = isCorrect ? 10 : -5;
  }
  cm.score = Math.max(0, Math.min(100, cm.score + delta));

  // Spaced repetition interval: well-known = review less often
  const dayMs = 86400000;
  const interval = cm.score >= 80 ? 7 * dayMs : cm.score >= 50 ? 3 * dayMs : dayMs;
  cm.nextReview = Date.now() + interval;

  mastery[conceptId] = cm;
  saveMastery(mastery);
  return cm;
}

// Call when a rule card is viewed (passive reinforcement)
export function recordView(conceptId) {
  const mastery = loadMastery();
  const cm = mastery[conceptId] || { score: 0, attempts: 0, correct: 0, lastSeen: null, nextReview: null };
  cm.score = Math.min(100, cm.score + 2);
  cm.lastSeen = Date.now();
  if (!cm.nextReview) cm.nextReview = Date.now() + 86400000;
  mastery[conceptId] = cm;
  saveMastery(mastery);
}

export function clearMastery() {
  localStorage.removeItem(STORAGE_KEY);
}
