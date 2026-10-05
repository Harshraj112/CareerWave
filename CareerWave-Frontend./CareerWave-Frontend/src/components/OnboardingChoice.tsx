import React from 'react';
import { UserSession } from '../types';
import { FileUp, Sparkles, ArrowRight, UserCheck, ShieldCheck, CheckCircle2, HelpCircle } from 'lucide-react';

interface OnboardingChoiceProps {
  session: UserSession;
  onSelectChoice: (choice: 'upload_resume' | 'no_resume') => void;
}

export const OnboardingChoice: React.FC<OnboardingChoiceProps> = ({ session, onSelectChoice }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      {/* Welcome banner */}
      <div className="text-center mb-10 space-y-3">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Logged in as <strong className="text-white">{session.name || 'Candidate'}</strong></span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          How would you like to get started?
        </h2>
        <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
          Do you have an existing resume to upload, or would you prefer to explore roles and enter basic details manually?
        </p>
      </div>

      {/* Two Choice Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Choice A: YES, Upload Resume */}
        <div
          onClick={() => onSelectChoice('upload_resume')}
          className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-brand-500/50 rounded-2xl p-7 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-brand-500/10 flex flex-col justify-between"
        >
          <div className="absolute top-4 right-4">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-500/10 border border-brand-500/30 text-brand-400">
              Path A (Recommended)
            </span>
          </div>

          <div>
            <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-brand-500 group-hover:text-white transition-all duration-300">
              <FileUp className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2 flex items-center space-x-2">
              <span>Yes, upload my resume</span>
            </h3>

            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Upload your resume in PDF, DOCX, or text format. Our AI will automatically parse your skills, check for ATS readability issues, and evaluate your match score against any target role.
            </p>

            <div className="space-y-2.5 mb-8">
              {[
                'Automatic skill & experience extraction',
                'ATS formatting & layout issue detection',
                'One-click comparison against real job listings'
              ].map((feat, idx) => (
                <div key={idx} className="flex items-center space-x-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-brand-400 font-semibold text-sm group-hover:text-brand-300">
            <span>Continue with Resume Upload</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition duration-200" />
          </div>
        </div>

        {/* Choice B: NO, Enter Details Manually */}
        <div
          onClick={() => onSelectChoice('no_resume')}
          className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-7 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/10 flex flex-col justify-between"
        >
          <div className="absolute top-4 right-4">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              Path B (Zero Files)
            </span>
          </div>

          <div>
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300">
              <UserCheck className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2 flex items-center space-x-2">
              <span>No, continue without resume</span>
            </h3>

            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              No resume on hand? No problem. Provide a few basic details (education, existing skills — all completely optional) and select the job field you want to break into.
            </p>

            <div className="space-y-2.5 mb-8">
              {[
                'Education and background details are optional',
                'Pick target field (Frontend, Backend, AI/ML, etc.)',
                'Get curated learning paths and skill requirements'
              ].map((feat, idx) => (
                <div key={idx} className="flex items-center space-x-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-cyan-400 font-semibold text-sm group-hover:text-cyan-300">
            <span>Continue with Manual Entry</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition duration-200" />
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-slate-500 flex items-center justify-center space-x-1.5">
        <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
        <span>Both paths feed into the same unified AI scoring & learning path engine.</span>
      </div>
    </div>
  );
};
