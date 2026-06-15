import { QuestionBankService } from './question-bank.service';

describe('QuestionBankService', () => {
  it('loads and validates the JoraIQ question bank', async () => {
    const service = new QuestionBankService();
    const bank = (await service.getBank()) as {
      questions: Array<{
        section: string;
        id: string;
        test_cases?: unknown[];
        open_test_cases?: Array<{ input?: string; expected?: string }>;
        hidden_test_cases?: Array<{ input?: string; expected?: string }>;
        expected_approach?: string[];
        ideal_time?: number;
        ideal_space?: number;
        schema_files?: {
          schema?: string;
          visible_seed?: string;
          hidden_seed?: string;
        };
        expected_columns?: string[];
        options?: Array<{ label?: string }>;
        correct_options?: string[];
        evaluator_context?: {
          domain_rules?: unknown[];
          required_components?: unknown[];
          design_constraints?: unknown[];
          acceptance_signals?: unknown[];
          red_flags?: unknown[];
        };
      }>;
    };
    const counts = bank.questions.reduce<Record<string, number>>(
      (summary, question) => {
        summary[question.section] = (summary[question.section] || 0) + 1;
        return summary;
      },
      {},
    );

    expect(bank.questions).toHaveLength(30);
    expect(counts).toMatchObject({ DSA: 4, SQL: 3, OOPs: 3, MCQ: 20 });
    expect(
      (bank as { assessment?: { scoring_weights?: Record<string, number> } })
        .assessment?.scoring_weights,
    ).toMatchObject({
      DSA: 40,
      SQL: 20,
      OOPs: 20,
      MCQ: 20,
    });
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

  it('keeps DSA test cases executable and deterministic', async () => {
    const service = new QuestionBankService();
    const bank = (await service.getBank()) as {
      questions: Array<{
        section: string;
        expected_approach?: string[];
        ideal_time?: number;
        ideal_space?: number;
        open_test_cases?: Array<{ input?: string; expected?: string }>;
        hidden_test_cases?: Array<{ input?: string; expected?: string }>;
      }>;
    };
    const vaguePattern =
      /\b(any|valid|before|within\s+time|correct\s+.*\s+(count|list|operations))\b|\.{3}/i;

    bank.questions
      .filter((question) => question.section === 'DSA')
      .forEach((question) => {
        expect(question.expected_approach?.length).toBeGreaterThan(0);
        question.expected_approach?.forEach((tag) => {
          expect(tag).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        });
        expect(Number.isInteger(question.ideal_time)).toBe(true);
        expect(Number.isInteger(question.ideal_space)).toBe(true);
        expect(question.ideal_time).toBeGreaterThan(0);
        expect(question.ideal_space).toBeGreaterThan(0);
      });

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
    const service = new QuestionBankService();
    const bank = (await service.getBank()) as {
      questions: Array<{
        section: string;
        schema_files?: {
          schema?: string;
          visible_seed?: string;
          hidden_seed?: string;
        };
        expected_columns?: string[];
        options?: Array<{ label?: string }>;
        correct_options?: string[];
      }>;
    };

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
        const labels = new Set(
          (question.options || []).map((option) => option.label),
        );
        expect(
          (question.correct_options || []).every((option) =>
            labels.has(option),
          ),
        ).toBe(true);
      });
  });

  it('keeps OOPs questions grounded with evaluator context', async () => {
    const service = new QuestionBankService();
    const bank = (await service.getBank()) as {
      questions: Array<{
        section: string;
        evaluator_context?: {
          domain_rules?: unknown[];
          required_components?: unknown[];
          design_constraints?: unknown[];
          acceptance_signals?: unknown[];
          red_flags?: unknown[];
        };
      }>;
    };
    const requiredKeys = [
      'domain_rules',
      'required_components',
      'design_constraints',
      'acceptance_signals',
      'red_flags',
    ] as const;

    bank.questions
      .filter((question) => question.section === 'OOPs')
      .forEach((question) => {
        requiredKeys.forEach((key) => {
          expect(Array.isArray(question.evaluator_context?.[key])).toBe(true);
          expect(question.evaluator_context?.[key]?.length).toBeGreaterThan(0);
        });
      });
  });

  it('removes MCQ answer keys from the public question bank', async () => {
    const service = new QuestionBankService();
    const privateBank = (await service.getBank()) as unknown as {
      questions: Array<{ section: string; correct_options?: string[] }>;
    };
    const publicBank = (await service.getPublicBank()) as unknown as {
      questions: Array<{
        section: string;
        correct_options?: string[];
        explanation?: string;
        allow_multiple_answers?: boolean;
      }>;
    };

    expect(
      privateBank.questions
        .filter((question) => question.section === 'MCQ')
        .every((question) => question.correct_options?.length),
    ).toBe(true);

    publicBank.questions
      .filter((question) => question.section === 'MCQ')
      .forEach((question) => {
        expect(question.correct_options).toBeUndefined();
        expect(question.explanation).toBeUndefined();
        expect(typeof question.allow_multiple_answers).toBe('boolean');
      });
  });

  it('includes visible SQL sample data in the public question bank', async () => {
    const service = new QuestionBankService();
    const publicBank = (await service.getPublicBank()) as unknown as {
      questions: Array<{
        section: string;
        sample_data_sql?: string;
        sample_data_tables?: Array<{
          name: string;
          columns: string[];
          rows: string[][];
        }>;
      }>;
    };

    publicBank.questions
      .filter((question) => question.section === 'SQL')
      .forEach((question) => {
        expect(question.sample_data_sql).toContain('INSERT');
        expect(question.sample_data_sql).not.toContain('hidden');
        expect(question.sample_data_tables?.length).toBeGreaterThan(0);
        expect(question.sample_data_tables?.[0].name).toBeTruthy();
        expect(question.sample_data_tables?.[0].columns.length).toBeGreaterThan(
          0,
        );
        expect(question.sample_data_tables?.[0].rows.length).toBeGreaterThan(0);
      });
  });
});
