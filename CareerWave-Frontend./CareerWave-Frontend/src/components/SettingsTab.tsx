/** Settings — profile (name, target role), path, privacy. */
import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { useCareer } from '../state/CareerContext';
import { errorMessage } from '../services/api';
import { TargetRolePicker } from './TargetRolePicker';
import { Card, ErrorPanel, PageHeader, PrimaryButton } from './ui';

interface Props {
  onSwitchPath: () => void;
  onOpenPrivacy: () => void;
  onSignOut: () => void;
  email?: string;
}

export default function SettingsTab({ onSwitchPath, onOpenPrivacy, onSignOut, email }: Props) {
  const { state, saveProfile } = useCareer();
  const [name, setName] = useState(state.profile.name);
  const [role, setRole] = useState(state.profile.targetRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const roleChanged = role.trim() !== state.profile.targetRole;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveProfile({ name: name.trim(), targetRole: role.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader icon={Settings} tone="slate" title="Settings" subtitle="Your profile, path and data" />

      <Card className="space-y-5">
        <h3 className="text-base font-bold text-slate-900">Profile</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="s-name" className="block text-sm font-semibold text-slate-800">Name</label>
            <input id="s-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>
          <div className="space-y-1.5">
            <span className="block text-sm font-semibold text-slate-800">Email</span>
            <p className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600">{email || state.profile.email || '—'}</p>
          </div>
        </div>
        <div className="space-y-2">
          <span className="block text-sm font-semibold text-slate-800">Target role</span>
          <TargetRolePicker value={role} onChange={setRole} />
          {roleChanged && state.resume && (
            <p className="text-xs text-amber-700">After saving, re-score your resume from the dashboard to see results for the new role.</p>
          )}
        </div>
        {error && <ErrorPanel message={error} />}
        <div className="flex items-center gap-3">
          <PrimaryButton onClick={save} disabled={saving || !name.trim() || !role.trim()}>{saving ? 'Saving…' : 'Save profile'}</PrimaryButton>
          {saved && <span className="text-sm text-emerald-700 font-semibold">Saved</span>}
        </div>
      </Card>

      <Card className="space-y-3">
        <h3 className="text-base font-bold text-slate-900">Your path</h3>
        <p className="text-sm text-slate-600">
          {state.profile.path === 'resume' ? 'You are using Career Wave with a resume.' : state.profile.path === 'beginner' ? 'You are on the beginner roadmap (no resume).' : 'You have not chosen a path yet.'}
        </p>
        <button onClick={onSwitchPath} className="px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-sm font-semibold text-blue-700 hover:bg-blue-100">
          Change path
        </button>
      </Card>

      <Card className="space-y-3">
        <h3 className="text-base font-bold text-slate-900">Privacy & data</h3>
        <p className="text-sm text-slate-600">We store your profile and the structured data extracted from your resume — not the original file. You can delete it any time.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={onOpenPrivacy} className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">Manage stored data</button>
          <button onClick={onSignOut} className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">Sign out</button>
        </div>
      </Card>
    </div>
  );
}
