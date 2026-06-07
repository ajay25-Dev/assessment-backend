import { OpenAiClientService } from '../ai/openai-client.service';
import { BaseEvaluatorService } from './base-evaluator.service';
export declare class SqlEvaluationService extends BaseEvaluatorService {
    constructor(aiClient: OpenAiClientService);
    evaluate(input: unknown): Promise<import("./evaluation.types").EvaluationResult>;
}
