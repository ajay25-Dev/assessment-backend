import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OpenAiClientService } from '../ai/openai-client.service';
import {
  DSA_APPROACH_PROMPT,
  DSA_APPROACH_PROMPT_VERSION,
} from '../ai/prompts/dsa-approach.v1';
import { dsaApproachOutputSchema } from '../ai/schemas/evaluation-output.schemas';
import { BaseEvaluatorService } from './base-evaluator.service';
import { evaluateDsaSubmission } from './dsa-deterministic-evaluator';

type DsaComplexityOutput = {
  student_time_complexity_rank: number;
  student_space_complexity_rank: number;
};

type JsonRecord = Record<string, unknown>;

@Injectable()
export class DsaEvaluationService extends BaseEvaluatorService {
  private readonly logger = new Logger(DsaEvaluationService.name);

  constructor(aiClient: OpenAiClientService) {
    super(aiClient);
  }

  async evaluate(input: unknown) {
    this.logger.log('Starting DSA evaluation');
    const record = this.asRecord(input);
    const complexitySelection = this.deriveComplexitySelection(record);
    const detectedApproachTags = await this.extractApproachTags(record);

    this.logger.log(
      `DSA complexity derived: timeRank=${complexitySelection.student_time_complexity_rank}, spaceRank=${complexitySelection.student_space_complexity_rank}`,
    );
    this.logger.log(
      `DSA approach tags returned by AI: ${detectedApproachTags.length ? detectedApproachTags.join(', ') : 'none'}`,
    );

    return evaluateDsaSubmission({
      ...record,
      student_time_complexity_rank: complexitySelection.student_time_complexity_rank,
      student_space_complexity_rank:
        complexitySelection.student_space_complexity_rank,
      detected_approach_tags: detectedApproachTags,
    });
  }

  private async extractApproachTags(record: JsonRecord) {
    const allowedApproachTags = this.normalizeTags(this.stringList(record.expected_approach));

    if (!allowedApproachTags.length) {
      throw new BadRequestException(
        'expected_approach must contain at least one allowed approach tag',
      );
    }

    const output = await this.evaluateWithPrompt({
      section: 'DSA',
      promptVersion: DSA_APPROACH_PROMPT_VERSION,
      schemaName: 'dsa_approach_tag_extraction',
      schema: dsaApproachOutputSchema,
      systemPrompt: DSA_APPROACH_PROMPT,
      input: {
        question: [record.question_title, record.prompt].filter(Boolean).join('\n\n'),
        submitted_code: String(record.submitted_code || ''),
        submitted_code_lines: this.numberedCodeLines(String(record.submitted_code || '')),
        allowed_expected_approach_tags: allowedApproachTags,
      },
    });

    this.logger.log(`Raw DSA approach tag output: ${JSON.stringify(output.output)}`);
    const parsed = this.asApproachTagsOutput(output.output, allowedApproachTags);
    this.logger.log(
      `Validated DSA approach tag output: detectedTags=${parsed.detected_tags.length}`,
    );

    return parsed.detected_tags;
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

  private numberedCodeLines(code: string) {
    return code
      .split(/\r?\n/)
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.trim().length > 0)
      .map(({ line, index }) => `${index + 1}: ${line.trimEnd()}`);
  }

  private normalizeTags(value: string[]) {
    return [...new Set(value.map((item) => this.normalizeTag(item)).filter(Boolean))];
  }

  private asApproachTagsOutput(value: unknown, allowedApproachTags: string[]) {
    const record = this.asRecord(value);
    const detectedTags = this.normalizeTags(this.stringList(record.detected_tags));

    if (!detectedTags.length) {
      throw new BadRequestException('DSA approach tag extraction returned no detected_tags');
    }

    const allowedSet = new Set(allowedApproachTags);
    const invalidTags = detectedTags.filter((tag) => !allowedSet.has(tag));

    if (invalidTags.length) {
      throw new BadRequestException(
        `DSA approach tag extraction returned tags outside the allowed set: ${invalidTags.join(', ')}`,
      );
    }

    return {
      detected_tags: detectedTags,
    };
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
