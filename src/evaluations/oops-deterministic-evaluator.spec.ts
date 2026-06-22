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
  it('scores from submitted source when structured OOPs test results are missing', () => {
    const result = evaluateOopsSubmission({
      question_id: 'oops_fintech_payment_gateway_routing',
      question_title: 'Payment Gateway Routing Scenario',
      expected_oops_tags: [
        'class-design',
        'payment-abstraction',
        'strategy-pattern',
        'polymorphism',
        'open-closed',
        'result-object',
      ],
      required_classes: [
        'payment-method-interface',
        'upi-payment',
        'credit-card-payment',
        'wallet-payment',
        'net-banking-payment',
        'payment-result',
        'checkout-service',
      ],
      required_abstractions: ['payment-method-interface'],
      required_patterns: ['strategy-pattern'],
      red_flag_tags: [
        'procedural-payment-switch',
        'checkout-knows-concrete-types',
        'missing-validation',
        'ambiguous-payment-result',
      ],
      hidden_test_cases: [
        {
          id: 'hidden_1',
          purpose: 'UPI payment validates and processes successfully',
          tags: [
            'strategy-pattern',
            'payment-abstraction',
            'polymorphism',
            'validation-before-processing',
          ],
        },
        {
          id: 'hidden_2',
          purpose: 'New payment method works through the same abstraction',
          tags: ['open-closed', 'dependency-inversion', 'extensibility'],
        },
        {
          id: 'hidden_3',
          purpose: 'Payment result communicates success or failure clearly',
          tags: ['result-object', 'controlled-failure', 'class-design'],
        },
      ],
      submitted_code: `
interface PaymentMethod { validate(amount: number): boolean; process(amount: number): PaymentResult; }
class PaymentResult { constructor(public success: boolean, public message: string) {} }
class UpiPayment implements PaymentMethod { validate(amount: number) { return amount > 0; } process(amount: number) { return this.validate(amount) ? new PaymentResult(true, 'success') : new PaymentResult(false, 'invalid amount'); } }
class CreditCardPayment implements PaymentMethod { validate(amount: number) { return amount > 0; } process(amount: number) { return this.validate(amount) ? new PaymentResult(true, 'success') : new PaymentResult(false, 'validation failure'); } }
class WalletPayment implements PaymentMethod { validate(amount: number) { return amount > 0; } process(amount: number) { return this.validate(amount) ? new PaymentResult(true, 'success') : new PaymentResult(false, 'failure'); } }
class NetBankingPayment implements PaymentMethod { validate(amount: number) { return amount > 0; } process(amount: number) { return this.validate(amount) ? new PaymentResult(true, 'success') : new PaymentResult(false, 'failure'); } }
class CheckoutService { checkout(method: PaymentMethod, amount: number) { return method.process(amount); } }
`,
    });

    const output = result.output as Record<string, unknown>;
    expect(output.overall_question_score).toBeGreaterThan(0);
    expect(output.abstraction_score).toBeGreaterThan(0);
    expect(output.encapsulation_score).toBeNull();
    expect(output.polymorphism_score).toBeGreaterThan(0);
    expect(output.missing_components).not.toEqual(
      expect.arrayContaining(['payment-abstraction', 'strategy-pattern', 'polymorphism', 'encapsulation']),
    );
    expect(output.key_weaknesses).not.toEqual(
      expect.arrayContaining(['Encapsulation needs work.']),
    );
  });
  it('scores a complete SaaS notification OOPs design at 100', () => {
    const result = evaluateOopsSubmission({
      question_id: 'oops_saas_notification_system',
      question_title: 'SaaS Notification System',
      expected_oops_tags: [
        'class-design',
        'notification-abstraction',
        'interface',
        'polymorphism',
        'composition',
        'open-closed',
        'encapsulation',
      ],
      hidden_test_cases: [
        {
          id: 'hidden_1',
          purpose: 'Email channel receives alert through common interface',
          tags: ['notification-abstraction', 'polymorphism', 'interface'],
        },
        {
          id: 'hidden_2',
          purpose: 'Multiple active channels receive the same alert',
          tags: ['composition', 'broadcast', 'polymorphism'],
        },
        {
          id: 'hidden_3',
          purpose: 'New channel can be added without notification manager changes',
          tags: ['open-closed', 'extensibility', 'notification-abstraction'],
        },
        {
          id: 'hidden_4',
          purpose: 'Disabled channel does not receive future alerts',
          tags: ['dynamic-channel-management', 'encapsulation', 'controlled-state', 'disabled-channel-skipped'],
        },
        {
          id: 'hidden_5',
          purpose: 'Manager handles empty active channel list gracefully',
          tags: ['controlled-failure', 'edge-case-handling', 'class-design', 'encapsulation', 'controlled-state', 'no-active-channel-handling'],
        },
        {
          id: 'hidden_6',
          purpose: 'Manager does not branch on concrete channel types',
          tags: ['dependency-inversion', 'open-closed', 'separation-of-concerns', 'single-responsibility'],
        },
      ],
      submitted_code: `
interface NotificationChannel { send(alert: string): void; }
class EmailChannel implements NotificationChannel { send(alert: string) {} }
class SmsChannel implements NotificationChannel { send(alert: string) {} }
class SlackChannel implements NotificationChannel { send(alert: string) {} }
class WhatsAppChannel implements NotificationChannel { send(alert: string) {} }
class NotificationManager {
  private channels: Map<string, { channel: NotificationChannel; enabled: boolean }> = new Map();
  add(name: string, channel: NotificationChannel) { this.channels.set(name, { channel, enabled: true }); }
  enable(name: string) { const entry = this.channels.get(name); if (entry) entry.enabled = true; }
  disable(name: string) { const entry = this.channels.get(name); if (entry) entry.enabled = false; }
  notify(alert: string) {
    const active = [...this.channels.values()].filter(entry => entry.enabled);
    if (active.length === 0) return;
    active.forEach(entry => entry.channel.send(alert));
  }
}
`,
    });

    const output = result.output as Record<string, unknown>;
    expect(output.abstraction_score).toBe(100);
    expect(output.encapsulation_score).toBe(100);
    expect(output.polymorphism_score).toBe(100);
    expect(output.solid_principles_score).toBe(100);
    expect(output.overall_question_score).toBe(100);
  });
});