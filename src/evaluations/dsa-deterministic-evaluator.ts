import { EvaluationResult } from './evaluation.types';
import {
  complexityScoreFromRanks,
  complexityScoreRankFromDetailedRank,
  loadComplexityRanks,
} from './complexity-ranks';

export { complexityScoreFromRanks, complexityScoreRankFromDetailedRank } from './complexity-ranks';

type JsonRecord = Record<string, unknown>;

type TestCase = {
  id?: unknown;
  number?: unknown;
  input?: unknown;
  expected?: unknown;
  expected_output?: unknown;
  purpose?: unknown;
  tags?: unknown;
};

type StructuredTestResults = {
  test_results?: Array<{ passed?: boolean } | null>;
  total?: number;
  passed?: number;
};

type TestSummary = {
  openPassed: number | null;
  openTotal: number | null;
  hiddenPassed: number | null;
  hiddenTotal: number | null;
  totalPassed: number | null;
  totalTests: number | null;
  hiddenAvailable: boolean;
};

type CodeQualityScores = {
  readabilityScore: number;
  modularityScore: number;
  namingScore: number;
  simplicityScore: number;
  noHardcodingScore: number;
  codeQualityScore: number;
};

type ApproachAnalysis = {
  approachMatchPercentage: number;
  expectedApproachUsed: 'Yes' | 'Partial' | 'No';
  approachScore: number;
  alternateSolutionScore: number;
  detectedApproach: string;
  expectedApproachTags: string[];
  aiReturnedApproachTags: string[];
};

type EdgeCaseEvaluation = {
  available: boolean;
  score: number | 'Not available';
  passedText: string | 'Not available';
  missedEdgeCases: string[];
};

const SCORE_BASIS =
  'Score is calculated from visible test correctness, expected code coverage, raw detailed complexity rank ratios versus question-bank targets, and edge-case performance.';

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'before',
  'build',
  'by',
  'can',
  'case',
  'cases',
  'count',
  'detect',
  'for',
  'from',
  'function',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'over',
  'return',
  'same',
  'should',
  'solution',
  'that',
  'the',
  'their',
  'these',
  'this',
  'those',
  'to',
  'use',
  'using',
  'valid',
  'we',
  'when',
  'with',
  'within',
]);

const EDGE_CASE_HINTS: Record<string, RegExp[]> = {
  dsa_servicenow_incident_dependency: [
    /cycle/i,
    /self dependency/i,
    /self loop/i,
    /single incident/i,
    /empty/i,
    /boundary/i,
    /zero/i,
    /large/i,
  ],
  dsa_amazon_delivery_routes: [
    /unreachable/i,
    /zero roads/i,
    /same-location/i,
    /cycle route/i,
    /exactly at deadline/i,
    /revisiting/i,
    /time-dependent/i,
    /five-package/i,
  ],
  dsa_commvault_deduplication: [
    /case sensitivity/i,
    /numeric/i,
    /special-character/i,
    /empty file/i,
    /empty range/i,
    /overlap/i,
    /single file/i,
    /multiple empty/i,
    /stress/i,
  ],
  dsa_autodesk_versioned_kv: [
    /version 0/i,
    /branch isolation/i,
    /deep inheritance/i,
    /parent remains immutable/i,
    /empty version/i,
    /mixed branch/i,
    /large value/i,
    /long key/i,
  ],
};

export function evaluateDsaSubmission(input: unknown): EvaluationResult {
  const record = assertRecord(input);
  const questionId = textValue(record.question_id);
  const questionTitle = textValue(record.question_title, questionId || 'DSA Question');
  const submittedCode = textValue(record.submitted_code);
  const openTests = caseList(record.open_test_cases);
  const hiddenTests = caseList(record.hidden_test_cases);
  const expectedApproach = stringList(record.expected_approach);
  const expectedCode = stringList(record.expected_code);
  const detectedApproachTags = stringList(record.detected_approach_tags);
  const hasDetectedApproachTags = Object.prototype.hasOwnProperty.call(
    record,
    'detected_approach_tags',
  );
  const structuredResults = submittedTestResults(record);
  const summary = parseTestSummary(record.compiler_result_summary);
  const testSummary = buildTestSummary({
    openTests,
    hiddenTests,
    structuredResults,
    summary,
  });

  const openTestCaseScore = scoreRatio(testSummary.openPassed, testSummary.openTotal);
  const hiddenTestCaseScore = testSummary.hiddenAvailable
    ? scoreRatio(testSummary.hiddenPassed, testSummary.hiddenTotal)
    : 'Not available';
  const correctnessScore = testSummary.hiddenAvailable
    ? scoreRatio(testSummary.totalPassed, testSummary.totalTests)
    : openTestCaseScore;

  const expectedTimeComplexity = textValue(record.expected_time_complexity) || 'Not available';
  const expectedSpaceComplexity = textValue(record.expected_space_complexity) || 'Not available';
  const expectedCodeScore =
    optionalPercentageValue(record.expected_code_score) ??
    expectedCodeSignalsScore(expectedCode, submittedCode);
  const matchedExpectedCode = matchedExpectedCodeSignals(expectedCode, submittedCode);
  const missingExpectedCode = uniqueList(expectedCode).filter(
    (signal) => !matchedExpectedCode.includes(signal),
  );
  const expectedTimeComplexityRank = resolveComplexityRank(expectedTimeComplexity);
  const expectedSpaceComplexityRank = resolveComplexityRank(expectedSpaceComplexity);
  const studentTimeComplexityRank = rankValue(record.student_time_complexity_rank);
  const studentSpaceComplexityRank = rankValue(record.student_space_complexity_rank);
  const studentTimeComplexityLabel = complexityLabelFromRank(studentTimeComplexityRank);
  const studentSpaceComplexityLabel = complexityLabelFromRank(studentSpaceComplexityRank);
  const expectedTimeComplexityScoreRank = complexityScoreRankFromDetailedRank(
    expectedTimeComplexityRank,
  );
  const expectedSpaceComplexityScoreRank = complexityScoreRankFromDetailedRank(
    expectedSpaceComplexityRank,
  );
  const studentTimeComplexityScoreRank = complexityScoreRankFromDetailedRank(
    studentTimeComplexityRank,
  );
  const studentSpaceComplexityScoreRank = complexityScoreRankFromDetailedRank(
    studentSpaceComplexityRank,
  );
  const timeComplexityRankGap = studentTimeComplexityRank - expectedTimeComplexityRank;
  const spaceComplexityRankGap = studentSpaceComplexityRank - expectedSpaceComplexityRank;
  const timeComplexityScoreRankGap =
    studentTimeComplexityScoreRank - expectedTimeComplexityScoreRank;
  const spaceComplexityScoreRankGap =
    studentSpaceComplexityScoreRank - expectedSpaceComplexityScoreRank;
  const timeComplexityScore = complexityScoreFromRanks(
    expectedTimeComplexityRank,
    studentTimeComplexityRank,
  );
  const spaceComplexityScore = complexityScoreFromRanks(
    expectedSpaceComplexityRank,
    studentSpaceComplexityRank,
  );
  const approachAnalysis = evaluateApproach(
    submittedCode,
    expectedApproach,
    studentTimeComplexityLabel,
    studentSpaceComplexityLabel,
    correctnessScore,
    hasDetectedApproachTags ? detectedApproachTags : null,
    optionalPercentageValue(record.approach_match_percentage),
  );
  const edgeCaseEvaluation = evaluateEdgeCases(
    questionId,
    openTests,
    structuredResults,
  );
  const overallQuestionScore = averageQuestionScore([
    correctnessScore,
    approachAnalysis.approachScore,
    timeComplexityScore,
    spaceComplexityScore,
    typeof edgeCaseEvaluation.score === 'number' ? edgeCaseEvaluation.score : null,
  ]);
  return {
    section: 'DSA',
    prompt_version: 'dsa-deterministic.v2',
    model: 'deterministic',
    output: {
      section: 'DSA',
      question_id: questionId,
      question_title: questionTitle,
      score_basis: SCORE_BASIS,
      expected_code_score: expectedCodeScore,
      matched_expected_code: matchedExpectedCode,
      missing_expected_code: missingExpectedCode,
      approach_match_percentage: approachAnalysis.approachMatchPercentage,
      expected_approach_used: approachAnalysis.expectedApproachUsed,
      approach_score: approachAnalysis.approachScore,
      expected_approach_tags: approachAnalysis.expectedApproachTags,
      ai_returned_approach_tags: approachAnalysis.aiReturnedApproachTags,
      open_test_case_score: openTestCaseScore,
      hidden_test_case_score: hiddenTestCaseScore,
      correctness_score: correctnessScore,
      expected_time_complexity: expectedTimeComplexity,
      expected_time_complexity_rank: expectedTimeComplexityRank,
      expected_time_complexity_label: complexityLabelFromRank(expectedTimeComplexityRank),
      expected_time_complexity_score_rank: expectedTimeComplexityScoreRank,
      student_time_complexity_rank: studentTimeComplexityRank,
      student_time_complexity_label: studentTimeComplexityLabel,
      student_time_complexity_score_rank: studentTimeComplexityScoreRank,
      time_complexity_rank_gap: timeComplexityRankGap,
      time_complexity_score_rank_gap: timeComplexityScoreRankGap,
      time_complexity_score: timeComplexityScore,
      expected_space_complexity: expectedSpaceComplexity,
      expected_space_complexity_rank: expectedSpaceComplexityRank,
      expected_space_complexity_label: complexityLabelFromRank(expectedSpaceComplexityRank),
      expected_space_complexity_score_rank: expectedSpaceComplexityScoreRank,
      student_space_complexity_rank: studentSpaceComplexityRank,
      student_space_complexity_label: studentSpaceComplexityLabel,
      student_space_complexity_score_rank: studentSpaceComplexityScoreRank,
      space_complexity_rank_gap: spaceComplexityRankGap,
      space_complexity_score_rank_gap: spaceComplexityScoreRankGap,
      space_complexity_score: spaceComplexityScore,
      edge_case_score: edgeCaseEvaluation.score,
      edge_cases_passed: edgeCaseEvaluation.passedText,
      overall_question_score: overallQuestionScore,
      open_tests_passed: formatPassed(testSummary.openPassed, testSummary.openTotal ?? openTests.length),
      hidden_tests_passed: testSummary.hiddenAvailable
        ? formatPassed(testSummary.hiddenPassed, testSummary.hiddenTotal)
        : 'Not available',
      total_tests_passed: testSummary.hiddenAvailable
        ? formatPassed(testSummary.totalPassed, testSummary.totalTests)
        : 'Not available',
      failed_case_analysis: buildFailedCaseAnalysis(
        testSummary,
        edgeCaseEvaluation,
      ),
      missed_edge_cases: edgeCaseEvaluation.missedEdgeCases,
    },
  };
}

function assertRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function textValue(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function safeNumber(value: unknown) {
  return Math.max(0, Math.round(numberValue(value, 0)));
}

function roundScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatPassed(passed: number | null, total: number | null) {
  return `${safeNumber(passed)} / ${safeNumber(total)}`;
}

function scoreRatio(passed: number | null, total: number | null) {
  if (!Number.isFinite(passed as number) || !Number.isFinite(total as number) || !total) return 0;
  return roundScore(((passed as number) / (total as number)) * 100);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => textValue(item)).filter(Boolean)
    : [];
}

function rankValue(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return 50;
  return parsed >= 1 && parsed <= 50 ? parsed : 50;
}

function compactComplexityText(value: string) {
  return normalizeText(value).replace(/\s+/g, '');
}

export function resolveComplexityRank(value: string) {
  const normalized = compactComplexityText(value);
  if (!normalized) return 50;

  for (const entry of loadComplexityRanks()) {
    const labelToken = compactComplexityText(entry.label);
    if (normalized === labelToken) {
      return entry.rank;
    }

    const aliasTokens = (entry.aliases || [])
      .map((item) => compactComplexityText(item))
      .filter(Boolean);
    if (aliasTokens.some((token) => normalized === token)) {
      return entry.rank;
    }
  }

  return 50;
}

export function rankRatioScore(expectedRank: number, studentRank: number) {
  return complexityScoreFromRanks(expectedRank, studentRank);
}

export const rankGapScore = rankRatioScore;

function complexityLabelFromRank(rank: number) {
  return loadComplexityRanks().find((entry) => entry.rank === rank)?.label || 'O(unknown)';
}

function uniqueList(value: string[]) {
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}

function normalizeSignalText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function signalMatchesCode(signal: string, code: string) {
  const normalizedSignal = normalizeSignalText(signal);
  if (!normalizedSignal) return false;

  const normalizedCode = normalizeSignalText(code);
  if (normalizedSignal.includes(' ')) {
    return normalizedCode.replace(/\s+/g, '').includes(normalizedSignal.replace(/\s+/g, ''));
  }

  return new RegExp(`(^|\\s)${escapeRegExp(normalizedSignal)}(\\s|$)`).test(normalizedCode);
}

function expectedCodeSignalsScore(expectedSignals: string[], code: string) {
  const signals = uniqueList(expectedSignals);
  if (!signals.length) return 0;
  const matched = signals.filter((signal) => signalMatchesCode(signal, code)).length;
  return roundScore((matched / signals.length) * 100);
}

function matchedExpectedCodeSignals(expectedSignals: string[], code: string) {
  const signals = uniqueList(expectedSignals);
  return signals.filter((signal) => signalMatchesCode(signal, code));
}

function caseList(value: unknown): TestCase[] {
  return Array.isArray(value)
    ? value
        .map((item) =>
          item && typeof item === 'object' && !Array.isArray(item)
            ? (item as TestCase)
            : null,
        )
        .filter((item): item is TestCase => Boolean(item))
    : [];
}

function submittedTestResults(value: JsonRecord): StructuredTestResults | null {
  const candidate = value.testResults ?? value.test_results ?? null;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;

  const rows = Array.isArray((candidate as StructuredTestResults).test_results)
    ? ((candidate as StructuredTestResults).test_results || []).filter(
        (item): item is { passed?: boolean } =>
          Boolean(item) && typeof item === 'object',
      )
    : [];
  if (!rows.length) return null;

  return {
    test_results: rows,
    total: numberOrUndefined((candidate as StructuredTestResults).total),
    passed: numberOrUndefined((candidate as StructuredTestResults).passed),
  };
}

function numberOrUndefined(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function parseTestSummary(message: unknown) {
  const match = textValue(message).match(/Test results:\s*(\d+)\/(\d+)\s*passed/i);
  if (!match) return null;
  return { passed: Number(match[1]), total: Number(match[2]) };
}

function buildTestSummary(params: {
  openTests: TestCase[];
  hiddenTests: TestCase[];
  structuredResults: StructuredTestResults | null;
  summary: { passed: number; total: number } | null;
}): TestSummary {
  const openTotal = params.openTests.length || params.summary?.total || 0;
  const hiddenTotal = params.hiddenTests.length || 0;

  if (params.structuredResults?.test_results?.length) {
    const results = params.structuredResults.test_results;
    const openCount = openTotal || Math.min(results.length, 5);
    const hiddenResults =
      hiddenTotal && results.length >= openCount + hiddenTotal
        ? results.slice(openCount, openCount + hiddenTotal)
        : [];
    const hiddenAvailable = hiddenTotal > 0 && hiddenResults.length === hiddenTotal;
    return {
      openPassed: countPassed(results.slice(0, openCount)),
      openTotal: openCount || null,
      hiddenPassed: hiddenAvailable ? countPassed(hiddenResults) : null,
      hiddenTotal: hiddenAvailable ? hiddenTotal : hiddenTotal || null,
      totalPassed:
        params.structuredResults.passed ??
        countPassed(results) ??
        results.length ??
        null,
      totalTests: params.structuredResults.total ?? results.length ?? null,
      hiddenAvailable,
    };
  }

  if (params.summary) {
    return {
      openPassed: params.summary.passed,
      openTotal: openTotal || params.summary.total || null,
      hiddenPassed: null,
      hiddenTotal: hiddenTotal || null,
      totalPassed: params.summary.passed,
      totalTests: params.summary.total,
      hiddenAvailable: false,
    };
  }

  return {
    openPassed: null,
    openTotal: openTotal || null,
    hiddenPassed: null,
    hiddenTotal: hiddenTotal || null,
    totalPassed: null,
    totalTests: null,
    hiddenAvailable: false,
  };
}

function countPassed(results: Array<{ passed?: boolean } | null | undefined>) {
  return results.filter((item) => item?.passed).length;
}

function evaluateApproach(
  code: string,
  expectedApproach: string[],
  studentTimeComplexity: string,
  studentSpaceComplexity: string,
  correctnessScore: number,
  detectedApproachTags: string[] | null,
  legacyApproachMatchPercentage?: number | null,
): ApproachAnalysis {
  const normalizedCode = normalizeText(code);
  const tokenSet = tokenSetFromText(normalizedCode);
  const normalizedExpectedTags = uniqueList(expectedApproach).map(normalizeApproachTag).filter(Boolean);
  const normalizedDetectedTags = detectedApproachTags
    ? uniqueList(detectedApproachTags).map(normalizeApproachTag).filter(Boolean)
    : [];
  const finalMatchPercentage = detectedApproachTags !== null
    ? calculateApproachMatchPercentage(normalizedExpectedTags, normalizedDetectedTags)
    : percentageValueOrThrow(legacyApproachMatchPercentage);
  const expectedApproachUsed: 'Yes' | 'Partial' | 'No' =
    finalMatchPercentage >= 70
      ? 'Yes'
      : finalMatchPercentage >= 40
        ? 'Partial'
        : 'No';
  const approachScore = roundScore(finalMatchPercentage);
  const alternateSolutionScore = alternateSolutionScoreFor(
    correctnessScore,
    studentTimeComplexity,
    studentSpaceComplexity,
  );

  return {
    approachMatchPercentage: finalMatchPercentage,
    expectedApproachUsed,
    approachScore,
    alternateSolutionScore,
    detectedApproach: detectApproach(tokenSet, normalizedCode),
    expectedApproachTags: normalizedExpectedTags,
    aiReturnedApproachTags: normalizedDetectedTags,
  };
}

function percentageValueOrThrow(value: unknown, label = 'DSA percentage') {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(`Invalid ${label} value`);
  }
  return parsed;
}

function optionalPercentageValue(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }
  return parsed;
}

function normalizeApproachTag(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function calculateApproachMatchPercentage(expectedTags: string[], detectedTags: string[]) {
  if (!expectedTags.length) return 0;
  const expectedSet = new Set(uniqueList(expectedTags).map(normalizeApproachTag).filter(Boolean));
  const detectedSet = new Set(uniqueList(detectedTags).map(normalizeApproachTag).filter(Boolean));
  if (!expectedSet.size) return 0;
  const matched = [...expectedSet].filter((tag) => detectedSet.has(tag)).length;
  return roundScore((matched / expectedSet.size) * 100);
}

function scoreApproachItem(
  item: string,
  tokenSet: Set<string>,
  normalizedCode: string,
  studentTimeComplexity: string,
  studentSpaceComplexity: string,
) {
  const point = normalizeText(item);
  if (!point) return 0;

  if (containsComplexity(point)) {
    const expectedRank = resolveComplexityRank(point);
    return expectedRank > 0 &&
      (resolveComplexityRank(studentTimeComplexity) === expectedRank ||
        resolveComplexityRank(studentSpaceComplexity) === expectedRank)
      ? 1
      : 0;
  }

  const tokens = tokenize(point).filter((token) => !STOP_WORDS.has(token));
  if (!tokens.length) return 0;

  const matched = tokens.filter((token) => tokenMatches(tokenSet, normalizedCode, token)).length;
  if (matched >= Math.max(2, Math.ceil(tokens.length * 0.6))) return 1;
  if (matched >= Math.max(1, Math.ceil(tokens.length * 0.3))) return 0.5;

  const hint = tokens.some((token) =>
    /bitmask|mask|subset|dp|memo|dfs|bfs|cycle|topolog|heap|queue|sort|graph|prerequis|deadline|duration|adjacency/.test(
      token,
    ),
  );
  return hint ? 0.5 : 0;
}

function containsComplexity(text: string) {
  return /o\s*\(/i.test(text) || /\b(n|m|k)\b.*[!*^]|2\^|log/i.test(text);
}

function alternateSolutionScoreFor(
  correctnessScore: number,
  studentTimeComplexity: string,
  studentSpaceComplexity: string,
) {
  const timeRank = resolveComplexityRank(studentTimeComplexity);
  const spaceRank = resolveComplexityRank(studentSpaceComplexity);
  const strongComplexity = timeRank > 0 && timeRank <= 3 && spaceRank > 0 && spaceRank <= 3;

  if (correctnessScore >= 100 && strongComplexity) return 100;
  if (correctnessScore >= 95 && strongComplexity) return 80;
  if (correctnessScore >= 80) return 60;
  if (correctnessScore >= 40) return 40;
  return 0;
}

function evaluateEdgeCases(
  questionId: string,
  tests: TestCase[],
  structuredResults: StructuredTestResults | null,
): EdgeCaseEvaluation {
  const indexes = identifyEdgeCaseIndexes(questionId, tests);
  if (!indexes.length) {
    return {
      available: false,
      score: 'Not available',
      passedText: 'Not available',
      missedEdgeCases: [],
    };
  }

  const results = structuredResults?.test_results || [];
  if (!results.length || indexes.some((index) => index >= results.length)) {
    return {
      available: false,
      score: 'Not available',
      passedText: 'Not available',
      missedEdgeCases: indexes.map((index) => describeTestCase(tests[index], index)),
    };
  }

  const passed = indexes.filter((index) => results[index]?.passed).length;
  const total = indexes.length;
  return {
    available: true,
    score: roundScore((passed / total) * 100),
    passedText: `${passed} / ${total}`,
    missedEdgeCases: indexes
      .filter((index) => !results[index]?.passed)
      .map((index) => describeTestCase(tests[index], index)),
  };
}

function identifyEdgeCaseIndexes(questionId: string, tests: TestCase[]) {
  const hints =
    EDGE_CASE_HINTS[questionId] ||
    [/\bcycle\b/i, /\bself\b/i, /\bboundary\b/i, /\bempty\b/i, /\bduplicate\b/i, /\bunreachable\b/i, /\blarge\b/i];

  return tests
    .map((test, index) => ({ test, index }))
    .filter(({ test }) => {
      const text = [
        textValue(test.id),
        textValue(test.number),
        textValue(test.input),
        textValue(test.expected),
        textValue(test.expected_output),
        textValue(test.purpose),
        stringList(test.tags).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return hints.some((pattern) => pattern.test(text));
    })
    .map(({ index }) => index);
}

function evaluateBruteForceRisk(
  timeComplexityScore: number,
  spaceComplexityScore: number,
  hiddenTestCaseScore: number | 'Not available',
) {
  const timeRisk = 100 - timeComplexityScore;
  const spaceRisk = 100 - spaceComplexityScore;
  if (typeof hiddenTestCaseScore === 'number') {
    return roundScore(
      0.5 * timeRisk + 0.2 * spaceRisk + 0.3 * (100 - hiddenTestCaseScore),
    );
  }
  return roundScore(0.7 * timeRisk + 0.3 * spaceRisk);
}

function evaluateCodeQuality(code: string): CodeQualityScores {
  const normalized = code || '';
  const lines = normalized.split(/\r?\n/);
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  const avgLineLength =
    nonEmpty.length > 0
      ? nonEmpty.reduce((sum, line) => sum + line.length, 0) / nonEmpty.length
      : 0;
  const maxLineLength = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const commentLines = lines.filter((line) => /^\s*(#|\/\/|\/\*|\*|--)/.test(line)).length;
  const helperCount = (normalized.match(/\b(function|def|class|private|public|static)\b/g) || []).length;
  const loopCountValue = loopCount(normalizeText(code));
  const conditionalCount = (normalized.match(/\b(if|switch|case|else if)\b/g) || []).length;
  const tokenSet = tokenSetFromText(normalizeText(code));
  const shortIdentifierCount = [...tokenSet].filter(
    (token) => token.length <= 2 && !/^\d+$/.test(token),
  ).length;
  const numericLiteralCount = (normalized.match(/\b\d+\b/g) || []).length;
  const suspiciousHardcoding =
    /if\s*\(\s*[a-z_][a-z0-9_]*\s*==\s*\d+\s*\)/i.test(normalized) ||
    /\bcase\s+\d+\b/i.test(normalized) ||
    /\breturn\s+\[[^\]]{20,}\]/i.test(normalized) ||
    numericLiteralCount > 12;

  const readabilityScore = clampQuality(
    88 - (avgLineLength > 110 ? 10 : avgLineLength > 90 ? 5 : 0) - (maxLineLength > 140 ? 8 : maxLineLength > 110 ? 4 : 0) - (commentLines === 0 && nonEmpty.length > 20 ? 4 : 0),
  );
  const modularityScore = clampQuality(helperCount >= 4 ? 95 : helperCount === 3 ? 88 : helperCount === 2 ? 80 : helperCount === 1 ? 68 : 58);
  const namingScore = clampQuality(92 - roundScore((shortIdentifierCount / (tokenSet.size || 1)) * 45));
  const simplicityScore = clampQuality(90 - Math.max(0, loopCountValue - 2) * 8 - Math.max(0, conditionalCount - 8) * 2);
  const noHardcodingScore = clampQuality(95 - (suspiciousHardcoding ? Math.min(60, 20 + numericLiteralCount * 2) : Math.min(15, numericLiteralCount)));

  const codeQualityScore = roundScore(
    readabilityScore * 0.25 +
      modularityScore * 0.2 +
      namingScore * 0.15 +
      simplicityScore * 0.2 +
      noHardcodingScore * 0.2,
  );

  return {
    readabilityScore,
    modularityScore,
    namingScore,
    simplicityScore,
    noHardcodingScore,
    codeQualityScore,
  };
}

function clampQuality(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function calculateProblemSolvingScore(params: {
  correctnessScore: number;
  finalApproachScore: number;
  timeComplexityScore: number;
  spaceComplexityScore: number;
  edgeCaseScore: number | 'Not available';
  codeQualityScore: number;
  edgeCaseAvailable: boolean;
  hiddenAvailable: boolean;
}) {
  const useEdgeCaseWeights =
    params.edgeCaseAvailable &&
    params.hiddenAvailable &&
    typeof params.edgeCaseScore === 'number';

  const weights: Array<[number, number]> = useEdgeCaseWeights
    ? [
        [params.correctnessScore, 0.35],
        [params.finalApproachScore, 0.2],
        [params.timeComplexityScore, 0.15],
        [params.spaceComplexityScore, 0.1],
        [typeof params.edgeCaseScore === 'number' ? params.edgeCaseScore : 0, 0.1],
        [params.codeQualityScore, 0.1],
      ]
    : [
        [params.correctnessScore, 0.4],
        [params.finalApproachScore, 0.25],
        [params.timeComplexityScore, 0.15],
        [params.spaceComplexityScore, 0.1],
        [params.codeQualityScore, 0.1],
      ];

  return roundScore(weightedSum(weights));
}

function weightedSum(entries: Array<[number, number]>) {
  return entries.reduce((sum, [score, weight]) => sum + score * weight, 0);
}

function averageQuestionScore(scores: Array<number | null | undefined>) {
  const values = scores.filter(
    (score): score is number => typeof score === 'number' && Number.isFinite(score),
  );
  if (!values.length) return 0;
  return roundScore(values.reduce((sum, score) => sum + score, 0) / values.length);
}

function riskLevel(score: number): 'Low' | 'Medium' | 'High' {
  if (score <= 30) return 'Low';
  if (score <= 60) return 'Medium';
  return 'High';
}

function placementLabel(
  problemSolvingScore: number,
  bruteForceRisk: 'Low' | 'Medium' | 'High',
  hardcodingRisk: 'Low' | 'Medium' | 'High',
) {
  if (
    problemSolvingScore >= 90 &&
    bruteForceRisk === 'Low' &&
    hardcodingRisk === 'Low'
  ) {
    return 'Elite 1% Company Ready';
  }
  if (
    problemSolvingScore >= 75 &&
    bruteForceRisk !== 'High' &&
    hardcodingRisk === 'Low'
  ) {
    return 'Strong Company Ready';
  }
  if (problemSolvingScore >= 65 && hardcodingRisk !== 'High') {
    return 'Near Ready';
  }
  if (bruteForceRisk === 'High' || hardcodingRisk === 'High') {
    return 'Risky High Scorer';
  }
  if (problemSolvingScore >= 45) {
    return 'Trainable but Not Ready';
  }
  return 'Not Ready';
}

function optimizationLevel(
  problemSolvingScore: number,
  bruteForceRisk: 'Low' | 'Medium' | 'High',
  hardcodingRisk: 'Low' | 'Medium' | 'High',
) {
  if (
    problemSolvingScore >= 85 &&
    bruteForceRisk === 'Low' &&
    hardcodingRisk === 'Low'
  ) {
    return 'Optimal';
  }
  if (problemSolvingScore >= 70 && bruteForceRisk !== 'High' && hardcodingRisk !== 'High') {
    return 'Acceptable';
  }
  if (bruteForceRisk === 'High') {
    return 'Brute Force';
  }
  if (hardcodingRisk === 'High') {
    return 'Incorrect';
  }
  return 'Inefficient';
}

function buildStrengths(
  correctnessScore: number,
  approachAnalysis: ApproachAnalysis,
  timeComplexityScore: number,
  spaceComplexityScore: number,
  codeQuality: CodeQualityScores,
  edgeCaseEvaluation: EdgeCaseEvaluation,
) {
  const strengths: string[] = [];
  if (correctnessScore >= 80) strengths.push('Strong visible test correctness.');
  if (approachAnalysis.expectedApproachUsed !== 'No') {
    strengths.push('Shows alignment with the expected DSA pattern.');
  }
  if (timeComplexityScore >= 80) strengths.push('Runtime complexity rank is close to or better than the target.');
  if (spaceComplexityScore >= 80) strengths.push('Memory complexity rank is close to or better than the target.');
  if (codeQuality.codeQualityScore >= 75) strengths.push('Code structure is readable and maintainable.');
  if (edgeCaseEvaluation.available && typeof edgeCaseEvaluation.score === 'number' && edgeCaseEvaluation.score >= 75) {
    strengths.push('Handles tagged edge cases well.');
  }
  return strengths.slice(0, 4);
}

function buildWeaknesses(
  correctnessScore: number,
  approachAnalysis: ApproachAnalysis,
  timeComplexityScore: number,
  spaceComplexityScore: number,
  codeQuality: CodeQualityScores,
  edgeCaseEvaluation: EdgeCaseEvaluation,
) {
  const weaknesses: string[] = [];
  if (correctnessScore < 70) weaknesses.push('Visible test correctness needs improvement.');
  if (approachAnalysis.expectedApproachUsed === 'No') weaknesses.push('Expected approach is not clearly visible in the code.');
  if (timeComplexityScore < 70) weaknesses.push('Runtime complexity rank is weaker than the target.');
  if (spaceComplexityScore < 70) weaknesses.push('Memory complexity rank is weaker than the target.');
  if (codeQuality.noHardcodingScore < 70) weaknesses.push('Hardcoded logic or literal-heavy code was detected.');
  if (!edgeCaseEvaluation.available) weaknesses.push('Edge-case coverage could not be measured from the available evidence.');
  return weaknesses.slice(0, 4);
}

function buildRecommendation(
  correctnessScore: number,
  approachAnalysis: ApproachAnalysis,
  timeComplexityScore: number,
  spaceComplexityScore: number,
  codeQuality: CodeQualityScores,
  edgeCaseEvaluation: EdgeCaseEvaluation,
) {
  if (correctnessScore >= 85 && timeComplexityScore >= 80 && spaceComplexityScore >= 80) {
    return 'Keep this approach, tighten the edge-case handling, and verify the final submission against the full hidden suite.';
  }
  if (approachAnalysis.expectedApproachUsed === 'No') {
    return 'Rework the solution around the expected algorithmic pattern and re-run the hidden cases.';
  }
  if (codeQuality.noHardcodingScore < 70) {
    return 'Remove hardcoded assumptions and replace them with reusable logic and cleaner abstractions.';
  }
  if (!edgeCaseEvaluation.available) {
    return 'Run the submitted solution against tagged edge cases so the edge-case score can be measured directly.';
  }
  return 'Improve the weakest dimension first, then re-check correctness, complexity, and edge-case coverage.';
}

function buildFailedCaseAnalysis(
  summary: TestSummary,
  edgeCaseEvaluation: EdgeCaseEvaluation,
) {
  const analysis: string[] = [];
  if (summary.hiddenAvailable && typeof summary.hiddenPassed === 'number' && summary.hiddenTotal) {
    const missed = summary.hiddenTotal - summary.hiddenPassed;
    if (missed > 0) analysis.push(`${missed} hidden test case(s) failed.`);
  }
  if (!edgeCaseEvaluation.available) {
    analysis.push('Edge-case failures could not be isolated from tagged cases.');
  } else if (edgeCaseEvaluation.missedEdgeCases.length) {
    analysis.push(`Missed edge cases: ${edgeCaseEvaluation.missedEdgeCases.join(', ')}.`);
  }
  return analysis.length ? analysis : ['No major failure pattern detected from the available evidence.'];
}

function buildSummary(
  questionTitle: string,
  correctnessScore: number,
  expectedCodeScore: number,
  timeComplexityScore: number,
  spaceComplexityScore: number,
  edgeCaseEvaluation: EdgeCaseEvaluation,
  overallQuestionScore: number,
) {
  const edgeText =
    typeof edgeCaseEvaluation.score === 'number'
      ? `${edgeCaseEvaluation.score}/100 edge-case coverage`
      : 'edge-case coverage not available';
  return `${questionTitle}: correctness ${correctnessScore}/100, expected code checklist ${expectedCodeScore}/100, time ${timeComplexityScore}/100, space ${spaceComplexityScore}/100, ${edgeText}, overall ${overallQuestionScore}/100.`;
}

function compilationBehavior(summary: string, status: string) {
  const text = `${summary} ${status}`.toLowerCase();
  if (text.includes('fail') || text.includes('error') || text.includes('syntax')) {
    return 'Failed';
  }
  if (text.includes('warn')) {
    return 'Warnings';
  }
  return 'Clean';
}

function detectApproach(tokenSet: Set<string>, normalizedCode: string) {
  if (tokenSet.has('bitmask') || tokenSet.has('subset') || tokenSet.has('dp')) {
    return 'Bitmask dynamic programming';
  }
  if (tokenSet.has('topological') || tokenSet.has('dfs') || tokenSet.has('cycle')) {
    return 'Graph traversal and cycle detection';
  }
  if (tokenSet.has('heap') || tokenSet.has('priority') || tokenSet.has('queue')) {
    return 'Heap or priority-queue driven solution';
  }
  if (tokenSet.has('memo') || tokenSet.has('memoization')) {
    return 'Memoized recursive solution';
  }
  if (tokenSet.has('backtrack') || tokenSet.has('permutation')) {
    return 'Brute-force backtracking';
  }
  if (normalizedCode.includes('sort')) {
    return 'Sorting and greedy selection';
  }
  return 'Code analysis did not reveal a strong named pattern.';
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

function tokenSetFromText(value: string) {
  return new Set(tokenize(value));
}

function tokenMatches(tokenSet: Set<string>, normalizedCode: string, token: string) {
  const variants = singularVariants(token);
  return variants.some((variant) => tokenSet.has(variant) || normalizedCode.includes(variant));
}

function singularVariants(token: string) {
  const variants = new Set<string>([token]);
  if (token.endsWith('ies') && token.length > 3) {
    variants.add(`${token.slice(0, -3)}y`);
  } else if (token.endsWith('es') && token.length > 3) {
    variants.add(token.slice(0, -2));
  } else if (token.endsWith('s') && token.length > 3) {
    variants.add(token.slice(0, -1));
  }
  return [...variants].filter(Boolean);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/['"`]/g, ' ')
    .replace(/[^a-z0-9_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function loopCount(code: string) {
  const matches = code.match(/\b(for|while)\b/g);
  return matches ? matches.length : 0;
}

function describeTestCase(test: TestCase | undefined, fallbackIndex: number) {
  if (!test) return `edge-case test ${fallbackIndex + 1}`;
  const id = textValue(test.id);
  const purpose = textValue(test.purpose);
  return id || purpose || `edge-case test ${fallbackIndex + 1}`;
}
