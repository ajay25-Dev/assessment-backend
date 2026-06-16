import { EvaluationResult } from './evaluation.types';

type JsonRecord = Record<string, unknown>;
type WeightedPart = { score: number | null; weight: number };
type OopsScores = {
  class_design_score: number;
  abstraction_score: number;
  encapsulation_score: number;
  polymorphism_score: number;
  extensibility_score: number;
  separation_of_concerns_score: number;
  solid_principles_score: number;
  error_handling_score: number;
  code_readability_score: number;
  design_pattern_awareness_score: number;
};
type ResolvedCase = {
  id: string;
  passed: boolean;
  purpose: string;
  tags: string[];
};

const DIMENSION_TAGS: Record<keyof OopsScores, string[]> = {
  class_design_score: [
    'class-design',
    'class-structure',
    'workflow-abstraction',
    'payment-abstraction',
    'exporter-abstraction',
    'issue-abstraction',
  ],
  abstraction_score: [
    'workflow-abstraction',
    'payment-abstraction',
    'exporter-abstraction',
    'issue-abstraction',
    'interface',
    'abstract',
    'contract',
  ],
  encapsulation_score: [
    'encapsulation',
    'private-state',
    'encapsulated-state',
    'controlled-state',
  ],
  polymorphism_score: ['polymorphism', 'strategy-pattern', 'state-pattern'],
  extensibility_score: [
    'open-closed',
    'extension-hook',
    'registry-pattern',
    'factory-pattern',
    'new-workflow-without-engine-change',
    'new-payment-mode-without-checkout-change',
    'new-exporter-without-design-file-change',
  ],
  separation_of_concerns_score: [
    'separation-of-concerns',
    'domain-service-boundary',
    'service-delegates-to-strategy',
    'validation-separation',
  ],
  solid_principles_score: [
    'single-responsibility',
    'open-closed',
    'dependency-inversion',
    'interface-segregation',
    'liskov-substitution',
  ],
  error_handling_score: [
    'invalid-transition-handling',
    'controlled-failure',
    'result-object',
    'unsupported-format-handling',
    'payment-processing-failure',
    'validation-with-strategy',
  ],
  code_readability_score: [
    'code-readability',
    'clear-structure',
    'organization',
    'concise',
    'naming',
  ],
  design_pattern_awareness_score: [
    'strategy-pattern',
    'state-pattern',
    'factory-pattern',
    'registry-pattern',
  ],
};

const READINESS_LABELS = {
  elite: 'Elite 1% Company Ready',
  strong: 'Strong Company Ready',
  near: 'Near Ready',
  trainable: 'Trainable but Not Ready',
  risky: 'Risky High Scorer',
  notReady: 'Not Ready',
} as const;

export function evaluateOopsSubmission(input: unknown): EvaluationResult {
  const record = assertRecord(input);
  const questionId = textValue(record.question_id);
  const questionTitle = textValue(record.question_title, questionId || 'OOPs Question');
  const testCases = resolveTestCases(record);
  const expectedOopsTags = normalizeTags(stringList(record.expected_oops_tags));
  const allowedRedFlags = normalizeTags(stringList(record.red_flag_tags));
  const passedCases = testCases.filter((item) => item.passed);
  const detectedOopsTags = uniqueList(
    passedCases.flatMap((item) => item.tags),
  );

  const classDesignScore = scoreDimension(testCases, DIMENSION_TAGS.class_design_score);
  const abstractionScore = scoreDimension(testCases, DIMENSION_TAGS.abstraction_score);
  const encapsulationScore = scoreDimension(testCases, DIMENSION_TAGS.encapsulation_score);
  const polymorphismScore = scoreDimension(testCases, DIMENSION_TAGS.polymorphism_score);
  const extensibilityScore = scoreDimension(testCases, DIMENSION_TAGS.extensibility_score);
  const separationOfConcernsScore = scoreDimension(
    testCases,
    DIMENSION_TAGS.separation_of_concerns_score,
  );
  const solidPrinciplesScore = scoreDimension(testCases, DIMENSION_TAGS.solid_principles_score);
  const errorHandlingScore = scoreDimension(testCases, DIMENSION_TAGS.error_handling_score);
  const codeReadabilityScore = scoreDimension(testCases, DIMENSION_TAGS.code_readability_score);
  const designPatternAwarenessScore = scoreDimension(
    testCases,
    DIMENSION_TAGS.design_pattern_awareness_score,
  );

  const scores: OopsScores = {
    class_design_score: classDesignScore,
    abstraction_score: abstractionScore,
    encapsulation_score: encapsulationScore,
    polymorphism_score: polymorphismScore,
    extensibility_score: extensibilityScore,
    separation_of_concerns_score: separationOfConcernsScore,
    solid_principles_score: solidPrinciplesScore,
    error_handling_score: errorHandlingScore,
    code_readability_score: codeReadabilityScore,
    design_pattern_awareness_score: designPatternAwarenessScore,
  };

  const overallQuestionScore = weightedScore([
    { score: scores.class_design_score, weight: 20 },
    { score: scores.abstraction_score, weight: 10 },
    { score: scores.encapsulation_score, weight: 10 },
    { score: scores.polymorphism_score, weight: 10 },
    { score: scores.extensibility_score, weight: 15 },
    { score: scores.separation_of_concerns_score, weight: 10 },
    { score: scores.solid_principles_score, weight: 10 },
    { score: scores.error_handling_score, weight: 5 },
    { score: scores.code_readability_score, weight: 5 },
    { score: scores.design_pattern_awareness_score, weight: 5 },
  ]);

  const detectedClasses = normalizeTags(stringList(record.required_classes));
  const detectedAbstractions = normalizeTags(stringList(record.required_abstractions));
  const detectedPatterns = normalizeTags(stringList(record.required_patterns));

  const missingComponents = uniqueList([
    ...scoreCoverage(expectedOopsTags, detectedOopsTags),
    ...missingByScore(scores),
  ]);
  const redFlags = inferRedFlags(scores, allowedRedFlags);
  const keyStrengths = buildStrengths(scores, overallQuestionScore, testCases.length);
  const keyWeaknesses = buildWeaknesses(scores, missingComponents, redFlags, testCases.length);

  return {
    section: 'OOPs',
    prompt_version: 'oops-testcase-deterministic.v1',
    model: 'deterministic',
    output: {
      section: 'OOPs',
      question_id: questionId,
      question_title: questionTitle,
      ...scores,
      overall_question_score: overallQuestionScore,
      design_maturity_label: designMaturityLabel(overallQuestionScore, redFlags),
      placement_readiness_label: placementReadinessLabel(overallQuestionScore, redFlags),
      identified_classes: detectedClasses,
      identified_interfaces_or_abstractions: detectedAbstractions,
      design_patterns_detected: detectedPatterns,
      missing_components: missingComponents,
      red_flags: redFlags,
      key_strengths: keyStrengths,
      key_weaknesses: keyWeaknesses,
      improvement_recommendation: buildRecommendation(missingComponents, redFlags, scores),
      evidence_reasoning_summary: `Derived from ${testCases.length} structured OOPs test case(s).`,
      detected_oops_tags: detectedOopsTags,
      expected_oops_tags: expectedOopsTags,
      open_tests_passed: countCases(testCases, 'open'),
      hidden_tests_passed: countCases(testCases, 'hidden'),
      total_tests_passed: `${passedCases.length} / ${testCases.length}`,
    },
  };
}

function assertRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function textValue(value: unknown, fallback = '') {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeTags(values: string[]) {
  return uniqueList(values.map(normalizeTag).filter(Boolean));
}

function uniqueList(values: string[]) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function normalizeTag(value: string) {
  return String(value || '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function resolveTestCases(record: JsonRecord): ResolvedCase[] {
  const bankCases = caseList(record.test_cases);
  const openCases = caseList(record.open_test_cases);
  const hiddenCases = caseList(record.hidden_test_cases);
  const rawResults = extractRuntimeCases(record);

  const sourceCases = rawResults.length
    ? rawResults.map((result, index) => ({
        id: textValue(result.id, `case_${index + 1}`),
        passed: Boolean(result.passed),
        purpose: textValue(result.purpose || result.label || result.description),
        tags: normalizeTags(
          stringList(result.tags).length
            ? stringList(result.tags)
            : stringList(bankCases[index]?.tags),
        ),
      }))
    : (bankCases.length ? bankCases : [...openCases, ...hiddenCases]).map((testCase, index) => ({
        id: textValue(testCase.id, `case_${index + 1}`),
        passed: false,
        purpose: textValue(testCase.purpose),
        tags: normalizeTags(stringList(testCase.tags)),
      }));

  return sourceCases.map((item) => ({
    ...item,
    tags: normalizeTags(item.tags),
  }));
}

function extractRuntimeCases(record: JsonRecord) {
  const runtime = record.test_results || record.testResults;
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) return [];
  const value = runtime as JsonRecord;
  const cases = Array.isArray(value.test_results) ? value.test_results : [];
  return cases
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => item as JsonRecord);
}

function caseList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) as Array<
    Record<string, unknown> & { tags?: unknown }
  >;
}

function scoreDimension(cases: ResolvedCase[], keywords: string[]) {
  const relevant = cases.filter((item) =>
    item.tags.some((tag) => keywords.some((keyword) => tag.includes(keyword))),
  );
  if (!relevant.length) return 0;
  const passed = relevant.filter((item) => item.passed).length;
  return clampScore((passed / relevant.length) * 100);
}

function scoreCoverage(expectedValues: string[], detectedValues: string[]) {
  const expected = normalizeTags(expectedValues);
  const detected = new Set(normalizeTags(detectedValues));
  if (!expected.length) return [];
  return expected.filter((tag) => !detected.has(tag));
}

function countCases(cases: ResolvedCase[], bucket: 'open' | 'hidden') {
  const indexed = cases.filter((item) =>
    bucket === 'open'
      ? item.id.toLowerCase().startsWith('open_')
      : item.id.toLowerCase().startsWith('hidden_'),
  );
  const passed = indexed.filter((item) => item.passed).length;
  return `${passed} / ${indexed.length || 0}`;
}

function missingByScore(scores: OopsScores) {
  const missing: string[] = [];
  if (scores.class_design_score < 70) missing.push('class-design');
  if (scores.abstraction_score < 70) missing.push('workflow-abstraction');
  if (scores.encapsulation_score < 70) missing.push('encapsulation');
  if (scores.polymorphism_score < 70) missing.push('polymorphism');
  if (scores.extensibility_score < 70) missing.push('open-closed');
  if (scores.separation_of_concerns_score < 70) missing.push('separation-of-concerns');
  if (scores.solid_principles_score < 70) missing.push('single-responsibility');
  if (scores.error_handling_score < 70) missing.push('result-object');
  if (scores.code_readability_score < 70) missing.push('code-readability');
  if (scores.design_pattern_awareness_score < 70) missing.push('strategy-pattern');
  return missing;
}

function inferRedFlags(scores: OopsScores, allowedRedFlags: string[]) {
  const inferred: string[] = [];
  if (scores.class_design_score < 40) inferred.push('no-class-structure');
  if (scores.polymorphism_score < 40) inferred.push('type-switching');
  if (scores.encapsulation_score < 40) inferred.push('public-mutable-state');
  if (scores.extensibility_score < 40) inferred.push('new-type-requires-core-change');
  if (scores.error_handling_score < 40) inferred.push('no-error-handling');
  if (scores.separation_of_concerns_score < 40) inferred.push('single-procedural-function');
  if (scores.code_readability_score < 40) inferred.push('mixed-responsibilities');

  const normalized = uniqueList(inferred);
  if (!allowedRedFlags.length) return normalized;
  return normalized.filter((tag) => allowedRedFlags.includes(tag));
}

function weightedScore(parts: WeightedPart[]) {
  const valid = parts.filter((part) => part.score !== null && Number.isFinite(part.score));
  if (!valid.length) return 0;
  const totalWeight = valid.reduce((sum, part) => sum + part.weight, 0);
  if (!totalWeight) return 0;
  return clampScore(
    valid.reduce((sum, part) => sum + Number(part.score) * part.weight, 0) / totalWeight,
  );
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function designMaturityLabel(score: number, redFlags: string[]) {
  if (redFlags.includes('single-procedural-function') || score < 35) return 'Procedural';
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Average';
  return 'Weak';
}

function placementReadinessLabel(score: number, redFlags: string[]) {
  const severeRedFlags = redFlags.filter((flag) =>
    ['single-procedural-function', 'no-class-structure', 'hardcoded-example'].includes(flag),
  );
  if (score >= 70 && severeRedFlags.length) return READINESS_LABELS.risky;
  if (score >= 90 && !redFlags.length) return READINESS_LABELS.elite;
  if (score >= 80 && severeRedFlags.length === 0) return READINESS_LABELS.strong;
  if (score >= 65 && severeRedFlags.length === 0) return READINESS_LABELS.near;
  if (score >= 45) return READINESS_LABELS.trainable;
  return READINESS_LABELS.notReady;
}

function buildStrengths(scores: OopsScores, overall: number, totalCases: number) {
  const strengths: string[] = [];
  if (overall >= 80) strengths.push(`Overall OOPs design is strong across ${totalCases} test cases.`);
  if (scores.class_design_score >= 80) strengths.push('Required class design coverage is strong.');
  if (scores.abstraction_score >= 80) strengths.push('Abstractions and contracts are covered.');
  if (scores.design_pattern_awareness_score >= 80) strengths.push('Expected design patterns are applied.');
  if (scores.solid_principles_score >= 80) strengths.push('SOLID principles are visible.');
  if (scores.error_handling_score >= 80) strengths.push('Failure and validation cases are handled.');
  if (scores.code_readability_score >= 75) strengths.push('The design is readable and organized.');
  return uniqueList(strengths);
}

function buildWeaknesses(
  scores: OopsScores,
  missingComponents: string[],
  redFlags: string[],
  totalCases: number,
) {
  const weaknesses: string[] = [];
  if (scores.class_design_score < 60) weaknesses.push('Class design coverage is weak.');
  if (scores.abstraction_score < 60) weaknesses.push('Abstractions or contracts are incomplete.');
  if (scores.extensibility_score < 60) weaknesses.push('Extensibility is not demonstrated strongly.');
  if (scores.error_handling_score < 60) weaknesses.push('Validation or error handling needs work.');
  if (scores.code_readability_score < 60) weaknesses.push('Code readability or structure is weak.');
  if (redFlags.length) {
    redFlags.slice(0, 3).forEach((flag) => weaknesses.push(`Red flag detected: ${flag}.`));
  }
  if (missingComponents.length) {
    missingComponents.slice(0, 3).forEach((item) =>
      weaknesses.push(`Missing expected evidence: ${item}.`),
    );
  }
  if (totalCases < 20) weaknesses.push('Not all OOPs test cases were available.');
  return uniqueList(weaknesses);
}

function buildRecommendation(
  missingComponents: string[],
  redFlags: string[],
  scores: OopsScores,
) {
  if (redFlags.includes('no-class-structure')) {
    return 'Introduce a clear class or interface hierarchy before refining the design.';
  }
  const focus: string[] = [];
  if (scores.class_design_score < 70) focus.push('define clearer classes and responsibilities');
  if (scores.abstraction_score < 70) focus.push('add interfaces or abstract contracts');
  if (scores.extensibility_score < 70) focus.push('show extension points for new variants');
  if (scores.error_handling_score < 70) focus.push('handle validation and failure cases');
  if (missingComponents.length) focus.push(`cover ${missingComponents[0]}`);
  return focus.length
    ? `Refine the design to ${focus.slice(0, 3).join(', ')}.`
    : 'Keep the class boundaries, abstractions, and extension points explicit.';
}
