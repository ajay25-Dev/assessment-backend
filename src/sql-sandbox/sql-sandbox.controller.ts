import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SqlSandboxService } from './sql-sandbox.service';

@Controller('sql')
export class SqlSandboxController {
  constructor(private readonly sqlSandbox: SqlSandboxService) {}

  @Get('questions/:questionId/schema')
  getSchema(@Param('questionId') questionId: string) {
    return this.sqlSandbox.getSchema(questionId);
  }

  @Post('run')
  run(@Body() body: unknown) {
    return this.sqlSandbox.run(body as Record<string, unknown>, false);
  }

  @Post('submit')
  submit(@Body() body: unknown) {
    return this.sqlSandbox.run(body as Record<string, unknown>, true);
  }

  @Get('runs/:id')
  getRun(@Param('id') id: string) {
    return {
      id,
      status: 'stored-after-attempt-integration',
    };
  }
}
