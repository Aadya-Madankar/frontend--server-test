
import React, { useState } from 'react';
import Header from './components/Header';
import ChatInterface from './components/ChatInterface';
import WelcomeScreen from './components/WelcomeScreen';
import TalkInterface from './components/TalkInterface';
import type { AppMode } from './types';


const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('Welcome');

  const renderContent = () => {
    switch (mode) {
      case 'Welcome':
        return <WelcomeScreen setMode={setMode} />;
      case 'Chat':
        return <ChatInterface />;
      case 'Talk':
        return <TalkInterface />;
      default:
        return <WelcomeScreen setMode={setMode} />;
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg-light flex flex-col">
      {mode !== 'Welcome' && <Header currentMode={mode} setMode={setMode} />}
      <main className="flex-grow flex flex-col items-center justify-center p-2 sm:p-4">
        <div className="w-full max-w-4xl h-full flex flex-col">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;