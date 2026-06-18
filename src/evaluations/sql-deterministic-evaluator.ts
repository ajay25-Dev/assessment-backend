import { JsonObject } from '../ai/ai.types';
import { EvaluationResult } from './evaluation.types';

type JsonRecord = Record<string, unknown>;
type SqlComparisonConfig = {
  orderMatters: boolean;
  numericTolerance: number;
};

type SqlCalculationTrace = {
  result_correctness: {
    expected_columns: string[];
    actual_columns: string[];
    expected_rows: JsonRecord[];
    actual_rows: JsonRecord[];
    order_matters: boolean;
    numeric_tolerance: number;
  };
  business_logic: {
    required_business_rules: string[];
    matched_business_rules: string[];
    missing_business_rules: string[];
  };
  sql_concepts: {
    configured_expected_sql_concept_tags: string[];
    ai_returned_concept_tags: string[];
    matched_sql_concept_tags: string[];
    missing_concepts: string[];
  };
  edge_cases: {
    configured_edge_cases: string[];
    matched_edge_cases: string[];
    missing_edge_cases: string[];
  };
  query_efficiency: {
    formatting_score: number;
    alias_score: number;
    structure_score: number;
    simplicity_score: number;
    signals: string[];
  };
  readability: {
    formatting_score: number;
    alias_score: number;
    structure_score: number;
    simplicity_score: number;
  };
  null_duplicate_handling: {
    configured_null_rules: string[];
    configured_duplicate_rules: string[];
    matched_null_rules: string[];
    missing_null_rules: string[];
    matched_duplicate_rules: string[];
    missing_duplicate_rules: string[];
  };
  overall: {
    score_weights: Record<string, number>;
    score_formula: string;
  };
};

type TagCoverageResult = {
  score: number;
  matched: string[];
  missing: string[];
};

type RuleSet = Record<string, RegExp[]>;

type SqlQuestionPatterns = {
  business: RuleSet;
  concepts: RuleSet;
  edgeCases: RuleSet;
  nullRules: RuleSet;
  duplicateRules: RuleSet;
};

const SQL_PATTERNS: Record<string, SqlQuestionPatterns> = {
  sql_blinkit_replenishment_risk: {
    business: {
      'latest-inventory-snapshot': [
        /row_number/i,
        /\brank\s*\(/i,
        /latest.*snapshot/i,
        /max\s*\(.*snapshot/i,
      ],
      'active-store-filter': [
        /\bactive\b.*store/i,
        /store.*\bactive\b/i,
        /status\s*=\s*'active'/i,
      ],
      'non-discontinued-sku-filter': [
        /discontinued/i,
        /is\s+discontinued/i,
        /sku.*active/i,
      ],
      'completed-sales-last-7-days': [
        /completed/i,
        /last\s*7\s*days/i,
        /interval\s*'7/i,
        /current_date\s*-\s*interval\s*'7/i,
      ],
      'average-daily-sales-over-seven-days': [/avg/i, /average/i, /\/\s*7\b/i],
      'days-of-cover-calculation': [
        /days?\s+of\s+cover/i,
        /cover/i,
        /on_hand.*avg_daily/i,
      ],
      'reorder-point-or-days-cover-threshold': [
        /reorder/i,
        /threshold/i,
        /<\s*3\b/i,
      ],
      'zero-sales-not-flagged-by-null-cover': [
        /\bcoalesce\b/i,
        /\bnull\b/i,
        /no\s+sales/i,
      ],
    },
    concepts: {
      'cte-or-subquery': [/\bwith\b/i, /\(\s*select\b/i],
      join: [/\bjoin\b/i],
      'left-join': [/\bleft\s+join\b/i],
      aggregation: [/\b(sum|avg|count|min|max)\s*\(/i],
      'group-by': [/\bgroup\s+by\b/i],
      'date-filter': [
        /\bdate\b/i,
        /\binterval\b/i,
        /\bbetween\b/i,
        /\bcurrent_date\b/i,
      ],
      'case-expression': [/\bcase\b/i],
      'coalesce-or-null-handling': [/\bcoalesce\b/i, /\bnull\b/i],
    },
    edgeCases: {
      'latest-snapshot-selection': [
        /row_number/i,
        /latest.*snapshot/i,
        /max\s*\(.*snapshot/i,
      ],
      'inactive-store-exclusion': [/\binactive\b/i, /status\s*!=\s*'active'/i],
      'discontinued-sku-exclusion': [/discontinued/i],
      'cancelled-sales-exclusion': [/cancel/i],
      'no-recent-sales-null-cover': [
        /\bcoalesce\b/i,
        /\bnull\b/i,
        /no\s+sales/i,
      ],
      'threshold-reorder-point': [/reorder/i, /threshold/i, /<\s*3\b/i],
    },
    nullRules: {
      'coalesce-missing-sales-to-zero': [
        /\bcoalesce\b/i,
        /sales.*0/i,
        /sum\s*\(\s*.*\)\s*.*0/i,
      ],
      'avoid-null-days-cover-flag': [
        /\bcoalesce\b/i,
        /\bis\s+null\b/i,
        /case\s+when/i,
      ],
    },
    duplicateRules: {
      'aggregate-sales-before-final-join': [
        /\bgroup\s+by\b/i,
        /\bwith\b/i,
        /sum\s*\(/i,
      ],
      'preserve-one-row-per-store-sku': [
        /\bgroup\s+by\b/i,
        /\bdistinct\b/i,
        /row_number/i,
      ],
    },
  },
  sql_payu_settlement_reconciliation: {
    business: {
      'active-merchant-filter': [
        /\bactive\b.*merchant/i,
        /merchant.*\bactive\b/i,
        /status\s*=\s*'active'/i,
      ],
      'captured-transaction-filter': [/\bcaptured\b/i],
      'past-settlement-due-date-filter': [
        /due.*date/i,
        /settlement.*date/i,
        /current_date/i,
        /2026-06-15/i,
      ],
      'expected-settlement-calculation': [
        /fee/i,
        /tax/i,
        /amount\s*-\s*fee/i,
        /expected_settlement/i,
      ],
      'settlement-payout-aggregation-by-transaction': [
        /\bsum\b/i,
        /\bgroup\s+by\b/i,
        /transaction/i,
      ],
      'missing-settlement-detection': [
        /\bleft\s+join\b/i,
        /\bcoalesce\b/i,
        /\bmissing\b/i,
      ],
      'mismatch-threshold-greater-than-one': [
        /abs/i,
        /difference/i,
        />\s*1\b/i,
      ],
      'settlement-gap-calculation': [/\bgap\b/i],
    },
    concepts: {
      'cte-or-subquery': [/\bwith\b/i, /\(\s*select\b/i],
      join: [/\bjoin\b/i],
      'left-join': [/\bleft\s+join\b/i],
      aggregation: [/\b(sum|avg|count|min|max)\s*\(/i],
      'group-by': [/\bgroup\s+by\b/i],
      'date-filter': [
        /\bdate\b/i,
        /\binterval\b/i,
        /\bbetween\b/i,
        /\bcurrent_date\b/i,
      ],
      'case-expression': [/\bcase\b/i],
      'coalesce-or-null-handling': [/\bcoalesce\b/i, /\bnull\b/i],
    },
    edgeCases: {
      'inactive-merchant-exclusion': [
        /\binactive\b/i,
        /status\s*!=\s*'active'/i,
      ],
      'non-captured-transaction-exclusion': [
        /\bnot\s+captured\b/i,
        /\bcaptured\b/i,
      ],
      'missing-settlement-row': [
        /\bleft\s+join\b/i,
        /\bmissing\b/i,
        /\bcoalesce\b/i,
      ],
      'multiple-payout-aggregation': [/\bsum\b/i, /\bgroup\s+by\b/i],
      'exact-match-not-flagged': [/abs/i, /difference/i, /<=\s*1\b/i],
      'mismatch-threshold-boundary': [/>\s*1\b/i, /threshold/i],
    },
    nullRules: {
      'left-join-preserves-missing-settlements': [/\bleft\s+join\b/i],
      'coalesce-missing-settled-amount-to-zero': [/\bcoalesce\b/i, /\b0\b/i],
    },
    duplicateRules: {
      'aggregate-payouts-before-final-filter': [/\bsum\b/i, /\bgroup\s+by\b/i],
      'preserve-one-row-per-transaction': [/\bgroup\s+by\b/i, /\bdistinct\b/i],
    },
  },
  sql_salesforce_renewal_expansion: {
    business: {
      'active-account-filter': [
        /\bactive\b.*account/i,
        /account.*\bactive\b/i,
        /status\s*=\s*'active'/i,
      ],
      'active-non-trial-contract-filter': [
        /\btrial\b/i,
        /\bactive\b.*contract/i,
        /contract.*active/i,
      ],
      'contract-ending-next-sixty-days': [
        /60\s*day/i,
        /interval\s*'60/i,
        /next\s*60\s*days/i,
      ],
      'exclude-internal-users': [/\binternal\b/i],
      'count-distinct-active-licensed-users': [/\bcount\s*\(\s*distinct/i],
      'last-thirty-days-usage-window': [
        /30\s*day/i,
        /interval\s*'30/i,
        /last\s*30\s*days/i,
      ],
      'exclude-open-critical-support-tickets': [
        /critical/i,
        /support\s+tickets?/i,
        /\banti\s*join\b/i,
        /not\s+exists/i,
      ],
      'utilization-at-least-eighty-percent': [
        /80\s*%/i,
        /\b0\.8\b/i,
        />=\s*80\b/i,
      ],
    },
    concepts: {
      'cte-or-subquery': [/\bwith\b/i, /\(\s*select\b/i],
      join: [/\bjoin\b/i],
      'left-join-or-anti-join': [
        /\bleft\s+join\b/i,
        /\banti\s+join\b/i,
        /not\s+exists/i,
      ],
      aggregation: [/\b(sum|avg|count|min|max)\s*\(/i],
      'group-by': [/\bgroup\s+by\b/i],
      'date-filter': [
        /\bdate\b/i,
        /\binterval\b/i,
        /\bbetween\b/i,
        /\bcurrent_date\b/i,
      ],
      'count-distinct': [/\bcount\s*\(\s*distinct/i],
      'having-or-final-filter': [/\bhaving\b/i, /\bwhere\b/i],
    },
    edgeCases: {
      'trial-contract-exclusion': [/\btrial\b/i],
      'inactive-account-exclusion': [
        /\binactive\b/i,
        /status\s*!=\s*'active'/i,
      ],
      'internal-user-exclusion': [/\binternal\b/i],
      'duplicate-usage-event-deduplication': [
        /\bdistinct\b/i,
        /\bcount\s*\(\s*distinct/i,
      ],
      'open-critical-ticket-exclusion': [
        /critical/i,
        /\banti\s*join\b/i,
        /not\s+exists/i,
      ],
      'utilization-threshold-boundary': [/80\s*%/i, /\b0\.8\b/i, />=\s*80\b/i],
    },
    nullRules: {
      'active-license-assignment-null-end-date': [/\bnull\b/i, /assigned_to/i],
      'anti-join-handles-missing-critical-ticket': [
        /\banti\s*join\b/i,
        /not\s+exists/i,
        /\bleft\s+join\b/i,
      ],
    },
    duplicateRules: {
      'count-distinct-users': [/\bcount\s*\(\s*distinct/i],
      'preserve-one-row-per-account-contract': [
        /\bgroup\s+by\b/i,
        /\bdistinct\b/i,
      ],
    },
  },
};

const GENERIC_CONCEPT_PATTERNS: RuleSet = {
  'cte-or-subquery': [/\bwith\b/i, /\(\s*select\b/i],
  join: [/\bjoin\b/i],
  'left-join': [/\bleft\s+join\b/i],
  'left-join-or-anti-join': [
    /\bleft\s+join\b/i,
    /\banti\s+join\b/i,
    /not\s+exists/i,
  ],
  aggregation: [/\b(sum|avg|count|min|max)\s*\(/i],
  'group-by': [/\bgroup\s+by\b/i],
  'date-filter': [
    /\bdate\b/i,
    /\binterval\b/i,
    /\bbetween\b/i,
    /\bcurrent_date\b/i,
  ],
  'case-expression': [/\bcase\b/i],
  'count-distinct': [/\bcount\s*\(\s*distinct/i],
  'coalesce-or-null-handling': [/\bcoalesce\b/i, /\bnull\b/i],
  'having-or-final-filter': [/\bhaving\b/i, /\bwhere\b/i],
};

export function evaluateSqlSubmission(input: unknown): EvaluationResult {
  const record = assertRecord(input);
  const questionId = textValue(record.question_id);
  const questionTitle = textValue(
    record.question_title,
    questionId || 'SQL Question',
  );
  const patterns = questionPatterns(questionId);
  const submittedQuery = textValue(record.submitted_query);
  const sqlResultError =
    textValue(record.sql_result_error) || textValue(record.error);
  const runtimeObservation =
    textValue(record.runtime_observation) ||
    textValue(record.sql_result_summary);
  const visibleExpectedRows = record.visible_expected_rows;
  const expectedRows = recordArrayOfRecords(visibleExpectedRows);
  const expectedColumns = stringList(record.expected_columns).length
    ? stringList(record.expected_columns)
    : expectedRows.length
      ? Object.keys(expectedRows[0] || {})
      : [];
  const actualColumns = stringList(record.sql_result_columns);
  const actualRows = normalizeActualRows(record.sql_result_rows, actualColumns);
  const comparison = comparisonConfig(record.result_match);
  const detectedSqlConceptTags = stringList(record.detected_sql_concept_tags);
  const configuredBusinessRules = stringList(record.required_business_rules)
    .length
    ? stringList(record.required_business_rules)
    : Object.keys(patterns.business);
  const configuredEdgeCases = stringList(record.edge_cases).length
    ? stringList(record.edge_cases)
    : Object.keys(patterns.edgeCases);
  const configuredNullRules = stringList(record.null_rules).length
    ? stringList(record.null_rules)
    : Object.keys(patterns.nullRules);
  const configuredDuplicateRules = stringList(record.duplicate_rules).length
    ? stringList(record.duplicate_rules)
    : Object.keys(patterns.duplicateRules);

  const resultCorrectness = sqlResultError
    ? 0
    : compareExpectedAndActualRows(
        expectedRows,
        actualRows,
        expectedColumns,
        comparison,
      );

  const { score: businessLogicScore, missing: missingBusinessRules } =
    scoreRuleSet({
      query: submittedQuery,
      ruleSet: patterns.business,
      fallbackRules: configuredBusinessRules,
      weightForEvidence: 0.7,
      correctnessScore: resultCorrectness,
    });

  const fallbackConceptTags = stringList(record.expected_sql_concept_tags)
    .length
    ? stringList(record.expected_sql_concept_tags)
    : stringList(record.expected_sql_concepts);
  const conceptMatch = detectedSqlConceptTags.length
    ? scoreTagCoverage(fallbackConceptTags, detectedSqlConceptTags)
    : scoreRuleSet({
        query: submittedQuery,
        ruleSet: patterns.concepts || GENERIC_CONCEPT_PATTERNS,
        fallbackRules: fallbackConceptTags,
        weightForEvidence: 1,
        correctnessScore: 0,
      });

  const edgeCaseMatch = scoreRuleSet({
    query: submittedQuery,
    ruleSet: patterns.edgeCases,
    fallbackRules: configuredEdgeCases,
    weightForEvidence: 1,
    correctnessScore: 0,
  });

  const nullRules = scoreRuleSet({
    query: submittedQuery,
    ruleSet: patterns.nullRules,
    fallbackRules: configuredNullRules,
    weightForEvidence: 1,
    correctnessScore: 0,
  });

  const duplicateRules = scoreRuleSet({
    query: submittedQuery,
    ruleSet: patterns.duplicateRules,
    fallbackRules: configuredDuplicateRules,
    weightForEvidence: 1,
    correctnessScore: 0,
  });

  const sqlConceptScore = conceptMatch.score;
  const edgeCaseScore = edgeCaseMatch.score;
  const nullDuplicateHandlingScore = Math.round(
    average([nullRules.score, duplicateRules.score]),
  );

  const formattingScore = computeFormattingScore(submittedQuery);
  const aliasScore = computeAliasScore(submittedQuery);
  const structureScore = computeStructureScore(submittedQuery);
  const simplicityScore = computeSimplicityScore(submittedQuery);
  const queryEfficiencySignals = buildQueryEfficiencySignals(submittedQuery);
  const readabilityScore = Math.round(
    average([formattingScore, aliasScore, structureScore, simplicityScore]),
  );
  const queryEfficiencyScore = computeQueryEfficiencyScore({
    query: submittedQuery,
    formattingScore,
    aliasScore,
    structureScore,
    simplicityScore,
    conceptScore: sqlConceptScore,
  });

  const hardcodingRisk = detectHardcodingRisk(
    submittedQuery,
    expectedRows,
    expectedColumns,
  );

  const overallQuestionScore =
    sqlResultError || !submittedQuery.trim()
      ? 0
      : clampScore(
          (resultCorrectness * 30 +
            businessLogicScore * 20 +
            sqlConceptScore * 15 +
            edgeCaseScore * 10 +
            queryEfficiencyScore * 10 +
            readabilityScore * 5 +
            nullDuplicateHandlingScore * 10) /
            100,
        );

  const queryQualityLabel = labelForScore(overallQuestionScore, {
    excellent: 90,
    good: 75,
    average: 55,
    weak: 35,
  });

  const placementReadinessLabel = readinessLabelForSql({
    overallQuestionScore,
    hardcodingRisk,
    sqlResultError,
  });

  const expectedConceptsUsed = conceptMatch.matched;
  const missingConcepts = conceptMatch.missing;
  const matchedBusinessRules = configuredBusinessRules.filter(
    (rule) => !missingBusinessRules.includes(rule),
  );
  const detectedMistakes = buildDetectedMistakes({
    sqlResultError,
    resultCorrectness,
    businessLogicScore,
    sqlConceptScore,
    edgeCaseScore,
    nullDuplicateHandlingScore,
    hardcodingRisk,
    missingBusinessRules,
    missingConcepts,
    query: submittedQuery,
  });
  const failedCaseAnalysis = buildFailedCaseAnalysis({
    sqlResultError,
    expectedRows,
    actualRows,
    resultCorrectness,
    comparison,
  });
  const keyStrengths = buildStrengths({
    resultCorrectness,
    businessLogicScore,
    sqlConceptScore,
    edgeCaseScore,
    queryEfficiencyScore,
    readabilityScore,
    hardcodingRisk,
  });
  const keyWeaknesses = buildWeaknesses({
    sqlResultError,
    resultCorrectness,
    businessLogicScore,
    sqlConceptScore,
    edgeCaseScore,
    queryEfficiencyScore,
    readabilityScore,
    nullDuplicateHandlingScore,
    hardcodingRisk,
  });

  const improvementRecommendation = buildRecommendation({
    sqlResultError,
    missingBusinessRules,
    missingConcepts,
    edgeCaseScore,
    readabilityScore,
    queryEfficiencyScore,
    hardcodingRisk,
  });

  const trace: SqlCalculationTrace = {
    result_correctness: {
      expected_columns: expectedColumns,
      actual_columns: actualColumns,
      expected_rows: expectedRows,
      actual_rows: actualRows,
      order_matters: comparison.orderMatters,
      numeric_tolerance: comparison.numericTolerance,
    },
    business_logic: {
      required_business_rules: configuredBusinessRules,
      matched_business_rules: matchedBusinessRules,
      missing_business_rules: missingBusinessRules,
    },
    sql_concepts: {
      configured_expected_sql_concept_tags: fallbackConceptTags,
      ai_returned_concept_tags: detectedSqlConceptTags,
      matched_sql_concept_tags: expectedConceptsUsed,
      missing_concepts: missingConcepts,
    },
    edge_cases: {
      configured_edge_cases: configuredEdgeCases,
      matched_edge_cases: edgeCaseMatch.matched,
      missing_edge_cases: edgeCaseMatch.missing,
    },
    query_efficiency: {
      formatting_score: formattingScore,
      alias_score: aliasScore,
      structure_score: structureScore,
      simplicity_score: simplicityScore,
      signals: queryEfficiencySignals,
    },
    readability: {
      formatting_score: formattingScore,
      alias_score: aliasScore,
      structure_score: structureScore,
      simplicity_score: simplicityScore,
    },
    null_duplicate_handling: {
      configured_null_rules: configuredNullRules,
      configured_duplicate_rules: configuredDuplicateRules,
      matched_null_rules: nullRules.matched,
      missing_null_rules: nullRules.missing,
      matched_duplicate_rules: duplicateRules.matched,
      missing_duplicate_rules: duplicateRules.missing,
    },
    overall: {
      score_weights: {
        result_correctness: 30,
        business_logic: 20,
        sql_concept: 15,
        edge_case: 10,
        query_efficiency: 10,
        readability: 5,
        null_duplicate_handling: 10,
      },
      score_formula:
        '(result correctness x 30 + business logic x 20 + SQL concepts x 15 + edge cases x 10 + query efficiency x 10 + readability x 5 + NULL/duplicate handling x 10) / 100',
    },
  };

  return {
    section: 'SQL',
    prompt_version: 'sql-deterministic.v1',
    model: 'deterministic',
    output: {
      section: 'SQL',
      question_id: questionId,
      question_title: questionTitle,
      result_correctness_score: resultCorrectness,
      business_logic_score: businessLogicScore,
      sql_concept_score: sqlConceptScore,
      edge_case_score: edgeCaseScore,
      query_efficiency_score: queryEfficiencyScore,
      formatting_score: formattingScore,
      alias_score: aliasScore,
      structure_score: structureScore,
      simplicity_score: simplicityScore,
      readability_score: readabilityScore,
      null_duplicate_handling_score: nullDuplicateHandlingScore,
      overall_question_score: overallQuestionScore,
      hardcoding_risk: hardcodingRisk,
      query_quality_label: queryQualityLabel,
      ai_returned_concept_tags: detectedSqlConceptTags,
      expected_sql_concept_tags: expectedConceptsUsed,
      expected_concepts_used: expectedConceptsUsed,
      missing_concepts: missingConcepts,
      detected_mistakes: detectedMistakes,
      missing_business_rules: missingBusinessRules,
      failed_case_analysis: failedCaseAnalysis,
      runtime_observation:
        runtimeObservation ||
        sqlResultError ||
        'No SQL runtime evidence provided.',
      key_strengths: keyStrengths,
      key_weaknesses: keyWeaknesses,
      improvement_recommendation: improvementRecommendation,
      placement_readiness_label: placementReadinessLabel,
      calculation_trace: trace as unknown as JsonObject,
    },
  };
}

function questionPatterns(questionId: string): SqlQuestionPatterns {
  return (
    SQL_PATTERNS[questionId] || {
      business: {},
      concepts: GENERIC_CONCEPT_PATTERNS,
      edgeCases: {},
      nullRules: {},
      duplicateRules: {},
    }
  );
}

function assertRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as JsonRecord;
}

function recordArrayOfRecords(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is JsonRecord =>
      Boolean(item) && typeof item === 'object' && !Array.isArray(item),
  );
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function textValue(value: unknown, fallback = '') {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return fallback;
}

function numericValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function comparisonConfig(value: unknown): SqlComparisonConfig {
  const record = assertRecord(value);
  return {
    orderMatters: Boolean(record.order_matters),
    numericTolerance: Math.max(0, numericValue(record.numeric_tolerance, 0.01)),
  };
}

function normalizeActualRows(value: unknown, columns: string[]): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (Array.isArray(row)) {
        return columns.reduce<JsonRecord>((acc, column, index) => {
          acc[column] = row[index];
          return acc;
        }, {});
      }
      if (row && typeof row === 'object') {
        return row as JsonRecord;
      }
      return {};
    })
    .filter((row) => Object.keys(row).length > 0);
}

function compareExpectedAndActualRows(
  expectedRows: JsonRecord[],
  actualRows: JsonRecord[],
  expectedColumns: string[],
  comparison: SqlComparisonConfig,
) {
  if (!expectedRows.length) return actualRows.length ? 0 : 100;
  if (!actualRows.length) return 0;

  const denominator = Math.max(expectedRows.length, actualRows.length);
  if (comparison.orderMatters) {
    let total = 0;
    for (let index = 0; index < denominator; index += 1) {
      total += rowMatchScore(
        actualRows[index] || {},
        expectedRows[index] || {},
        expectedColumns,
        comparison.numericTolerance,
      );
    }
    return clampScore(total / denominator);
  }

  const used = new Set<number>();
  let total = 0;
  for (const actualRow of actualRows) {
    let bestScore = 0;
    let bestIndex = -1;
    expectedRows.forEach((expectedRow, index) => {
      if (used.has(index)) return;
      const score = rowMatchScore(
        actualRow,
        expectedRow,
        expectedColumns,
        comparison.numericTolerance,
      );
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) used.add(bestIndex);
    total += bestScore;
  }
  return clampScore(total / denominator);
}

function rowMatchScore(
  actualRow: JsonRecord,
  expectedRow: JsonRecord,
  expectedColumns: string[],
  numericTolerance: number,
) {
  const columns = expectedColumns.length
    ? expectedColumns
    : Object.keys(expectedRow || {});
  if (!columns.length) return 0;
  let matched = 0;
  for (const column of columns) {
    if (valuesEqual(actualRow[column], expectedRow[column], numericTolerance)) {
      matched += 1;
    }
  }
  return (matched / columns.length) * 100;
}

function valuesEqual(left: unknown, right: unknown, numericTolerance: number) {
  if (left === null || left === undefined)
    return right === null || right === undefined;
  if (right === null || right === undefined) return false;

  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return Math.abs(leftNumber - rightNumber) <= numericTolerance;
  }

  const leftText = String(left).trim().toLowerCase();
  const rightText = String(right).trim().toLowerCase();
  return leftText === rightText;
}

function scoreRuleSet(params: {
  query: string;
  ruleSet: RuleSet;
  fallbackRules: string[];
  weightForEvidence: number;
  correctnessScore: number;
}) {
  const normalizedQuery = String(params.query || '').toLowerCase();
  const keys = params.fallbackRules.length
    ? params.fallbackRules
    : Object.keys(params.ruleSet || {});
  const matched: string[] = [];

  for (const key of keys) {
    const patterns = params.ruleSet[key] || [];
    if (patterns.some((pattern) => pattern.test(normalizedQuery))) {
      matched.push(key);
    }
  }

  const score = keys.length
    ? clampScore(
        (matched.length / keys.length) * 100 * params.weightForEvidence +
          params.correctnessScore * (1 - params.weightForEvidence),
      )
    : clampScore(params.correctnessScore);

  return {
    score,
    matched,
    missing: keys.filter((key) => !matched.includes(key)),
  };
}

function scoreTagCoverage(
  expectedTags: string[],
  detectedTags: string[],
): TagCoverageResult {
  const expected = uniqueList(expectedTags).map(normalizeTag).filter(Boolean);
  const detected = uniqueList(detectedTags).map(normalizeTag).filter(Boolean);
  if (!expected.length) {
    return {
      score: 0,
      matched: [],
      missing: [],
    };
  }

  const detectedSet = new Set(detected);
  const matched = expected.filter((tag) => detectedSet.has(tag));
  return {
    score: clampScore((matched.length / expected.length) * 100),
    matched,
    missing: expected.filter((tag) => !detectedSet.has(tag)),
  };
}

function uniqueList(values: string[]) {
  return [
    ...new Set(values.map((value) => String(value).trim()).filter(Boolean)),
  ];
}

function normalizeTag(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function computeFormattingScore(query: string) {
  if (!query.trim()) return 0;
  const lines = query
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim().length > 0);
  const lineCount = lines.length || 1;
  const longLinePenalty = lines.filter((line) => line.length > 120).length * 8;
  const clauseStarts = lines.filter((line) =>
    /^\s*(select|with|from|where|group\s+by|having|order\s+by|join|left\s+join|right\s+join|inner\s+join|case|when|then|else|end)\b/i.test(
      line,
    ),
  ).length;
  const indentationBonus = lines.some((line) => /^\s{2,}\S/.test(line)) ? 8 : 0;
  const clauseBonus = Math.min(32, clauseStarts * 6);
  const singleLinePenalty = lineCount === 1 ? 25 : 0;
  return clampScore(
    48 + clauseBonus + indentationBonus - longLinePenalty - singleLinePenalty,
  );
}

function computeAliasScore(query: string) {
  if (!query.trim()) return 0;
  const normalized = query.toLowerCase();
  const aliasDefinitions = [
    ...normalized.matchAll(
      /\b(from|join)\s+([a-z_][a-z0-9_]*)\s+(?:as\s+)?([a-z_][a-z0-9_]*)\b/gi,
    ),
  ].map((match) => ({ source: match[2], alias: match[3] }));
  const joinCount = (normalized.match(/\bjoin\b/g) || []).length;
  const qualifiedRefs = (
    normalized.match(/\b[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*\b/g) || []
  ).length;
  const aliasUsage = aliasDefinitions.length ? 100 : joinCount > 0 ? 30 : 70;
  const qualification =
    joinCount > 0
      ? Math.min(100, (qualifiedRefs / Math.max(1, joinCount * 2)) * 100)
      : 60;
  const naming = !aliasDefinitions.length
    ? 40
    : average(
        aliasDefinitions.map((item) => (item.alias.length > 1 ? 100 : 65)),
      );
  const consistency =
    aliasDefinitions.length && qualifiedRefs > 0
      ? 100
      : joinCount > 0
        ? 50
        : 80;
  return clampScore(average([aliasUsage, qualification, naming, consistency]));
}

function computeStructureScore(query: string) {
  if (!query.trim()) return 0;
  const normalized = query.toLowerCase();
  const hasCte = /\bwith\b/i.test(normalized);
  const selectCount = (normalized.match(/\bselect\b/g) || []).length;
  const nestedSelectCount = Math.max(0, selectCount - 1);
  const clauseOrderScore = clauseOrderScoreForQuery(normalized);
  const lineBreakScore =
    query.split(/\r?\n/).filter((line) => line.trim()).length > 1 ? 100 : 55;
  const nestingPenalty =
    nestedSelectCount > 1 ? Math.min(35, (nestedSelectCount - 1) * 10) : 0;
  const cteBonus = hasCte ? 12 : 0;
  const selectStarPenalty = /\bselect\s+\*/i.test(normalized) ? 12 : 0;
  return clampScore(
    average([clauseOrderScore, lineBreakScore, hasCte ? 100 : 65]) +
      cteBonus -
      nestingPenalty -
      selectStarPenalty,
  );
}

function clauseOrderScoreForQuery(query: string) {
  const order = [
    'with',
    'select',
    'from',
    'where',
    'group by',
    'having',
    'order by',
  ];
  const indexes = order
    .map((clause) => ({ clause, index: query.indexOf(clause) }))
    .filter((entry) => entry.index >= 0);
  if (indexes.length < 2) return 65;
  const sorted = [...indexes].sort((left, right) => left.index - right.index);
  const inOrder = sorted.every(
    (entry, index) => entry.clause === indexes[index]?.clause,
  );
  return inOrder ? 100 : 60;
}

function computeSimplicityScore(query: string) {
  if (!query.trim()) return 0;
  const normalized = query.toLowerCase();
  const selectCount = (normalized.match(/\bselect\b/g) || []).length;
  const nestedPenalty = Math.max(0, selectCount - 1) * 12;
  const selectStarPenalty = /\bselect\s+\*/i.test(normalized) ? 15 : 0;
  const longQueryPenalty =
    normalized.length > 900 ? 12 : normalized.length > 500 ? 6 : 0;
  const repeatedCasePenalty =
    (normalized.match(/\bcase\b/g) || []).length > 1 ? 8 : 0;
  const cteBonus = /\bwith\b/i.test(normalized) ? 6 : 0;
  return clampScore(
    78 +
      cteBonus -
      nestedPenalty -
      selectStarPenalty -
      longQueryPenalty -
      repeatedCasePenalty,
  );
}

function computeQueryEfficiencyScore(params: {
  query: string;
  formattingScore: number;
  aliasScore: number;
  structureScore: number;
  simplicityScore: number;
  conceptScore: number;
}) {
  const normalized = params.query.toLowerCase();
  if (!normalized.trim()) return 0;
  const selectStarPenalty = /\bselect\s+\*/i.test(normalized) ? 10 : 0;
  const repeatedScanPenalty =
    (normalized.match(/\bfrom\b/g) || []).length > 1 ? 8 : 0;
  const cteBonus = /\bwith\b/i.test(normalized) ? 8 : 0;
  const earlyFilterBonus = /\bwhere\b/i.test(normalized) ? 10 : 0;
  const aggregateBonus = /\bgroup\s+by\b/i.test(normalized) ? 10 : 0;
  const antiJoinBonus =
    /\bleft\s+join\b/i.test(normalized) || /not\s+exists/i.test(normalized)
      ? 8
      : 0;
  const base = average([
    params.structureScore,
    params.simplicityScore,
    params.aliasScore,
    params.formattingScore,
  ]);
  return clampScore(
    base +
      cteBonus +
      earlyFilterBonus +
      aggregateBonus +
      antiJoinBonus +
      params.conceptScore * 0.05 -
      selectStarPenalty -
      repeatedScanPenalty,
  );
}

function detectHardcodingRisk(
  query: string,
  expectedRows: JsonRecord[],
  expectedColumns: string[],
) {
  const normalized = query.toLowerCase();
  if (!normalized.trim()) return 'Low';

  const expectedLiterals = expectedRows
    .flatMap((row) =>
      expectedColumns
        .map((column) => row[column])
        .filter((value) => value !== null && value !== undefined),
    )
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean);
  const literalMatches = expectedLiterals.filter((literal) =>
    normalized.includes(literal),
  );
  const numericLiteralCount = (normalized.match(/\b\d+(?:\.\d+)?\b/g) || [])
    .length;
  const quotedLiteralCount = (normalized.match(/'[^']*'/g) || []).length;
  const structureSignals = (
    normalized.match(/\b(join|group\s+by|where|having|with)\b/g) || []
  ).length;

  if (literalMatches.length >= 3) return 'High';
  if (literalMatches.length >= 2 && structureSignals <= 1) return 'High';
  if (numericLiteralCount + quotedLiteralCount >= 5 && structureSignals <= 1)
    return 'Medium';
  if (quotedLiteralCount >= 3 && !/\bjoin\b/i.test(normalized)) return 'Medium';
  return 'Low';
}

function labelForScore(
  score: number,
  thresholds: {
    excellent: number;
    good: number;
    average: number;
    weak: number;
  },
) {
  if (score >= thresholds.excellent) return 'Excellent';
  if (score >= thresholds.good) return 'Good';
  if (score >= thresholds.average) return 'Average';
  if (score >= thresholds.weak) return 'Weak';
  return 'Incorrect';
}

function readinessLabelForSql(params: {
  overallQuestionScore: number;
  hardcodingRisk: 'Low' | 'Medium' | 'High';
  sqlResultError: string;
}) {
  if (params.sqlResultError) return 'Not Ready';
  if (params.hardcodingRisk === 'High' && params.overallQuestionScore >= 70) {
    return 'Risky High Scorer';
  }
  if (params.overallQuestionScore >= 90 && params.hardcodingRisk === 'Low') {
    return 'Elite 1% Company Ready';
  }
  if (params.overallQuestionScore >= 80 && params.hardcodingRisk !== 'High') {
    return 'Strong Company Ready';
  }
  if (params.overallQuestionScore >= 65 && params.hardcodingRisk === 'Low') {
    return 'Near Ready';
  }
  if (params.overallQuestionScore >= 50) {
    return 'Trainable but Not Ready';
  }
  return 'Not Ready';
}

function buildDetectedMistakes(params: {
  sqlResultError: string;
  resultCorrectness: number;
  businessLogicScore: number;
  sqlConceptScore: number;
  edgeCaseScore: number;
  nullDuplicateHandlingScore: number;
  hardcodingRisk: 'Low' | 'Medium' | 'High';
  missingBusinessRules: string[];
  missingConcepts: string[];
  query: string;
}) {
  const mistakes = new Set<string>();
  if (params.sqlResultError)
    mistakes.add(`Execution error: ${params.sqlResultError}`);
  if (params.resultCorrectness < 100)
    mistakes.add('Visible output does not fully match the expected rows.');
  if (params.businessLogicScore < 70)
    mistakes.add('One or more required business rules are not fully covered.');
  if (params.sqlConceptScore < 70)
    mistakes.add('Some required SQL concepts are missing or weak.');
  if (params.edgeCaseScore < 70)
    mistakes.add('Edge-case handling is incomplete.');
  if (params.nullDuplicateHandlingScore < 70)
    mistakes.add('NULL or duplicate handling is incomplete.');
  if (params.hardcodingRisk !== 'Low')
    mistakes.add(`Hardcoding risk is ${params.hardcodingRisk.toLowerCase()}.`);
  if (/\bselect\s+\*/i.test(params.query))
    mistakes.add('SELECT * is used, which makes the query less robust.');
  if (!/\b(join|where|with)\b/i.test(params.query))
    mistakes.add(
      'The query lacks clear relational filtering or joining logic.',
    );
  params.missingBusinessRules
    .slice(0, 3)
    .forEach((rule) => mistakes.add(`Missing business rule: ${rule}.`));
  params.missingConcepts
    .slice(0, 3)
    .forEach((concept) => mistakes.add(`Missing SQL concept: ${concept}.`));
  return [...mistakes];
}

function buildFailedCaseAnalysis(params: {
  sqlResultError: string;
  expectedRows: JsonRecord[];
  actualRows: JsonRecord[];
  resultCorrectness: number;
  comparison: SqlComparisonConfig;
}) {
  if (params.sqlResultError)
    return [`Query execution failed: ${params.sqlResultError}`];
  if (!params.expectedRows.length)
    return ['No expected visible rows were provided.'];
  if (!params.actualRows.length) return ['No result rows were returned.'];
  if (params.resultCorrectness >= 100)
    return ['All visible expected rows matched the query output.'];
  if (!params.comparison.orderMatters) {
    return [
      `Visible output matched about ${params.resultCorrectness}% of the expected rows and columns.`,
    ];
  }

  const messages: string[] = [];
  const maxRows = Math.max(
    params.expectedRows.length,
    params.actualRows.length,
  );
  for (let index = 0; index < maxRows; index += 1) {
    const expectedRow = params.expectedRows[index];
    const actualRow = params.actualRows[index];
    if (!expectedRow && actualRow) {
      messages.push(`Extra row returned at position ${index + 1}.`);
      continue;
    }
    if (expectedRow && !actualRow) {
      messages.push(`Missing expected row at position ${index + 1}.`);
      continue;
    }
    if (!expectedRow || !actualRow) continue;
    const mismatchedColumns = Object.keys(expectedRow).filter(
      (column) =>
        !valuesEqual(
          actualRow[column],
          expectedRow[column],
          params.comparison.numericTolerance,
        ),
    );
    if (mismatchedColumns.length) {
      messages.push(
        `Row ${index + 1} mismatched on: ${mismatchedColumns.slice(0, 3).join(', ')}.`,
      );
    }
  }
  return messages.length
    ? messages
    : ['Visible rows are close but not fully aligned.'];
}

function buildStrengths(params: {
  resultCorrectness: number;
  businessLogicScore: number;
  sqlConceptScore: number;
  edgeCaseScore: number;
  queryEfficiencyScore: number;
  readabilityScore: number;
  hardcodingRisk: 'Low' | 'Medium' | 'High';
}) {
  const strengths: string[] = [];
  if (params.resultCorrectness >= 90)
    strengths.push('Visible output matches the expected rows closely.');
  if (params.businessLogicScore >= 80)
    strengths.push('Business rules are covered well.');
  if (params.sqlConceptScore >= 80)
    strengths.push('Core SQL concepts are applied effectively.');
  if (params.edgeCaseScore >= 70)
    strengths.push('Edge-case handling is reasonably strong.');
  if (params.queryEfficiencyScore >= 70)
    strengths.push('Query shape is reasonably efficient.');
  if (params.readabilityScore >= 70)
    strengths.push('Query readability is solid.');
  if (params.hardcodingRisk === 'Low')
    strengths.push('No obvious hardcoding signals were detected.');
  return strengths;
}

function buildWeaknesses(params: {
  sqlResultError: string;
  resultCorrectness: number;
  businessLogicScore: number;
  sqlConceptScore: number;
  edgeCaseScore: number;
  queryEfficiencyScore: number;
  readabilityScore: number;
  nullDuplicateHandlingScore: number;
  hardcodingRisk: 'Low' | 'Medium' | 'High';
}) {
  const weaknesses: string[] = [];
  if (params.sqlResultError) weaknesses.push('Execution failed.');
  if (params.resultCorrectness < 70)
    weaknesses.push('Visible result matching needs work.');
  if (params.businessLogicScore < 70)
    weaknesses.push('Required business logic coverage is incomplete.');
  if (params.sqlConceptScore < 70)
    weaknesses.push('Some required SQL concepts are missing.');
  if (params.edgeCaseScore < 70)
    weaknesses.push('Edge-case handling is incomplete.');
  if (params.queryEfficiencyScore < 70)
    weaknesses.push('Query efficiency can be improved.');
  if (params.readabilityScore < 70)
    weaknesses.push('Formatting, aliases, or query structure can be improved.');
  if (params.nullDuplicateHandlingScore < 70)
    weaknesses.push('NULL and duplicate handling need more care.');
  if (params.hardcodingRisk !== 'Low')
    weaknesses.push(
      `Hardcoding risk is ${params.hardcodingRisk.toLowerCase()}.`,
    );
  return weaknesses;
}

function buildRecommendation(params: {
  sqlResultError: string;
  missingBusinessRules: string[];
  missingConcepts: string[];
  edgeCaseScore: number;
  readabilityScore: number;
  queryEfficiencyScore: number;
  hardcodingRisk: 'Low' | 'Medium' | 'High';
}) {
  if (params.sqlResultError) {
    return 'Fix the SQL error first, then validate the result set against the visible expected rows.';
  }

  const focus: string[] = [];
  if (params.missingBusinessRules.length)
    focus.push(`cover ${params.missingBusinessRules[0]}`);
  if (params.missingConcepts.length)
    focus.push(`add ${params.missingConcepts[0]}`);
  if (params.edgeCaseScore < 70) focus.push('tighten edge-case handling');
  if (params.readabilityScore < 70)
    focus.push('improve formatting, aliases, and structure');
  if (params.queryEfficiencyScore < 70)
    focus.push('reduce repeated scans and simplify joins');
  if (params.hardcodingRisk !== 'Low') focus.push('remove hardcoded literals');

  if (!focus.length) {
    return 'Validate the final query against the visible rows and keep the same structure for hidden data.';
  }

  return `Refine the query to ${focus.slice(0, 3).join(', ')}, then rerun it against the visible dataset.`;
}

function buildQueryEfficiencySignals(query: string) {
  const normalized = String(query || '').toLowerCase();
  const signals: string[] = [];
  if (!normalized.trim()) return signals;
  if (/\bwith\b/i.test(normalized)) signals.push('CTE bonus');
  if (/\bwhere\b/i.test(normalized)) signals.push('Early filter bonus');
  if (/\bgroup\s+by\b/i.test(normalized)) signals.push('Aggregation bonus');
  if (/\bleft\s+join\b/i.test(normalized) || /not\s+exists/i.test(normalized)) {
    signals.push('Anti-join bonus');
  }
  if (/\bselect\s+\*/i.test(normalized)) signals.push('SELECT * penalty');
  const repeatedFromCount = (normalized.match(/\bfrom\b/g) || []).length;
  if (repeatedFromCount > 1) signals.push('Repeated scan penalty');
  return signals;
}
