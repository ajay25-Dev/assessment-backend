import { Injectable } from '@nestjs/common';
import {
  DASHBOARD_EVALUATOR_PROMPT,
  DASHBOARD_EVALUATOR_PROMPT_VERSION,
} from '../ai/prompts/dashboard-evaluator.v1';
import { dashboardEvaluationOutputSchema } from '../ai/schemas/evaluation-output.schemas';
import { OpenAiClientService } from '../ai/openai-client.service';
import { BaseEvaluatorService } from './base-evaluator.service';

@Injectable()
export class DashboardEvaluationService extends BaseEvaluatorService {
  constructor(aiClient: OpenAiClientService) {
    super(aiClient);
  }

  evaluate(input: unknown) {
    return this.evaluateWithPrompt({
      section: 'DASHBOARD',
      promptVersion: DASHBOARD_EVALUATOR_PROMPT_VERSION,
      schemaName: 'dashboard_evaluation',
      schema: dashboardEvaluationOutputSchema,
      systemPrompt: DASHBOARD_EVALUATOR_PROMPT,
      input,
    });
  }
}
