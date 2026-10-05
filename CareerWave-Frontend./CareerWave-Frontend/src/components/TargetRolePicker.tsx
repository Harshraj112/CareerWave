import React, { useState } from 'react';
import { TARGET_ROLE_OPTIONS } from '../data/options';

/** Predefined roles + a custom role field. Used in onboarding and settings. */
export function TargetRolePicker({ value, onChange }: { value: string; onChange: (role: string) => void }) {
  const isPreset = TARGET_ROLE_OPTIONS.some((o) => o.title === value);
  const [custom, setCustom] = useState(!isPreset && Boolean(value));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Target role">
        {TARGET_ROLE_OPTIONS.map((opt) => {
          const selected = !custom && value === opt.title;
          return (
            <button
              key={opt.title}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => { setCustom(false); onChange(opt.title); }}
              className={`p-3 rounded-xl border text-left transition ${
                selected ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className={`text-sm font-semibold ${selected ? 'text-blue-800' : 'text-slate-800'}`}>{opt.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{opt.description}</div>
            </button>
          );
        })}
      </div>
      <div>
        <button
          type="button"
          onClick={() => { setCustom(!custom); if (custom) onChange(TARGET_ROLE_OPTIONS[0].title); else onChange(''); }}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
        >
          {custom ? 'Choose from the list instead' : "My role isn't listed"}
        </button>
        {custom && (
          <input
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={100}
            placeholder="e.g. Cybersecurity Analyst, Product Designer, SDE-1"
            aria-label="Custom target role"
            className="mt-2 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        )}
      </div>
    </div>
  );
}
