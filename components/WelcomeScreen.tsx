
import React from 'react';
import type { AppMode } from '../types';
import { MicIcon } from './icons';

interface WelcomeScreenProps {
  setMode: (mode: AppMode) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ setMode }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-4">
      <div className="mb-10">
        <h1 className="text-5xl md:text-7xl font-serif font-bold text-brand-primary">
          Rani Bhat
        </h1>
        <p className="text-xl md:text-2xl text-brand-secondary/70 mt-3">
          Your Virtual Companion
        </p>
      </div>

      <div className="space-y-6 w-full max-w-sm">
        <button
          onClick={() => setMode('Chat')}
          className="w-full bg-brand-primary text-white font-bold py-4 px-6 rounded-lg shadow-lg hover:bg-brand-primary-light transform hover:-translate-y-1 transition-all duration-300 ease-in-out"
        >
          <span className="text-xl">Chat with Rani</span>
          <p className="text-sm font-normal opacity-80">Type and get instant replies.</p>
        </button>

        <button
          onClick={() => setMode('Talk')}
          className="w-full bg-brand-surface text-brand-primary font-bold py-4 px-6 rounded-lg shadow-lg border border-brand-bg-alt hover:bg-brand-bg-alt transform hover:-translate-y-1 transition-all duration-300 ease-in-out flex items-center justify-center space-x-3"
        >
          <MicIcon className="w-6 h-6" />
          <div>
            <span className="text-xl">Talk with Rani</span>
            <p className="text-sm font-normal opacity-80">Have a live voice conversation.</p>
          </div>
        </button>
      </div>
       <p className="mt-16 text-center text-brand-secondary/50 text-sm max-w-xs">
        Choose an option to start a conversation. You can end the chat anytime from the header.
      </p>
    </div>
  );
};

export default WelcomeScreen;