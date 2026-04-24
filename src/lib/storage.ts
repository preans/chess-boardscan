const KEYS = {
  fen: 'boardscan.fen',
} as const;

export const storage = {
  getFen(): string | null {
    return localStorage.getItem(KEYS.fen);
  },
  setFen(fen: string) {
    localStorage.setItem(KEYS.fen, fen);
  },
  clearFen() {
    localStorage.removeItem(KEYS.fen);
  },
};
