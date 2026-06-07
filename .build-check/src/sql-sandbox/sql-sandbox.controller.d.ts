import { SqlSandboxService } from './sql-sandbox.service';
export declare class SqlSandboxController {
    private readonly sqlSandbox;
    constructor(sqlSandbox: SqlSandboxService);
    getSchema(questionId: string): Promise<{
        question_id: string;
        schema_sql: string;
        tables: {
            name: string;
        }[];
    }>;
    run(body: unknown): Promise<{
        question_id: string;
        mode: string;
        columns: string[];
        rows: any[];
        row_count: number | null;
        execution_ms: number;
        error?: undefined;
    } | {
        question_id: string;
        mode: string;
        columns: never[];
        rows: never[];
        row_count: number;
        execution_ms: number;
        error: string;
    }>;
    submit(body: unknown): Promise<{
        question_id: string;
        mode: string;
        columns: string[];
        rows: any[];
        row_count: number | null;
        execution_ms: number;
        error?: undefined;
    } | {
        question_id: string;
        mode: string;
        columns: never[];
        rows: never[];
        row_count: number;
        execution_ms: number;
        error: string;
    }>;
    getRun(id: string): {
        id: string;
        status: string;
    };
}
