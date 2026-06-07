import { ConfigService } from '@nestjs/config';
type Judge0Result = {
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
};
export declare class Judge0Adapter {
    private readonly config;
    constructor(config: ConfigService);
    submitAndWait(params: {
        languageId: number;
        sourceCode: string;
        stdin?: string;
        expectedOutput?: string;
        cpuTimeLimit?: number;
        memoryLimit?: number;
    }): Promise<Judge0Result>;
    private poll;
    private getBaseUrl;
    private headers;
    private encodeBase64;
    private decodeBase64;
    private decodeResult;
}
export {};
