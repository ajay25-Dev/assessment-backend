import { Injectable } from '@nestjs/common';
import { EvaluationResult } from './evaluation.types';

type DashboardInput = {
  student_id?: unknown;
  student_email?: unknown;
  student_name?: unknown;
  submitted_at?: unknown;
  duration_minutes?: unknown;
  tab_events?: unknown;
  hidden_test_pass_rate?: unknown;
  deterministic_scores?: Record<string, unknown>;
  weights?: Record<string, unknown>;
  section_evaluations?: Record<string, unknown>;
  deterministic_details?: Record<string, unknown>;
};

type EvaluationOutput = Record<string, unknown>;

type RiskLevel = 'Low' | 'Medium' | 'High';
type CompilationBehaviour = 'Clean' | 'Warnings' | 'Failed';
type ReadinessLabel =
  | 'Elite 1% Company Ready'
  | 'Strong Company Ready'
  | 'Near Ready'
  | 'Trainable but Not Ready'
  | 'Risky High Scorer'
  | 'Not Ready';

@Injectable()
export class DashboardEvaluationService {
  evaluate(input: unknown): Promise<EvaluationResult> {
    const record = this.assertObject(input);
    const deterministicScores = this.asRecord(record.deterministic_scores);
    const weights = this.asRecord(record.weights);
    const sectionEvaluations = this.asRecord(record.section_evaluations);

    const dsaEvaluations = this.asEvaluationArray(sectionEvaluations.DSA);
    const sqlEvaluations = this.asEvaluationArray(sectionEvaluations.SQL);
    const oopsEvaluations = this.asEvaluationArray(sectionEvaluations.OOPs);
    const mcqEvaluations = this.asEvaluationArray(sectionEvaluations.MCQ);

    const sectionScores = {
      DSA: this.clampScore(this.numberValue(deterministicScores.DSA)),
      SQL: this.clampScore(this.numberValue(deterministicScores.SQL)),
      OOPs: this.clampScore(this.numberValue(deterministicScores.OOPs)),
      MCQ: this.clampScore(this.numberValue(deterministicScores.MCQ)),
    };

    const overallMarksScore = this.weightedAverage(sectionScores, weights);
    const correctnessScore = overallMarksScore;
    const problemSolvingEfficiencyScore = this.problemSolvingEfficiencyScore(
      dsaEvaluations,
      sqlEvaluations,
      oopsEvaluations,
      sectionScores,
    );
    const complexityScore = this.complexityScore(
      dsaEvaluations,
      sqlEvaluations,
      sectionScores,
    );
    const edgeCaseHandlingScore = this.edgeCaseHandlingScore(
      dsaEvaluations,
      sqlEvaluations,
      oopsEvaluations,
      sectionScores,
    );
    const codeQualityScore = this.codeQualityScore(
      dsaEvaluations,
      oopsEvaluations,
      sectionScores,
    );
    const independenceScore = this.independenceScore(record.tab_events);
    const problemSolvingScore = this.capabilityScore({
      correctnessScore,
      problemSolvingEfficiencyScore,
      complexityScore,
      edgeCaseHandlingScore,
      codeQualityScore,
      independenceScore,
    });
    const dsaScore = sectionScores.DSA;
    const sqlScore = sectionScores.SQL;
    const oopsScore = sectionScores.OOPs;
    const mcqScore = sectionScores.MCQ;
    const approachScore = problemSolvingEfficiencyScore;
    const hiddenTestPassRate = this.hiddenTestPassRate(
      record.hidden_test_pass_rate,
      dsaEvaluations,
    );
    const bruteForceRisk = this.bruteForceRisk(dsaEvaluations, sectionScores);
    const hardcodingRisk = this.hardcodingRisk(
      dsaEvaluations,
      sqlEvaluations,
      oopsEvaluations,
      sectionScores,
    );
    const compilationBehaviour = this.compilationBehaviour(
      dsaEvaluations,
      oopsEvaluations,
    );
    const strongestArea = this.strongestArea(sectionScores);
    const weakestArea = this.weakestArea(sectionScores);
    const readinessLabel = this.readinessLabel(
      overallMarksScore,
      problemSolvingScore,
      bruteForceRisk,
      hardcodingRisk,
    );
    const trainingPriority = this.trainingPriority(weakestArea, sectionScores);

    return Promise.resolve({
      section: 'DASHBOARD',
      prompt_version: 'dashboard-deterministic.v1',
      model: 'deterministic',
      output: {
        student_id: this.textValue(record.student_id),
        student_name:
          this.textValue(record.student_name) ||
          this.textValue(record.student_email) ||
          this.textValue(record.student_id),
        overall_marks_score: overallMarksScore,
        capability_score: problemSolvingScore,
        problem_solving_score: problemSolvingScore,
        dsa_score: dsaScore,
        sql_score: sqlScore,
        oops_score: oopsScore,
        mcq_score: mcqScore,
        approach_score: approachScore,
        complexity_score: complexityScore,
        code_quality_score: codeQualityScore,
        hidden_test_pass_rate: hiddenTestPassRate,
        brute_force_risk: bruteForceRisk,
        hardcoding_risk: hardcodingRisk,
        compilation_behaviour: compilationBehaviour,
        runtime_percentile: this.runtimePercentile(
          overallMarksScore,
          problemSolvingScore,
          complexityScore,
        ),
        strongest_area: strongestArea,
        weakest_area: weakestArea,
        readiness_label: readinessLabel,
        company_recommendation: this.companyRecommendation(readinessLabel),
        training_recommendation: this.trainingRecommendation(
          readinessLabel,
          trainingPriority,
        ),
        faculty_insight: this.facultyInsight(
          overallMarksScore,
          problemSolvingScore,
          strongestArea,
          weakestArea,
          bruteForceRisk,
          hardcodingRisk,
        ),
        student_summary: this.studentSummary(
          overallMarksScore,
          problemSolvingScore,
          strongestArea,
          weakestArea,
          readinessLabel,
        ),
        detailed_strengths: this.detailedStrengths(
          sectionScores,
          dsaEvaluations,
          sqlEvaluations,
          oopsEvaluations,
          mcqEvaluations,
        ),
        detailed_weaknesses: this.detailedWeaknesses(
          sectionScores,
          dsaEvaluations,
          sqlEvaluations,
          oopsEvaluations,
          mcqEvaluations,
        ),
        next_3_learning_actions: this.nextActions(
          weakestArea,
          trainingPriority,
          sectionScores,
        ),
      },
    });
  }

  private assertObject(value: unknown): DashboardInput {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Dashboard evaluation input must be a JSON object');
    }

    return value;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private asEvaluationArray(value: unknown): EvaluationOutput[] {
    return Array.isArray(value)
      ? value
          .map((item) =>
            item && typeof item === 'object' && !Array.isArray(item)
              ? (item as EvaluationOutput)
              : null,
          )
          .filter((item): item is EvaluationOutput => Boolean(item))
      : [];
  }

  private weightedAverage(
    scores: Record<'DSA' | 'SQL' | 'OOPs' | 'MCQ', number>,
    weights: Record<string, unknown>,
  ) {
    const dsaWeight = this.numberValue(weights.DSA, 40);
    const sqlWeight = this.numberValue(weights.SQL, 20);
    const oopsWeight = this.numberValue(weights.OOPs, 20);
    const mcqWeight = this.numberValue(weights.MCQ, 20);
    const totalWeight = dsaWeight + sqlWeight + oopsWeight + mcqWeight || 100;
    return this.clampScore(
      (scores.DSA * dsaWeight +
        scores.SQL * sqlWeight +
        scores.OOPs * oopsWeight +
        scores.MCQ * mcqWeight) /
        totalWeight,
    );
  }

  private capabilityScore(params: {
    correctnessScore: number;
    problemSolvingEfficiencyScore: number;
    complexityScore: number;
    edgeCaseHandlingScore: number;
    codeQualityScore: number;
    independenceScore: number;
  }) {
    return this.clampScore(
      params.correctnessScore * 0.35 +
        params.problemSolvingEfficiencyScore * 0.2 +
        params.complexityScore * 0.15 +
        params.edgeCaseHandlingScore * 0.15 +
        params.codeQualityScore * 0.1 +
        params.independenceScore * 0.05,
    );
  }

  private problemSolvingEfficiencyScore(
    dsaEvaluations: EvaluationOutput[],
    sqlEvaluations: EvaluationOutput[],
    oopsEvaluations: EvaluationOutput[],
    scores: Record<'DSA' | 'SQL' | 'OOPs' | 'MCQ', number>,
  ) {
    const dsaApproach = this.averageField(
      dsaEvaluations,
      'approach_score',
      scores.DSA,
    );
    const sqlLogic = this.averageField(
      sqlEvaluations,
      'business_logic_score',
      scores.SQL,
    );
    const sqlConcept = this.averageField(
      sqlEvaluations,
      'sql_concept_score',
      scores.SQL,
    );
    const oopsDesign = this.averageField(
      oopsEvaluations,
      'class_design_score',
      scores.OOPs,
    );
    const oopsAbstraction = this.averageField(
      oopsEvaluations,
      'abstraction_score',
      scores.OOPs,
    );
    return this.clampScore(
      (dsaApproach + sqlLogic + sqlConcept + oopsDesign + oopsAbstraction) / 5,
    );
  }

  private edgeCaseHandlingScore(
    dsaEvaluations: EvaluationOutput[],
    sqlEvaluations: EvaluationOutput[],
    oopsEvaluations: EvaluationOutput[],
    scores: Record<'DSA' | 'SQL' | 'OOPs' | 'MCQ', number>,
  ) {
    const dsaEdge = this.averageField(
      dsaEvaluations,
      'edge_case_score',
      scores.DSA,
    );
    const sqlEdge = this.averageField(
      sqlEvaluations,
      'null_duplicate_handling_score',
      scores.SQL,
    );
    const oopsEdge = this.averageField(
      oopsEvaluations,
      'error_handling_score',
      scores.OOPs,
    );
    return this.clampScore((dsaEdge + sqlEdge + oopsEdge) / 3);
  }

  private complexityScore(
    dsaEvaluations: EvaluationOutput[],
    sqlEvaluations: EvaluationOutput[],
    scores: Record<'DSA' | 'SQL' | 'OOPs' | 'MCQ', number>,
  ) {
    const dsaTime = this.averageField(
      dsaEvaluations,
      'time_complexity_score',
      scores.DSA,
    );
    const dsaSpace = this.averageField(
      dsaEvaluations,
      'space_complexity_score',
      scores.DSA,
    );
    const sqlEfficiency = this.averageField(
      sqlEvaluations,
      'query_efficiency_score',
      scores.SQL,
    );
    const sqlNullHandling = this.averageField(
      sqlEvaluations,
      'null_duplicate_handling_score',
      scores.SQL,
    );
    return this.clampScore(
      (dsaTime + dsaSpace + sqlEfficiency + sqlNullHandling) / 4,
    );
  }

  private codeQualityScore(
    dsaEvaluations: EvaluationOutput[],
    oopsEvaluations: EvaluationOutput[],
    scores: Record<'DSA' | 'SQL' | 'OOPs' | 'MCQ', number>,
  ) {
    const dsaQuality = this.averageField(
      dsaEvaluations,
      'code_quality_score',
      scores.DSA,
    );
    const oopsReadability = this.averageField(
      oopsEvaluations,
      'code_readability_score',
      scores.OOPs,
    );
    const oopsStructure = this.averageField(
      oopsEvaluations,
      'separation_of_concerns_score',
      scores.OOPs,
    );
    const oopsDesign = this.averageField(
      oopsEvaluations,
      'solid_principles_score',
      scores.OOPs,
    );
    return this.clampScore(
      (dsaQuality + oopsReadability + oopsStructure + oopsDesign) / 4,
    );
  }

  private hiddenTestPassRate(
    value: unknown,
    dsaEvaluations: EvaluationOutput[],
  ) {
    const explicit = this.numberValue(value, NaN);
    if (Number.isFinite(explicit)) {
      return this.clampScore(explicit);
    }
    const hidden = this.averageField(
      dsaEvaluations,
      'hidden_test_case_score',
      0,
    );
    return this.clampScore(hidden);
  }

  private independenceScore(tabEvents: unknown) {
    const events = Math.max(0, this.numberValue(tabEvents, 0));
    if (events <= 0) return 100;
    if (events === 1) return 90;
    if (events === 2) return 80;
    if (events === 3) return 70;
    if (events === 4) return 60;
    return 50;
  }

  private bruteForceRisk(
    dsaEvaluations: EvaluationOutput[],
    scores: Record<'DSA' | 'SQL' | 'OOPs' | 'MCQ', number>,
  ): RiskLevel {
    const explicit = this.aggregateRisk(dsaEvaluations, 'brute_force_risk');
    if (explicit === 'High' || scores.DSA < 35) return 'High';
    if (explicit === 'Medium' || scores.DSA < 60) return 'Medium';
    return 'Low';
  }

  private hardcodingRisk(
    dsaEvaluations: EvaluationOutput[],
    sqlEvaluations: EvaluationOutput[],
    oopsEvaluations: EvaluationOutput[],
    scores: Record<'DSA' | 'SQL' | 'OOPs' | 'MCQ', number>,
  ): RiskLevel {
    const explicit = this.aggregateRisk(
      [...dsaEvaluations, ...sqlEvaluations, ...oopsEvaluations],
      'hardcoding_risk',
    );
    if (explicit === 'High' || scores.SQL < 35 || scores.OOPs < 35)
      return 'High';
    if (explicit === 'Medium' || scores.SQL < 60 || scores.OOPs < 60)
      return 'Medium';
    return 'Low';
  }

  private compilationBehaviour(
    dsaEvaluations: EvaluationOutput[],
    oopsEvaluations: EvaluationOutput[],
  ): CompilationBehaviour {
    const values = [...dsaEvaluations, ...oopsEvaluations]
      .map((item) =>
        this.textValue(item.compilation_behavior || item.compilation_behaviour),
      )
      .map((text) => text.toLowerCase());
    if (values.some((value) => value.includes('fail'))) return 'Failed';
    if (values.some((value) => value.includes('warn'))) return 'Warnings';
    return 'Clean';
  }

  private readinessLabel(
    overallMarksScore: number,
    capabilityScore: number,
    bruteForceRisk: RiskLevel,
    hardcodingRisk: RiskLevel,
  ): ReadinessLabel {
    if (
      overallMarksScore >= 90 &&
      capabilityScore >= 90 &&
      bruteForceRisk === 'Low' &&
      hardcodingRisk === 'Low'
    ) {
      return 'Elite 1% Company Ready';
    }
    if (
      overallMarksScore >= 75 &&
      capabilityScore >= 75 &&
      bruteForceRisk !== 'High' &&
      hardcodingRisk === 'Low'
    ) {
      return 'Strong Company Ready';
    }
    if (
      overallMarksScore >= 60 &&
      capabilityScore >= 65 &&
      hardcodingRisk !== 'High'
    ) {
      return 'Near Ready';
    }
    if (bruteForceRisk === 'High' || hardcodingRisk === 'High') {
      return 'Risky High Scorer';
    }
    if (overallMarksScore >= 45 || capabilityScore >= 45) {
      return 'Trainable but Not Ready';
    }
    return 'Not Ready';
  }

  private companyRecommendation(label: ReadinessLabel) {
    if (
      label === 'Elite 1% Company Ready' ||
      label === 'Strong Company Ready'
    ) {
      return 'Send to product/service company immediately';
    }
    if (label === 'Near Ready') return 'Send only after mock interview';
    if (label === 'Trainable but Not Ready') {
      return 'Train for 6-8 weeks before sending';
    }
    if (label === 'Risky High Scorer') return 'Send only after mock interview';
    return 'Do not send to company yet';
  }

  private trainingRecommendation(label: ReadinessLabel, priority: string) {
    if (
      label === 'Elite 1% Company Ready' ||
      label === 'Strong Company Ready'
    ) {
      return 'Move to company-specific interview practice and maintain current strengths.';
    }
    if (label === 'Near Ready') {
      return `Train for 2-3 weeks on ${priority.toLowerCase()} before final interview screening.`;
    }
    if (label === 'Trainable but Not Ready') {
      return `Train for 6-8 weeks on ${priority.toLowerCase()} and reassess.`;
    }
    if (label === 'Risky High Scorer') {
      return `Do not send to companies yet. Require supervised remediation on ${priority.toLowerCase()} and a fresh assessment.`;
    }
    return `Do not send to companies yet. Require supervised remediation on ${priority.toLowerCase()} and a fresh assessment.`;
  }

  private detailedStrengths(
    scores: Record<'DSA' | 'SQL' | 'OOPs' | 'MCQ', number>,
    dsaEvaluations: EvaluationOutput[],
    sqlEvaluations: EvaluationOutput[],
    oopsEvaluations: EvaluationOutput[],
    mcqEvaluations: EvaluationOutput[],
  ) {
    const strengths = [
      this.sectionStrength('DSA', scores.DSA, dsaEvaluations),
      this.sectionStrength('SQL', scores.SQL, sqlEvaluations),
      this.sectionStrength('OOPs', scores.OOPs, oopsEvaluations),
      this.sectionStrength('MCQ', scores.MCQ, mcqEvaluations),
    ].filter(Boolean);
    return strengths.slice(0, 6);
  }

  private detailedWeaknesses(
    scores: Record<'DSA' | 'SQL' | 'OOPs' | 'MCQ', number>,
    dsaEvaluations: EvaluationOutput[],
    sqlEvaluations: EvaluationOutput[],
    oopsEvaluations: EvaluationOutput[],
    mcqEvaluations: EvaluationOutput[],
  ) {
    const weaknesses = [
      this.sectionWeakness('DSA', scores.DSA, dsaEvaluations),
      this.sectionWeakness('SQL', scores.SQL, sqlEvaluations),
      this.sectionWeakness('OOPs', scores.OOPs, oopsEvaluations),
      this.sectionWeakness('MCQ', scores.MCQ, mcqEvaluations),
    ].filter(Boolean);
    return weaknesses.slice(0, 6);
  }

  private nextActions(
    weakestArea: string,
    priority: string,
    scores: Record<'DSA' | 'SQL' | 'OOPs' | 'MCQ', number>,
  ) {
    const section = weakestArea || 'DSA';
    const actions =
      section === 'DSA'
        ? [
            'Revisit core algorithms and edge cases.',
            'Practice the expected DSA approach before resubmission.',
            'Compare your solution against the complexity target.',
          ]
        : section === 'SQL'
          ? [
              'Review joins, filters, NULL handling, and duplicates.',
              'Re-run the query against sample and edge-case data.',
              'Verify the output ordering and business rules.',
            ]
          : section === 'OOPs'
            ? [
                'Rebuild the design around clearer classes and responsibilities.',
                'Strengthen abstraction and separation of concerns.',
                'Check maintainability and extensibility decisions.',
              ]
            : [
                'Revisit the core theory behind the missed MCQs.',
                'Compare each wrong answer with the correct option.',
                'Revise the related subject areas before retrying.',
              ];

    return [
      actions[0],
      `Focus on ${priority.toLowerCase()} and close the weakest section gap.`,
      scores.MCQ < 60
        ? 'Review MCQ fundamentals alongside the code-based sections.'
        : actions[2],
    ];
  }

  private runtimePercentile(
    overallMarksScore: number,
    capabilityScore: number,
    complexityScore: number,
  ) {
    if (
      overallMarksScore >= 90 &&
      capabilityScore >= 90 &&
      complexityScore >= 85
    ) {
      return 'Top 10%';
    }
    if (overallMarksScore >= 80 && capabilityScore >= 75) {
      return 'Top 25%';
    }
    if (overallMarksScore >= 65 && capabilityScore >= 60) {
      return 'Top 40%';
    }
    return 'Needs improvement';
  }

  private facultyInsight(
    overallMarksScore: number,
    capabilityScore: number,
    strongestArea: string,
    weakestArea: string,
    bruteForceRisk: RiskLevel,
    hardcodingRisk: RiskLevel,
  ) {
    return `Overall score ${overallMarksScore}/100 with problem solving score ${capabilityScore}/100. Strongest area: ${strongestArea}. Weakest area: ${weakestArea}. Risk levels: brute-force ${bruteForceRisk}, hardcoding ${hardcodingRisk}.`;
  }

  private studentSummary(
    overallMarksScore: number,
    capabilityScore: number,
    strongestArea: string,
    weakestArea: string,
    readinessLabel: ReadinessLabel,
  ) {
    return `The student is currently rated ${readinessLabel} with an overall score of ${overallMarksScore}/100 and problem solving score of ${capabilityScore}/100. Strongest area: ${strongestArea}. Needs attention in ${weakestArea}.`;
  }

  private sectionStrength(
    section: string,
    score: number,
    evaluations: EvaluationOutput[],
  ) {
    if (score < 70) return '';
    const detail = this.bestDetail(evaluations, section);
    return detail
      ? `${section}: ${detail}`
      : `${section}: strong performance and consistent evidence.`;
  }

  private sectionWeakness(
    section: string,
    score: number,
    evaluations: EvaluationOutput[],
  ) {
    if (score >= 60) return '';
    const detail = this.worstDetail(evaluations, section);
    return detail
      ? `${section}: ${detail}`
      : `${section}: needs focused revision.`;
  }

  private bestDetail(evaluations: EvaluationOutput[], section: string) {
    const field = this.pickPrimaryScoreField(section);
    const best = evaluations
      .map((item) => ({
        score: this.numberValue(item[field]),
        item,
      }))
      .sort((left, right) => right.score - left.score)[0]?.item;
    return best ? this.detailSummary(section, best, true) : '';
  }

  private worstDetail(evaluations: EvaluationOutput[], section: string) {
    const field = this.pickPrimaryScoreField(section);
    const worst = evaluations
      .map((item) => ({
        score: this.numberValue(item[field]),
        item,
      }))
      .sort((left, right) => left.score - right.score)[0]?.item;
    return worst ? this.detailSummary(section, worst, false) : '';
  }

  private detailSummary(
    section: string,
    evaluation: EvaluationOutput,
    positive: boolean,
  ) {
    if (section === 'DSA') {
      const approach = this.numberValue(evaluation.approach_score);
      const complexity =
        this.numberValue(evaluation.time_complexity_score) +
        this.numberValue(evaluation.space_complexity_score);
      return positive
        ? `approach ${approach}/100 and complexity ${Math.round(complexity / 2)}/100 are strong.`
        : `approach ${approach}/100 and complexity ${Math.round(complexity / 2)}/100 need work.`;
    }
    if (section === 'SQL') {
      const logic = this.numberValue(evaluation.business_logic_score);
      const efficiency = this.numberValue(evaluation.query_efficiency_score);
      return positive
        ? `business logic ${logic}/100 and efficiency ${efficiency}/100 are strong.`
        : `business logic ${logic}/100 and efficiency ${efficiency}/100 need work.`;
    }
    if (section === 'OOPs') {
      const design = this.numberValue(evaluation.class_design_score);
      const readability = this.numberValue(evaluation.code_readability_score);
      return positive
        ? `design ${design}/100 and readability ${readability}/100 are strong.`
        : `design ${design}/100 and readability ${readability}/100 need work.`;
    }
    const mcq = this.numberValue(evaluation.overall_mcq_score);
    return positive
      ? `MCQ accuracy ${mcq}/100 is strong.`
      : `MCQ accuracy ${mcq}/100 needs revision.`;
  }

  private pickPrimaryScoreField(section: string) {
    if (section === 'DSA') return 'overall_question_score';
    if (section === 'SQL') return 'overall_question_score';
    if (section === 'OOPs') return 'overall_question_score';
    return 'overall_mcq_score';
  }

  private aggregateRisk(
    evaluations: EvaluationOutput[],
    key: 'brute_force_risk' | 'hardcoding_risk',
  ): RiskLevel {
    const risks = evaluations.map((item) => this.normalizeRisk(item[key]));
    if (risks.includes('High')) return 'High';
    if (risks.includes('Medium')) return 'Medium';
    return 'Low';
  }

  private averageField(
    evaluations: EvaluationOutput[],
    key: string,
    fallback: number,
  ) {
    const values = evaluations
      .map((item) => this.numberValue(item[key], NaN))
      .filter((value) => Number.isFinite(value));
    if (!values.length) return fallback;
    return Math.round(
      values.reduce((sum, value) => sum + value, 0) / values.length,
    );
  }

  private numberValue(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
  }

  private clampScore(value: unknown) {
    return Math.max(0, Math.min(100, this.numberValue(value, 0)));
  }

  private textValue(value: unknown, fallback = '') {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return fallback;
  }

  private normalizeRisk(value: unknown): RiskLevel {
    const risk = this.textValue(value).toLowerCase();
    if (risk === 'high') return 'High';
    if (risk === 'medium') return 'Medium';
    return 'Low';
  }

  private strongestArea(
    scores: Record<'DSA' | 'SQL' | 'OOPs' | 'MCQ', number>,
  ) {
    return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'DSA';
  }

  private weakestArea(scores: Record<'DSA' | 'SQL' | 'OOPs' | 'MCQ', number>) {
    return Object.entries(scores).sort((a, b) => a[1] - b[1])[0]?.[0] || 'MCQ';
  }

  private trainingPriority(
    weakestSection: string,
    sectionScores: Record<'DSA' | 'SQL' | 'OOPs' | 'MCQ', number>,
  ) {
    const score =
      sectionScores[weakestSection as keyof typeof sectionScores] ?? 0;
    if (weakestSection === 'DSA') {
      return score < 45
        ? 'Core problem solving and edge-case handling'
        : 'Algorithmic optimization and edge-case practice';
    }
    if (weakestSection === 'SQL') {
      return score < 45
        ? 'SQL correctness, joins, and result validation'
        : 'SQL efficiency, NULL handling, and business rules';
    }
    if (weakestSection === 'OOPs') {
      return score < 45
        ? 'Object modelling, abstraction, and class design'
        : 'SOLID design, extensibility, and structure';
    }
    return score < 45
      ? 'Fundamental CS revision and accuracy drills'
      : 'MCQ revision for weaker theory areas';
  }
}
