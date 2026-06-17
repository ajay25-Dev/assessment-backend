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

// Normalized scoring rank used for percentage comparisons.
// Higher is better: 10 = O(1), 1 = O(n!) or worse, 0 = unavailable/unknown.
export function complexityScoreRankFromDetailedRank(rank: number) {
  if (!Number.isFinite(rank) || rank <= 0) return 0;
  if (rank <= 1) return 10;
  if (rank <= 3) return 9;
  if (rank <= 9) return 8;
  if (rank <= 12) return 7;
  if (rank <= 19) return 6;
  if (rank <= 23) return 5;
  if (rank <= 35) return 4;
  if (rank <= 37) return 3;
  if (rank === 38) return 2;
  if (rank <= 49) return 1;
  return 0;
}

export function complexityScoreFromRanks(expectedRank: number, studentRank: number) {
  if (!Number.isFinite(expectedRank) || !Number.isFinite(studentRank)) return 0;
  if (expectedRank <= 0 || studentRank <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((studentRank / expectedRank) * 100)));
}
