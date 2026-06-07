import { ConfigService } from '@nestjs/config';
import { SqlSafetyService } from './sql-safety.service';
type SqlRunInput = {
    attempt_id?: string;
    question_id?: string;
    query?: string;
    mode?: 'visible' | 'hidden';
};
export declare class SqlSandboxService {
    private readonly config;
    private readonly safety;
    private pool?;
    constructor(config: ConfigService, safety: SqlSafetyService);
    getSchema(questionId: string): Promise<{
        question_id: string;
        schema_sql: string;
        tables: {
            name: string;
        }[];
    }>;
    run(input: SqlRunInput, submit?: boolean): Promise<{
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
    private getPool;
    private getFiles;
    private readSql;
    private schemaName;
    private extractTables;
}
export {};
