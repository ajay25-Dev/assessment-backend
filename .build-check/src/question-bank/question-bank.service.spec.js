"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const question_bank_service_1 = require("./question-bank.service");
describe('QuestionBankService', () => {
    it('loads and validates the JoraIQ question bank', async () => {
        const service = new question_bank_service_1.QuestionBankService();
        const bank = (await service.getBank());
        const counts = bank.questions.reduce((summary, question) => {
            summary[question.section] = (summary[question.section] || 0) + 1;
            return summary;
        }, {});
        expect(bank.questions).toHaveLength(31);
        expect(counts).toMatchObject({ DSA: 5, SQL: 3, OOPs: 3, MCQ: 20 });
        expect(bank.questions
            .filter((question) => question.section === 'DSA')
            .every((question) => question.test_cases?.length === 15 &&
            question.open_test_cases?.length === 5 &&
            question.hidden_test_cases?.length === 10)).toBe(true);
    });
    it('keeps DSA test cases executable and deterministic', async () => {
        const service = new question_bank_service_1.QuestionBankService();
        const bank = (await service.getBank());
        const vaguePattern = /\b(any|valid|before|within\s+time|correct\s+.*\s+(count|list|operations))\b|\.{3}/i;
        bank.questions
            .filter((question) => question.section === 'DSA')
            .flatMap((question) => [
            ...(question.open_test_cases || []),
            ...(question.hidden_test_cases || []),
        ])
            .forEach((testCase) => {
            expect(testCase.input).toBeTruthy();
            expect(testCase.expected).toBeTruthy();
            expect(testCase.input).not.toMatch(vaguePattern);
            expect(testCase.expected).not.toMatch(vaguePattern);
        });
    });
    it('keeps SQL and MCQ metadata suitable for deterministic checks', async () => {
        const service = new question_bank_service_1.QuestionBankService();
        const bank = (await service.getBank());
        bank.questions
            .filter((question) => question.section === 'SQL')
            .forEach((question) => {
            expect(question.schema_files?.schema).toBeTruthy();
            expect(question.schema_files?.visible_seed).toBeTruthy();
            expect(question.schema_files?.hidden_seed).toBeTruthy();
            expect(question.expected_columns?.length).toBeGreaterThan(0);
        });
        bank.questions
            .filter((question) => question.section === 'MCQ')
            .forEach((question) => {
            const labels = new Set((question.options || []).map((option) => option.label));
            expect((question.correct_options || []).every((option) => labels.has(option))).toBe(true);
        });
    });
});
//# sourceMappingURL=question-bank.service.spec.js.map