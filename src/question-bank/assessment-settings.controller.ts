import { Body, Controller, Get, Patch } from '@nestjs/common';
import { QuestionBankService } from './question-bank.service';

@Controller('settings')
export class AssessmentSettingsController {
  constructor(private readonly questionBank: QuestionBankService) {}

  @Get('security')
  getSecurity() {
    return this.questionBank.getCurrentAssessmentSecurityPolicy();
  }

  @Patch('security')
  updateSecurity(@Body() body: unknown) {
    return this.questionBank.updateAssessmentSecurityPolicy(body);
  }
}
