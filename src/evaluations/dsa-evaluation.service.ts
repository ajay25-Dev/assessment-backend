import { Injectable, Logger } from '@nestjs/common';
import { evaluateDsaSubmission } from './dsa-deterministic-evaluator';

type DsaComplexityOutput = {
  student_time_complexity_rank: number;
  student_space_complexity_rank: number;
};

type JsonRecord = Record<string, unknown>;

@Injectable()
export class DsaEvaluationService {
  private readonly logger = new Logger(DsaEvaluationService.name);

  async evaluate(input: unknown) {
    this.logger.log('Starting DSA evaluation');
    const record = this.asRecord(input);
    const complexitySelection = this.deriveComplexitySelection(record);
    const detectedApproachTags = this.deriveApproachTags(record);

    this.logger.log(
      `DSA complexity derived: timeRank=${complexitySelection.student_time_complexity_rank}, spaceRank=${complexitySelection.student_space_complexity_rank}`,
    );
    this.logger.log(
      `DSA approach tags derived: ${detectedApproachTags.length ? detectedApproachTags.join(', ') : 'none'}`,
    );

    return evaluateDsaSubmission({
      ...record,
      student_time_complexity_rank: complexitySelection.student_time_complexity_rank,
      student_space_complexity_rank:
        complexitySelection.student_space_complexity_rank,
      detected_approach_tags: detectedApproachTags,
    });
  }

  private deriveComplexitySelection(record: JsonRecord): DsaComplexityOutput {
    const submittedCode = String(record.submitted_code || '');
    const normalizedCode = this.normalizeText(submittedCode);
    const lowerCode = submittedCode.toLowerCase();
    const loopCount = this.loopCount(submittedCode);
    const hasFactorial = this.containsAny(lowerCode, [
      /\bpermutation\b/,
      /\bfactorial\b/,
      /\bn!\b/,
      /branch\s*and\s*bound/,
    ]);
    const hasExponential = this.containsAny(normalizedCode, [
      /\bbitmask\b/,
      /\bsubset\b/,
      /\bmask\b/,
      /\bbacktrack\b/,
      /\bbacktracking\b/,
      /\bmemo\b/,
      /\bmemoization\b/,
      /\bdp\b/,
      /\bpowerset\b/,
    ]);
    const hasGraphOrQueue = this.containsAny(normalizedCode, [
      /\bgraph\b/,
      /\badjacency\b/,
      /\bdijkstra\b/,
      /\bheap\b/,
      /\bpriority\b/,
      /\bqueue\b/,
      /\btopolog\b/,
      /\bcycle\b/,
    ]);
    const hasSort = this.containsAny(normalizedCode, [/\bsort\b/, /\bsorted\b/]);
    const hasHashing = this.containsAny(normalizedCode, [
      /\bmap\b/,
      /\bset\b/,
      /\bhash\b/,
      /\bcache\b/,
    ]);
    const nestedLoops = loopCount >= 2;

    if (hasFactorial) {
      return {
        student_time_complexity_rank: 41,
        student_space_complexity_rank: 41,
      };
    }

    if (hasExponential) {
      return {
        student_time_complexity_rank: nestedLoops || hasHashing ? 36 : 35,
        student_space_complexity_rank: nestedLoops || hasHashing ? 35 : 36,
      };
    }

    if (hasGraphOrQueue || hasSort) {
      return {
        student_time_complexity_rank: nestedLoops ? 16 : 11,
        student_space_complexity_rank: nestedLoops ? 11 : 9,
      };
    }

    if (nestedLoops) {
      return {
        student_time_complexity_rank: 16,
        student_space_complexity_rank: 9,
      };
    }

    if (loopCount === 1) {
      return {
        student_time_complexity_rank: 9,
        student_space_complexity_rank: hasHashing ? 9 : 9,
      };
    }

    if (this.containsAny(normalizedCode, [/\brecurs\b/, /\bdfs\b/, /\bbacktrack\b/])) {
      return {
        student_time_complexity_rank: 16,
        student_space_complexity_rank: 16,
      };
    }

    return {
      student_time_complexity_rank: 1,
      student_space_complexity_rank: 1,
    };
  }

  private deriveApproachTags(record: JsonRecord) {
    const submittedCode = String(record.submitted_code || '');
    const normalizedCode = this.normalizeText(submittedCode);
    const lowerCode = submittedCode.toLowerCase();
    const expectedApproach = this.stringList(record.expected_approach);

    return expectedApproach.filter((tag) =>
      this.tagMatchesCode(tag, normalizedCode, lowerCode),
    );
  }

  private tagMatchesCode(tag: string, normalizedCode: string, lowerCode: string) {
    const normalizedTag = this.normalizeTag(tag);
    if (!normalizedTag) return false;

    const parts = normalizedTag.split('-').filter(Boolean);
    if (!parts.length) return false;

    const matchesPart = (part: string) =>
      normalizedCode.includes(part) || lowerCode.includes(part);

    if (parts.length === 1) {
      return matchesPart(parts[0]);
    }

    const matchedParts = parts.filter((part) => matchesPart(part)).length;
    return matchedParts >= Math.max(1, Math.ceil(parts.length * 0.6));
  }

  private asRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as JsonRecord)
      : {};
  }

  private stringList(value: unknown): string[] {
    return Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : [];
  }

  private containsAny(text: string, patterns: RegExp[]) {
    return patterns.some((pattern) => pattern.test(text));
  }

  private loopCount(code: string) {
    const matches = code.match(/\b(for|while)\b/g);
    return matches ? matches.length : 0;
  }

  private normalizeText(value: string) {
    return value
      .toLowerCase()
      .replace(/['"`]/g, ' ')
      .replace(/[^a-z0-9_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeTag(value: string) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');
  }
}
