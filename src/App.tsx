import { useEffect, useState } from 'react';
import { CaptureBar } from './components/CaptureBar';
import { PositionEditor } from './components/PositionEditor';
import {
  EMPTY_FEN,
  STARTING_FEN,
  lichessAnalysisUrl,
  lichessEditorUrl,
  parseFen,
  withTurn,
} from './lib/fen';
import { downscaleImage, ocrBoard } from './lib/ocr';
import { storage } from './lib/storage';

export default function App() {
  const [fen, setFen] = useState<string>(() => storage.getFen() ?? EMPTY_FEN);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    storage.setFen(fen);
  }, [fen]);

  const parts = parseFen(fen);
  const turn = parts?.turn ?? 'w';

  const handleFiles = async (files: File[]) => {
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      const first = files[0];
      setStatus('Preparing image…');
      const blob = await downscaleImage(first);
      setStatus('Reading board…');
      const result = await ocrBoard(blob);
      if (!result.fen) {
        setError(result.notes ? `Couldn't read a position. ${result.notes}` : `Couldn't read a position.`);
      } else {
        setFen(result.fen);
        const bits: string[] = [`Detected position${result.confidence ? ` (${result.confidence} confidence)` : ''}.`];
        if (result.notes) bits.push(result.notes);
        setStatus(bits.join(' '));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR failed');
    } finally {
      setBusy(false);
    }
  };

  const openInLichess = () => {
    window.open(lichessAnalysisUrl(fen), '_blank', 'noopener');
  };

  const openInEditor = () => {
    window.open(lichessEditorUrl(fen), '_blank', 'noopener');
  };

  const copyFen = async () => {
    try {
      await navigator.clipboard.writeText(fen);
      setStatus('FEN copied.');
      setError(null);
    } catch {
      setError('Copy failed.');
    }
  };

  const resetToStart = () => setFen(STARTING_FEN);
  const clearBoard = () => setFen(EMPTY_FEN);

  const toggleTurn = () => setFen(withTurn(fen, turn === 'w' ? 'b' : 'w'));

  return (
    <div className="min-h-[100dvh] max-w-xl mx-auto px-3 pt-4 pb-8 text-slate-100">
      <header className="flex items-baseline justify-between mb-3">
        <h1 className="font-semibold uppercase tracking-[0.2em] text-sm">
          <span className="text-xl mr-1.5">♞</span>
          BoardScan
        </h1>
        <span
          className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${
            turn === 'w' ? 'bg-slate-100 text-slate-900' : 'bg-slate-900 text-slate-100 ring-1 ring-slate-500'
          }`}
        >
          {turn === 'w' ? 'White to move' : 'Black to move'}
        </span>
      </header>

      <div className="mb-4 space-y-2">
        <CaptureBar onFiles={handleFiles} busy={busy} label="Scan board" />

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={openInLichess}
            className="px-4 py-3 rounded-sm font-semibold tracking-wide bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            Open in Lichess
          </button>
          <button
            onClick={toggleTurn}
            className="px-4 py-3 rounded-sm font-semibold tracking-wide border-2 border-slate-500 text-slate-100 hover:border-slate-300"
          >
            Toggle turn
          </button>
        </div>

        {status && <Banner tone="info">{status}</Banner>}
        {error && <Banner tone="error">{error}</Banner>}
      </div>

      <PositionEditor
        fen={fen}
        onChange={setFen}
        orientation={orientation}
        onFlip={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
      />

      <div className="mt-4 text-[11px] text-slate-400">
        <div className="font-mono break-all p-2 bg-slate-800/60 rounded">{fen}</div>
        <div className="mt-2 flex items-center gap-3 uppercase tracking-wider">
          <button onClick={copyFen} className="hover:text-slate-100">Copy FEN</button>
          <span className="text-slate-600">·</span>
          <button onClick={openInEditor} className="hover:text-slate-100">Open editor</button>
          <span className="text-slate-600">·</span>
          <button onClick={resetToStart} className="hover:text-slate-100">Reset</button>
          <span className="text-slate-600">·</span>
          <button onClick={clearBoard} className="hover:text-rose-400">Clear</button>
        </div>
      </div>
    </div>
  );
}

function Banner({ tone, children }: { tone: 'info' | 'error'; children: React.ReactNode }) {
  const cls =
    tone === 'error'
      ? 'border-rose-600/50 bg-rose-950/50 text-rose-200'
      : 'border-sky-600/40 bg-sky-950/40 text-sky-100';
  return <div className={`text-sm rounded-sm border px-3 py-2 ${cls}`}>{children}</div>;
}
