import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(DsaEvaluationService.name);

  constructor(aiClient: OpenAiClientService) {
    super(aiClient);
  }

  async evaluate(input: unknown) {
    this.logger.log('Starting DSA evaluation');
    const complexitySelection = await this.extractComplexitySelection(input);
    this.logger.log(
      `DSA complexity selected: timeRank=${complexitySelection.student_time_complexity_rank}, spaceRank=${complexitySelection.student_space_complexity_rank}`,
    );
    return evaluateDsaSubmission({
      ...(this.asRecord(input) || {}),
      student_time_complexity_rank: complexitySelection.student_time_complexity_rank,
      student_space_complexity_rank:
        complexitySelection.student_space_complexity_rank,
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
