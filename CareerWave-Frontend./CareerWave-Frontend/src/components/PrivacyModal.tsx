import React, { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { useCareer } from '../state/CareerContext';
import { ApiService, errorMessage } from '../services/api';
import { ErrorPanel } from './ui';

interface PrivacyModalProps {
  onClose: () => void;
  onWipeComplete: () => void;
}

/** Delete the stored resume, or wipe everything the backend holds for this user. */
export const PrivacyModal: React.FC<PrivacyModalProps> = ({ onClose, onWipeComplete }) => {
  const { state, demo, refresh, exitDemo, wipeAll } = useCareer();
  const [busy, setBusy] = useState<null | 'resume' | 'all'>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const deleteResume = async () => {
    if (!state.resume) return;
    setBusy('resume');
    setError(null);
    try {
      if (demo) await exitDemo();
      else {
        await ApiService.deleteResume(state.resume.id);
        await refresh();
      }
      setDone('Resume data deleted.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const wipe = async () => {
    setBusy('all');
    setError(null);
    try {
      await wipeAll();
      onWipeComplete();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-xl relative">
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-slate-900" /></div>
          <div>
            <h3 id="privacy-title" className="text-base font-bold text-slate-900">Your data</h3>
            <p className="text-xs text-slate-500">Deletion is permanent</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Resume data</div>
            <div className="text-xs text-slate-500">{state.resume ? `${state.resume.originalFilename} + its analysis` : 'Nothing stored'}</div>
          </div>
          {state.resume && (
            <button onClick={deleteResume} disabled={busy !== null} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 hover:bg-slate-50 disabled:opacity-50">
              {busy === 'resume' ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>

        <div className="p-3.5 rounded-xl border border-red-200 space-y-2">
          <div className="text-sm font-semibold text-slate-900">Delete everything</div>
          <div className="text-xs text-slate-500">Profile, resume, scores, roadmap, job preferences and alert settings. You'll be signed out.</div>
          {confirmAll ? (
            <div className="flex gap-2">
              <button onClick={wipe} disabled={busy !== null} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">
                {busy === 'all' ? 'Deleting…' : 'Yes, delete everything'}
              </button>
              <button onClick={() => setConfirmAll(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmAll(true)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
              Delete all my data
            </button>
          )}
        </div>

        {error && <ErrorPanel message={error} />}
        {done && <p className="text-sm text-emerald-700 font-semibold">{done}</p>}
      </div>
    </div>
  );
};
