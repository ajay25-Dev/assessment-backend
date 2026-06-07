import { Judge0Adapter } from './judge0.adapter';
import { TestHarnessService } from './test-harness.service';
type CodeRunInput = {
    attempt_id?: string;
    question_id?: string;
    language?: string;
    source_code?: string;
    stdin?: string;
    run_type?: 'run' | 'submit';
};
export declare class CodeExecutionService {
    private readonly judge0;
    private readonly harness;
    constructor(judge0: Judge0Adapter, harness: TestHarnessService);
    getLanguages(): {
        id: string;
        label: string;
        judge0_language_id: number;
    }[];
    warmup(languageId?: string): Promise<{
        warmed: {
            language: string;
            status: "rejected" | "fulfilled";
        }[];
    }>;
    run(input: CodeRunInput, runType: 'run' | 'submit'): Promise<{
        test_results: unknown;
        token?: string;
        status?: {
            id?: number;
            description?: string;
        };
        stdout?: string | null;
        stderr?: string | null;
        compile_output?: string | null;
        message?: string | null;
        time?: string | null;
        memory?: number | null;
    }>;
    private extractTestResults;
}
export {};
