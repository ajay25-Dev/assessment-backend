import { Body, Controller, Post } from '@nestjs/common';
import { DashboardEvaluationService } from './dashboard-evaluation.service';
import { DsaEvaluationService } from './dsa-evaluation.service';
import { McqEvaluationService } from './mcq-evaluation.service';
import { OopsEvaluationService } from './oops-evaluation.service';
import { SqlEvaluationService } from './sql-evaluation.service';

@Controller('evaluations')
export class EvaluationsController {
  constructor(
    private readonly dsaEvaluation: DsaEvaluationService,
    private readonly sqlEvaluation: SqlEvaluationService,
    private readonly oopsEvaluation: OopsEvaluationService,
    private readonly mcqEvaluation: McqEvaluationService,
    private readonly dashboardEvaluation: DashboardEvaluationService,
  ) {}

  @Post('dsa')
  evaluateDsa(@Body() body: unknown) {
    return this.dsaEvaluation.evaluate(body);
  }

  @Post('sql')
  evaluateSql(@Body() body: unknown) {
    return this.sqlEvaluation.evaluate(body);
  }

  @Post('oops')
  evaluateOops(@Body() body: unknown) {
    return this.oopsEvaluation.evaluate(body);
  }

  @Post('mcq')
  evaluateMcq(@Body() body: unknown) {
    return this.mcqEvaluation.evaluate(body);
  }

  @Post('dashboard')
  evaluateDashboard(@Body() body: unknown) {
    return this.dashboardEvaluation.evaluate(body);
  }
}
