import { Module } from '@nestjs/common';
import { SqlSandboxController } from './sql-sandbox.controller';
import { SqlSandboxService } from './sql-sandbox.service';
import { SqlSafetyService } from './sql-safety.service';

@Module({
  controllers: [SqlSandboxController],
  providers: [SqlSandboxService, SqlSafetyService],
  exports: [SqlSandboxService],
})
export class SqlSandboxModule {}
