import { readFileSync } from 'fs';
import { join } from 'path';

export type ComplexityRankEntry = {
  rank: number;
  label: string;
  aliases: string[];
};

let cachedRankEntries: ComplexityRankEntry[] | null = null;

export function loadComplexityRanks() {
  if (cachedRankEntries) return cachedRankEntries;

  const candidates = [
    join(__dirname, 'data', 'complexity-rankings.json'),
    join(process.cwd(), 'src', 'evaluations', 'data', 'complexity-rankings.json'),
    join(process.cwd(), 'dist', 'evaluations', 'data', 'complexity-rankings.json'),
  ];

  for (const candidate of candidates) {
    try {
      const file = readFileSync(candidate, 'utf8');
      const parsed = JSON.parse(file) as { rankings?: ComplexityRankEntry[] };
      if (Array.isArray(parsed.rankings) && parsed.rankings.length) {
        cachedRankEntries = parsed.rankings;
        return cachedRankEntries;
      }
    } catch {
      // Try the next runtime path.
    }
  }

  throw new Error(
    `Complexity rankings file could not be loaded from: ${candidates.join(', ')}`,
  );
}

export function allowedComplexityRanks() {
  return loadComplexityRanks().map((entry) => entry.rank);
}

export function isKnownComplexityRank(rank: number) {
  return allowedComplexityRanks().includes(rank);
}
