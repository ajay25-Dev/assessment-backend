import { evaluateSqlSubmission } from './sql-deterministic-evaluator';

describe('evaluateSqlSubmission', () => {
  it('scores visible result matching and readability sub-scores deterministically', () => {
    const output = evaluateSqlSubmission({
      question_id: 'sql_salesforce_renewal_expansion',
      question_title: 'Salesforce Renewal Expansion Opportunity',
      submitted_query: `
        WITH active_accounts AS (
          SELECT
            a.account_id,
            a.account_name,
            c.plan_type,
            c.seats_purchased,
            COUNT(DISTINCT lu.user_id) AS active_users_30d,
            ROUND(COUNT(DISTINCT lu.user_id) * 100.0 / NULLIF(c.seats_purchased, 0), 0) AS utilization_percentage,
            c.end_date AS contract_end_date
          FROM accounts a
          JOIN contracts c ON c.account_id = a.account_id
          LEFT JOIN licensed_users lu ON lu.account_id = a.account_id
          LEFT JOIN support_tickets st ON st.account_id = a.account_id
          WHERE a.account_status = 'ACTIVE'
            AND c.contract_status = 'ACTIVE'
            AND c.is_trial = FALSE
            AND c.end_date BETWEEN DATE '2026-06-15' AND DATE '2026-08-14'
            AND lu.is_internal_user = FALSE
          GROUP BY a.account_id, a.account_name, c.plan_type, c.seats_purchased, c.end_date
          HAVING COUNT(DISTINCT lu.user_id) >= 0.8 * c.seats_purchased
             AND COUNT(CASE WHEN st.severity = 'CRITICAL' AND st.ticket_status = 'OPEN' THEN 1 END) = 0
        )
        SELECT * FROM active_accounts
      `,
      expected_columns: [
        'account_id',
        'account_name',
        'plan_type',
        'seats_purchased',
        'active_users_30d',
        'utilization_percentage',
        'contract_end_date',
      ],
      visible_expected_rows: [
        {
          account_id: 1,
          account_name: 'BuildRight Infra',
          plan_type: 'Enterprise',
          seats_purchased: 10,
          active_users_30d: 8,
          utilization_percentage: 80,
          contract_end_date: '2026-07-20',
        },
        {
          account_id: 4,
          account_name: 'MediaFlow Ltd',
          plan_type: 'Enterprise',
          seats_purchased: 5,
          active_users_30d: 4,
          utilization_percentage: 80,
          contract_end_date: '2026-08-01',
        },
      ],
      result_match: {
        order_matters: false,
        numeric_tolerance: 0.01,
      },
      required_business_rules: [
        'active-account-filter',
        'active-non-trial-contract-filter',
        'contract-ending-next-sixty-days',
        'exclude-internal-users',
        'count-distinct-active-licensed-users',
        'last-thirty-days-usage-window',
        'exclude-open-critical-support-tickets',
        'utilization-at-least-eighty-percent',
      ],
      expected_sql_concepts: [
        'cte-or-subquery',
        'join',
        'left-join-or-anti-join',
        'aggregation',
        'group-by',
        'date-filter',
        'count-distinct',
        'having-or-final-filter',
      ],
      edge_cases: [
        'trial-contract-exclusion',
        'inactive-account-exclusion',
        'internal-user-exclusion',
        'duplicate-usage-event-deduplication',
        'open-critical-ticket-exclusion',
        'utilization-threshold-boundary',
      ],
      null_rules: [
        'active-license-assignment-null-end-date',
        'anti-join-handles-missing-critical-ticket',
      ],
      duplicate_rules: [
        'count-distinct-users',
        'preserve-one-row-per-account-contract',
      ],
      expected_sql_concept_tags: ['join', 'group-by', 'date-filter'],
      detected_sql_concept_tags: ['join', 'group-by', 'date-filter'],
      sql_result_columns: [
        'account_id',
        'account_name',
        'plan_type',
        'seats_purchased',
        'active_users_30d',
        'utilization_percentage',
        'contract_end_date',
      ],
      sql_result_rows: [
        {
          account_id: 4,
          account_name: 'MediaFlow Ltd',
          plan_type: 'Enterprise',
          seats_purchased: 5,
          active_users_30d: 4,
          utilization_percentage: 80,
          contract_end_date: '2026-08-01',
        },
        {
          account_id: 1,
          account_name: 'BuildRight Infra',
          plan_type: 'Enterprise',
          seats_purchased: 10,
          active_users_30d: 8,
          utilization_percentage: 80,
          contract_end_date: '2026-07-20',
        },
      ],
      sql_result_row_count: 2,
      execution_ms: 18,
      sql_result_summary: 'Returned 2 row(s)',
      sql_result_error: '',
      runtime_observation: 'Returned 2 row(s)',
    });

    const outputRecord = output.output as Record<string, unknown>;
    expect(outputRecord.result_correctness_score).toBe(100);
    expect(outputRecord.business_logic_score).toBeGreaterThanOrEqual(60);
    expect(outputRecord.sql_concept_score).toBeGreaterThanOrEqual(60);
    expect(outputRecord.edge_case_score).toBeGreaterThanOrEqual(50);
    expect(outputRecord.formatting_score).toBeGreaterThanOrEqual(0);
    expect(outputRecord.alias_score).toBeGreaterThanOrEqual(0);
    expect(outputRecord.structure_score).toBeGreaterThanOrEqual(0);
    expect(outputRecord.simplicity_score).toBeGreaterThanOrEqual(0);
    expect(outputRecord.readability_score).toBeGreaterThanOrEqual(0);
    expect(outputRecord.null_duplicate_handling_score).toBeGreaterThanOrEqual(0);
    expect(outputRecord.overall_question_score).toBeGreaterThan(0);
    expect(Array.isArray(outputRecord.missing_business_rules)).toBe(true);
    expect((outputRecord.missing_business_rules as unknown[]).length).toBeLessThan(
      8,
    );
    expect(outputRecord.expected_concepts_used).toEqual(
      expect.arrayContaining(['join', 'group-by', 'date-filter']),
    );
    expect(outputRecord.ai_returned_concept_tags).toEqual(
      expect.arrayContaining(['join', 'group-by', 'date-filter']),
    );
    expect(outputRecord.expected_sql_concept_tags).toEqual(
      expect.arrayContaining(['join', 'group-by', 'date-filter']),
    );
    expect(outputRecord.query_quality_label).toMatch(/Excellent|Good|Average/);
    expect(typeof outputRecord.placement_readiness_label).toBe('string');
  });

  it('drops the score to zero when the SQL execution reports an error', () => {
    const output = evaluateSqlSubmission({
      question_id: 'sql_payu_settlement_reconciliation',
      question_title: 'PayU Settlement Reconciliation Mismatch',
      submitted_query: 'SELECT * FROM missing_table',
      visible_expected_rows: [
        {
          merchant_id: 1,
          merchant_name: 'Ridge Commerce',
          txn_id: 1002,
          txn_amount: 2000,
          expected_settlement_amount: 1952.8,
          settled_amount: 1900,
          settlement_gap: 52.8,
          settlement_status: 'MISMATCH',
        },
      ],
      result_match: {
        order_matters: false,
        numeric_tolerance: 0.01,
      },
      required_business_rules: ['active-merchant-filter'],
      expected_sql_concepts: ['join'],
      expected_sql_concept_tags: ['join'],
      edge_cases: ['missing-settlement-row'],
      null_rules: ['coalesce-missing-settled-amount-to-zero'],
      duplicate_rules: ['aggregate-payouts-before-final-filter'],
      sql_result_error: 'relation "missing_table" does not exist',
      sql_result_summary: 'relation "missing_table" does not exist',
      runtime_observation: 'relation "missing_table" does not exist',
      sql_result_rows: [],
      sql_result_columns: [],
      sql_result_row_count: 0,
    });

    const outputRecord = output.output as Record<string, unknown>;
    expect(outputRecord.result_correctness_score).toBe(0);
    expect(outputRecord.overall_question_score).toBe(0);
    expect(outputRecord.query_quality_label).toBe('Incorrect');
    expect(outputRecord.placement_readiness_label).toBe('Not Ready');
  });
});
