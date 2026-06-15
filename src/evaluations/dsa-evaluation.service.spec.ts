import { DsaEvaluationService } from './dsa-evaluation.service';

describe('DsaEvaluationService', () => {
  function makeService(generateStructuredJson: jest.Mock) {
    return new DsaEvaluationService({
      model: 'test-model',
      generateStructuredJson,
    } as never);
  }

  it('uses the AI approach tags when the extraction succeeds', async () => {
    const generateStructuredJson = jest.fn(async (request: { schemaName: string }) => {
      if (request.schemaName === 'dsa_complexity_extraction') {
        return {
          student_time_complexity_rank: 36,
          student_space_complexity_rank: 35,
        };
      }

      if (request.schemaName === 'dsa_expected_code_extraction') {
        return {
          expected_code_score: 92,
        };
      }

      if (request.schemaName === 'dsa_approach_extraction') {
        return {
          detected_tags: ['prerequisite-bitmask', 'cycle-detection'],
        };
      }

      throw new Error(`Unexpected schema ${request.schemaName}`);
    });
    const service = makeService(generateStructuredJson);

    const result = await service.evaluate({
      question_id: 'dsa_servicenow_incident_dependency',
      question_title: 'Incident SLA Scheduling with Dependencies',
      prompt:
        'Use bitmask DP with prerequisite masking, cycle detection, and subset transitions.',
      expected_approach: [
        'prerequisite-bitmask',
        'cycle-detection',
        'bitmask-dp',
      ],
      expected_time_complexity: 'O(n * 2^n)',
      expected_space_complexity: 'O(2^n)',
      expected_code: ['bitmask', 'dp', 'prerequisite'],
      submitted_code: 'function maxOnTimeIncidents() { const bitmask = 1; const dp = []; return bitmask + dp.length; }',
      status: 'submitted',
      run_count: 1,
      submit_count: 0,
      compiler_result_summary: 'Test results: 4/5 passed (80%)',
      open_test_cases: Array.from({ length: 5 }, (_, index) => ({
        id: `open_${index + 1}`,
        purpose: `Open case ${index + 1}`,
      })),
      hidden_test_cases: [],
      testResults: {
        test_results: Array.from({ length: 5 }, (_, index) => ({
          passed: index < 4,
        })),
        total: 5,
        passed: 4,
      },
    });

    const output = result.output as Record<string, unknown>;

    expect(output.approach_match_percentage).toBe(67);
    expect(output.expected_approach_used).toBe('Partial');
    expect(output.approach_score).toBe(67);
    expect(output.expected_approach_tags).toEqual([
      'prerequisite-bitmask',
      'cycle-detection',
      'bitmask-dp',
    ]);
    expect(output.ai_returned_approach_tags).toEqual([
      'prerequisite-bitmask',
      'cycle-detection',
    ]);
    expect(output.expected_code_score).toBe(92);
    expect(generateStructuredJson).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaName: 'dsa_approach_extraction',
      }),
    );
  });

  it('fails the evaluation when the AI approach extraction fails', async () => {
    const input = {
      question_id: 'dsa_servicenow_incident_dependency',
      question_title: 'Incident SLA Scheduling with Dependencies',
      prompt:
        'Use bitmask DP with prerequisite masking, cycle detection, and subset transitions.',
      expected_approach: [
        'prerequisite-bitmask',
        'cycle-detection',
        'bitmask-dp',
      ],
      expected_time_complexity: 'O(n * 2^n)',
      expected_space_complexity: 'O(2^n)',
      expected_code: ['bitmask', 'dp', 'prerequisite'],
      submitted_code: 'function maxOnTimeIncidents() { const bitmask = 1; const dp = []; return bitmask + dp.length; }',
      status: 'submitted',
      run_count: 1,
      submit_count: 0,
      compiler_result_summary: 'Test results: 4/5 passed (80%)',
      open_test_cases: Array.from({ length: 5 }, (_, index) => ({
        id: `open_${index + 1}`,
        purpose: `Open case ${index + 1}`,
      })),
      hidden_test_cases: [],
      testResults: {
        test_results: Array.from({ length: 5 }, (_, index) => ({
          passed: index < 4,
        })),
        total: 5,
        passed: 4,
      },
    };

    const generateStructuredJson = jest.fn(async (request: { schemaName: string }) => {
      if (request.schemaName === 'dsa_complexity_extraction') {
        return {
          student_time_complexity_rank: 36,
          student_space_complexity_rank: 35,
        };
      }

      if (request.schemaName === 'dsa_expected_code_extraction') {
        return {
          expected_code_score: 92,
        };
      }

      if (request.schemaName === 'dsa_approach_extraction') {
        throw new Error('approach extraction failed');
      }

      throw new Error(`Unexpected schema ${request.schemaName}`);
    });
    const service = makeService(generateStructuredJson);

    await expect(service.evaluate(input)).rejects.toThrow(
      'approach extraction failed',
    );
  });
});
