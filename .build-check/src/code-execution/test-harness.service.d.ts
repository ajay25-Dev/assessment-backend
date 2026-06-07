type HarnessParams = {
    language: string;
    sourceCode: string;
    questionId: string;
    runType: 'run' | 'submit' | 'warmup';
};
export declare class TestHarnessService {
    buildSource(params: HarnessParams): Promise<string>;
    private loadTestCases;
    private wrapWithHarness;
    private normalizedTestCases;
    private escapedJsonForJava;
    private escapedJsonForCpp;
    private escapeJavaLiteral;
    private functionCandidates;
    private escapeCppLiteral;
    private javaHarness;
    private javaInvocation;
    private cppHarness;
    private cppInvocation;
    private cHarness;
    private cInvocation;
    private pythonHarness;
    private javascriptHarness;
}
export {};
