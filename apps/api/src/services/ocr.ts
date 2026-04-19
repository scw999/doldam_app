import type { Env } from '../types';

// 혼인관계증명서에서 찾아야 할 키워드
const DIVORCE_KEYWORDS = ['이혼', '혼인해소', '재판상 이혼'];

export interface OcrResult {
  matched: boolean;
  reason?: string;
  rawText?: string;
}

// Google Vision API: images:annotate (DOCUMENT_TEXT_DETECTION)
// https://cloud.google.com/vision/docs/ocr
export async function runOcr(env: Env, r2Key: string): Promise<OcrResult> {
  const obj = await env.DOLDAM_R2.get(r2Key);
  if (!obj) return { matched: false, reason: 'r2_object_missing' };

  const bytes = await obj.arrayBuffer();
  const base64 = bufferToBase64(new Uint8Array(bytes));

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${env.GOOGLE_VISION_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            imageContext: { languageHints: ['ko'] },
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('[ocr] vision error', res.status, err);
    return { matched: false, reason: `vision_http_${res.status}` };
  }

  const body = await res.json<{
    responses: Array<{ fullTextAnnotation?: { text?: string } }>;
  }>();
  const text = body.responses?.[0]?.fullTextAnnotation?.text ?? '';
  const matched = DIVORCE_KEYWORDS.some((k) => text.includes(k));

  return { matched, rawText: text };
}

function bufferToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(bin);
}
