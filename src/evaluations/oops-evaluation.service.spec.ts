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
        test_results: Array.from({ length: 20 }, (_, index) => ({
          id: index < 5 ? `open_${index + 1}` : `hidden_${index + 1}`,
          passed: index !== 18,
          purpose: index === 18 ? 'Stress invalid transition handling' : 'Structured OOPs check',
          tags:
            index < 5
              ? ['class-design', 'payment-abstraction', 'strategy-pattern']
              : ['open-closed', 'validation-with-strategy', 'result-object'],
        })),
        total: 20,
        passed: 19,
      },
    });

    const output = result.output as Record<string, unknown>;
    expect(output.overall_question_score).toEqual(expect.any(Number));
    expect(output.class_design_score).toBeGreaterThanOrEqual(80);
    expect(output.error_handling_score).toBeLessThan(100);
    expect(output.total_tests_passed).toBe('19 / 20');
    expect(output.evidence_reasoning_summary).toContain('structured OOPs test case');
  });
});
