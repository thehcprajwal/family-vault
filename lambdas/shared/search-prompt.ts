import type { PersonRecord, CategoryRecord } from './types';

const SYSTEM_PROMPT = `Extract search slots from a document vault query. Return ONLY JSON:
{
  "person": "string or null — name or relationship term from the query",
  "category": "string or null — must match one of the provided category names exactly",
  "subcategory": "string or null — must match one of the provided subcategory names exactly",
  "keywords": ["array of keywords for text fallback search"]
}
Return ONLY valid JSON. No markdown, no explanation.`;

export function buildSearchPrompt(
  query: string,
  persons: PersonRecord[],
  categories: CategoryRecord[],
): { system: string; user: string } {
  const personsStr =
    persons.length > 0
      ? `Family members: ${persons.map((p) => `${p.displayName} (${p.relationship ?? 'unknown'})`).join(', ')}`
      : 'No family members registered.';

  const categoriesStr =
    categories.length > 0
      ? `Categories and subcategories:\n${categories
          .map((c) => `- ${c.name}${c.subcategories.length > 0 ? `: ${c.subcategories.join(', ')}` : ''}`)
          .join('\n')}`
      : 'Categories: Identity, Financial, Medical, Property, Vehicle, Legal, Educational, Other';

  const user = `${personsStr}
${categoriesStr}

User query: "${query}"

Extract the search slots.`;

  return { system: SYSTEM_PROMPT, user };
}
