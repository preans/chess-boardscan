interface Env {
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL?: string;
  ALLOWED_ORIGINS?: string;
  RATE_LIMIT_IP_PER_DAY?: string;
  RATE_LIMIT_TOTAL_PER_DAY?: string;
  RATE_LIMITS: KVNamespace;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPT = `You are an expert at reading chess positions from photos.

INPUT: one photo of a chess board. It may be:
- A physical 3D board (any angle, any piece style, any lighting)
- A digital screenshot from Lichess, Chess.com, a book, an app, etc.

TASK: output the position in FEN notation (piece placement field is what matters most; other fields can be sensibly defaulted).

RULES:
- Output strictly valid JSON matching the schema. No prose, no markdown, no code fences.
- Detect board orientation: figure out which corner is a1. Convention: a1 is a dark square at White's bottom-left. On 3D photos, find the side that looks like White at setup.
- Use standard FEN piece letters: uppercase = White (K Q R B N P), lowercase = black (k q r b n p). Empty squares = digits 1-8 per rank.
- FEN ranks are listed from rank 8 down to rank 1, separated by "/".
- Each rank: concatenate pieces and run-length-encoded empty squares. e.g. "r1bqkbnr" or "4P3".
- WHOSE TURN: usually impossible to tell from a still position. Default to "w". If a clock is visible and one side is clearly running, use that. Note reasoning in notes.
- CASTLING: assume "KQkq" unless a king or rook has clearly moved from its home square.
- EN PASSANT: always "-".
- HALFMOVE CLOCK: always 0.
- FULLMOVE NUMBER: always 1.
- If the image doesn't clearly show a chess position, set fen to null and explain in notes.
- If some squares are ambiguous (glare, occlusion, unusual pieces), make your best guess and list ambiguous squares in notes using algebraic coordinates (e.g. "f3 unclear — bishop or knight?").

CRITICAL: piece placement must have exactly 8 ranks separated by "/", and each rank must describe exactly 8 squares.

Output schema:
{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "confidence": "high" | "medium" | "low",
  "notes": "optional — ambiguities, orientation reasoning, whose turn reasoning"
}`;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const err = (status: number, error: string) => jsonResponse(status, { error });

function clientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function extractJson(text: string): { fen?: unknown; confidence?: unknown; notes?: unknown } {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) {
      try {
        return JSON.parse(fence[1]);
      } catch {
        /* fall through */
      }
    }
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first !== -1 && last > first) {
      try {
        return JSON.parse(trimmed.slice(first, last + 1));
      } catch {
        /* fall through */
      }
    }
    throw new Error('Could not parse JSON from model output');
  }
}

// Structural FEN sanity check — doesn't validate legality, just shape.
function isStructurallyValidFen(fen: string): boolean {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 1 || parts.length > 6) return false;
  const ranks = parts[0].split('/');
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

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  if (request.method !== 'POST') {
    return err(405, 'Method not allowed');
  }

  const allowedOrigins = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = request.headers.get('origin') ?? '';
  if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
    return err(403, 'Forbidden origin');
  }

  if (!env.OPENROUTER_API_KEY) {
    return err(500, 'Server not configured (missing OPENROUTER_API_KEY)');
  }
  const model = env.OPENROUTER_MODEL || 'google/gemini-2.5-pro';
  const maxPerIp = Number(env.RATE_LIMIT_IP_PER_DAY ?? '20');
  const maxTotal = Number(env.RATE_LIMIT_TOTAL_PER_DAY ?? '500');

  let body: { image?: unknown };
  try {
    body = await request.json();
  } catch {
    return err(400, 'Invalid JSON');
  }
  const image = body.image;
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    return err(400, 'Expected field "image" as a data: URL (image/jpeg or image/png)');
  }
  if (image.length > 3_500_000) {
    return err(413, 'Image too large — downscale further on client');
  }

  const ip = clientIp(request);
  const date = todayKey();
  const ipKey = `${date}:ip:${ip}`;
  const totalKey = `${date}:total`;
  const ttl = 60 * 60 * 48;

  const [ipCountRaw, totalCountRaw] = await Promise.all([
    env.RATE_LIMITS.get(ipKey),
    env.RATE_LIMITS.get(totalKey),
  ]);
  const ipCount = Number(ipCountRaw ?? '0') || 0;
  const totalCount = Number(totalCountRaw ?? '0') || 0;

  if (totalCount >= maxTotal) {
    return err(429, 'Daily service limit reached. Try again tomorrow.');
  }
  if (ipCount >= maxPerIp) {
    return err(429, `Daily limit reached for your IP (${maxPerIp} requests/day).`);
  }

  const upstreamBody = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Read the chess position from this image. Return a FEN.' },
          { type: 'image_url', image_url: { url: image } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  };

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': origin || 'https://boardscan.local',
        'X-Title': 'BoardScan',
      },
      body: JSON.stringify(upstreamBody),
    });
  } catch (e) {
    return err(502, `Upstream fetch failed: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    return err(502, `OpenRouter ${upstream.status}: ${text.slice(0, 400)}`);
  }

  const data: unknown = await upstream.json().catch(() => null);
  const text = (data as { choices?: Array<{ message?: { content?: string } }> } | null)?.choices?.[0]?.message?.content;
  if (!text) {
    return err(502, 'Empty response from model');
  }

  let parsed: { fen?: unknown; confidence?: unknown; notes?: unknown };
  try {
    parsed = extractJson(text);
  } catch (e) {
    return err(502, e instanceof Error ? e.message : 'Parse error');
  }

  const fen = typeof parsed.fen === 'string' ? parsed.fen.trim() : null;
  const confidence = typeof parsed.confidence === 'string' ? parsed.confidence : undefined;
  const notes = typeof parsed.notes === 'string' ? parsed.notes : undefined;

  if (!fen || !isStructurallyValidFen(fen)) {
    return jsonResponse(200, { fen: null, confidence, notes: notes ?? 'Could not produce a valid FEN.' });
  }

  context.waitUntil(
    Promise.all([
      env.RATE_LIMITS.put(ipKey, String(ipCount + 1), { expirationTtl: ttl }),
      env.RATE_LIMITS.put(totalKey, String(totalCount + 1), { expirationTtl: ttl }),
    ]).catch(() => {}),
  );

  return jsonResponse(200, { fen, confidence, notes });
};
