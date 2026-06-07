"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_harness_service_1 = require("./test-harness.service");
describe('TestHarnessService', () => {
    const service = new test_harness_service_1.TestHarnessService();
    it('generates Python harnesses that dispatch non-dependency DSA inputs', async () => {
        const source = await service.buildSource({
            language: 'python',
            sourceCode: 'def minimum_delivery_times(n, roads):\n    return [0 for _ in range(n)]\n',
            questionId: 'dsa_amazon_delivery_routes',
            runType: 'run',
        });
        expect(source).toContain('matrix_value(input_str, "roads")');
        expect(source).toContain('invoke_user_func("dsa_amazon_delivery_routes"');
        expect(source).not.toContain('try_parse_input');
        expect(source).not.toContain('expected_lower.startswith("any")');
    });
    it('generates JavaScript harnesses without permissive valid/before auto-pass checks', async () => {
        const source = await service.buildSource({
            language: 'javascript',
            sourceCode: 'function resolveIncidents(n, dependencies) { return [...Array(n).keys()]; }',
            questionId: 'dsa_servicenow_incident_dependency',
            runType: 'run',
        });
        expect(source).toContain('compareTopologicalOrder');
        expect(source).toContain('invokeUserFunc("dsa_servicenow_incident_dependency"');
        expect(source).not.toContain('lower.startsWith("any")');
        expect(source).not.toContain('includes("before")');
    });
});
//# sourceMappingURL=test-harness.service.spec.js.map