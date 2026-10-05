import React, { useState } from 'react';
import type { UserSession } from '../types';
import { Compass, Shield, RotateCcw, Copy, Check, Server } from 'lucide-react';

interface NavbarProps {
  session: UserSession | null;
  onReset: () => void;
  onOpenPrivacy: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ session, onReset, onOpenPrivacy }) => {
  const [copied, setCopied] = useState(false);

  const copySessionId = () => {
    if (session?.id) {
      navigator.clipboard.writeText(session.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-paper-50/90 backdrop-blur-md transition">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3 cursor-pointer select-none" onClick={onReset}>
          <div className="w-9 h-9 rounded-xl bg-stone-900 text-stone-100 flex items-center justify-center shadow-sm">
            <Compass className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-stone-900 tracking-tight text-base">
                CareerPath
              </span>
              <span className="text-[11px] font-medium text-stone-500 bg-stone-200/60 px-2 py-0.5 rounded-md">
                Skill Matcher
              </span>
            </div>
            <p className="text-[11px] text-stone-500 hidden sm:block">
              Find your gaps • Master the skills • Land the job
            </p>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center space-x-2.5">
          {/* Live Backend Badge */}
          <div
            className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 shadow-sm"
            title="Connected to Live CareerWave Spring Boot Backend"
          >
            <Server className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-stone-500">Backend:</span>
            <span className="text-emerald-700 font-semibold">Live API</span>
          </div>

          {/* Session UUID badge */}
          {session && (
            <button
              onClick={copySessionId}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs text-stone-600 hover:border-stone-300 shadow-sm transition"
              title="Click to copy your session ID"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="font-mono text-stone-700 font-medium">
                {session.name ? session.name.split(' ')[0] : session.id.substring(0, 8)}
              </span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3 text-stone-400" />
              )}
            </button>
          )}

          {/* Privacy & Hard Deletion Button */}
          {session && (
            <button
              onClick={onOpenPrivacy}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:text-stone-900 hover:border-stone-300 text-xs font-medium shadow-sm transition"
              title="Physical resume & data deletion"
            >
              <Shield className="w-3.5 h-3.5 text-stone-500" />
              <span className="hidden sm:inline">Privacy</span>
            </button>
          )}

          {/* Reset / Start Fresh */}
          {session && (
            <button
              onClick={onReset}
              className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-stone-900 hover:border-stone-300 shadow-sm transition"
              title="Start Fresh"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
