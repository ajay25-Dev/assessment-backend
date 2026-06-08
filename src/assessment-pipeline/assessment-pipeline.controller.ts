import { Body, Controller, Param, Post } from '@nestjs/common';
import { AssessmentPipelineService } from './assessment-pipeline.service';

@Controller('assessment')
export class AssessmentPipelineController {
  constructor(private readonly pipeline: AssessmentPipelineService) {}

  @Post('finalize')
  finalize(@Body() body: unknown) {
    return this.pipeline.finalize(body);
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
