import { EvaluationResult } from './evaluation.types';

type JsonRecord = Record<string, unknown>;
type WeightedPart = { score: number | null; weight: number };
type OopsScores = {
  abstraction_score: number | null;
  encapsulation_score: number | null;
  polymorphism_score: number | null;
  solid_principles_score: number | null;
};
type ResolvedCase = {
  id: string;
  passed: boolean;
  purpose: string;
  tags: string[];
};

const DIMENSION_TAGS: Record<keyof OopsScores, string[]> = {
  abstraction_score: [
    'class-design',
    'workflow-abstraction',
    'payment-abstraction',
    'notification-abstraction',
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
  polymorphism_score: ['polymorphism', 'strategy-pattern', 'state-pattern', 'interface'],
  solid_principles_score: [
    'single-responsibility',
    'open-closed',
    'dependency-inversion',
    'interface-segregation',
    'liskov-substitution',
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
  const questionTitle = textValue(
    record.question_title,
    questionId || 'OOPs Question',
  );
  const submittedCode = textValue(record.submitted_code);
  const testCases = resolveTestCases(record);
  const expectedOopsTags = normalizeTags(stringList(record.expected_oops_tags));
  const allowedRedFlags = normalizeTags(stringList(record.red_flag_tags));
  const passedCases = testCases.filter((item) => item.passed);
  const candidateOopsTags = uniqueList([
    ...expectedOopsTags,
    ...testCases.flatMap((item) => item.tags),
  ]);
  const detectedOopsTags = submittedCode.trim()
    ? candidateOopsTags.filter((tag) => oopsTagPass(submittedCode, tag, questionId))
    : uniqueList(passedCases.flatMap((item) => item.tags));

  const abstractionScore = scoreDimension(
    testCases,
    DIMENSION_TAGS.abstraction_score,
  );
  const encapsulationScore = scoreDimension(
    testCases,
    DIMENSION_TAGS.encapsulation_score,
  );
  const polymorphismScore = scoreDimension(
    testCases,
    DIMENSION_TAGS.polymorphism_score,
  );
  const solidPrinciplesScore = scoreDimension(
    testCases,
    DIMENSION_TAGS.solid_principles_score,
  );

  const scores: OopsScores = {
    abstraction_score: abstractionScore,
    encapsulation_score: encapsulationScore,
    polymorphism_score: polymorphismScore,
    solid_principles_score: solidPrinciplesScore,
  };

  const overallQuestionScore = weightedScore([
    { score: scores.abstraction_score, weight: 25 },
    { score: scores.encapsulation_score, weight: 25 },
    { score: scores.polymorphism_score, weight: 25 },
    { score: scores.solid_principles_score, weight: 25 },
  ]);

  const detectedClasses = normalizeTags(stringList(record.required_classes));
  const detectedAbstractions = normalizeTags(
    stringList(record.required_abstractions),
  );
  const detectedPatterns = normalizeTags(stringList(record.required_patterns));

  const missingComponents = uniqueList([
    ...scoreCoverage(expectedOopsTags, detectedOopsTags),
    ...missingByScore(scores),
  ]);
  const redFlags = inferRedFlags(scores, allowedRedFlags);
  const keyStrengths = buildStrengths(
    scores,
    overallQuestionScore,
    testCases.length,
  );
  const keyWeaknesses = buildWeaknesses(
    scores,
    missingComponents,
    redFlags,
    testCases.length,
  );

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
      design_maturity_label: designMaturityLabel(
        overallQuestionScore,
        redFlags,
      ),
      placement_readiness_label: placementReadinessLabel(
        overallQuestionScore,
        redFlags,
      ),
      identified_classes: detectedClasses,
      identified_interfaces_or_abstractions: detectedAbstractions,
      design_patterns_detected: detectedPatterns,
      missing_components: missingComponents,
      red_flags: redFlags,
      key_strengths: keyStrengths,
      key_weaknesses: keyWeaknesses,
      improvement_recommendation: buildRecommendation(
        missingComponents,
        redFlags,
        scores,
      ),
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
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
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
  return [
    ...new Set(values.map((value) => String(value).trim()).filter(Boolean)),
  ];
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

function oopsTagPass(sourceCode: string, tag: string, questionId = '') {
  const source = String(sourceCode || '');
  const has = (...patterns: RegExp[]) =>
    patterns.every((pattern) => pattern.test(source));
  const hasAny = (...patterns: RegExp[]) =>
    patterns.some((pattern) => pattern.test(source));
  const hasClassStructure = hasAny(
    /\bclass\b/i,
    /\binterface\b/i,
    /\babstract\b/i,
    /\bstruct\b/i,
  );
  const tagKey = normalizeTag(tag);

  if (tagKey === 'class-design' || tagKey === 'class-structure') {
    return hasClassStructure;
  }
  if (tagKey === 'interface') return /\binterface\b|\babstract\b/i.test(source);
  if (tagKey === 'payment-abstraction') {
    return hasClassStructure && /(payment|checkout|transaction)/i.test(source);
  }
  if (tagKey === 'notification-abstraction') {
    return hasClassStructure && /(notification|channel|alert)/i.test(source);
  }
  if (tagKey === 'workflow-abstraction' || tagKey === 'issue-abstraction') {
    return hasClassStructure && /(workflow|state|ticket|issue|order)/i.test(source);
  }
  if (tagKey === 'exporter-abstraction') {
    return hasClassStructure && /(export|designfile|design file)/i.test(source);
  }
  if (
    tagKey === 'encapsulation' ||
    tagKey === 'encapsulated-state' ||
    tagKey === 'private-state' ||
    tagKey === 'controlled-state'
  ) {
    return /private|protected|readonly|_state|getState|setState|enabled|active|disable|enable/i.test(source);
  }
  if (tagKey === 'polymorphism') {
    return /(implements|extends|override|virtual|polymorph|interface|abstract)/i.test(source);
  }
  if (tagKey === 'strategy-pattern') {
    return /(strategy|delegate|paymentmethod|notificationchannel|interface|abstract|implements|extends)/i.test(source);
  }
  if (tagKey === 'state-pattern') return /(state|transition|orderstate)/i.test(source);
  if (tagKey === 'factory-pattern') return /(factory|create|build|make)/i.test(source);
  if (tagKey === 'registry-pattern') return /(registry|register|map|dictionary)/i.test(source);
  if (
    tagKey === 'open-closed' ||
    tagKey === 'extension-hook' ||
    tagKey === 'extensibility' ||
    tagKey === 'new-workflow-without-engine-change' ||
    tagKey === 'new-payment-mode-without-checkout-change' ||
    tagKey === 'new-payment-method-without-checkout-change' ||
    tagKey === 'new-exporter-without-design-file-change'
  ) {
    return hasClassStructure && /(interface|abstract|extends|implements|register|strategy|state|channel|without\s+(modifying|changing)|new\s+.+without)/i.test(source);
  }
  if (
    tagKey === 'separation-of-concerns' ||
    tagKey === 'single-responsibility' ||
    tagKey === 'domain-service-boundary' ||
    tagKey === 'service-delegation'
  ) {
    return hasClassStructure && /(service|engine|workflow|checkout|export|manager|delegate|process|send)/i.test(source);
  }
  if (tagKey === 'dependency-inversion') {
    return /(interface|abstract)/i.test(source) && /(service|engine|checkout|export|manager|order)/i.test(source);
  }
  if (
    tagKey === 'invalid-transition-handling' ||
    tagKey === 'validated-transition' ||
    tagKey === 'workflow-rules' ||
    tagKey === 'cancellation-rule' ||
    tagKey === 'late-cancellation-rejection'
  ) {
    return /(transition|cancel|invalid|reject|allowed|throw|error|fail|out_for_delivery|delivered)/i.test(source);
  }
  if (
    tagKey === 'controlled-failure' ||
    tagKey === 'result-object' ||
    tagKey === 'clear-error' ||
    tagKey === 'ambiguous-payment-result'
  ) {
    return /(result|response|outcome|status|success|failure|message|error|empty|no\s+active|length|size|count)/i.test(source);
  }
  if (tagKey === 'edge-case-handling') {
    return /(empty|no\s+active|length|size|count|zero|null|undefined|none)/i.test(source);
  }
  if (
    tagKey === 'validation-before-processing' ||
    tagKey === 'validation-with-strategy' ||
    tagKey === 'validation-separation' ||
    tagKey === 'payment-validation-failure' ||
    tagKey === 'invalid-amount-handling'
  ) {
    return /validat|amount|failure|fail|invalid|process/i.test(source);
  }
  if (tagKey === 'unsupported-format-handling') return /(unsupported|not supported|return false)/i.test(source);
  if (tagKey === 'payment-processing-failure') return /(decline|fail|error|reject)/i.test(source);
  if (
    tagKey === 'code-readability' ||
    tagKey === 'organization' ||
    tagKey === 'concise' ||
    tagKey === 'naming'
  ) {
    return source.split(/\r?\n/).filter((line) => line.trim()).length >= 8;
  }
  if (tagKey === 'composition') {
    return /(delegate|compose|has-a|contains|uses|list|array|map|set|vector|channels)/i.test(source);
  }
  if (
    tagKey === 'service-delegates-to-strategy' ||
    tagKey === 'checkout-depends-on-abstraction' ||
    tagKey === 'design-file-delegates-export' ||
    tagKey === 'manager-depends-on-channel-abstraction'
  ) {
    return /(delegate|strategy|exporter|paymentmethod|workflow|channel|interface|abstract|manager)/i.test(source);
  }
  if (tagKey === 'explicit-export-settings') return /(settings|options|resolution|page_size|units)/i.test(source);
  if (
    tagKey === 'observer-like-broadcast' ||
    tagKey === 'broadcast' ||
    tagKey === 'broadcast-to-active-channels'
  ) {
    return /(broadcast|notify|send|forEach|for\s*\(|map\s*\(|channels?)/i.test(source);
  }
  if (tagKey === 'dynamic-channel-management') {
    return /(enable|disable|add|remove|active|inactive|register|unregister)/i.test(source);
  }
  if (tagKey === 'disabled-channel-skipped' || tagKey === 'no-active-channel-handling') {
    return /(disable|enabled|active|skip|empty|no active|length|size)/i.test(source);
  }

  if (questionId === 'oops_fintech_payment_gateway_routing' && tagKey.includes('payment')) {
    return hasClassStructure && /(payment|checkout)/i.test(source);
  }
  if (questionId === 'oops_food_delivery_order_state_machine' && tagKey.includes('state')) {
    return hasClassStructure && /(state|order|transition)/i.test(source);
  }
  if (questionId === 'oops_saas_notification_system' && tagKey.includes('channel')) {
    return hasClassStructure && /(channel|notification|alert)/i.test(source);
  }

  return hasAny(new RegExp(tagKey.replace(/-/g, '[-_ ]'), 'i'));
}
function resolveTestCases(record: JsonRecord): ResolvedCase[] {
  const submittedCode = textValue(record.submitted_code);
  const questionId = textValue(record.question_id);
  const bankCases = caseList(record.test_cases);
  const openCases = caseList(record.open_test_cases);
  const hiddenCases = caseList(record.hidden_test_cases);
  const rawResults = extractRuntimeCases(record);

  const sourceCases = rawResults.length
    ? rawResults.map((result, index) => ({
        id: textValue(result.id, `case_${index + 1}`),
        passed: Boolean(result.passed),
        purpose: textValue(
          result.purpose || result.label || result.description,
        ),
        tags: normalizeTags(
          stringList(result.tags).length
            ? stringList(result.tags)
            : stringList(bankCases[index]?.tags),
        ),
      }))
    : ([...openCases, ...hiddenCases].length
        ? [...openCases, ...hiddenCases]
        : bankCases
      ).map((testCase, index) => {
        const tags = normalizeTags(stringList(testCase.tags));
        return {
          id: textValue(testCase.id, `case_${index + 1}`),
          passed: submittedCode.trim()
            ? tags.every((tag) => oopsTagPass(submittedCode, tag, questionId))
            : false,
          purpose: textValue(testCase.purpose),
          tags,
        };
      });

  return sourceCases.map((item) => ({
    ...item,
    tags: normalizeTags(item.tags),
  }));
}

function extractRuntimeCases(record: JsonRecord) {
  const runtime = record.test_results || record.testResults;
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime))
    return [];
  const value = runtime as JsonRecord;
  const cases = Array.isArray(value.test_results) ? value.test_results : [];
  return cases
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => item as JsonRecord);
}

function caseList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item) => item && typeof item === 'object' && !Array.isArray(item),
  ) as Array<Record<string, unknown> & { tags?: unknown }>;
}

function scoreDimension(cases: ResolvedCase[], keywords: string[]) {
  const relevant = cases.filter((item) =>
    item.tags.some((tag) => keywords.some((keyword) => tag.includes(keyword))),
  );
  if (!relevant.length) return null;
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
  if (scoreBelow(scores.abstraction_score, 70)) missing.push('workflow-abstraction');
  if (scoreBelow(scores.encapsulation_score, 70)) missing.push('encapsulation');
  if (scoreBelow(scores.polymorphism_score, 70)) missing.push('polymorphism');
  if (scoreBelow(scores.solid_principles_score, 70)) missing.push('single-responsibility');
  return missing;
}

function inferRedFlags(scores: OopsScores, allowedRedFlags: string[]) {
  const inferred: string[] = [];
  if (scoreBelow(scores.abstraction_score, 40)) inferred.push('no-shared-abstraction');
  if (scoreBelow(scores.polymorphism_score, 40)) inferred.push('type-switching');
  if (scoreBelow(scores.encapsulation_score, 40)) inferred.push('public-mutable-state');
  if (
    scoreBelow(scores.solid_principles_score, 40) ||
    (scoreBelow(scores.abstraction_score, 40) &&
      (scores.polymorphism_score === null || scoreBelow(scores.polymorphism_score, 40)))
  )
    inferred.push('single-procedural-function');

  const normalized = uniqueList(inferred);
  if (!allowedRedFlags.length) return normalized;
  return normalized.filter((tag) => allowedRedFlags.includes(tag));
}

function weightedScore(parts: WeightedPart[]) {
  const valid = parts.filter(
    (part) => part.score !== null && Number.isFinite(part.score),
  );
  if (!valid.length) return 0;
  const totalWeight = valid.reduce((sum, part) => sum + part.weight, 0);
  if (!totalWeight) return 0;
  return clampScore(
    valid.reduce((sum, part) => sum + Number(part.score) * part.weight, 0) /
      totalWeight,
  );
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreBelow(score: number | null, threshold: number) {
  return typeof score === 'number' && score < threshold;
}

function scoreAtLeast(score: number | null, threshold: number) {
  return typeof score === 'number' && score >= threshold;
}

function designMaturityLabel(score: number, redFlags: string[]) {
  if (redFlags.includes('single-procedural-function') || score < 35)
    return 'Procedural';
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Average';
  return 'Weak';
}

function placementReadinessLabel(score: number, redFlags: string[]) {
  const severeRedFlags = redFlags.filter((flag) =>
    [
      'single-procedural-function',
      'no-class-structure',
      'hardcoded-example',
    ].includes(flag),
  );
  if (score >= 70 && severeRedFlags.length) return READINESS_LABELS.risky;
  if (score >= 90 && !redFlags.length) return READINESS_LABELS.elite;
  if (score >= 80 && severeRedFlags.length === 0)
    return READINESS_LABELS.strong;
  if (score >= 65 && severeRedFlags.length === 0) return READINESS_LABELS.near;
  if (score >= 45) return READINESS_LABELS.trainable;
  return READINESS_LABELS.notReady;
}

function buildStrengths(
  scores: OopsScores,
  overall: number,
  totalCases: number,
) {
  const strengths: string[] = [];
  if (overall >= 80)
    strengths.push(
      `Overall OOPs design is strong across ${totalCases} test cases.`,
    );
  if (scoreAtLeast(scores.abstraction_score, 80))
    strengths.push('Abstractions and contracts are covered.');
  if (scoreAtLeast(scores.encapsulation_score, 80))
    strengths.push('Encapsulation is handled well.');
  if (scoreAtLeast(scores.polymorphism_score, 80))
    strengths.push('Polymorphism is applied clearly.');
  if (scoreAtLeast(scores.solid_principles_score, 80))
    strengths.push('SOLID principles are visible.');
  return uniqueList(strengths);
}

function buildWeaknesses(
  scores: OopsScores,
  missingComponents: string[],
  redFlags: string[],
  totalCases: number,
) {
  const weaknesses: string[] = [];
  if (scoreBelow(scores.abstraction_score, 60))
    weaknesses.push('Abstractions or contracts are incomplete.');
  if (scoreBelow(scores.encapsulation_score, 60))
    weaknesses.push('Encapsulation needs work.');
  if (scoreBelow(scores.polymorphism_score, 60))
    weaknesses.push('Polymorphism is not demonstrated strongly.');
  if (scoreBelow(scores.solid_principles_score, 60))
    weaknesses.push('SOLID principles need work.');
  if (redFlags.length) {
    redFlags
      .slice(0, 3)
      .forEach((flag) => weaknesses.push(`Red flag detected: ${flag}.`));
  }
  if (missingComponents.length) {
    missingComponents
      .slice(0, 3)
      .forEach((item) =>
        weaknesses.push(`Missing expected evidence: ${item}.`),
      );
  }
  if (totalCases < 8)
    weaknesses.push('Not all OOPs test cases were available.');
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
  if (scoreBelow(scores.abstraction_score, 70))
    focus.push('add clear interfaces or abstract contracts');
  if (scoreBelow(scores.encapsulation_score, 70))
    focus.push('keep state and rules encapsulated');
  if (scoreBelow(scores.polymorphism_score, 70))
    focus.push('use polymorphic behavior instead of type checks');
  if (scoreBelow(scores.solid_principles_score, 70))
    focus.push('align responsibilities and dependencies with SOLID principles');
  if (missingComponents.length) focus.push(`cover ${missingComponents[0]}`);
  return focus.length
    ? `Refine the design to ${focus.slice(0, 3).join(', ')}.`
    : 'Keep abstraction, encapsulation, polymorphism, and SOLID principles explicit.';
}
