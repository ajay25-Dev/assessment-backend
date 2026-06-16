import { Injectable } from '@nestjs/common';
import { evaluateOopsSubmission } from './oops-deterministic-evaluator';

@Injectable()
export class OopsEvaluationService {
  async evaluate(input: unknown) {
    return evaluateOopsSubmission(input);
  }
}
