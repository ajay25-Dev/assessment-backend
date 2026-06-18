import { QuestionBankService } from './question-bank.service';

describe('QuestionBankService', () => {
  it('loads and validates the JoraIQ question bank', async () => {
    const service = new QuestionBankService();
    const bank = (await service.getBank()) as {
      questions: Array<{
        section: string;
        id: string;
        test_cases?: unknown[];
        open_test_cases?: Array<{
          input?: string;
          expected?: string;
          tags?: string[];
        }>;
        hidden_test_cases?: Array<{
          input?: string;
          expected?: string;
          tags?: string[];
        }>;
        expected_approach?: string[];
        ideal_time?: number;
        ideal_space?: number;
        schema_files?: {
          schema?: string;
          visible_seed?: string;
          hidden_seed?: string;
        };
        expected_columns?: string[];
        visible_expected_rows?: unknown[];
        required_business_rules?: string[];
        expected_sql_concepts?: string[];
        expected_sql_concept_tags?: string[];
        edge_cases?: string[];
        null_rules?: string[];
        duplicate_rules?: string[];
        expected_oops_tags?: string[];
        required_classes?: string[];
        required_abstractions?: string[];
        required_patterns?: string[];
        required_solid_principles?: string[];
        required_error_cases?: string[];
        required_design_rules?: string[];
        optional_oops_tags?: string[];
        red_flag_tags?: string[];
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
      assessment?: {
        security?: {
          tab_switch_protection_enabled?: boolean;
          max_tab_switch_events?: number;
          auto_submit_on_max_events?: boolean;
          camera_proctoring_enabled?: boolean;
          max_camera_events?: number;
          auto_submit_on_camera_events?: boolean;
          copy_paste_block_enabled?: boolean;
          inspect_mode_block_enabled?: boolean;
          restart_timer_on_login?: boolean;
        };
      };
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
    expect(bank.assessment?.security).toMatchObject({
      tab_switch_protection_enabled: true,
      max_tab_switch_events: 2,
      auto_submit_on_max_events: true,
      camera_proctoring_enabled: true,
      max_camera_events: 2,
      auto_submit_on_camera_events: true,
      copy_paste_block_enabled: true,
      inspect_mode_block_enabled: true,
      restart_timer_on_login: true,
    });
    expect(
      bank.questions
        .filter((question) => question.section === 'DSA')
        .every(
          (question) =>
            question.test_cases?.length === 20 &&
            question.open_test_cases?.length === 5 &&
            question.hidden_test_cases?.length === 15,
        ),
    ).toBe(true);
    expect(
      bank.questions
        .filter((question) => question.section === 'OOPs')
        .every(
          (question) =>
            question.test_cases?.length === 8 &&
            question.open_test_cases?.length === 0 &&
            question.hidden_test_cases?.length === 8,
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
        id: string;
        schema_files?: {
          schema?: string;
          visible_seed?: string;
          hidden_seed?: string;
        };
        expected_columns?: string[];
        visible_expected_rows?: unknown[];
        required_business_rules?: string[];
        expected_sql_concepts?: string[];
        expected_sql_concept_tags?: string[];
        edge_cases?: string[];
        null_rules?: string[];
        duplicate_rules?: string[];
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
        expect(question.visible_expected_rows?.length).toBeGreaterThan(0);
        expect(question.required_business_rules?.length).toBeGreaterThan(0);
        expect(
          question.expected_sql_concept_tags?.length ||
            question.expected_sql_concepts?.length,
        ).toBeGreaterThan(0);
        expect(question.edge_cases?.length).toBeGreaterThan(0);
        expect(question.null_rules?.length).toBeGreaterThan(0);
        expect(question.duplicate_rules?.length).toBeGreaterThan(0);
      });

    expect(
      bank.questions.find(
        (question) =>
          question.section === 'SQL' &&
          question.id === 'sql_salesforce_renewal_expansion',
      )?.visible_expected_rows?.length,
    ).toBe(2);

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
        expected_oops_tags?: string[];
        required_classes?: string[];
        required_abstractions?: string[];
        required_patterns?: string[];
        required_solid_principles?: string[];
        required_error_cases?: string[];
        required_design_rules?: string[];
        optional_oops_tags?: string[];
        red_flag_tags?: string[];
        test_cases?: Array<{ tags?: string[] }>;
        open_test_cases?: Array<{ tags?: string[] }>;
        hidden_test_cases?: Array<{ tags?: string[] }>;
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
    const requiredScoringFields = [
      'expected_oops_tags',
      'required_classes',
      'required_abstractions',
      'required_patterns',
      'required_solid_principles',
      'required_error_cases',
      'required_design_rules',
      'red_flag_tags',
    ] as const;
    const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    bank.questions
      .filter((question) => question.section === 'OOPs')
      .forEach((question) => {
        requiredKeys.forEach((key) => {
          expect(Array.isArray(question.evaluator_context?.[key])).toBe(true);
          expect(question.evaluator_context?.[key]?.length).toBeGreaterThan(0);
        });
        requiredScoringFields.forEach((key) => {
          expect(Array.isArray(question[key])).toBe(true);
          expect(question[key]?.length).toBeGreaterThan(0);
          question[key]?.forEach((tag: string) =>
            expect(tag).toMatch(slugPattern),
          );
        });
        expect(question.test_cases?.length).toBe(8);
        expect(question.open_test_cases?.length).toBe(0);
        expect(question.hidden_test_cases?.length).toBe(8);
        [
          ...(question.test_cases || []),
          ...(question.open_test_cases || []),
          ...(question.hidden_test_cases || []),
        ].forEach((testCase: { tags?: string[] }) => {
          expect(Array.isArray(testCase.tags)).toBe(true);
          expect(testCase.tags?.length).toBeGreaterThan(0);
          testCase.tags?.forEach((tag: string) =>
            expect(tag).toMatch(slugPattern),
          );
        });
        question.optional_oops_tags?.forEach((tag) =>
          expect(tag).toMatch(slugPattern),
        );
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
