import { SqlEvaluationService } from './sql-evaluation.service';

describe('SqlEvaluationService', () => {
  function makeService(generateStructuredJson: jest.Mock) {
    return new SqlEvaluationService({
      model: 'test-model',
      generateStructuredJson,
    } as never);
  }

  it('extracts SQL concept tags from the AI and scores against them', async () => {
    const generateStructuredJson = jest.fn(async (request: { schemaName: string }) => {
      if (request.schemaName === 'sql_concept_tag_extraction') {
        return {
          detected_tags: ['join', 'group-by', 'date-filter'],
        };
      }

      throw new Error(`Unexpected schema ${request.schemaName}`);
    });

    const service = makeService(generateStructuredJson);

    const result = await service.evaluate({
      question_id: 'sql_salesforce_renewal_expansion',
      question_title: 'Salesforce Renewal Expansion Opportunity',
      prompt:
        'Find active accounts with recent usage, a join, grouping, and a date filter.',
      submitted_query: `
        WITH active_accounts AS (
          SELECT a.account_id, COUNT(*) AS usage_count
          FROM accounts a
          JOIN contracts c ON c.account_id = a.account_id
          WHERE c.end_date BETWEEN DATE '2026-06-15' AND DATE '2026-08-14'
          GROUP BY a.account_id
        )
        SELECT * FROM active_accounts
      `,
      expected_sql_concept_tags: ['join', 'group-by', 'date-filter'],
      required_business_rules: ['active-account-filter'],
      visible_expected_rows: [],
      expected_columns: [],
      result_match: { order_matters: false, numeric_tolerance: 0.01 },
      edge_cases: ['trial-contract-exclusion'],
      null_rules: ['active-license-assignment-null-end-date'],
      duplicate_rules: ['count-distinct-users'],
      sql_result_columns: ['account_id', 'usage_count'],
      sql_result_rows: [{ account_id: 1, usage_count: 2 }],
      sql_result_row_count: 1,
      sql_result_summary: 'Returned 1 row(s)',
      runtime_observation: 'Returned 1 row(s)',
    });

    const output = result.output as Record<string, unknown>;
    expect(generateStructuredJson).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaName: 'sql_concept_tag_extraction',
        input: expect.objectContaining({
          allowed_sql_concept_tags: ['join', 'group-by', 'date-filter'],
        }),
      }),
    );
    expect(output.ai_returned_concept_tags).toEqual([
      'join',
      'group-by',
      'date-filter',
    ]);
    expect(output.expected_sql_concept_tags).toEqual([
      'join',
      'group-by',
      'date-filter',
    ]);
    expect(output.sql_concept_score).toBe(100);
  });

  it('falls back to deterministic matching when the AI tag extraction fails', async () => {
    const generateStructuredJson = jest.fn(async (request: { schemaName: string }) => {
      if (request.schemaName === 'sql_concept_tag_extraction') {
        throw new Error('tag extraction failed');
      }

      throw new Error(`Unexpected schema ${request.schemaName}`);
    });

    const service = makeService(generateStructuredJson);

    const result = await service.evaluate({
      question_id: 'sql_salesforce_renewal_expansion',
      question_title: 'Salesforce Renewal Expansion Opportunity',
      prompt:
        'Find active accounts with recent usage, a join, grouping, and a date filter.',
      submitted_query: `
        SELECT a.account_id
        FROM accounts a
        JOIN contracts c ON c.account_id = a.account_id
        WHERE c.end_date BETWEEN DATE '2026-06-15' AND DATE '2026-08-14'
      `,
      expected_sql_concept_tags: ['join', 'date-filter'],
      required_business_rules: ['active-account-filter'],
      visible_expected_rows: [],
      expected_columns: [],
      result_match: { order_matters: false, numeric_tolerance: 0.01 },
      edge_cases: ['trial-contract-exclusion'],
      null_rules: ['active-license-assignment-null-end-date'],
      duplicate_rules: ['count-distinct-users'],
      sql_result_columns: ['account_id'],
      sql_result_rows: [{ account_id: 1 }],
      sql_result_row_count: 1,
      sql_result_summary: 'Returned 1 row(s)',
      runtime_observation: 'Returned 1 row(s)',
    });

    const output = result.output as Record<string, unknown>;
    expect(output.ai_returned_concept_tags).toEqual([]);
    expect(output.expected_sql_concept_tags).toEqual(
      expect.arrayContaining(['join', 'date-filter']),
    );
    expect(output.sql_concept_score).toBeGreaterThan(0);
  });
});
