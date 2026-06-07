import { DashboardEvaluationService } from './dashboard-evaluation.service';
import { DsaEvaluationService } from './dsa-evaluation.service';
import { McqEvaluationService } from './mcq-evaluation.service';
import { OopsEvaluationService } from './oops-evaluation.service';
import { SqlEvaluationService } from './sql-evaluation.service';
export declare class EvaluationsController {
    private readonly dsaEvaluation;
    private readonly sqlEvaluation;
    private readonly oopsEvaluation;
    private readonly mcqEvaluation;
    private readonly dashboardEvaluation;
    constructor(dsaEvaluation: DsaEvaluationService, sqlEvaluation: SqlEvaluationService, oopsEvaluation: OopsEvaluationService, mcqEvaluation: McqEvaluationService, dashboardEvaluation: DashboardEvaluationService);
    evaluateDsa(body: unknown): Promise<import("./evaluation.types").EvaluationResult>;
    evaluateSql(body: unknown): Promise<import("./evaluation.types").EvaluationResult>;
    evaluateOops(body: unknown): Promise<import("./evaluation.types").EvaluationResult>;
    evaluateMcq(body: unknown): Promise<import("./evaluation.types").EvaluationResult>;
    evaluateDashboard(body: unknown): Promise<import("./evaluation.types").EvaluationResult>;
}
