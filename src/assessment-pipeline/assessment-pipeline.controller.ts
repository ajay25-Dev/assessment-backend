import { Body, Controller, Param, Post } from '@nestjs/common';
import { AssessmentPipelineService } from './assessment-pipeline.service';

@Controller('assessment')
export class AssessmentPipelineController {
  constructor(private readonly pipeline: AssessmentPipelineService) {}

  @Post('finalize')
  finalize(@Body() body: unknown) {
    return this.pipeline.finalize(body);
  }

  @Post('session')
  bootstrapSession(@Body() body: unknown) {
    return this.pipeline.bootstrapSession(body);
  }

  @Post('dsa/submit')
  persistDsaQuestionSubmission(@Body() body: unknown) {
    return this.pipeline.persistDsaQuestionSubmission(body);
  }

  @Post('sql/submit')
  persistSqlQuestionSubmission(@Body() body: unknown) {
    return this.pipeline.persistSectionQuestionSubmission('SQL', body);
  }

  @Post('oops/submit')
  persistOopsQuestionSubmission(@Body() body: unknown) {
    return this.pipeline.persistSectionQuestionSubmission('OOPs', body);
  }

  @Post('mcq/submit')
  persistMcqQuestionSubmission(@Body() body: unknown) {
    return this.pipeline.persistSectionQuestionSubmission('MCQ', body);
  }

  @Post('finalize/:attemptId/:stage')
  processFinalizeStage(
    @Param('attemptId') attemptId: string,
    @Param('stage') stage: string,
    @Body() body: unknown,
  ) {
    return this.pipeline.processFinalizeStage(attemptId, stage, body);
  }
}
