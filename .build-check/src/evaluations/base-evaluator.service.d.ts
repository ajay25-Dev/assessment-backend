import { JsonSchema } from '../ai/ai.types';
import { OpenAiClientService } from '../ai/openai-client.service';
import { EvaluationResult, EvaluationSection } from './evaluation.types';
export declare abstract class BaseEvaluatorService {
    private readonly aiClient;
    protected constructor(aiClient: OpenAiClientService);
    protected evaluateWithPrompt(params: {
        section: EvaluationSection;
        promptVersion: string;
        schemaName: string;
        schema: JsonSchema;
        systemPrompt: string;
        input: unknown;
    }): Promise<EvaluationResult>;
    private assertJsonObject;
}
