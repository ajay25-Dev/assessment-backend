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

  try {
    const file = readFileSync(
      join(__dirname, 'data', 'complexity-rankings.json'),
      'utf8',
    );
    const parsed = JSON.parse(file) as { rankings?: ComplexityRankEntry[] };
    cachedRankEntries = Array.isArray(parsed.rankings) && parsed.rankings.length
      ? parsed.rankings
      : [];
    return cachedRankEntries;
  } catch {
    cachedRankEntries = [];
    return cachedRankEntries;
  }
}

export function allowedComplexityRanks() {
  return loadComplexityRanks().map((entry) => entry.rank);
}

export function isKnownComplexityRank(rank: number) {
  return allowedComplexityRanks().includes(rank);
}
