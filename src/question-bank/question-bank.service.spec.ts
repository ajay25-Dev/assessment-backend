import { QuestionBankService } from './question-bank.service';

describe('QuestionBankService', () => {
  it('loads and validates the JoraIQ question bank', async () => {
    const service = new QuestionBankService();
    const bank = (await service.getBank()) as {
      questions: Array<{
        section: string;
        test_cases?: unknown[];
        open_test_cases?: unknown[];
        hidden_test_cases?: unknown[];
      }>;
    };
    const counts = bank.questions.reduce<Record<string, number>>(
      (summary, question) => {
        summary[question.section] = (summary[question.section] || 0) + 1;
        return summary;
      },
      {},
    );

    expect(bank.questions).toHaveLength(31);
    expect(counts).toMatchObject({ DSA: 5, SQL: 3, OOPs: 3, MCQ: 20 });
    expect(
      bank.questions
        .filter((question) => question.section === 'DSA')
        .every(
          (question) =>
            question.test_cases?.length === 15 &&
            question.open_test_cases?.length === 5 &&
            question.hidden_test_cases?.length === 10,
        ),
    ).toBe(true);
  });
});
