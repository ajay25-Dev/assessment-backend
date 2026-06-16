import { Module } from '@nestjs/common';
import { EvaluationsModule } from '../evaluations/evaluations.module';
import { QuestionBankModule } from '../question-bank/question-bank.module';
import { SqlSandboxModule } from '../sql-sandbox/sql-sandbox.module';
import { AssessmentPipelineController } from './assessment-pipeline.controller';
import { AssessmentPipelineService } from './assessment-pipeline.service';

@Module({
  imports: [EvaluationsModule, QuestionBankModule, SqlSandboxModule],
  controllers: [AssessmentPipelineController],
  providers: [AssessmentPipelineService],
})
export class AssessmentPipelineModule {}
