
import React from 'react';
import type { AppMode } from '../types';
import { HomeIcon } from './icons';

interface HeaderProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
}

const Header: React.FC<HeaderProps> = ({ currentMode, setMode }) => {
  const modes: Exclude<AppMode, 'Welcome'>[] = ['Chat', 'Talk'];

  return (
    <header className="bg-brand-surface/80 backdrop-blur-md shadow-sm sticky top-0 z-10 border-b border-brand-bg-alt">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex-shrink-0">
             <button
                onClick={() => setMode('Welcome')}
                className="flex items-center space-x-2 text-brand-secondary/70 hover:text-brand-primary transition-colors"
                title="End Chat & Go Home"
              >
                <HomeIcon className="w-6 h-6" />
                <span className="text-sm font-medium hidden sm:block">End Chat</span>
            </button>
          </div>
          
          <div className="absolute left-1/2 -translate-x-1/2">
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-brand-primary text-center">Rani Bhat</h1>
          </div>

          <div className="flex items-center justify-end">
            <div className="bg-brand-bg-alt p-1 rounded-lg flex items-baseline space-x-1">
              {modes.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setMode(mode)}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-all duration-300 ${
                    currentMode === mode
                      ? 'bg-brand-surface text-brand-primary shadow-sm'
                      : 'text-brand-secondary/60 hover:bg-brand-surface/50 hover:text-brand-secondary'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;