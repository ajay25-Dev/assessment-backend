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
      'preview-exporter',
      'export-service',
    ],
    required_abstractions: ['exporter-interface'],
    required_patterns: ['strategy-or-factory-pattern'],
    required_solid_principles: [
      'single-responsibility',
      'open-closed',
      'dependency-inversion',
    ],
    required_error_cases: ['unsupported-format-handling', 'export-failure-handling'],
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
          { id: 'open_1', passed: true, purpose: 'Class design', tags: ['class-design', 'exporter-abstraction'] },
          { id: 'open_2', passed: true, purpose: 'Composition', tags: ['composition', 'separation-of-concerns'] },
          { id: 'open_3', passed: true, purpose: 'Unsupported format', tags: ['unsupported-format-handling', 'result-object'] },
          { id: 'open_4', passed: true, purpose: 'Factory registry', tags: ['factory-pattern', 'registry-pattern', 'open-closed'] },
          { id: 'open_5', passed: true, purpose: 'Polymorphism', tags: ['polymorphism', 'dependency-inversion'] },
          { id: 'hidden_6', passed: true, purpose: 'PDF export rules', tags: ['explicit-export-settings', 'result-object'] },
          { id: 'hidden_7', passed: true, purpose: 'PNG export rules', tags: ['explicit-export-settings', 'strategy-pattern'] },
          { id: 'hidden_8', passed: false, purpose: 'DWG export rules', tags: ['explicit-export-settings', 'composition'] },
          { id: 'hidden_9', passed: true, purpose: '3D export rules', tags: ['exporter-abstraction', 'strategy-pattern'] },
          { id: 'hidden_10', passed: true, purpose: 'Unsupported formats fail safely', tags: ['unsupported-format-handling', 'controlled-failure'] },
          { id: 'hidden_11', passed: true, purpose: 'New exporter extension', tags: ['new-exporter-without-design-file-change', 'factory-pattern'] },
          { id: 'hidden_12', passed: true, purpose: 'Delegation', tags: ['design-file-delegates-export', 'service-delegates-to-strategy'] },
          { id: 'hidden_13', passed: true, purpose: 'Separation', tags: ['separation-of-concerns', 'domain-service-boundary'] },
          { id: 'hidden_14', passed: true, purpose: 'Result object', tags: ['result-object', 'controlled-failure'] },
          { id: 'hidden_15', passed: true, purpose: 'Open closed', tags: ['open-closed', 'registry-pattern'] },
          { id: 'hidden_16', passed: true, purpose: 'Dependency inversion', tags: ['dependency-inversion', 'class-design'] },
          { id: 'hidden_17', passed: true, purpose: 'Error handling', tags: ['unsupported-format-handling', 'validation-separation'] },
          { id: 'hidden_18', passed: true, purpose: 'Readability', tags: ['code-readability', 'organization'] },
          { id: 'hidden_19', passed: true, purpose: 'Single responsibility', tags: ['single-responsibility', 'class-design'] },
          { id: 'hidden_20', passed: true, purpose: 'Final extension hook', tags: ['extension-hook', 'new-exporter-without-design-file-change'] },
        ],
        total: 20,
        passed: 19,
      },
    });

    const output = result.output as Record<string, unknown>;
    expect(output.class_design_score).toBeGreaterThan(80);
    expect(output.extensibility_score).toBeGreaterThan(70);
    expect(output.error_handling_score).toBeGreaterThan(70);
    expect(output.overall_question_score).toBeGreaterThan(75);
    expect(output.total_tests_passed).toBe('19 / 20');
  });

  it('marks a procedural answer as weak', () => {
    const result = evaluateOopsSubmission({
      ...baseInput,
      submitted_code: 'function exportDesign(format) { return format; }',
      test_results: {
        test_results: [
          { id: 'open_1', passed: false, purpose: 'Class design', tags: ['class-design'] },
          { id: 'open_2', passed: false, purpose: 'Composition', tags: ['composition'] },
        ],
        total: 2,
        passed: 0,
      },
    });

    const output = result.output as Record<string, unknown>;
    expect(output.overall_question_score).toBeLessThanOrEqual(40);
    expect(output.design_maturity_label).toBe('Procedural');
    expect(output.red_flags).toEqual(
      expect.arrayContaining(['no-class-structure', 'single-procedural-function']),
    );
  });
});
