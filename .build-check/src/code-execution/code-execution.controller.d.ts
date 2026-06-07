import { CodeExecutionService } from './code-execution.service';
export declare class CodeExecutionController {
    private readonly codeExecution;
    constructor(codeExecution: CodeExecutionService);
    getLanguages(): {
        id: string;
        label: string;
        judge0_language_id: number;
    }[];
    warmup(body: {
        language?: string;
    }): Promise<{
        warmed: {
            language: string;
            status: "rejected" | "fulfilled";
        }[];
    }>;
    run(body: unknown): Promise<{
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
    submit(body: unknown): Promise<{
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
    getRun(id: string): {
        id: string;
        status: string;
        message: string;
    };
}
