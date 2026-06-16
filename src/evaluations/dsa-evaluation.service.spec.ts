import { DsaEvaluationService } from './dsa-evaluation.service';

describe('DsaEvaluationService', () => {
  function makeService() {
    return new DsaEvaluationService();
  }

  function makeResults(openPassed: number, hiddenPassed: number) {
    return {
      test_results: [
        ...Array.from({ length: 5 }, (_, index) => ({
          passed: index < openPassed,
        })),
        ...Array.from({ length: 15 }, (_, index) => ({
          passed: index < hiddenPassed,
        })),
      ],
      total: 20,
      passed: openPassed + hiddenPassed,
    };
  }

  it('derives deterministic complexity, code coverage, and approach tags without AI', async () => {
    const service = makeService();

    const result = await service.evaluate({
      question_id: 'dsa_servicenow_incident_dependency',
      question_title: 'Incident SLA Scheduling with Dependencies',
      prompt:
        'Use bitmask DP with prerequisite masking, cycle detection, subset transitions, and deadline-aware selection.',
      expected_approach: [
        'prerequisite-bitmask',
        'cycle-detection',
        'bitmask-dp',
        'subset-transition',
        'deadline-aware-selection',
      ],
      expected_time_complexity: 'O(n * 2^n)',
      expected_space_complexity: 'O(2^n)',
      expected_code: ['bitmask', 'dp', 'prerequisite'],
      submitted_code: `
        function maxOnTimeIncidents() {
          // bitmask dp prerequisite cycle detection subset transition deadline selection
          for (let i = 0; i < 1; i += 1) {
            for (let j = 0; j < 1; j += 1) {}
          }
          const mask = 0;
          const dp = [];
          return mask + dp.length;
        }
      `,
      status: 'submitted',
      run_count: 2,
      submit_count: 1,
      compiler_result_summary: 'Test results: 14/20 passed (70%)',
      open_test_cases: Array.from({ length: 5 }, (_, index) => ({
        id: `open_${index + 1}`,
        purpose: index === 2 ? 'Cycle detection' : `Open case ${index + 1}`,
      })),
      hidden_test_cases: Array.from({ length: 15 }, (_, index) => ({
        id: `hidden_${index + 6}`,
        purpose:
          index === 4
            ? 'Self dependency cycle'
            : index === 10
              ? 'Deadline boundary'
              : `Hidden case ${index + 6}`,
      })),
      testResults: makeResults(4, 10),
    });

    const output = result.output as Record<string, unknown>;

    expect(output.section).toBe('DSA');
    expect(output.open_test_case_score).toBe(80);
    expect(output.hidden_test_case_score).toBe(67);
    expect(output.expected_code_score).toBe(100);
    expect(output.approach_match_percentage).toBe(100);
    expect(output.expected_approach_used).toBe('Yes');
    expect(output.approach_score).toBe(100);
    expect(output.expected_approach_tags).toEqual([
      'prerequisite-bitmask',
      'cycle-detection',
      'bitmask-dp',
      'subset-transition',
      'deadline-aware-selection',
    ]);
    expect(output.ai_returned_approach_tags).toEqual([
      'prerequisite-bitmask',
      'cycle-detection',
      'bitmask-dp',
      'subset-transition',
      'deadline-aware-selection',
    ]);
    expect(output.expected_time_complexity_rank).toBe(36);
    expect(output.student_time_complexity_rank).toBe(36);
    expect(output.student_time_complexity_label).toBe('O(n * 2^n)');
    expect(output.time_complexity_rank_gap).toBe(0);
    expect(output.time_complexity_score).toBe(100);
    expect(output.expected_space_complexity_rank).toBe(35);
    expect(output.student_space_complexity_rank).toBe(35);
    expect(output.student_space_complexity_label).toBe('O(2^n)');
    expect(output.space_complexity_rank_gap).toBe(0);
    expect(output.space_complexity_score).toBe(100);
    expect(output.open_tests_passed).toBe('4 / 5');
    expect(output.hidden_tests_passed).toBe('10 / 15');
    expect(output.total_tests_passed).toBe('14 / 20');
  });

  it('marks hidden results as not available when only visible evidence exists', async () => {
    const service = makeService();

    const result = await service.evaluate({
      question_id: 'dsa_servicenow_incident_dependency',
      question_title: 'Incident SLA Scheduling with Dependencies',
      submitted_code: 'function maxOnTimeIncidents() { return 0; }',
      detected_approach_tags: [],
      status: 'submitted',
      run_count: 1,
      submit_count: 0,
      compiler_result_summary: 'Test results: 4/5 passed (80%)',
      open_test_cases: Array.from({ length: 5 }, (_, index) => ({
        id: `open_${index + 1}`,
        purpose: index === 2 ? 'Cycle detection' : `Open case ${index + 1}`,
      })),
      hidden_test_cases: Array.from({ length: 15 }, (_, index) => ({
        id: `hidden_${index + 6}`,
        purpose: index === 4 ? 'Self dependency cycle' : `Hidden case ${index + 6}`,
      })),
    });

    const output = result.output as Record<string, unknown>;

    expect(output.open_test_case_score).toBe(80);
    expect(output.hidden_test_case_score).toBe('Not available');
    expect(output.correctness_score).toBe(80);
    expect(output.hidden_tests_passed).toBe('Not available');
    expect(output.total_tests_passed).toBe('Not available');
  });
});
