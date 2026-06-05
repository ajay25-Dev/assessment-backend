import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssessmentPipelineModule } from './assessment-pipeline/assessment-pipeline.module';
import { AuthModule } from './auth/auth.module';
import { CodeExecutionModule } from './code-execution/code-execution.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { QuestionBankModule } from './question-bank/question-bank.module';
import { SqlSandboxModule } from './sql-sandbox/sql-sandbox.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    AssessmentPipelineModule,
    EvaluationsModule,
    CodeExecutionModule,
    SqlSandboxModule,
    QuestionBankModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
