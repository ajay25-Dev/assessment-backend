import { Injectable } from '@nestjs/common';
import {
  SQL_EVALUATOR_PROMPT,
  SQL_EVALUATOR_PROMPT_VERSION,
} from '../ai/prompts/sql-evaluator.v1';
import { sqlEvaluationOutputSchema } from '../ai/schemas/evaluation-output.schemas';
import { OpenAiClientService } from '../ai/openai-client.service';
import { BaseEvaluatorService } from './base-evaluator.service';

@Injectable()
export class SqlEvaluationService extends BaseEvaluatorService {
  constructor(aiClient: OpenAiClientService) {
    super(aiClient);
  }

  evaluate(input: unknown) {
    return this.evaluateWithPrompt({
      section: 'SQL',
      promptVersion: SQL_EVALUATOR_PROMPT_VERSION,
      schemaName: 'sql_evaluation',
      schema: sqlEvaluationOutputSchema,
      systemPrompt: SQL_EVALUATOR_PROMPT,
      input,
    });
  }
}
