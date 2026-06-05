import { Module } from '@nestjs/common';
import { EvaluationsModule } from '../evaluations/evaluations.module';
import { QuestionBankModule } from '../question-bank/question-bank.module';
import { AssessmentPipelineController } from './assessment-pipeline.controller';
import { AssessmentPipelineService } from './assessment-pipeline.service';

@Module({
  imports: [EvaluationsModule, QuestionBankModule],
  controllers: [AssessmentPipelineController],
  providers: [AssessmentPipelineService],
})
export class AssessmentPipelineModule {}
