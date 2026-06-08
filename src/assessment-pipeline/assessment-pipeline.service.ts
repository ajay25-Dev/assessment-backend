import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { DashboardEvaluationService } from '../evaluations/dashboard-evaluation.service';
import { DsaEvaluationService } from '../evaluations/dsa-evaluation.service';
import { EvaluationResult } from '../evaluations/evaluation.types';
import { McqEvaluationService } from '../evaluations/mcq-evaluation.service';
import { OopsEvaluationService } from '../evaluations/oops-evaluation.service';
import { SqlEvaluationService } from '../evaluations/sql-evaluation.service';
import { QuestionBankService } from '../question-bank/question-bank.service';

type Section = 'DSA' | 'SQL' | 'OOPs' | 'MCQ';

type FinalizeAnswer = {
  value?: string;
  language?: string;
  selectedOptions?: string[];
  marked?: boolean;
  runs?: number;
  submissions?: number;
  status?: string;
  resultMessage?: string;
  sqlExecutionMs?: number | null;
};

type FinalizeInput = {
  student_id?: string;
  student_email?: string;
  assessment_id?: string;
  started_at?: string;
  submitted_at?: string;
  duration_minutes?: number;
  tab_events?: number;
  camera_events?: number;
  submission_mode?: 'manual' | 'auto';
  answers?: Record<string, FinalizeAnswer>;
};

type BankQuestion = {
  id: string;
  title?: string;
  section: Section;
  engine?: string;
  prompt?: string;
  topic?: string;
  difficulty?: string;
  marks?: number;
  options?: Array<{ id?: string; label?: string; text?: string }>;
  correct_options?: string[];
  explanation?: string;
  misconception_mapping?: Record<string, string>;
  expected_approach?: unknown;
  evaluator_context?: unknown;
  test_cases?: unknown[];
  open_test_cases?: unknown[];
  hidden_test_cases?: unknown[];
  schema_ref?: unknown;
};

type Bank = {
  assessment?: {
    id?: string;
    title?: string;
    duration_minutes?: number;
    scoring_weights?: Record<string, number>;
  };
  questions?: BankQuestion[];
};

type SectionSummary = {
  score: number;
  evaluations: EvaluationResult[];
  deterministic: Record<string, unknown>;
};

type ReadinessLabel =
  | 'Elite 1% Company Ready'
  | 'Strong Company Ready'
  | 'Near Ready'
  | 'Trainable but Not Ready'
  | 'Risky High Scorer'
  | 'Not Ready';
type ReadinessBucket = 'Ready' | 'Training Needed' | 'Failed';
type RiskLevel = 'Low' | 'Medium' | 'High';
type CompilationBehaviour = 'Clean' | 'Warnings' | 'Failed';

@Injectable()
export class AssessmentPipelineService {
  private supabase?: SupabaseClient;

  constructor(
    private readonly config: ConfigService,
    private readonly questionBank: QuestionBankService,
    private readonly dsaEvaluation: DsaEvaluationService,
    private readonly sqlEvaluation: SqlEvaluationService,
    private readonly oopsEvaluation: OopsEvaluationService,
    private readonly mcqEvaluation: McqEvaluationService,
    private readonly dashboardEvaluation: DashboardEvaluationService,
  ) {}

  async finalize(rawInput: unknown) {
    const input = this.parseInput(rawInput);
    const bank = (await this.questionBank.getBank()) as Bank;
    const questions = bank.questions || [];
    const questionsById = new Map(questions.map((question) => [question.id, question]));
    const submittedAt = input.submitted_at || new Date().toISOString();
    const durationMinutes =
      input.duration_minutes || bank.assessment?.duration_minutes || 180;

    const attemptId = await this.persistAttempt(input, bank, submittedAt, durationMinutes);
    await this.persistQuestionAttempts(attemptId, input, questions);
    await this.persistFinalRuntimeSnapshots(attemptId, input, questions);

    const dsa = await this.evaluateCodingSection('DSA', questions, input);
    const sql = await this.evaluateSqlSection(questions, input);
    const oops = await this.evaluateCodingSection('OOPs', questions, input);
    const mcq = await this.evaluateMcqSection(questions, input);

    const deterministicScores = {
      DSA: dsa.score,
      SQL: sql.score,
      OOPs: oops.score,
      MCQ: mcq.score,
    };

    const dashboardInput = {
      student_id: input.student_id,
      student_email: input.student_email || '',
      student_name: input.student_email || input.student_id,
      assessment: bank.assessment,
      submitted_at: submittedAt,
      duration_minutes: durationMinutes,
      tab_events: input.tab_events || 0,
      deterministic_scores: deterministicScores,
      weights: bank.assessment?.scoring_weights || {
        DSA: 40,
        SQL: 25,
        OOPs: 20,
        MCQ: 15,
      },
      section_evaluations: {
        DSA: dsa.evaluations.map((item) => item.output),
        SQL: sql.evaluations.map((item) => item.output),
        OOPs: oops.evaluations.map((item) => item.output),
        MCQ: mcq.evaluations.map((item) => item.output),
      },
      deterministic_details: {
        DSA: dsa.deterministic,
        SQL: sql.deterministic,
        OOPs: oops.deterministic,
        MCQ: mcq.deterministic,
      },
    };

    const dashboardEvaluation = await this.tryEvaluate(
      'DASHBOARD',
      () => this.dashboardEvaluation.evaluate(dashboardInput),
      this.fallbackDashboard(input, bank, deterministicScores),
    );

    await this.persistEvaluations(attemptId, questionsById, [
      ...dsa.evaluations,
      ...sql.evaluations,
      ...oops.evaluations,
      ...mcq.evaluations,
    ]);

    const report = await this.persistReport({
      attemptId,
      input,
      bank,
      dashboardEvaluation,
      deterministicScores,
      allEvaluations: {
        DSA: dsa.evaluations,
        SQL: sql.evaluations,
        OOPs: oops.evaluations,
        MCQ: mcq.evaluations,
      },
      dashboardInput,
    });

    return {
      attempt_id: attemptId,
      report_id: report.id,
      report,
      dashboard_evaluation: dashboardEvaluation.output,
    };
  }

  private parseInput(rawInput: unknown): FinalizeInput {
    if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
      throw new BadRequestException('Finalize payload must be a JSON object');
    }

    const input = rawInput as FinalizeInput;
    if (!input.student_id) throw new BadRequestException('student_id is required');
    if (!input.answers || typeof input.answers !== 'object') {
      throw new BadRequestException('answers are required');
    }

    return input;
  }

  private async evaluateCodingSection(
    section: 'DSA' | 'OOPs',
    questions: BankQuestion[],
    input: FinalizeInput,
  ): Promise<SectionSummary> {
    const sectionQuestions = questions.filter((question) => question.section === section);
    const evaluations: EvaluationResult[] = [];
    const details = sectionQuestions.map((question) => {
      const answer = input.answers?.[question.id] || {};
      return {
        question_id: question.id,
        question_title: question.title || question.id,
        prompt: question.prompt,
        topic: question.topic,
        difficulty: question.difficulty,
        expected_approach: question.expected_approach,
        evaluator_context: question.evaluator_context,
        language: answer.language,
        submitted_code: answer.value || '',
        status: answer.status || 'unvisited',
        run_count: answer.runs || 0,
        submit_count: answer.submissions || 0,
        compiler_result_summary: answer.resultMessage || '',
        open_test_cases: question.open_test_cases || [],
        hidden_test_cases: section === 'DSA' ? question.hidden_test_cases || [] : [],
        all_doc_test_cases: question.test_cases || [],
      };
    });

    for (const detail of details) {
      const fallback = this.fallbackQuestionEvaluation(section, detail);
      evaluations.push(
        await this.tryEvaluate(section, () =>
          section === 'DSA'
            ? this.dsaEvaluation.evaluate(detail)
            : this.oopsEvaluation.evaluate(detail), fallback),
      );
    }

    return {
      score: this.average(
        evaluations.map((item) => Number(item.output.overall_question_score || 0)),
      ),
      evaluations,
      deterministic: { questions: details },
    };
  }

  private async evaluateSqlSection(
    questions: BankQuestion[],
    input: FinalizeInput,
  ): Promise<SectionSummary> {
    const sectionQuestions = questions.filter((question) => question.section === 'SQL');
    const evaluations: EvaluationResult[] = [];
    const details = sectionQuestions.map((question) => {
      const answer = input.answers?.[question.id] || {};
      return {
        question_id: question.id,
        question_title: question.title || question.id,
        prompt: question.prompt,
        topic: question.topic,
        expected_approach: question.expected_approach,
        evaluator_context: question.evaluator_context,
        schema_ref: question.schema_ref,
        submitted_query: answer.value || '',
        status: answer.status || 'unvisited',
        run_count: answer.runs || 0,
        submit_count: answer.submissions || 0,
        execution_ms: this.nullableNumber(answer.sqlExecutionMs),
        sql_result_summary: answer.resultMessage || '',
      };
    });

    for (const detail of details) {
      evaluations.push(
        await this.tryEvaluate(
          'SQL',
          () => this.sqlEvaluation.evaluate(detail),
          this.fallbackQuestionEvaluation('SQL', detail),
        ),
      );
    }

    return {
      score: this.average(
        evaluations.map((item) => Number(item.output.overall_question_score || 0)),
      ),
      evaluations,
      deterministic: { questions: details },
    };
  }

  private async evaluateMcqSection(
    questions: BankQuestion[],
    input: FinalizeInput,
  ): Promise<SectionSummary> {
    const sectionQuestions = questions.filter((question) => question.section === 'MCQ');
    const answers = sectionQuestions.map((question) => {
      const answer = input.answers?.[question.id] || {};
      const selected = answer.selectedOptions || [];
      const correct = question.correct_options || [];
      return {
        question_id: question.id,
        question_title: question.title || question.id,
        topic: question.topic || 'general',
        options: question.options || [],
        selected_options: selected,
        correct_options: correct,
        explanation: question.explanation,
        misconception_mapping: question.misconception_mapping,
        is_correct: this.sameStringSet(selected, correct),
        answer_change_count: 0,
        time_spent_seconds: 0,
      };
    });
    const correctCount = answers.filter((answer) => answer.is_correct).length;
    const score = sectionQuestions.length
      ? Math.round((correctCount / sectionQuestions.length) * 100)
      : 0;
    const payload = {
      student_id: input.student_id,
      total_questions: sectionQuestions.length,
      correct_count: correctCount,
      deterministic_score: score,
      answers,
      tab_events: input.tab_events || 0,
    };

    const evaluation = await this.tryEvaluate(
      'MCQ',
      () => this.mcqEvaluation.evaluate(payload),
      {
        section: 'MCQ',
        prompt_version: 'fallback',
        model: 'deterministic',
        output: {
          section: 'MCQ',
          student_id: input.student_id || '',
          overall_mcq_score: score,
          subject_scores: {
            operating_systems: score,
            computer_networks: score,
            cybersecurity: score,
            computer_architecture: score,
            cloud_computing: score,
            ms_office_excel: score,
            oops: score,
          },
          topic_scores: {},
          strong_topics: [],
          weak_topics: [],
          misconceptions_detected: [],
          guessing_risk: 'Low',
          confidence_signal: 'Moderate',
          time_behavior_summary: 'Deterministic fallback based on selected answers.',
          revision_recommendation: 'Review incorrect concepts from the MCQ section.',
          placement_readiness_label: 'Near Ready',
        },
      },
    );

    return {
      score,
      evaluations: [evaluation],
      deterministic: payload,
    };
  }

  private async tryEvaluate(
    section: string,
    evaluate: () => Promise<EvaluationResult>,
    fallback: EvaluationResult,
  ) {
    try {
      return await evaluate();
    } catch (error) {
      return {
        ...fallback,
        output: {
          ...fallback.output,
          evaluation_error:
            error instanceof Error ? error.message : `${section} evaluation failed`,
        },
      };
    }
  }

  private async persistAttempt(
    input: FinalizeInput,
    bank: Bank,
    submittedAt: string,
    durationMinutes: number,
  ) {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from('student_assessment_attempts')
      .insert({
        student_id: input.student_id,
        assessment_id: this.uuidOrNull(input.assessment_id),
        status: input.submission_mode === 'auto' ? 'auto_submitted' : 'submitted',
        started_at: input.started_at || submittedAt,
        submitted_at: submittedAt,
        duration_minutes: durationMinutes,
        tab_visibility_events: input.tab_events || 0,
        last_seen_at: submittedAt,
        client_metadata: {
          source_assessment_id: input.assessment_id || bank.assessment?.id,
          student_email: input.student_email,
          submission_mode: input.submission_mode || 'manual',
          camera_events: input.camera_events || 0,
        },
      })
      .select('id')
      .single();

    if (error) {
      throw new InternalServerErrorException(
        `Could not create assessment attempt: ${error.message}`,
      );
    }

    return String(data.id);
  }

  private async persistQuestionAttempts(
    attemptId: string,
    input: FinalizeInput,
    questions: BankQuestion[],
  ) {
    const rows = questions.map((question) => {
      const answer = input.answers?.[question.id] || {};
      return {
        attempt_id: attemptId,
        question_id: question.id,
        section: question.section,
        answer_text: answer.value || '',
        selected_language: answer.language || null,
        selected_options: answer.selectedOptions || [],
        marked_for_review: Boolean(answer.marked),
        status: this.questionStatus(answer.status),
        run_count: answer.runs || 0,
        submit_count: answer.submissions || 0,
        last_autosaved_at: input.submitted_at || new Date().toISOString(),
      };
    });

    const { error } = await this.getSupabase()
      .from('student_question_attempts')
      .insert(rows);

    if (error) {
      throw new InternalServerErrorException(
        `Could not persist question attempts: ${error.message}`,
      );
    }
  }

  private async persistEvaluations(
    attemptId: string,
    questionsById: Map<string, BankQuestion>,
    evaluations: EvaluationResult[],
  ) {
    const rows: Array<{
      attempt_id: string;
      question_id: string;
      section: string;
      deterministic_score: number;
      ai_evaluation: EvaluationResult;
      final_score: number;
      assessment_question_id: null;
      question_attempt_id: null;
      question_title: string;
    }> = evaluations
      .map((evaluation) => {
        const output = evaluation.output as Record<string, unknown>;
        const questionId = String(output.question_id || '');
        if (!questionId) return null;
        return {
          attempt_id: attemptId,
          question_id: questionId,
          section: evaluation.section,
          deterministic_score: Number(output.overall_question_score || 0),
          ai_evaluation: evaluation,
          final_score: Number(output.overall_question_score || 0),
          assessment_question_id: null,
          question_attempt_id: null,
          question_title: questionsById.get(questionId)?.title || questionId,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (!rows.length) return;

    const sanitizedRows = rows.map(({ question_title, ...row }) => ({
      ...row,
      ai_evaluation: { ...row.ai_evaluation, question_title },
    }));

    const { error } = await this.getSupabase()
      .from('student_question_evaluations')
      .insert(sanitizedRows);

    if (error) {
      throw new InternalServerErrorException(
        `Could not persist question evaluations: ${error.message}`,
      );
    }
  }

  private async persistFinalRuntimeSnapshots(
    attemptId: string,
    input: FinalizeInput,
    questions: BankQuestion[],
  ) {
    await Promise.all([
      this.persistFinalCodeRuns(attemptId, input, questions),
      this.persistFinalSqlRuns(attemptId, input, questions),
      this.persistFinalMcqAnswers(attemptId, input, questions),
    ]);
  }

  private async persistFinalCodeRuns(
    attemptId: string,
    input: FinalizeInput,
    questions: BankQuestion[],
  ) {
    const rows = questions
      .filter((question) => question.engine === 'code')
      .map((question) => {
        const answer = input.answers?.[question.id] || {};
        const passSummary = this.parseTestSummary(answer.resultMessage);
        return {
          attempt_id: attemptId,
          question_id: question.id,
          assessment_question_id: null,
          question_attempt_id: null,
          language: answer.language || 'unknown',
          run_type: answer.submissions ? 'submit' : 'run',
          source_code: answer.value || '',
          provider: 'judge0',
          status: answer.resultMessage || answer.status || 'finalized',
          stdout: null,
          stderr: null,
          compile_output: null,
          runtime_ms: null,
          memory_kb: null,
          open_tests_passed: passSummary?.passed ?? null,
          open_tests_total: passSummary?.total ?? null,
          hidden_tests_passed: null,
          hidden_tests_total: null,
          test_results: [],
          raw_provider_response: {
            final_snapshot: true,
            run_count: answer.runs || 0,
            submit_count: answer.submissions || 0,
            result_message: answer.resultMessage || '',
          },
        };
      })
      .filter((row) => row.source_code.trim().length > 0);

    if (!rows.length) return;

    const { error } = await this.getSupabase().from('student_code_runs').insert(rows);
    if (error) {
      throw new InternalServerErrorException(
        `Could not persist final code run snapshots: ${error.message}`,
      );
    }
  }

  private async persistFinalSqlRuns(
    attemptId: string,
    input: FinalizeInput,
    questions: BankQuestion[],
  ) {
    const rows = questions
      .filter((question) => question.engine === 'sql')
      .map((question) => {
        const answer = input.answers?.[question.id] || {};
        return {
          attempt_id: attemptId,
          question_id: question.id,
          assessment_question_id: null,
          question_attempt_id: null,
          run_type: answer.submissions ? 'submit' : 'run',
          query_text: answer.value || '',
          columns: [],
          rows: [],
          row_count: 0,
          execution_ms: this.nullableNumber(answer.sqlExecutionMs),
          error_text: answer.resultMessage || null,
          comparison_result: {
            final_snapshot: true,
            run_count: answer.runs || 0,
            submit_count: answer.submissions || 0,
            result_message: answer.resultMessage || '',
            execution_ms: this.nullableNumber(answer.sqlExecutionMs),
          },
        };
      })
      .filter((row) => row.query_text.trim().length > 0);

    if (!rows.length) return;

    const { error } = await this.getSupabase().from('student_sql_runs').insert(rows);
    if (error) {
      throw new InternalServerErrorException(
        `Could not persist final SQL run snapshots: ${error.message}`,
      );
    }
  }

  private async persistFinalMcqAnswers(
    attemptId: string,
    input: FinalizeInput,
    questions: BankQuestion[],
  ) {
    const rows = questions
      .filter((question) => question.section === 'MCQ')
      .map((question) => {
        const answer = input.answers?.[question.id] || {};
        const selectedOptions = answer.selectedOptions || [];
        const correctOptions = question.correct_options || [];
        return {
          attempt_id: attemptId,
          question_id: question.id,
          assessment_question_id: null,
          question_attempt_id: null,
          selected_options: selectedOptions,
          is_correct: this.sameStringSet(selectedOptions, correctOptions),
          answer_change_count: 0,
          time_spent_seconds: 0,
        };
      });

    if (!rows.length) return;

    const { error } = await this.getSupabase().from('student_mcq_answers').insert(rows);
    if (error) {
      throw new InternalServerErrorException(
        `Could not persist final MCQ answers: ${error.message}`,
      );
    }
  }

  private parseTestSummary(message: string | undefined) {
    const match = String(message || '').match(/Test results:\s*(\d+)\/(\d+)\s*passed/i);
    if (!match) return null;
    return {
      passed: Number(match[1]),
      total: Number(match[2]),
    };
  }

  private async persistReport(params: {
    attemptId: string;
    input: FinalizeInput;
    bank: Bank;
    dashboardEvaluation: EvaluationResult;
    deterministicScores: Record<string, number>;
    allEvaluations: Record<string, EvaluationResult[]>;
    dashboardInput: Record<string, unknown>;
  }) {
    const output = params.dashboardEvaluation.output as Record<string, unknown>;
    const sectionScores = {
      DSA: this.numberOutput(output.dsa_score, params.deterministicScores.DSA),
      SQL: this.numberOutput(output.sql_score, params.deterministicScores.SQL),
      OOPs: this.numberOutput(output.oops_score, params.deterministicScores.OOPs),
      MCQ: this.numberOutput(output.mcq_score, params.deterministicScores.MCQ),
    };
    const marksScore = this.numberOutput(output.overall_marks_score);
    const capabilityScore = this.numberOutput(output.capability_score);
    const approachScore = this.numberOutput(output.approach_score);
    const complexityScore = this.numberOutput(output.complexity_score);
    const codeQualityScore = this.numberOutput(output.code_quality_score);
    const hiddenTestPassRate = this.numberOutput(output.hidden_test_pass_rate);
    const bruteForceRisk = this.riskOutput(output.brute_force_risk);
    const hardcodingRisk = this.riskOutput(output.hardcoding_risk);
    const compilationBehaviour = this.compilationOutput(output.compilation_behaviour);
    const runtimePercentile = String(output.runtime_percentile || 'Unknown');
    const strongestSection = this.strongestArea(sectionScores);
    const weakestSection = this.weakestArea(sectionScores);
    const readiness = this.computeReadiness({
      marksScore,
      capabilityScore,
      hiddenTestPassRate,
      approachScore,
      complexityScore,
      codeQualityScore,
      bruteForceRisk,
      hardcodingRisk,
      compilationBehaviour,
      sectionScores,
      strongestSection,
      weakestSection,
    });

    const row = {
      student_id: params.input.student_id,
      assessment_id: this.uuidOrNull(params.input.assessment_id),
      attempt_id: params.attemptId,
      assessment_title:
        params.bank.assessment?.title || 'JoraIQ College Assessment',
      marks_score: marksScore,
      capability_score: capabilityScore,
      dsa_score: sectionScores.DSA,
      sql_score: sectionScores.SQL,
      oops_score: sectionScores.OOPs,
      mcq_score: sectionScores.MCQ,
      approach_score: approachScore,
      complexity_score: complexityScore,
      code_quality_score: codeQualityScore,
      hidden_test_pass_rate: hiddenTestPassRate,
      brute_force_risk: bruteForceRisk,
      hardcoding_risk: hardcodingRisk,
      compilation_behaviour: compilationBehaviour,
      runtime_percentile: runtimePercentile,
      readiness_label: readiness.label,
      readiness_bucket: readiness.bucket,
      readiness_reason: readiness.reason,
      strongest_section: strongestSection,
      weakest_section: weakestSection,
      training_priority: readiness.trainingPriority,
      teacher_action: readiness.teacherAction,
      risk_summary: readiness.riskSummary,
      training_recommendation: String(output.training_recommendation || readiness.trainingRecommendation),
      faculty_insight: String(output.faculty_insight || ''),
      company_recommendation: readiness.companyRecommendation,
      student_summary: String(output.student_summary || ''),
      detailed_strengths: this.stringArrayOutput(output.detailed_strengths),
      detailed_weaknesses: this.stringArrayOutput(output.detailed_weaknesses),
      next_3_learning_actions: this.stringArrayOutput(output.next_3_learning_actions),
      report_json: {
        dashboard_evaluation: params.dashboardEvaluation,
        section_evaluations: params.allEvaluations,
        dashboard_input: params.dashboardInput,
        deterministic_readiness: readiness,
      },
    };

    const { data, error } = await this.getSupabase()
      .from('student_assessment_reports')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      throw new InternalServerErrorException(
        `Could not write dashboard report: ${error.message}`,
      );
    }

    return data as Record<string, unknown>;
  }

  private fallbackQuestionEvaluation(section: Section, detail: Record<string, unknown>): EvaluationResult {
    const hasAnswer = String(detail.submitted_code || detail.submitted_query || '').trim().length > 0;
    const score = hasAnswer ? 45 : 0;
    const base = {
      section,
      question_id: String(detail.question_id || ''),
      question_title: String(detail.question_title || ''),
      overall_question_score: score,
      hardcoding_risk: 'Low',
      placement_readiness_label: 'Near Ready',
    };

    return {
      section,
      prompt_version: 'fallback',
      model: 'deterministic',
      output:
        section === 'DSA'
          ? {
              ...base,
              correctness_score: score,
              open_test_case_score: score,
              hidden_test_case_score: 0,
              approach_score: score,
              time_complexity_score: score,
              space_complexity_score: score,
              edge_case_score: score,
              code_quality_score: score,
              brute_force_risk: 'Low',
              optimization_level: hasAnswer ? 'Acceptable' : 'Incorrect',
              detected_approach: 'Fallback evaluation from submitted code.',
              expected_approach_match: false,
              likely_time_complexity: 'Unknown',
              likely_space_complexity: 'Unknown',
              failed_case_analysis: [],
              missed_edge_cases: [],
              compilation_behavior: String(detail.compiler_result_summary || ''),
              submission_behavior: `${detail.run_count || 0} runs, ${detail.submit_count || 0} submissions`,
              runtime_observation: 'Not available in fallback.',
              memory_observation: 'Not available in fallback.',
              key_strengths: [],
              key_weaknesses: hasAnswer ? [] : ['No answer submitted'],
              improvement_recommendation: 'Review the expected approach and hidden edge cases.',
            }
          : section === 'SQL'
            ? {
                ...base,
                result_correctness_score: score,
                business_logic_score: score,
                sql_concept_score: score,
                edge_case_score: score,
                query_efficiency_score: score,
                readability_score: score,
                null_duplicate_handling_score: score,
                query_quality_label: hasAnswer ? 'Average' : 'Incorrect',
                expected_concepts_used: [],
                missing_concepts: [],
                detected_mistakes: [],
                missing_business_rules: [],
                failed_case_analysis: [],
                runtime_observation: String(detail.sql_result_summary || ''),
                key_strengths: [],
                key_weaknesses: hasAnswer ? [] : ['No query submitted'],
                improvement_recommendation: 'Review joins, filters, NULLs, duplicates, and expected output.',
              }
            : {
                ...base,
                class_design_score: score,
                abstraction_score: score,
                encapsulation_score: score,
                polymorphism_score: score,
                extensibility_score: score,
                separation_of_concerns_score: score,
                solid_principles_score: score,
                error_handling_score: score,
                code_readability_score: score,
                design_pattern_awareness_score: score,
                design_maturity_label: hasAnswer ? 'Average' : 'Procedural',
                identified_classes: [],
                identified_interfaces_or_abstractions: [],
                design_patterns_detected: [],
                missing_components: [],
                red_flags: hasAnswer ? [] : ['No design submitted'],
                key_strengths: [],
                key_weaknesses: hasAnswer ? [] : ['No answer submitted'],
                improvement_recommendation: 'Improve class boundaries, abstractions, and extensibility.',
              },
    };
  }

  private fallbackDashboard(
    input: FinalizeInput,
    bank: Bank,
    scores: Record<string, number>,
  ): EvaluationResult {
    const weights = bank.assessment?.scoring_weights || {
      DSA: 40,
      SQL: 25,
      OOPs: 20,
      MCQ: 15,
    };
    const weighted =
      (scores.DSA * Number(weights.DSA || 0) +
        scores.SQL * Number(weights.SQL || 0) +
        scores.OOPs * Number(weights.OOPs || 0) +
        scores.MCQ * Number(weights.MCQ || 0)) /
      100;

    return {
      section: 'DASHBOARD',
      prompt_version: 'fallback',
      model: 'deterministic',
      output: {
        student_id: input.student_id || '',
        student_name: input.student_email || input.student_id || '',
        overall_marks_score: Math.round(weighted),
        capability_score: Math.round((scores.DSA + scores.SQL + scores.OOPs + scores.MCQ) / 4),
        dsa_score: scores.DSA,
        sql_score: scores.SQL,
        oops_score: scores.OOPs,
        mcq_score: scores.MCQ,
        approach_score: Math.round((scores.DSA + scores.SQL + scores.OOPs) / 3),
        complexity_score: Math.round((scores.DSA + scores.SQL) / 2),
        code_quality_score: Math.round((scores.DSA + scores.OOPs) / 2),
        hidden_test_pass_rate: 0,
        brute_force_risk: 'Low',
        hardcoding_risk: 'Low',
        compilation_behaviour: 'Clean',
        runtime_percentile: 'Unknown',
        strongest_area: this.strongestArea(scores),
        weakest_area: this.weakestArea(scores),
        readiness_label: weighted >= 70 ? 'Near Ready' : 'Trainable but Not Ready',
        company_recommendation:
          weighted >= 70
            ? 'Send only after mock interview'
            : 'Train for 2-3 weeks before sending',
        training_recommendation: 'Review section-level weaknesses and rerun mock assessment.',
        faculty_insight: 'Report generated with deterministic fallback because AI evaluation was unavailable.',
        student_summary: 'Assessment submitted and scored from available evidence.',
        detailed_strengths: [],
        detailed_weaknesses: [],
        next_3_learning_actions: [
          'Review failed and unattempted questions',
          'Practice hidden edge cases',
          'Improve explanation and code structure',
        ],
      },
    };
  }

  private getSupabase() {
    if (this.supabase) return this.supabase;
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const serviceKey =
      this.config.get<string>('SUPABASE_SERVICE_ROLE') ||
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      this.config.get<string>('SUPABASE_KEY');

    if (!supabaseUrl || !serviceKey) {
      throw new InternalServerErrorException(
        'Supabase service credentials are not configured',
      );
    }

    this.supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: {
        transport: WebSocket as never,
      },
    });
    return this.supabase;
  }

  private sameStringSet(left: string[], right: string[]) {
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    return leftSet.size === rightSet.size && [...leftSet].every((item) => rightSet.has(item));
  }

  private average(values: number[]) {
    const valid = values.filter((value) => Number.isFinite(value));
    if (!valid.length) return 0;
    return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
  }

  private computeReadiness(params: {
    marksScore: number;
    capabilityScore: number;
    hiddenTestPassRate: number;
    approachScore: number;
    complexityScore: number;
    codeQualityScore: number;
    bruteForceRisk: RiskLevel;
    hardcodingRisk: RiskLevel;
    compilationBehaviour: CompilationBehaviour;
    sectionScores: Record<'DSA' | 'SQL' | 'OOPs' | 'MCQ', number>;
    strongestSection: string;
    weakestSection: string;
  }) {
    const reasons: string[] = [];
    const concerns: string[] = [];
    const severeRisk =
      params.compilationBehaviour === 'Failed' ||
      params.bruteForceRisk === 'High' ||
      params.hardcodingRisk === 'High';

    if (params.marksScore < 45) reasons.push(`Overall marks score is low at ${params.marksScore}.`);
    if (params.capabilityScore < 45) reasons.push(`Capability score is low at ${params.capabilityScore}.`);
    if (params.hiddenTestPassRate < 30) reasons.push(`Hidden test pass rate is weak at ${params.hiddenTestPassRate}.`);
    if (params.compilationBehaviour === 'Failed') reasons.push('Compilation failed on the submitted evidence.');
    if (params.bruteForceRisk === 'High') reasons.push('Brute-force risk is high.');
    if (params.hardcodingRisk === 'High') reasons.push('Hardcoding risk is high.');

    if (params.approachScore < 50) concerns.push(`Approach score needs work at ${params.approachScore}.`);
    if (params.complexityScore < 50) concerns.push(`Complexity handling is weak at ${params.complexityScore}.`);
    if (params.codeQualityScore < 50) concerns.push(`Code quality is weak at ${params.codeQualityScore}.`);
    if (params.sectionScores[params.weakestSection as keyof typeof params.sectionScores] < 50) {
      concerns.push(`${params.weakestSection} is the weakest section and should be prioritized.`);
    }

    let label: ReadinessLabel = 'Trainable but Not Ready';
    if (
      params.marksScore < 45 ||
      params.capabilityScore < 45 ||
      params.hardcodingRisk === 'High'
    ) {
      label = 'Not Ready';
    } else if (
      params.marksScore >= 70 &&
      (params.hiddenTestPassRate < 50 ||
        params.bruteForceRisk === 'High' ||
        params.hardcodingRisk === 'Medium')
    ) {
      label = 'Risky High Scorer';
    } else if (
      params.marksScore >= 85 &&
      params.capabilityScore >= 85 &&
      params.hiddenTestPassRate >= 80 &&
      params.bruteForceRisk === 'Low' &&
      params.hardcodingRisk === 'Low'
    ) {
      label = 'Elite 1% Company Ready';
    } else if (
      params.marksScore >= 75 &&
      params.capabilityScore >= 75 &&
      params.hiddenTestPassRate >= 70 &&
      (params.bruteForceRisk === 'Low' || params.bruteForceRisk === 'Medium') &&
      params.hardcodingRisk === 'Low'
    ) {
      label = 'Strong Company Ready';
    } else if (
      params.marksScore >= 60 &&
      params.capabilityScore >= 65 &&
      params.hiddenTestPassRate >= 55 &&
      params.bruteForceRisk !== 'High' &&
      params.hardcodingRisk === 'Low'
    ) {
      label = 'Near Ready';
    } else if (
      (params.marksScore >= 45 && params.marksScore <= 60) ||
      (params.capabilityScore >= 45 && params.capabilityScore <= 65)
    ) {
      label = 'Trainable but Not Ready';
    } else if (severeRisk || params.hiddenTestPassRate < 30) {
      label = 'Not Ready';
    }

    const bucket = this.bucketFromReadinessLabel(label);
    const trainingPriority = this.trainingPriority(params.weakestSection, params.sectionScores);
    const teacherAction = this.teacherAction(bucket, trainingPriority, severeRisk);
    const companyRecommendation = this.companyRecommendation(label);
    const trainingRecommendation = this.trainingRecommendation(label, trainingPriority);
    const riskSummary = {
      brute_force_risk: params.bruteForceRisk,
      hardcoding_risk: params.hardcodingRisk,
      compilation_behaviour: params.compilationBehaviour,
      severe_risk: severeRisk,
      concerns,
    };

    return {
      label,
      bucket,
      reason: {
        label,
        bucket,
        rules_triggered: reasons.length ? reasons : ['Profile is in the transition band and needs targeted practice.'],
        score_snapshot: {
          marks_score: params.marksScore,
          capability_score: params.capabilityScore,
          hidden_test_pass_rate: params.hiddenTestPassRate,
          approach_score: params.approachScore,
          complexity_score: params.complexityScore,
          code_quality_score: params.codeQualityScore,
        },
        strongest_section: params.strongestSection,
        weakest_section: params.weakestSection,
      },
      trainingPriority,
      teacherAction,
      companyRecommendation,
      trainingRecommendation,
      riskSummary,
    };
  }

  private trainingPriority(
    weakestSection: string,
    sectionScores: Record<'DSA' | 'SQL' | 'OOPs' | 'MCQ', number>,
  ) {
    const score = sectionScores[weakestSection as keyof typeof sectionScores] ?? 0;
    if (weakestSection === 'DSA') return score < 45 ? 'Core problem solving and hidden-case handling' : 'Algorithmic optimization and edge-case practice';
    if (weakestSection === 'SQL') return score < 45 ? 'SQL correctness, joins, and result validation' : 'SQL efficiency, NULL handling, and business rules';
    if (weakestSection === 'OOPs') return score < 45 ? 'Object modelling, abstraction, and class design' : 'SOLID design, extensibility, and structure';
    return score < 45 ? 'Fundamental CS revision and accuracy drills' : 'MCQ revision for weaker theory areas';
  }

  private teacherAction(
    bucket: ReadinessBucket,
    trainingPriority: string,
    severeRisk: boolean,
  ) {
    if (bucket === 'Ready') {
      return 'Move the student to mock interviews and keep monitoring the weakest section.';
    }
    if (bucket === 'Failed') {
      return severeRisk
        ? 'Hold interview progression. Require supervised remediation and a reassessment attempt.'
        : `Hold interview progression. Assign focused remediation on ${trainingPriority.toLowerCase()}.`;
    }
    return `Assign targeted training on ${trainingPriority.toLowerCase()} and schedule a reassessment.`;
  }

  private numberOutput(value: unknown, fallback = 0) {
    const score = Number(value ?? fallback);
    if (!Number.isFinite(score)) return fallback;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private nullableNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  private riskOutput(value: unknown) {
    const text = String(value || '').toLowerCase();
    if (text === 'high') return 'High';
    if (text === 'medium') return 'Medium';
    return 'Low';
  }

  private compilationOutput(value: unknown) {
    const text = String(value || '').toLowerCase();
    if (text.includes('fail')) return 'Failed';
    if (text.includes('warn')) return 'Warnings';
    return 'Clean';
  }

  private bucketFromReadinessLabel(label: ReadinessLabel): ReadinessBucket {
    if (label === 'Elite 1% Company Ready' || label === 'Strong Company Ready') return 'Ready';
    if (label === 'Not Ready' || label === 'Risky High Scorer') return 'Failed';
    return 'Training Needed';
  }

  private companyRecommendation(label: ReadinessLabel) {
    if (label === 'Elite 1% Company Ready' || label === 'Strong Company Ready') {
      return 'Send to product/service company immediately';
    }
    if (label === 'Near Ready') return 'Send only after mock interview';
    if (label === 'Trainable but Not Ready') return 'Train for 6-8 weeks before sending';
    return 'Do not send to company yet';
  }

  private trainingRecommendation(label: ReadinessLabel, trainingPriority: string) {
    if (label === 'Elite 1% Company Ready' || label === 'Strong Company Ready') {
      return 'Move to company-specific interview practice and maintain current strengths.';
    }
    if (label === 'Near Ready') {
      return `Train for 2-3 weeks on ${trainingPriority.toLowerCase()} before final interview screening.`;
    }
    if (label === 'Trainable but Not Ready') {
      return `Train for 6-8 weeks on ${trainingPriority.toLowerCase()} and reassess.`;
    }
    return `Do not send to companies yet. Require supervised remediation on ${trainingPriority.toLowerCase()} and a fresh assessment.`;
  }

  private stringArrayOutput(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item));
  }

  private uuidOrNull(value?: string) {
    if (!value) return null;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
      ? value
      : null;
  }

  private questionStatus(value?: string) {
    if (value === 'submitted' || value === 'ran' || value === 'saved') return value;
    return 'unvisited';
  }

  private strongestArea(scores: Record<string, number>) {
    return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'DSA';
  }

  private weakestArea(scores: Record<string, number>) {
    return Object.entries(scores).sort((a, b) => a[1] - b[1])[0]?.[0] || 'MCQ';
  }
}
