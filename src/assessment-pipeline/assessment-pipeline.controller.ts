import { Body, Controller, Post } from '@nestjs/common';
import { AssessmentPipelineService } from './assessment-pipeline.service';

@Controller('assessment')
export class AssessmentPipelineController {
  constructor(private readonly pipeline: AssessmentPipelineService) {}

  @Post('finalize')
  finalize(@Body() body: unknown) {
    return this.pipeline.finalize(body);
  }
}
