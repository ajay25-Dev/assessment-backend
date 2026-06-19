import { Module } from '@nestjs/common';
import { AssessmentSettingsController } from './assessment-settings.controller';
import { QuestionBankController } from './question-bank.controller';
import { QuestionBankService } from './question-bank.service';

@Module({
  controllers: [QuestionBankController, AssessmentSettingsController],
  providers: [QuestionBankService],
  exports: [QuestionBankService],
})
export class QuestionBankModule {}
