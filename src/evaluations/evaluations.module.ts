import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { DashboardEvaluationService } from './dashboard-evaluation.service';
import { DsaEvaluationService } from './dsa-evaluation.service';
import { EvaluationsController } from './evaluations.controller';
import { McqEvaluationService } from './mcq-evaluation.service';
import { OopsEvaluationService } from './oops-evaluation.service';
import { SqlEvaluationService } from './sql-evaluation.service';

@Module({
  imports: [AiModule],
  controllers: [EvaluationsController],
  providers: [
    DsaEvaluationService,
    SqlEvaluationService,
    OopsEvaluationService,
    McqEvaluationService,
    DashboardEvaluationService,
  ],
})
export class EvaluationsModule {}
