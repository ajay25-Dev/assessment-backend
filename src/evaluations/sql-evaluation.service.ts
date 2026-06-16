import { Injectable, Logger } from '@nestjs/common';
import { OpenAiClientService } from '../ai/openai-client.service';
import {
  SQL_CONCEPT_TAGS_PROMPT,
  SQL_CONCEPT_TAGS_PROMPT_VERSION,
} from '../ai/prompts/sql-concept-tags.v1';
import { sqlConceptTagsOutputSchema } from '../ai/schemas/evaluation-output.schemas';
import { BaseEvaluatorService } from './base-evaluator.service';
import { evaluateSqlSubmission } from './sql-deterministic-evaluator';

type SqlConceptTagsOutput = {
  detected_tags: string[];
};

@Injectable()
export class SqlEvaluationService extends BaseEvaluatorService {
  private readonly logger = new Logger(SqlEvaluationService.name);

  constructor(aiClient: OpenAiClientService) {
    super(aiClient);
  }

  async evaluate(input: unknown) {
    this.logger.log('Starting SQL evaluation');
    const conceptTags = await this.extractConceptTags(input);
    this.logger.log(
      `SQL concept tags selected: ${conceptTags.length ? conceptTags.join(', ') : 'none'}`,
    );

    return evaluateSqlSubmission({
      ...(this.asRecord(input) || {}),
      detected_sql_concept_tags: conceptTags,
    });
  }

  private async extractConceptTags(input: unknown): Promise<string[]> {
    const record = this.asRecord(input);
    const allowedConceptTags = this.stringList(record.expected_sql_concept_tags).length
      ? this.stringList(record.expected_sql_concept_tags)
      : this.stringList(record.expected_sql_concepts);

    if (!allowedConceptTags.length) {
      this.logger.log(
        'Skipping SQL concept tag prompt because expected_sql_concept_tags and expected_sql_concepts are empty',
      );
      return [];
    }

    try {
      this.logger.log(
        `Preparing SQL concept tag prompt with question length=${String([record.question_title, record.prompt].filter(Boolean).join('\n\n')).length}, submitted_query length=${String(record.submitted_query || '').length}, allowed_concept_count=${allowedConceptTags.length}`,
      );
      const output = await this.evaluateWithPrompt({
        section: 'SQL',
        promptVersion: SQL_CONCEPT_TAGS_PROMPT_VERSION,
        schemaName: 'sql_concept_tag_extraction',
        schema: sqlConceptTagsOutputSchema,
        systemPrompt: SQL_CONCEPT_TAGS_PROMPT,
        input: {
          question: [record.question_title, record.prompt].filter(Boolean).join('\n\n'),
          submitted_query: record.submitted_query,
          allowed_sql_concept_tags: allowedConceptTags,
        },
      });
      this.logger.log(`Raw SQL concept tag output: ${JSON.stringify(output.output)}`);

      const parsed = this.asConceptTagsOutput(output.output);
      this.logger.log(
        `Validated SQL concept tag output: detectedTags=${parsed.detected_tags.length}`,
      );
      return parsed.detected_tags;
    } catch (error) {
      this.logger.warn(
        `SQL concept tag extraction failed, falling back to deterministic concept matching: ${this.errorMessage(error)}`,
      );
      return [];
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

  private asConceptTagsOutput(value: unknown): SqlConceptTagsOutput {
    const record = this.asRecord(value);
    return {
      detected_tags: this.normalizeTags(this.stringList(record.detected_tags)),
    };
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
