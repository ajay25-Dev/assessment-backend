import { Injectable } from '@nestjs/common';
import {
  MCQ_EVALUATOR_PROMPT,
  MCQ_EVALUATOR_PROMPT_VERSION,
} from '../ai/prompts/mcq-evaluator.v1';
import { mcqEvaluationOutputSchema } from '../ai/schemas/evaluation-output.schemas';
import { OpenAiClientService } from '../ai/openai-client.service';
import { BaseEvaluatorService } from './base-evaluator.service';

@Injectable()
export class McqEvaluationService extends BaseEvaluatorService {
  constructor(aiClient: OpenAiClientService) {
    super(aiClient);
  }

  evaluate(input: unknown) {
    return this.evaluateWithPrompt({
      section: 'MCQ',
      promptVersion: MCQ_EVALUATOR_PROMPT_VERSION,
      schemaName: 'mcq_evaluation',
      schema: mcqEvaluationOutputSchema,
      systemPrompt: MCQ_EVALUATOR_PROMPT,
      input,
    });
  }
}
