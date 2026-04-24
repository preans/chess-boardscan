import { useEffect, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { formatFen, parseFen } from '../lib/fen';

type Piece = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P' | 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
type ArmedAction = Piece | 'empty' | null;

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function placementToBoard(placement: string): (Piece | null)[][] {
  return placement.split('/').map((rank) => {
    const row: (Piece | null)[] = [];
    for (const ch of rank) {
      if (/[1-8]/.test(ch)) {
        for (let i = 0; i < parseInt(ch, 10); i++) row.push(null);
      } else {
        row.push(ch as Piece);
      }
    }
    return row;
  });
}

function boardToPlacement(board: (Piece | null)[][]): string {
  return board
    .map((rank) => {
      let out = '';
      let empty = 0;
      for (const sq of rank) {
        if (sq === null) {
          empty++;
        } else {
          if (empty > 0) {
            out += empty;
            empty = 0;
          }
          out += sq;
        }
      }
      if (empty > 0) out += empty;
      return out;
    })
    .join('/');
}

function squareToIndices(square: string): [number, number] | null {
  if (square.length !== 2) return null;
  const fileIdx = FILES.indexOf(square[0]);
  const rank = parseInt(square[1], 10);
  if (fileIdx < 0 || Number.isNaN(rank) || rank < 1 || rank > 8) return null;
  return [8 - rank, fileIdx];
}

function setSquare(fen: string, square: string, piece: Piece | null): string {
  const parts = parseFen(fen);
  if (!parts) return fen;
  const board = placementToBoard(parts.placement);
  const idx = squareToIndices(square);
  if (!idx) return fen;
  board[idx[0]][idx[1]] = piece;
  return formatFen({ ...parts, placement: boardToPlacement(board) });
}

function getSquare(fen: string, square: string): Piece | null {
  const parts = parseFen(fen);
  if (!parts) return null;
  const board = placementToBoard(parts.placement);
  const idx = squareToIndices(square);
  if (!idx) return null;
  return board[idx[0]][idx[1]];
}

const UNICODE: Record<Piece, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

type Props = {
  fen: string;
  onChange: (fen: string) => void;
  orientation: 'white' | 'black';
  onFlip: () => void;
};

export function PositionEditor({ fen, onChange, orientation, onFlip }: Props) {
  const [armed, setArmed] = useState<ArmedAction>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(340);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w) setBoardWidth(Math.min(540, w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onSquareClick = (square: string) => {
    if (armed === null) return;
    const piece = armed === 'empty' ? null : armed;
    onChange(setSquare(fen, square, piece));
    // keep armed so you can tap-tap-tap to place the same piece on multiple squares
  };

  const onPieceDrop = (source: string, target: string) => {
    if (source === target) return false;
    const p = getSquare(fen, source);
    if (!p) return false;
    let next = setSquare(fen, source, null);
    next = setSquare(next, target, p);
    onChange(next);
    return true;
  };

  const paletteBtn = (action: ArmedAction, label: string, color: 'w' | 'b' | 'x') => {
    const isActive = armed === action;
    const bg =
      color === 'w'
        ? isActive
          ? 'bg-amber-200 text-slate-900 ring-2 ring-amber-400'
          : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
        : color === 'b'
        ? isActive
          ? 'bg-amber-200 text-slate-900 ring-2 ring-amber-400'
          : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
        : isActive
        ? 'bg-rose-600 text-white ring-2 ring-rose-400'
        : 'bg-slate-700 text-rose-200 hover:bg-slate-600';
    return (
      <button
        key={String(action)}
        onClick={() => setArmed(isActive ? null : action)}
        className={`aspect-square flex items-center justify-center rounded-md text-3xl leading-none select-none ${bg}`}
        aria-pressed={isActive}
        aria-label={label}
      >
        {label}
      </button>
    );
  };

  const whitePalette: Piece[] = ['K', 'Q', 'R', 'B', 'N', 'P'];
  const blackPalette: Piece[] = ['k', 'q', 'r', 'b', 'n', 'p'];

  const armedLabel =
    armed === null
      ? 'Tip — tap a piece below, then tap a square. Drag a piece to move it.'
      : armed === 'empty'
      ? 'Eraser armed — tap a square to clear it.'
      : `${armed === armed.toUpperCase() ? 'White' : 'Black'} ${pieceName(armed)} armed — tap any square to place it.`;

  return (
    <div ref={containerRef} className="w-full">
      <div className="mx-auto" style={{ width: boardWidth }}>
        <Chessboard
          position={fen}
          boardWidth={boardWidth}
          boardOrientation={orientation}
          onSquareClick={onSquareClick}
          onPieceDrop={onPieceDrop}
          arePiecesDraggable
          customBoardStyle={{
            borderRadius: 4,
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          }}
          customDarkSquareStyle={{ backgroundColor: '#6b7a8f' }}
          customLightSquareStyle={{ backgroundColor: '#e8ecf2' }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-300 flex-1">{armedLabel}</p>
        <button
          type="button"
          onClick={onFlip}
          className="text-xs text-slate-300 hover:text-white border border-slate-600 rounded px-2 py-1"
          aria-label="Flip board orientation"
        >
          ⇅ Flip
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {whitePalette.map((p) => paletteBtn(p, UNICODE[p], 'w'))}
        {paletteBtn('empty', '⌫', 'x')}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {blackPalette.map((p) => paletteBtn(p, UNICODE[p], 'b'))}
        <div aria-hidden />
      </div>
    </div>
  );
}

function pieceName(p: Piece): string {
  const map: Record<string, string> = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn' };
  return map[p.toUpperCase()] ?? p;
}
