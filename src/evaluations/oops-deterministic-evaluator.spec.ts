import { evaluateOopsSubmission } from './oops-deterministic-evaluator';

describe('evaluateOopsSubmission', () => {
  const baseInput = {
    question_id: 'oops_canva_export',
    question_title: 'Canva Design Export System',
    expected_oops_tags: [
      'class-design',
      'exporter-abstraction',
      'composition',
      'strategy-pattern',
      'factory-pattern',
      'polymorphism',
      'open-closed',
      'unsupported-format-handling',
      'result-object',
      'separation-of-concerns',
    ],
    required_classes: [
      'design-file',
      'exporter',
      'pdf-exporter',
      'png-exporter',
      'jpg-exporter',
      'export-service',
    ],
    required_abstractions: ['exporter-interface'],
    required_patterns: ['strategy-or-factory-pattern'],
    required_solid_principles: [
      'single-responsibility',
      'open-closed',
      'dependency-inversion',
    ],
    required_error_cases: [
      'unsupported-format-handling',
      'export-failure-handling',
    ],
    required_design_rules: [
      'design-file-delegates-export',
      'explicit-export-settings',
      'service-delegates-to-strategy',
      'new-exporter-without-design-file-change',
    ],
    red_flag_tags: [
      'single-procedural-function',
      'type-switching',
      'public-mutable-state',
      'no-exporter-abstraction',
      'silent-failure',
      'new-type-requires-core-change',
      'no-class-structure',
    ],
  };

  it('calculates OOPs KPIs from structured test cases', () => {
    const result = evaluateOopsSubmission({
      ...baseInput,
      test_results: {
        test_results: [
          {
            id: 'hidden_1',
            passed: true,
            purpose: 'Abstraction',
            tags: ['exporter-abstraction', 'interface'],
          },
          {
            id: 'hidden_2',
            passed: true,
            purpose: 'Private state',
            tags: ['private-state', 'encapsulated-state'],
          },
          {
            id: 'hidden_3',
            passed: true,
            purpose: 'Polymorphism',
            tags: ['polymorphism', 'strategy-pattern'],
          },
          {
            id: 'hidden_4',
            passed: true,
            purpose: 'Strategy behavior',
            tags: ['strategy-pattern', 'polymorphism'],
          },
          {
            id: 'hidden_5',
            passed: true,
            purpose: 'Single responsibility',
            tags: ['single-responsibility'],
          },
          {
            id: 'hidden_6',
            passed: true,
            purpose: 'Dependency inversion',
            tags: ['dependency-inversion'],
          },
          {
            id: 'hidden_7',
            passed: false,
            purpose: 'Open closed',
            tags: ['open-closed'],
          },
          {
            id: 'hidden_8',
            passed: true,
            purpose: 'SOLID responsibility',
            tags: ['single-responsibility', 'dependency-inversion'],
          },
        ],
        total: 8,
        passed: 7,
      },
    });

    const output = result.output as Record<string, unknown>;
    expect(output.class_design_score).toBeUndefined();
    expect(output.abstraction_score).toBe(100);
    expect(output.encapsulation_score).toBe(100);
    expect(output.polymorphism_score).toBe(100);
    expect(output.solid_principles_score).toBeGreaterThan(70);
    expect(output.overall_question_score).toBeGreaterThan(75);
    expect(output.total_tests_passed).toBe('7 / 8');
  });

  it('marks a procedural answer as weak', () => {
    const result = evaluateOopsSubmission({
      ...baseInput,
      submitted_code: 'function exportDesign(format) { return format; }',
      test_results: {
        test_results: [
          {
            id: 'open_1',
            passed: false,
            purpose: 'Abstraction',
            tags: ['exporter-abstraction'],
          },
          {
            id: 'open_2',
            passed: false,
            purpose: 'Composition',
            tags: ['composition'],
          },
        ],
        total: 2,
        passed: 0,
      },
    });

    const output = result.output as Record<string, unknown>;
    expect(output.overall_question_score).toBeLessThanOrEqual(40);
    expect(output.design_maturity_label).toBe('Procedural');
    expect(output.red_flags).toEqual(
      expect.arrayContaining(['single-procedural-function']),
    );
  });
});
