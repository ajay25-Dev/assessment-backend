import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CodeExecutionService } from './code-execution.service';

@Controller('code')
export class CodeExecutionController {
  constructor(private readonly codeExecution: CodeExecutionService) {}

  @Get('languages')
  getLanguages() {
    return this.codeExecution.getLanguages();
  }

  @Post('warmup')
  warmup(@Body() body: { language?: string }) {
    return this.codeExecution.warmup(body?.language);
  }

  @Post('run')
  run(@Body() body: unknown) {
    return this.codeExecution.run(body as Record<string, unknown>, 'run');
  }

  @Post('submit')
  submit(@Body() body: unknown) {
    return this.codeExecution.run(body as Record<string, unknown>, 'submit');
  }

  @Get('runs/:id')
  getRun(@Param('id') id: string) {
    return {
      id,
      status: 'external-provider',
      message:
        'Run persistence is reserved for the assessment attempt store integration.',
    };
  }
}
