import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  DSA_COMPLEXITY_PROMPT,
  DSA_COMPLEXITY_PROMPT_VERSION,
} from '../ai/prompts/dsa-complexity.v1';
import {
  dsaComplexityOutputSchema,
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

@Injectable()
export class DsaEvaluationService extends BaseEvaluatorService {
  constructor(aiClient: OpenAiClientService) {
    super(aiClient);
  }

  async evaluate(input: unknown) {
    const complexityRanks = await this.extractComplexityRanks(input);
    return evaluateDsaSubmission({
      ...(this.asRecord(input) || {}),
      student_time_complexity_rank: complexityRanks.student_time_complexity_rank,
      student_space_complexity_rank:
        complexityRanks.student_space_complexity_rank,
    });
  }

  private async extractComplexityRanks(input: unknown): Promise<DsaComplexityOutput> {
    const record = this.asRecord(input);
    const output = await this.evaluateWithPrompt({
      section: 'DSA',
      promptVersion: DSA_COMPLEXITY_PROMPT_VERSION,
      schemaName: 'dsa_complexity_extraction',
      schema: dsaComplexityOutputSchema,
      systemPrompt: DSA_COMPLEXITY_PROMPT,
      input: {
        question_id: record.question_id,
        question_title: record.question_title,
        prompt: record.prompt,
        expected_approach: record.expected_approach,
        expected_code: record.expected_code,
        expected_time_complexity: record.expected_time_complexity,
        expected_space_complexity: record.expected_space_complexity,
        submitted_code: record.submitted_code,
        complexity_rankings: loadComplexityRanks(),
      },
    });

    const parsed = this.asComplexityOutput(output.output);
    if (!isKnownComplexityRank(parsed.student_time_complexity_rank)) {
      throw new InternalServerErrorException(
        'Invalid DSA time complexity rank returned by the model',
      );
    }
    if (!isKnownComplexityRank(parsed.student_space_complexity_rank)) {
      throw new InternalServerErrorException(
        'Invalid DSA space complexity rank returned by the model',
      );
    }

    return parsed;
  }

  private asRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
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

  private rankValue(value: unknown) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
      throw new InternalServerErrorException(
        'Invalid DSA complexity rank returned by the model',
      );
    }
    return parsed;
  }
}
