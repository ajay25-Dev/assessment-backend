import { Module } from '@nestjs/common';
import { CodeExecutionController } from './code-execution.controller';
import { CodeExecutionService } from './code-execution.service';
import { Judge0Adapter } from './judge0.adapter';
import { TestHarnessService } from './test-harness.service';

@Module({
  controllers: [CodeExecutionController],
  providers: [CodeExecutionService, Judge0Adapter, TestHarnessService],
  exports: [CodeExecutionService],
})
export class CodeExecutionModule {}
