import { JsonObject } from '../ai/ai.types';
export type EvaluationSection = 'DSA' | 'SQL' | 'OOPs' | 'MCQ' | 'DASHBOARD';
export type EvaluationResult = {
    section: EvaluationSection;
    prompt_version: string;
    model: string;
    output: JsonObject;
};
