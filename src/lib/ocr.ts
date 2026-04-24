const OCR_ENDPOINT = '/api/ocr';

export type OcrResult = {
  fen: string | null;
  confidence?: string;
  notes?: string;
};

export async function ocrBoard(image: Blob, opts?: { signal?: AbortSignal }): Promise<OcrResult> {
  const dataUrl = await blobToDataUrl(image);

  const res = await fetch(OCR_ENDPOINT, {
    method: 'POST',
    signal: opts?.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: dataUrl }),
  });

  let payload: { fen?: unknown; confidence?: unknown; notes?: unknown; error?: unknown } = {};
  try {
    payload = await res.json();
  } catch {
    // non-JSON body on infra failure
  }

  if (!res.ok) {
    const msg = typeof payload?.error === 'string' ? payload.error : `OCR request failed (${res.status})`;
    throw new Error(msg);
  }

  return {
    fen: typeof payload.fen === 'string' ? payload.fen : null,
    confidence: typeof payload.confidence === 'string' ? payload.confidence : undefined,
    notes: typeof payload.notes === 'string' ? payload.notes : undefined,
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

export async function downscaleImage(file: File, maxDim = 1400, quality = 0.85): Promise<Blob> {
  const decodable = await ensureDecodable(file);
  const bitmap = await createImageBitmap(decodable);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not supported');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('Image encode failed');
  return blob;
}

async function ensureDecodable(file: File): Promise<Blob> {
  const name = file.name.toLowerCase();
  const looksHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif');

  if (!looksHeic) return file;

  const { heicTo, isHeic } = await import('heic-to');
  try {
    if (!(await isHeic(file))) return file;
  } catch {
    // isHeic throws on some odd inputs — fall through and try conversion anyway
  }
  return heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
}
