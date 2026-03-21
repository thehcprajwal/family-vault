import type { Block } from '@aws-sdk/client-textract';
import type { TextractResult } from './types';

// ── Thresholds ────────────────────────────────────────────────
const MIN_TEXT_LENGTH = 50;
const MIN_AVG_CONFIDENCE = 60;

// ── Allowed mime types ────────────────────────────────────────
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/webp',
  'application/pdf',
];

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export function extractTextFromBlocks(blocks: Block[]): TextractResult {
  const wordBlocks = blocks.filter((b) => b.BlockType === 'WORD');
  const lineBlocks = blocks.filter((b) => b.BlockType === 'LINE');

  const wordCount = wordBlocks.length;
  const text = lineBlocks.map((b) => b.Text ?? '').join('\n');
  const avgConfidence =
    wordCount > 0
      ? wordBlocks.reduce((sum, b) => sum + (b.Confidence ?? 0), 0) / wordCount
      : 0;

  const isPoorQuality = text.length < MIN_TEXT_LENGTH || avgConfidence < MIN_AVG_CONFIDENCE;

  return { text, avgConfidence, wordCount, isPoorQuality };
}
