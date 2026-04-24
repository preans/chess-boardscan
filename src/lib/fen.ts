export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

export type FenParts = {
  placement: string;
  turn: 'w' | 'b';
  castling: string;
  enPassant: string;
  halfmove: number;
  fullmove: number;
};

export function parseFen(fen: string): FenParts | null {
  const parts = fen.trim().split(/\s+/);
  if (parts.length === 0) return null;
  const placement = parts[0];
  if (!isValidPlacement(placement)) return null;
  const turn = (parts[1] === 'b' ? 'b' : 'w') as 'w' | 'b';
  const castling = parts[2] ?? 'KQkq';
  const enPassant = parts[3] ?? '-';
  const halfmove = Number(parts[4] ?? '0') || 0;
  const fullmove = Number(parts[5] ?? '1') || 1;
  return { placement, turn, castling, enPassant, halfmove, fullmove };
}

export function formatFen(parts: FenParts): string {
  return [parts.placement, parts.turn, parts.castling || '-', parts.enPassant || '-', parts.halfmove, parts.fullmove].join(' ');
}

export function isValidPlacement(placement: string): boolean {
  const ranks = placement.split('/');
  if (ranks.length !== 8) return false;
  for (const rank of ranks) {
    let count = 0;
    for (const ch of rank) {
      if (/[1-8]/.test(ch)) count += parseInt(ch, 10);
      else if (/[prnbqkPRNBQK]/.test(ch)) count += 1;
      else return false;
    }
    if (count !== 8) return false;
  }
  return true;
}

/** Replace only the placement field of a FEN, preserving the rest. */
export function withPlacement(fen: string, placement: string): string {
  const parts = parseFen(fen);
  if (!parts) return `${placement} w KQkq - 0 1`;
  return formatFen({ ...parts, placement });
}

export function withTurn(fen: string, turn: 'w' | 'b'): string {
  const parts = parseFen(fen);
  if (!parts) return fen;
  return formatFen({ ...parts, turn });
}

/** Lichess analysis URL for a given FEN. Uses the format that Lichess routes reliably. */
export function lichessAnalysisUrl(fen: string): string {
  // Lichess accepts the FEN in the path with slashes preserved.
  return `https://lichess.org/analysis/${encodeURI(fen).replace(/%20/g, '_')}`;
}

/** Lichess editor URL (user can tweak position, then click analysis/play). */
export function lichessEditorUrl(fen: string): string {
  return `https://lichess.org/editor/${encodeURI(fen).replace(/%20/g, '_')}`;
}
