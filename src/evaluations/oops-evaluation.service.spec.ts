import { OopsEvaluationService } from './oops-evaluation.service';

describe('OopsEvaluationService', () => {
  it('scores OOPs submissions from structured test cases without AI', async () => {
    const service = new OopsEvaluationService();
    const result = await service.evaluate({
      question_id: 'oops_razorpay_payments',
      question_title: 'Razorpay Multi-Mode Payment Processing System',
      expected_oops_tags: [
        'class-design',
        'payment-abstraction',
        'strategy-pattern',
        'factory-pattern',
        'polymorphism',
        'dependency-inversion',
        'open-closed',
        'validation-with-strategy',
        'result-object',
        'separation-of-concerns',
      ],
      required_classes: [
        'payment-method',
        'checkout-service',
        'card-payment',
        'upi-payment',
        'wallet-payment',
      ],
      required_abstractions: ['payment-method-interface'],
      required_patterns: ['strategy-pattern', 'factory-pattern'],
      required_solid_principles: [
        'single-responsibility',
        'open-closed',
        'dependency-inversion',
      ],
      required_error_cases: [
        'card-validation-failure',
        'upi-validation-failure',
        'wallet-insufficient-balance',
        'payment-processing-failure',
      ],
      required_design_rules: [
        'checkout-depends-on-abstraction',
        'validation-with-strategy',
        'service-delegates-to-strategy',
        'new-payment-mode-without-checkout-change',
      ],
      red_flag_tags: [
        'single-procedural-function',
        'type-switching',
        'public-mutable-state',
        'no-shared-abstraction',
        'no-error-handling',
        'new-type-requires-core-change',
        'no-class-structure',
      ],
      test_results: {
        test_results: [
          {
            id: 'hidden_1',
            passed: true,
            purpose: 'Abstraction',
            tags: ['payment-abstraction', 'interface'],
          },
          {
            id: 'hidden_2',
            passed: true,
            purpose: 'Controlled state',
            tags: ['controlled-state'],
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
            tags: ['strategy-pattern'],
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
            tags: ['single-responsibility'],
          },
        ],
        total: 8,
        passed: 7,
      },
    });

    const output = result.output as Record<string, unknown>;
    expect(output.overall_question_score).toEqual(expect.any(Number));
    expect(output.class_design_score).toBeUndefined();
    expect(output.abstraction_score).toBeGreaterThanOrEqual(80);
    expect(output.encapsulation_score).toBeGreaterThanOrEqual(80);
    expect(output.polymorphism_score).toBeGreaterThanOrEqual(80);
    expect(output.solid_principles_score).toBeLessThan(100);
    expect(output.total_tests_passed).toBe('7 / 8');
    expect(output.evidence_reasoning_summary).toContain(
      'structured OOPs test case',
    );
  });
});
