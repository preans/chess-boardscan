import { useRef } from 'react';

type Props = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  busy?: boolean;
  label?: string;
};

export function CaptureBar({ onFiles, disabled, busy, label }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex gap-2">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => cameraRef.current?.click()}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-sm font-semibold tracking-wide bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 text-white"
      >
        {busy ? <Spinner /> : <CameraGlyph />}
        <span>{label ?? 'Take photo'}</span>
      </button>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => libraryRef.current?.click()}
        className="flex items-center justify-center px-4 py-3 rounded-sm font-semibold tracking-wide bg-transparent text-slate-100 border-2 border-slate-500 hover:border-slate-300 disabled:opacity-40"
      >
        Upload
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CameraGlyph() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" strokeLinejoin="round" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}
