export declare class QuestionBankService {
    getBank(): Promise<Record<string, unknown>>;
    getImportPreview(): Promise<{
        title: string;
        sections: unknown[];
        question_count: number;
        counts_by_section: Record<string, number>;
        next_step: string;
    }>;
    private assertValidBank;
    private assertAuthenticDsaCases;
    private assertDsaCaseParseable;
    private parseIntValue;
    private parseJsonMatrix;
    private parseJsonArray;
    private assertMcqAnswerKeys;
    private assertSqlMetadata;
}
