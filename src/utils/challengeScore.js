const KEY = 'ferguson_net_challenge_v1';

export function getChallengeScores() {
  try {
    const stored = localStorage.getItem(KEY);
    return stored ? JSON.parse(stored) : { high: 0, last: null };
  } catch {
    return { high: 0, last: null };
  }
}

// Save score, return { high, last, isNew }
export function saveChallengeScore(score) {
  const current = getChallengeScores();
  const isNew = score > (current.high || 0);
  const updated = {
    high: isNew ? score : (current.high || 0),
    last: score,
  };
  localStorage.setItem(KEY, JSON.stringify(updated));
  return { ...updated, isNew };
}
