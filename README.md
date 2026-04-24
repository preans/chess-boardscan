# BoardScan

Mobile-first PWA that reads a chess position from a photo and opens it in Lichess analysis.

Photograph a physical 3D board *or* a screenshot of any digital board (Lichess, Chess.com, a book, an app) → get a FEN → one tap opens the position in Lichess with the engine running.

## Architecture

```
Browser (PWA)  →  /api/ocr (Cloudflare Pages Function)  →  OpenRouter vision model
                  (holds OPENROUTER_API_KEY;
                   rate limits via Cloudflare KV)
```

Same pattern as the sister Scoresheet app — the OpenRouter API key never reaches the browser. Per-IP and global daily rate limits bound cost.

## Deploy to Cloudflare Pages

```bash
npm install
npx wrangler login
npx wrangler kv namespace create RATE_LIMITS
```

Paste the returned namespace id into `wrangler.toml` (replace `REPLACE_WITH_KV_NAMESPACE_ID`), then:

```bash
npm run deploy
```

First deploy creates the Pages project. After it exists:

1. Dashboard → **Pages → boardscan → Settings → Variables and Secrets**
2. Add:
   - `OPENROUTER_API_KEY` (Secret) — from https://openrouter.ai/keys
   - `ALLOWED_ORIGINS` — your production origin, e.g. `https://boardscan.paulreaney.com`
3. Optional:
   - `OPENROUTER_MODEL` — defaults to `google/gemini-2.5-pro`. Use `google/gemini-2.5-flash` for faster/cheaper
   - `RATE_LIMIT_IP_PER_DAY` (default 20) / `RATE_LIMIT_TOTAL_PER_DAY` (default 500)
4. **Deployments → latest → Retry deployment** so env vars take effect
5. **Custom domains** → add `boardscan.paulreaney.com` (one-click since DNS is already on Cloudflare)

## Local development

```bash
cp .dev.vars.example .dev.vars   # edit with your key
npm install
npm start                        # runs vite + wrangler pages dev
```

Open **http://localhost:8788** (not :5173 — that's Vite alone, no functions).

## How it works

1. User snaps a photo of a board. HEIC from iOS is auto-converted to JPEG.
2. Image is downscaled to 1400px max, JPEG-encoded, POSTed to `/api/ocr`.
3. Function calls an OpenRouter vision model with a FEN-extraction prompt.
4. Client validates the returned FEN structurally, loads it into an **interactive draggable board** (`react-chessboard`).
5. User fixes any OCR mistakes — drag pieces to move, tap a palette piece + tap a square to add/replace, eraser + tap to clear.
6. Toggle whose turn, then **Open in Lichess** opens `lichess.org/analysis/<FEN>` with engine loaded.

## Tips for best OCR

- Board fills most of the frame, shot from above if possible (less perspective distortion)
- Even lighting — avoid strong shadows across ranks
- Standard Staunton pieces work best; ornamental sets are harder for the model
- For online-board screenshots: crop to just the board before uploading
