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
    const sqlSandbox = {
      run: jest.fn(),
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
        config as never,
        questionBank as never,
        dsaEvaluation as never,
        sqlEvaluation as never,
        sqlSandbox as never,
        oopsEvaluation as never,
        mcqEvaluation as never,
        dashboardEvaluation as never,
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

  it('persists the dashboard report during final submission', async () => {
    const { service, questionBank } = makeService();
    questionBank.getBank.mockResolvedValue({
      assessment: { duration_minutes: 120 },
    });

    const upsertAssessmentAttempt = jest
      .spyOn(service as any, 'upsertAssessmentAttempt')
      .mockResolvedValue('attempt-123');
    const persistDashboardReport = jest
      .spyOn(service as any, 'persistDashboardReport')
      .mockResolvedValue({ id: 'report-123' });

    await expect(
      service.finalize({
        student_id: 'student-a',
        assessment_id: 'assessment-a',
        answers: {},
      }),
    ).resolves.toEqual({
      attempt_id: 'attempt-123',
      status: 'finalized',
    });

    expect(upsertAssessmentAttempt).toHaveBeenCalledTimes(1);
    expect(persistDashboardReport).toHaveBeenCalledWith(
      'attempt-123',
      expect.objectContaining({
        student_id: 'student-a',
        assessment_id: 'assessment-a',
        answers: {},
      }),
      expect.objectContaining({
        assessment: { duration_minutes: 120 },
      }),
    );
  });
});
