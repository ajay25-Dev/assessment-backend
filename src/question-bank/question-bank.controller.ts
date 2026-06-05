import { Controller, Get } from '@nestjs/common';
import { QuestionBankService } from './question-bank.service';

@Controller('question-bank')
export class QuestionBankController {
  constructor(private readonly questionBank: QuestionBankService) {}

  @Get()
  getBank() {
    return this.questionBank.getBank();
  }

  @Get('import-preview')
  getImportPreview() {
    return this.questionBank.getImportPreview();
  }
}
