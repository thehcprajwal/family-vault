import type { PersonMatch, PersonRecord } from './types';

// ── Relationship synonyms (Indian family context) ─────────────
const RELATIONSHIP_SYNONYMS: Record<string, string[]> = {
  father: ['appa', 'appa', 'papa', 'dad', 'daddy', 'nanna', 'baba', 'pitaji', 'achan'],
  mother: ['amma', 'mama', 'mom', 'mommy', 'mummy', 'maa', 'mataji', 'aai', 'amma'],
  grandfather: ['thatha', 'thata', 'thataa', 'dada', 'nana', 'ajja', 'babaji'],
  grandmother: ['paati', 'paatty', 'patti', 'dadi', 'nani', 'ajji', 'aajji'],
  brother: ['anna', 'bhai', 'bro', 'anna'],
  sister: ['akka', 'didi', 'sis', 'chechi'],
  son: ['magan', 'beta', 'son'],
  daughter: ['magal', 'beti', 'daughter'],
};

// Build reverse map: synonym → canonical relationship term
const SYNONYM_TO_REL = new Map<string, string>();
for (const [rel, synonyms] of Object.entries(RELATIONSHIP_SYNONYMS)) {
  SYNONYM_TO_REL.set(rel, rel); // canonical maps to itself
  for (const syn of synonyms) {
    SYNONYM_TO_REL.set(syn.toLowerCase(), rel);
  }
}

// ── Levenshtein distance ──────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function matchPerson(
  hint: string | null,
  persons: PersonRecord[],
): PersonMatch | null {
  if (!hint || persons.length === 0) return null;

  const hintLower = hint.toLowerCase().trim();

  // Layer 1 — Exact case-insensitive (confidenceMultiplier 1.0)
  const exact = persons.find((p) => p.displayName.toLowerCase() === hintLower);
  if (exact) {
    return { personId: exact.personId, displayName: exact.displayName, matchLayer: 'exact', confidenceMultiplier: 1.0 };
  }

  // Layer 2 — Relationship synonym match (confidenceMultiplier 0.9)
  const hintRel = SYNONYM_TO_REL.get(hintLower);
  if (hintRel) {
    for (const person of persons) {
      const personRel = SYNONYM_TO_REL.get(person.displayName.toLowerCase());
      if (personRel === hintRel) {
        return { personId: person.personId, displayName: person.displayName, matchLayer: 'synonym', confidenceMultiplier: 0.9 };
      }
    }
  }

  // Layer 3 — Levenshtein ≤ 2 (confidenceMultiplier 0.75)
  let best: PersonMatch | null = null;
  let bestDist = 3;
  for (const person of persons) {
    const dist = levenshtein(hintLower, person.displayName.toLowerCase());
    if (dist <= 2 && dist < bestDist) {
      bestDist = dist;
      best = { personId: person.personId, displayName: person.displayName, matchLayer: 'fuzzy', confidenceMultiplier: 0.75 };
    }
  }

  return best;
}
