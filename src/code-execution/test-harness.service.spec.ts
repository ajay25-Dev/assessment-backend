import { TestHarnessService } from './test-harness.service';

describe('TestHarnessService', () => {
  const service = new TestHarnessService();

  it('generates Python harnesses that dispatch non-dependency DSA inputs', async () => {
    const source = await service.buildSource({
      language: 'python',
      sourceCode:
        'def max_on_time_deliveries(n, roads, packages):\n    return 0\n',
      questionId: 'dsa_amazon_delivery_routes',
      runType: 'run',
    });

    expect(source).toContain('matrix_value(input_str, "roads")');
    expect(source).toContain('matrix_value(input_str, "packages")');
    expect(source).toContain('invoke_user_func("dsa_amazon_delivery_routes"');
    expect(source).toContain('max_on_time_deliveries');
    expect(source).not.toContain('try_parse_input');
    expect(source).not.toContain('expected_lower.startswith("any")');
  });

  it('generates JavaScript harnesses without permissive valid/before auto-pass checks', async () => {
    const source = await service.buildSource({
      language: 'javascript',
      sourceCode:
        'function resolveIncidents(n, dependencies) { return [...Array(n).keys()]; }',
      questionId: 'dsa_servicenow_incident_dependency',
      runType: 'run',
    });

    expect(source).toContain('compareOutputs');
    expect(source).toContain(
      'invokeUserFunc("dsa_servicenow_incident_dependency"',
    );
    expect(source).not.toContain('lower.startsWith("any")');
    expect(source).not.toContain('includes("before")');
  });

  it('generates a static OOPs harness for C++ submissions', async () => {
    const source = await service.buildSource({
      language: 'cpp',
      sourceCode: 'class OrderState { public: virtual bool canMoveTo() = 0; };',
      questionId: 'oops_food_delivery_order_state_machine',
      runType: 'submit',
    });

    expect(source).toContain('===TEST_RESULTS_START===');
    expect(source).toContain('std::cout');
    expect(source).not.toContain('int main() { return 0; }');
  });

  it('generates a static OOPs harness for simplified C++ submissions', async () => {
    const source = await service.buildSource({
      language: 'cpp',
      sourceCode: 'class NotificationChannel { public: virtual void send() = 0; };',
      questionId: 'oops_saas_notification_system',
      runType: 'submit',
    });

    expect(source).toContain('===TEST_RESULTS_START===');
    expect(source).toContain('std::cout');
    expect(source).not.toContain('Solution solution;');
  });

  it('does not expose OOPs test cases on run', async () => {
    const source = await service.buildSource({
      language: 'cpp',
      sourceCode: 'class NotificationChannel { public: virtual void send() = 0; };',
      questionId: 'oops_saas_notification_system',
      runType: 'run',
    });

    expect(source).not.toContain('===TEST_RESULTS_START===');
    expect(source).not.toContain('manager sends alert through email channel');
    expect(source).toContain('int main() { return 0; }');
  });

  it('generates a static OOPs harness for Java submissions', async () => {
    const source = await service.buildSource({
      language: 'java',
      sourceCode: 'public interface PaymentMethod { boolean pay(); }',
      questionId: 'oops_fintech_payment_gateway_routing',
      runType: 'submit',
    });

    expect(source).toContain('===TEST_RESULTS_START===');
    expect(source).toContain('System.out.println');
    expect(source).not.toContain(
      'class Main { public static void main(String[] args) {} }',
    );
  });
});
