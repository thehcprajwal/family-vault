import Anthropic from '@anthropic-ai/sdk';
import type { ClaudeClassification, PersonRecord, CategoryRecord } from './types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_OCR_CHARS = 1500;

const SYSTEM_PROMPT = `You are a document classifier for an Indian family document vault.
Given OCR text from a scanned document, return ONLY a JSON object with these fields:
- personHint: string | null — the person this document belongs to. Use one of the provided family member names if it matches, otherwise infer from the document text, or null if unclear.
- category: string — document category (use one of the provided categories)
- subcategory: string | null — document subcategory if applicable, else null
- displayName: string — concise human-readable document name (e.g. "Aadhaar Card", "PAN Card", "Passport")
- confidence: number — 0.0 to 1.0, your confidence in this classification
- expiryDate: string | null — expiry date in YYYY-MM-DD format if present in the document, else null
- reasoning: string — one sentence explaining your classification

Return ONLY valid JSON. No explanation, no markdown, no other text.`;

export async function classifyDocument(
  ocrText: string,
  persons: PersonRecord[],
  categories: CategoryRecord[],
): Promise<ClaudeClassification | null> {
  if (!ocrText.trim()) return null;

  const truncated = ocrText.slice(0, MAX_OCR_CHARS);

  const personsStr =
    persons.length > 0
      ? `Family members: ${persons.map((p) => p.displayName).join(', ')}`
      : 'No family members registered yet — infer person from document if possible.';

  const categoriesStr =
    categories.length > 0
      ? `Document categories: ${categories
          .map((c) => {
            const subs = c.subcategories.length > 0 ? ` (${c.subcategories.join(', ')})` : '';
            return `${c.name}${subs}`;
          })
          .join('; ')}`
      : 'Categories: Identity (Aadhaar, PAN, Passport, Voter ID, Driving Licence), Financial (Bank Statement, ITR, Form 16), Medical (Prescription, Report, Insurance), Property (Sale Deed, Rental Agreement), Vehicle (RC, Insurance), Legal, Educational, Other';

  const userMessage = `${personsStr}
${categoriesStr}

OCR text:
---
${truncated}
---

Classify this document.`;

  return callWithRetry(userMessage, 0);
}

async function callWithRetry(userMessage: string, attempt: number): Promise<ClaudeClassification | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    try {
      return JSON.parse(text) as ClaudeClassification;
    } catch {
      if (attempt === 0) {
        // Retry once with a stricter prompt appended
        const stricterMessage = userMessage + '\n\nIMPORTANT: Return ONLY a raw JSON object. No markdown, no code fences, no explanation.';
        return callWithRetry(stricterMessage, 1);
      }
      console.error('Claude returned unparseable JSON after retry:', text);
      return null;
    }
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 429 && attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((res) => setTimeout(res, delay));
      return callWithRetry(userMessage, attempt + 1);
    }
    console.error('Claude classification failed:', err);
    return null;
  }
}
