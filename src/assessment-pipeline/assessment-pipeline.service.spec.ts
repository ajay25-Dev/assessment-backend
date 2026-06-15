import { NotFoundException } from '@nestjs/common';
import { AssessmentPipelineService } from './assessment-pipeline.service';

describe('AssessmentPipelineService', () => {
  function makeService() {
    const config = {
      get: jest.fn(),
    };
    const questionBank = {
      getBank: jest.fn(),
    };
    const dsaEvaluation = {
      evaluate: jest.fn(),
    };
    const sqlEvaluation = {
      evaluate: jest.fn(),
    };
    const oopsEvaluation = {
      evaluate: jest.fn(),
    };
    const mcqEvaluation = {
      evaluate: jest.fn(),
    };
    const dashboardEvaluation = {
      evaluate: jest.fn(),
    };

    return {
      service: new AssessmentPipelineService(
        config,
        questionBank,
        dsaEvaluation,
        sqlEvaluation,
        oopsEvaluation,
        mcqEvaluation,
        dashboardEvaluation,
      ),
      questionBank,
    };
  }

  it('rejects finalize-stage processing when the attempt belongs to a different student', async () => {
    const { service, questionBank } = makeService();
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const eqStudentId = jest.fn().mockReturnValue({ maybeSingle });
    const eqAttemptId = jest.fn().mockReturnValue({ eq: eqStudentId });
    const select = jest.fn().mockReturnValue({ eq: eqAttemptId });
    const from = jest.fn().mockReturnValue({ select });
    jest.spyOn(service as any, 'getSupabase').mockReturnValue({ from } as never);

    await expect(
      service.processFinalizeStage('attempt-123', 'DASHBOARD', {
        student_id: 'student-a',
        assessment_id: 'assessment-a',
        answers: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(from).toHaveBeenCalledWith('student_assessment_attempts');
    expect(questionBank.getBank).not.toHaveBeenCalled();
  });
});
