/**
 * Path A — resume upload. The target role from onboarding is applied
 * automatically (server-side); the user is never asked for it again here.
 *
 * Frontend → POST /resumes (Resume Parser) → POST /assessments (AI) → dashboard.
 */
import React, { useRef, useState } from 'react';
import { UploadCloud, Target, FlaskConical, FileText } from 'lucide-react';
import { useCareer } from '../state/CareerContext';
import { errorMessage } from '../services/api';
import { ErrorPanel, LoadingPanel } from './ui';

const ACCEPT = '.pdf,.docx,.txt,.png,.jpg,.jpeg,.webp';
const MAX_MB = 10;

interface PathAResumeUploadProps {
  onComplete: () => void;
  /** Smaller layout when used inside the Resume tab. */
  embedded?: boolean;
}

export const PathAResumeUpload: React.FC<PathAResumeUploadProps> = ({ onComplete, embedded }) => {
  const { state, uploadResume, startDemo } = useCareer();
  const [stage, setStage] = useState<'idle' | 'parsing' | 'scoring'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const role = state.profile.targetRole;

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That file is larger than ${MAX_MB} MB. Upload a smaller PDF or DOCX.`);
      return;
    }
    setFileName(file.name);
    try {
      await uploadResume(file, setStage);
      onComplete();
    } catch (e) {
      setError(errorMessage(e, 'We could not analyse that resume. Please try again.'));
    } finally {
      setStage('idle');
    }
  };

  const busy = stage !== 'idle';

  return (
    <div className={embedded ? 'space-y-4' : 'bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6'}>
      {!embedded && (
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Upload your resume</h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
            <Target className="w-4 h-4 text-blue-600" />
            We'll score it for <span className="font-semibold text-slate-800">{role}</span> roles.
          </p>
        </div>
      )}

      {busy ? (
        <div className="border-2 border-dashed border-blue-200 rounded-2xl bg-blue-50/30">
          <LoadingPanel
            key={stage}
            messages={stage === 'parsing'
              ? ['Reading your resume…', 'Extracting experience, education and skills…', 'Checking formatting and sections…']
              : [`Scoring your resume for ${role}…`, 'Comparing your skills with what employers ask for…', 'Writing your summary…']}
            hint={`${fileName ?? 'Your resume'} — this usually takes under a minute.`}
          />
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload resume file"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
          }}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 ${
            dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/30'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) handleFile(f);
            }}
          />
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            {embedded ? <FileText className="w-6 h-6" /> : <UploadCloud className="w-6 h-6" />}
          </div>
          <div className="text-sm font-bold text-slate-800">
            Drop your resume here, or <span className="text-blue-600 underline">browse</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">PDF, DOCX, TXT or a photo (PNG/JPG) · up to {MAX_MB} MB</p>
        </div>
      )}

      {error && <ErrorPanel message={error} />}

      {!busy && !embedded && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <span className="text-xs text-slate-500">Just exploring? See the product with a sample resume — results are clearly marked as sample data.</span>
          <button
            type="button"
            onClick={() => { startDemo(); onComplete(); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold"
          >
            <FlaskConical className="w-3.5 h-3.5" /> Try with a sample resume
          </button>
        </div>
      )}
    </div>
  );
};

export default PathAResumeUpload;
