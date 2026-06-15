import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import {
  DSA_COMPLEXITY_PROMPT,
  DSA_COMPLEXITY_PROMPT_VERSION,
} from '../ai/prompts/dsa-complexity.v1';
import {
  DSA_APPROACH_PROMPT,
  DSA_APPROACH_PROMPT_VERSION,
} from '../ai/prompts/dsa-approach.v1';
import {
  DSA_EXPECTED_CODE_PROMPT,
  DSA_EXPECTED_CODE_PROMPT_VERSION,
} from '../ai/prompts/dsa-expected-code.v1';
import {
  dsaApproachOutputSchema,
  dsaComplexityOutputSchema,
  dsaExpectedCodeOutputSchema,
} from '../ai/schemas/evaluation-output.schemas';
import { OpenAiClientService } from '../ai/openai-client.service';
import { BaseEvaluatorService } from './base-evaluator.service';
import {
  isKnownComplexityRank,
  loadComplexityRanks,
} from './complexity-ranks';
import { evaluateDsaSubmission } from './dsa-deterministic-evaluator';

type DsaComplexityOutput = {
  student_time_complexity_rank: number;
  student_space_complexity_rank: number;
};

type DsaApproachOutput = {
  detected_tags: string[];
};

type DsaExpectedCodeOutput = {
  expected_code_score: number;
};

@Injectable()
export class DsaEvaluationService extends BaseEvaluatorService {
  private readonly logger = new Logger(DsaEvaluationService.name);

  constructor(aiClient: OpenAiClientService) {
    super(aiClient);
  }

  async evaluate(input: unknown) {
    this.logger.log('Starting DSA evaluation');
    const [complexitySelection, expectedCodeScore, detectedApproachTags] = await Promise.all([
      this.extractComplexitySelection(input),
      this.extractExpectedCodeScore(input),
      this.extractApproachTags(input),
    ]);
    this.logger.log(
      `DSA complexity selected: timeRank=${complexitySelection.student_time_complexity_rank}, spaceRank=${complexitySelection.student_space_complexity_rank}`,
    );
    this.logger.log(
      `DSA expected code score selected: ${expectedCodeScore === null ? 'fallback' : expectedCodeScore}`,
    );
    this.logger.log(
      `DSA approach tags selected: ${detectedApproachTags.length ? detectedApproachTags.join(', ') : 'none'}`,
    );
    return evaluateDsaSubmission({
      ...(this.asRecord(input) || {}),
      student_time_complexity_rank: complexitySelection.student_time_complexity_rank,
      student_space_complexity_rank:
        complexitySelection.student_space_complexity_rank,
      expected_code_score: expectedCodeScore ?? undefined,
      detected_approach_tags: detectedApproachTags,
    });
  }

  private async extractComplexitySelection(input: unknown): Promise<DsaComplexityOutput> {
    const record = this.asRecord(input);
    this.logger.log(
      `Preparing DSA complexity prompt with question length=${String([record.question_title, record.prompt].filter(Boolean).join('\n\n')).length} and submitted_code length=${String(record.submitted_code || '').length}`,
    );
    const rankTable = loadComplexityRanks().map((entry) => ({
      rank: entry.rank,
      label: entry.label,
      aliases: entry.aliases,
    }));
    this.logger.log(
      `DSA complexity rank input: count=${rankTable.length}, first=${rankTable[0]?.rank}:${rankTable[0]?.label}, last=${rankTable[rankTable.length - 1]?.rank}:${rankTable[rankTable.length - 1]?.label}`,
    );
    const output = await this.evaluateWithPrompt({
      section: 'DSA',
      promptVersion: DSA_COMPLEXITY_PROMPT_VERSION,
      schemaName: 'dsa_complexity_extraction',
      schema: dsaComplexityOutputSchema,
      systemPrompt: DSA_COMPLEXITY_PROMPT,
      input: {
        complexity_rankings: rankTable,
        question: [record.question_title, record.prompt].filter(Boolean).join('\n\n'),
        submitted_code: record.submitted_code,
      },
    });
    this.logger.log(`Raw DSA complexity output: ${JSON.stringify(output.output)}`);

    const parsed = this.asComplexityOutput(output.output);
    this.logger.log(
      `Validated DSA complexity output: timeRank=${parsed.student_time_complexity_rank}, spaceRank=${parsed.student_space_complexity_rank}`,
    );
    if (!isKnownComplexityRank(parsed.student_time_complexity_rank)) {
      throw new InternalServerErrorException(
        'Invalid DSA time complexity returned by the model',
      );
    }
    if (!isKnownComplexityRank(parsed.student_space_complexity_rank)) {
      throw new InternalServerErrorException(
        'Invalid DSA space complexity returned by the model',
      );
    }

    return parsed;
  }

  private async extractApproachTags(input: unknown): Promise<string[]> {
    const record = this.asRecord(input);
    const expectedApproach = this.stringList(record.expected_approach);

    if (!expectedApproach.length) {
      throw new InternalServerErrorException(
        'DSA approach extraction requires expected_approach',
      );
    }

    this.logger.log(
      `Preparing DSA approach prompt with question length=${String([record.question_title, record.prompt].filter(Boolean).join('\n\n')).length}, submitted_code length=${String(record.submitted_code || '').length}, expected_approach count=${expectedApproach.length}`,
    );
    const output = await this.evaluateWithPrompt({
      section: 'DSA',
      promptVersion: DSA_APPROACH_PROMPT_VERSION,
      schemaName: 'dsa_approach_extraction',
      schema: dsaApproachOutputSchema,
      systemPrompt: DSA_APPROACH_PROMPT,
      input: {
        question: [record.question_title, record.prompt].filter(Boolean).join('\n\n'),
        submitted_code: record.submitted_code,
        allowed_expected_approach_tags: expectedApproach,
      },
    });
    this.logger.log(`Raw DSA approach output: ${JSON.stringify(output.output)}`);

    const parsed = this.asApproachOutput(output.output);
    this.logger.log(
      `Validated DSA approach output: detectedTags=${parsed.detected_tags.length}`,
    );
    return parsed.detected_tags;
  }

  private async extractExpectedCodeScore(input: unknown): Promise<number | null> {
    const record = this.asRecord(input);
    const expectedCode = this.stringList(record.expected_code);

    if (!expectedCode.length) {
      this.logger.log(
        'Skipping DSA expected-code prompt because expected_code is empty',
      );
      return null;
    }

    try {
      this.logger.log(
        `Preparing DSA expected-code prompt with question length=${String([record.question_title, record.prompt].filter(Boolean).join('\n\n')).length}, submitted_code length=${String(record.submitted_code || '').length}, expected_code count=${expectedCode.length}`,
      );
      const output = await this.evaluateWithPrompt({
        section: 'DSA',
        promptVersion: DSA_EXPECTED_CODE_PROMPT_VERSION,
        schemaName: 'dsa_expected_code_extraction',
        schema: dsaExpectedCodeOutputSchema,
        systemPrompt: DSA_EXPECTED_CODE_PROMPT,
        input: {
          question: [record.question_title, record.prompt].filter(Boolean).join('\n\n'),
          submitted_code: record.submitted_code,
          expected_code: expectedCode,
        },
      });
      this.logger.log(`Raw DSA expected-code output: ${JSON.stringify(output.output)}`);

      const parsed = this.asExpectedCodeOutput(output.output);
      this.logger.log(
        `Validated DSA expected-code output: expectedCodeScore=${parsed.expected_code_score}`,
      );
      return parsed.expected_code_score;
    } catch (error) {
      this.logger.warn(
        `DSA expected-code extraction failed, falling back to deterministic heuristic: ${this.errorMessage(error)}`,
      );
      return null;
    }
  }

  private asRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private stringList(value: unknown): string[] {
    return Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : [];
  }

  private asComplexityOutput(value: unknown): DsaComplexityOutput {
    const record = this.asRecord(value);
    return {
      student_time_complexity_rank: this.rankValue(
        record.student_time_complexity_rank,
      ),
      student_space_complexity_rank: this.rankValue(
        record.student_space_complexity_rank,
      ),
    };
  }

  private asApproachOutput(value: unknown): DsaApproachOutput {
    const record = this.asRecord(value);
    return {
      detected_tags: this.normalizeTags(this.stringList(record.detected_tags)),
    };
  }

  private asExpectedCodeOutput(value: unknown): DsaExpectedCodeOutput {
    const record = this.asRecord(value);
    return {
      expected_code_score: this.percentageValueOrThrow(
        record.expected_code_score,
        'DSA expected-code score',
      ),
    };
  }

  private percentageValueOrThrow(value: unknown, label = 'DSA percentage') {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
      throw new InternalServerErrorException(
        `Invalid ${label} returned by the model`,
      );
    }
    return parsed;
  }

  private rankValue(value: unknown) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
      throw new InternalServerErrorException(
        'Invalid DSA complexity rank returned by the model',
      );
    }
    return parsed;
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private normalizeTags(value: string[]) {
    return [...new Set(value.map((item) => this.normalizeTag(item)).filter(Boolean))];
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
