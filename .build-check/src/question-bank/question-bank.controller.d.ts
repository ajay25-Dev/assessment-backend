import { QuestionBankService } from './question-bank.service';
export declare class QuestionBankController {
    private readonly questionBank;
    constructor(questionBank: QuestionBankService);
    getBank(): Promise<Record<string, unknown>>;
    getImportPreview(): Promise<{
        title: string;
        sections: unknown[];
        question_count: number;
        counts_by_section: Record<string, number>;
        next_step: string;
    }>;
}
