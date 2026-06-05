import { BadRequestException } from '@nestjs/common';
import { JsonObject, JsonSchema } from '../ai/ai.types';
import { OpenAiClientService } from '../ai/openai-client.service';
import { EvaluationResult, EvaluationSection } from './evaluation.types';

export abstract class BaseEvaluatorService {
  protected constructor(private readonly aiClient: OpenAiClientService) {}

  protected async evaluateWithPrompt(params: {
    section: EvaluationSection;
    promptVersion: string;
    schemaName: string;
    schema: JsonSchema;
    systemPrompt: string;
    input: unknown;
  }): Promise<EvaluationResult> {
    const input = this.assertJsonObject(params.input);

    const output = await this.aiClient.generateStructuredJson({
      schemaName: params.schemaName,
      schema: params.schema,
      systemPrompt: params.systemPrompt,
      input,
    });

    return {
      section: params.section,
      prompt_version: params.promptVersion,
      model: this.aiClient.model,
      output,
    };
  }

  private assertJsonObject(input: unknown): JsonObject {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Evaluation input must be a JSON object');
    }

    return input as JsonObject;
  }
}
