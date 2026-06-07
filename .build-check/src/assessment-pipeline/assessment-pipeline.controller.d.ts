import { AssessmentPipelineService } from './assessment-pipeline.service';
export declare class AssessmentPipelineController {
    private readonly pipeline;
    constructor(pipeline: AssessmentPipelineService);
    finalize(body: unknown): Promise<{
        attempt_id: string;
        report_id: unknown;
        report: Record<string, unknown>;
        dashboard_evaluation: import("../ai/ai.types").JsonObject;
    }>;
}
