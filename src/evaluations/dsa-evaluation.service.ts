import { Injectable } from '@nestjs/common';
import {
  DSA_EVALUATOR_PROMPT,
  DSA_EVALUATOR_PROMPT_VERSION,
} from '../ai/prompts/dsa-evaluator.v1';
import { dsaEvaluationOutputSchema } from '../ai/schemas/evaluation-output.schemas';
import { OpenAiClientService } from '../ai/openai-client.service';
import { BaseEvaluatorService } from './base-evaluator.service';

@Injectable()
export class DsaEvaluationService extends BaseEvaluatorService {
  constructor(aiClient: OpenAiClientService) {
    super(aiClient);
  }

  evaluate(input: unknown) {
    return this.evaluateWithPrompt({
      section: 'DSA',
      promptVersion: DSA_EVALUATOR_PROMPT_VERSION,
      schemaName: 'dsa_evaluation',
      schema: dsaEvaluationOutputSchema,
      systemPrompt: DSA_EVALUATOR_PROMPT,
      input,
    });
  }
}
