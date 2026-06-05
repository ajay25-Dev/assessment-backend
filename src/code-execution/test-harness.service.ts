import { Injectable } from '@nestjs/common';

@Injectable()
export class TestHarnessService {
  buildSource(params: {
    language: string;
    sourceCode: string;
    questionId: string;
    runType: 'run' | 'submit' | 'warmup';
  }) {
    // The first implementation preserves candidate source verbatim.
    // Function-signature harnesses can be added per question once the final
    // test-case JSON is locked.
    return params.sourceCode;
  }
}
