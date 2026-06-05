import { Injectable } from '@nestjs/common';
import {
  OOPS_EVALUATOR_PROMPT,
  OOPS_EVALUATOR_PROMPT_VERSION,
} from '../ai/prompts/oops-evaluator.v1';
import { oopsEvaluationOutputSchema } from '../ai/schemas/evaluation-output.schemas';
import { OpenAiClientService } from '../ai/openai-client.service';
import { BaseEvaluatorService } from './base-evaluator.service';

@Injectable()
export class OopsEvaluationService extends BaseEvaluatorService {
  constructor(aiClient: OpenAiClientService) {
    super(aiClient);
  }

  evaluate(input: unknown) {
    return this.evaluateWithPrompt({
      section: 'OOPs',
      promptVersion: OOPS_EVALUATOR_PROMPT_VERSION,
      schemaName: 'oops_evaluation',
      schema: oopsEvaluationOutputSchema,
      systemPrompt: OOPS_EVALUATOR_PROMPT,
      input,
    });
  }
}
