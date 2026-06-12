import {
  evaluateDsaSubmission,
  rankGapScore,
  resolveComplexityRank,
} from './dsa-deterministic-evaluator';

function makeResults(openPassed: number, hiddenPassed: number) {
  return {
    test_results: [
      ...Array.from({ length: 5 }, (_, index) => ({
        passed: index < openPassed,
      })),
      ...Array.from({ length: 10 }, (_, index) => ({
        passed: index < hiddenPassed,
      })),
    ],
    total: 15,
    passed: openPassed + hiddenPassed,
  };
}

describe('evaluateDsaSubmission', () => {
  it('scores visible and hidden tests deterministically when full submit data is available', () => {
    const result = evaluateDsaSubmission({
      question_id: 'dsa_servicenow_incident_dependency',
      question_title: 'Incident SLA Scheduling with Dependencies',
      prompt:
        'Use bitmask DP with prerequisite masking, cycle detection, and subset transitions.',
      expected_approach: [
        'Build prerequisite bitmasks for every incident',
        'Detect cycles using DFS/topological check',
        'Use bitmask DP over completed incident subsets',
        'For each subset, try unresolved incidents whose prerequisites are already completed',
        'Track best on-time count for each subset using total duration of the subset as completion time',
        'O(n * 2^n)',
      ],
      expected_time_complexity: 'O(n * 2^n)',
      expected_space_complexity: 'O(2^n)',
      expected_code: ['bitmask', 'dp', 'prerequisite', 'dfs', 'cycle', 'topological', 'subset'],
      student_time_complexity_rank: 36,
      student_space_complexity_rank: 35,
      submitted_code: `
        function maxOnTimeIncidents() {
          // bitmask dp prerequisite dfs cycle topological subset
          const mask = 0;
          const dp = [];
          return mask + dp.length;
        }
      `,
      status: 'submitted',
      run_count: 2,
      submit_count: 1,
      compiler_result_summary: 'Test results: 15/15 passed (100%)',
      open_test_cases: Array.from({ length: 5 }, (_, index) => ({
        id: `open_${index + 1}`,
        purpose: index === 2 ? 'Cycle detection' : `Open case ${index + 1}`,
      })),
      hidden_test_cases: Array.from({ length: 10 }, (_, index) => ({
        id: `hidden_${index + 6}`,
        purpose: index === 4 ? 'Self dependency cycle' : `Hidden case ${index + 6}`,
      })),
      testResults: makeResults(5, 0),
    });

    const output = result.output as Record<string, unknown>;

    expect(output.section).toBe('DSA');
    expect(output.open_test_case_score).toBe(100);
    expect(output.hidden_test_case_score).toBe(0);
    expect(output.expected_code_score).toBe(100);
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
    expect(output.edge_case_score).toBe(100);
    expect(output.total_tests_passed).toBe('5 / 15');
    expect(output.overall_question_score).toBe(100);
  });

  it('marks hidden results as not available when only visible evidence exists', () => {
    const result = evaluateDsaSubmission({
      question_id: 'dsa_servicenow_incident_dependency',
      question_title: 'Incident SLA Scheduling with Dependencies',
      submitted_code: 'function maxOnTimeIncidents() { return 0; }',
      status: 'submitted',
      run_count: 1,
      submit_count: 0,
      compiler_result_summary: 'Test results: 4/5 passed (80%)',
      open_test_cases: Array.from({ length: 5 }, (_, index) => ({
        id: `open_${index + 1}`,
        purpose: index === 2 ? 'Cycle detection' : `Open case ${index + 1}`,
      })),
      hidden_test_cases: Array.from({ length: 10 }, (_, index) => ({
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

  it('prefers explicit question-bank complexity values over inferred ones', () => {
    const result = evaluateDsaSubmission({
      question_id: 'dsa_servicenow_incident_dependency',
      question_title: 'Incident SLA Scheduling with Dependencies',
      prompt: 'Use the provided question-bank complexity values.',
      expected_approach: ['Use bitmask DP over subsets', 'Detect cycles using DFS'],
      expected_time_complexity: 'O(n^2)',
      expected_space_complexity: 'O(n)',
      student_time_complexity_rank: 16,
      student_space_complexity_rank: 9,
      submitted_code: 'function maxOnTimeIncidents() { for (let i = 0; i < 1; i += 1) {} return 0; }',
      status: 'submitted',
      run_count: 1,
      submit_count: 0,
      compiler_result_summary: 'Test results: 0/5 passed (0%)',
      open_test_cases: Array.from({ length: 5 }, (_, index) => ({
        id: `open_${index + 1}`,
        purpose: index === 2 ? 'Cycle detection' : `Open case ${index + 1}`,
      })),
      hidden_test_cases: Array.from({ length: 10 }, (_, index) => ({
        id: `hidden_${index + 6}`,
        purpose: index === 4 ? 'Self dependency cycle' : `Hidden case ${index + 6}`,
      })),
      testResults: makeResults(0, 0),
    });

    const output = result.output as Record<string, unknown>;

    expect(output.expected_time_complexity).toBe('O(n^2)');
    expect(output.expected_space_complexity).toBe('O(n)');
    expect(output.expected_time_complexity_rank).toBe(16);
    expect(output.expected_space_complexity_rank).toBe(9);
    expect(output.time_complexity_score).toBe(100);
    expect(output.space_complexity_score).toBe(100);
  });

  it('maps ranks into the requested gap-based score table', () => {
    expect(resolveComplexityRank('O(1)')).toBe(1);
    expect(resolveComplexityRank('O(n * 2^n)')).toBe(36);
    expect(resolveComplexityRank('O(2^n * n)')).toBe(36);
    expect(resolveComplexityRank('O(totalVersions)')).toBe(9);
    expect(rankGapScore(10, 10)).toBe(100);
    expect(rankGapScore(10, 11)).toBe(90);
    expect(rankGapScore(10, 12)).toBe(80);
    expect(rankGapScore(10, 9)).toBe(100);
  });
});
