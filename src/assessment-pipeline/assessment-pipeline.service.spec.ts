import { NotFoundException } from '@nestjs/common';
import { AssessmentPipelineService } from './assessment-pipeline.service';

describe('AssessmentPipelineService', () => {
  function makeService() {
    const securityPolicy = {
      tab_switch_protection_enabled: true,
      max_tab_switch_events: 2,
      auto_submit_on_max_events: true,
      camera_proctoring_enabled: true,
      max_camera_events: 2,
      auto_submit_on_camera_events: true,
      copy_paste_block_enabled: true,
      inspect_mode_block_enabled: true,
      restart_timer_on_login: true,
    };
    const config = {
      get: jest.fn(),
    };
    const questionBank = {
      getBank: jest.fn(),
      getAssessmentSecurityPolicy: jest.fn().mockReturnValue(securityPolicy),
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

  it('bootsraps an in-progress assessment session by resuming the existing timer and incrementing reset metadata', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-18T03:00:00.000Z'));

    try {
      const { service, questionBank } = makeService();
      questionBank.getBank.mockResolvedValue({
        assessment: {
          id: 'assessment-a',
          duration_minutes: 180,
          security: {},
        },
      });

      const findLatestAssessmentAttempt = jest
        .spyOn(service as any, 'findLatestAssessmentAttempt')
        .mockResolvedValue({
          id: 'attempt-123',
          status: 'in_progress',
          started_at: '2026-06-18T01:00:00.000Z',
          client_metadata: {
            session_reset_count: 1,
            session_started_at: '2026-06-18T01:00:00.000Z',
            original_started_at: '2026-06-18T01:00:00.000Z',
          },
        });

      const upsertAssessmentAttempt = jest
        .spyOn(service as any, 'upsertAssessmentAttempt')
        .mockResolvedValue('attempt-123');

      const response = await service.bootstrapSession({
        student_id: 'student-a',
        student_email: 'student@example.com',
        assessment_id: 'assessment-a',
      });

      expect(findLatestAssessmentAttempt).toHaveBeenCalledWith(
        'student-a',
        'assessment-a',
      );
      expect(upsertAssessmentAttempt).toHaveBeenCalledTimes(1);
      expect(upsertAssessmentAttempt.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          student_id: 'student-a',
          student_email: 'student@example.com',
          assessment_id: 'assessment-a',
          started_at: '2026-06-18T01:00:00.000Z',
          session_started_at: '2026-06-18T01:00:00.000Z',
          session_reset_count: 2,
          timer_policy: 'resume_on_login',
        }),
      );
      expect(response).toEqual(
        expect.objectContaining({
          attempt_id: 'attempt-123',
          assessment_id: 'assessment-a',
          duration_minutes: 180,
          started_at: '2026-06-18T01:00:00.000Z',
          status: 'disqualified',
          timer_policy: 'resume_on_login',
          can_resume: false,
          session_reset_count: 2,
          security: expect.objectContaining({
            tab_switch_protection_enabled: true,
            camera_proctoring_enabled: true,
            copy_paste_block_enabled: true,
            inspect_mode_block_enabled: true,
            restart_timer_on_login: true,
          }),
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
