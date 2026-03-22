import React, { useState } from 'react';
import ModeSelect from './components/ModeSelect';
import Feed from './components/Feed';
import ChallengeMode from './components/ChallengeMode';
import StudyMode from './components/StudyMode';
import SocraticMode from './components/SocraticMode';
import QuestMode from './components/QuestMode';
import rawCards from './data/feed.json';
import './index.css';

function App() {
  const [mode, setMode] = useState(null); // null | 'learn' | 'study' | 'challenge' | 'socratic' | 'quest'

  return (
    <div className="app-container">
      {mode === null        && <ModeSelect onSelect={setMode} />}
      {mode === 'learn'     && <StudyMode onExit={() => setMode(null)} />}
      {mode === 'study'     && <Feed cards={rawCards} onExit={() => setMode(null)} />}
      {mode === 'challenge' && <ChallengeMode cards={rawCards} onExit={() => setMode(null)} />}
      {mode === 'socratic'  && <SocraticMode onExit={() => setMode(null)} />}
      {mode === 'quest'     && <QuestMode onExit={() => setMode(null)} />}
    </div>
  );
}

export default App;
