import { Body, Controller, Get, Patch } from '@nestjs/common';
import { QuestionBankService } from './question-bank.service';

@Controller('question-bank')
export class QuestionBankController {
  constructor(private readonly questionBank: QuestionBankService) {}

  @Get()
  getBank() {
    return this.questionBank.getPublicBank();
  }

  @Get('import-preview')
  getImportPreview() {
    return this.questionBank.getImportPreview();
  }

  @Patch('security')
  updateSecurity(@Body() body: unknown) {
    return this.questionBank.updateAssessmentSecurityPolicy(body);
  }
}
