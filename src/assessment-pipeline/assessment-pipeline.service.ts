import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
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
import { SqlSandboxService } from '../sql-sandbox/sql-sandbox.service';

type Section = 'DSA' | 'SQL' | 'OOPs' | 'MCQ';
type FinalizeStage = Section | 'DASHBOARD';

type FinalizeAnswer = {
  value?: string;
  language?: string;
  selectedOptions?: string[];
  marked?: boolean;
  runs?: number;
  submissions?: number;
  status?: string;
  resultMessage?: string;
  executionTime?: string | null;
  executionMemory?: number | null;
  sqlExecutionMs?: number | null;
  testResults?: {
    test_results?: Array<{ passed?: boolean }>;
    total?: number;
    passed?: number;
  } | null;
  test_results?: {
    test_results?: Array<{ passed?: boolean }>;
    total?: number;
    passed?: number;
  } | null;
};

type QuestionSubmitInput = {
  student_id?: string;
  student_email?: string;
  assessment_id?: string;
  attempt_id?: string;
  question_id?: string;
  started_at?: string;
  submitted_at?: string;
  duration_minutes?: number;
  submission_mode?: 'manual' | 'auto';
  answer?: FinalizeAnswer;
  dsa_output?: Record<string, unknown>;
  test_results?: FinalizeAnswer['testResults'];
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
  integrity_status?: 'disqualified' | null;
  integrity_source?: 'tab_switch' | 'camera' | null;
  integrity_message?: string | null;
  integrity_event_count?: number | null;
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
  expected_code?: unknown;
  expected_time_complexity?: string;
  expected_space_complexity?: string;
  ideal_time?: number;
  ideal_space?: number;
  evaluator_context?: unknown;
  test_cases?: unknown[];
  open_test_cases?: unknown[];
  hidden_test_cases?: unknown[];
  schema_ref?: unknown;
  expected_columns?: unknown[];
  visible_expected_rows?: unknown[];
  result_match?: {
    order_matters?: boolean;
    numeric_tolerance?: number;
  };
  required_business_rules?: unknown[];
  expected_sql_concepts?: unknown[];
  expected_sql_concept_tags?: unknown[];
  edge_cases?: unknown[];
  null_rules?: unknown[];
  duplicate_rules?: unknown[];
  expected_oops_tags?: unknown[];
  required_classes?: unknown[];
  required_abstractions?: unknown[];
  required_patterns?: unknown[];
  required_solid_principles?: unknown[];
  required_error_cases?: unknown[];
  required_design_rules?: unknown[];
  optional_oops_tags?: unknown[];
  red_flag_tags?: unknown[];
};

type CodeTestSummary = {
  openPassed: number | null;
  openTotal: number | null;
  hiddenPassed: number | null;
  hiddenTotal: number | null;
  totalPassed: number | null;
  totalTests: number | null;
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
    private readonly sqlSandbox: SqlSandboxService,
    private readonly oopsEvaluation: OopsEvaluationService,
    private readonly mcqEvaluation: McqEvaluationService,
    private readonly dashboardEvaluation: DashboardEvaluationService,
  ) {}

  async finalize(rawInput: unknown) {
    const input = this.parseInput(rawInput);
    const bank = (await this.questionBank.getBank()) as Bank;
    const submittedAt = input.submitted_at || new Date().toISOString();
    const durationMinutes =
      input.duration_minutes || bank.assessment?.duration_minutes || 180;

    const attemptId = await this.upsertAssessmentAttempt(
      input,
      bank,
      submittedAt,
      durationMinutes,
      input.integrity_status === 'disqualified'
        ? 'disqualified'
        : input.submission_mode === 'auto'
          ? 'auto_submitted'
          : 'submitted',
    );
    await this.persistDashboardReport(attemptId, input, bank);
    return {
      attempt_id: attemptId,
      status: 'finalized',
    };
  }

  async persistDsaQuestionSubmission(rawInput: unknown) {
    const input = this.parseQuestionSubmitInput(rawInput);
    const bank = (await this.questionBank.getBank()) as Bank;
    const questions = bank.questions || [];
    const question = questions.find((item) => item.id === input.question_id);

    if (!question) {
      throw new BadRequestException(`Unknown question_id ${input.question_id}`);
    }
    if (question.section !== 'DSA' || question.engine !== 'code') {
      throw new BadRequestException(`${question.id} is not a DSA coding question`);
    }

    const submittedAt = input.submitted_at || new Date().toISOString();
    const durationMinutes =
      input.duration_minutes || bank.assessment?.duration_minutes || 180;
    const answer = input.answer || {};
    const evaluationDetail = {
      question_id: question.id,
      question_title: question.title || question.id,
      prompt: question.prompt,
      topic: question.topic,
      difficulty: question.difficulty,
      expected_approach: question.expected_approach,
      expected_code: question.expected_code,
      expected_time_complexity: question.expected_time_complexity,
      expected_space_complexity: question.expected_space_complexity,
      ideal_time: question.ideal_time,
      ideal_space: question.ideal_space,
      evaluator_context: question.evaluator_context,
      language: answer.language,
      submitted_code: answer.value || '',
      status: answer.status || 'submitted',
      run_count: answer.runs || 0,
      submit_count: answer.submissions || 0,
      compiler_result_summary: answer.resultMessage || '',
      execution_time_ms: this.parseExecutionTimeMs(answer.executionTime),
      execution_memory_kb: this.nullableNumber(answer.executionMemory),
      testResults: input.test_results || answer.testResults || answer.test_results || null,
      test_results: input.test_results || answer.testResults || answer.test_results || null,
      open_test_cases: question.open_test_cases || [],
      hidden_test_cases: question.hidden_test_cases || [],
      all_doc_test_cases: question.test_cases || [],
    };
    const evaluation = await this.dsaEvaluation.evaluate(evaluationDetail);
    const attemptId = await this.upsertAssessmentAttempt(
      {
        student_id: input.student_id,
        student_email: input.student_email,
        assessment_id: input.assessment_id,
        started_at: input.started_at,
        submitted_at: submittedAt,
        duration_minutes: durationMinutes,
        submission_mode: input.submission_mode || 'manual',
        integrity_status: null,
        integrity_source: null,
        integrity_message: null,
        integrity_event_count: null,
      },
      bank,
      submittedAt,
      durationMinutes,
      'in_progress',
    );

    await this.persistQuestionAttemptSnapshot(attemptId, question, input, submittedAt);
    await this.persistQuestionEvaluationSnapshot(
      attemptId,
      question,
      input,
      submittedAt,
      evaluation,
    );

    return {
      attempt_id: attemptId,
      question_id: question.id,
      section: question.section,
      status: 'saved',
      evaluation,
    };
  }

  async persistSectionQuestionSubmission(section: Section, rawInput: unknown) {
    const input = this.parseQuestionSubmitInput(rawInput);
    const bank = (await this.questionBank.getBank()) as Bank;
    const questions = bank.questions || [];
    const question = questions.find((item) => item.id === input.question_id);

    if (!question) {
      throw new BadRequestException(`Unknown question_id ${input.question_id}`);
    }
    if (question.section !== section) {
      throw new BadRequestException(`${question.id} is not a ${section} question`);
    }
    if (section === 'DSA') {
      return this.persistDsaQuestionSubmission(rawInput);
    }

    const submittedAt = input.submitted_at || new Date().toISOString();
    const durationMinutes =
      input.duration_minutes || bank.assessment?.duration_minutes || 180;
    const evaluation = await this.evaluateSingleSubmittedQuestion(
      section,
      question,
      input,
    );
    const attemptId = await this.upsertAssessmentAttempt(
      {
        student_id: input.student_id,
        student_email: input.student_email,
        assessment_id: input.assessment_id,
        started_at: input.started_at,
        submitted_at: submittedAt,
        duration_minutes: durationMinutes,
        submission_mode: input.submission_mode || 'manual',
        integrity_status: null,
        integrity_source: null,
        integrity_message: null,
        integrity_event_count: null,
      },
      bank,
      submittedAt,
      durationMinutes,
      'in_progress',
    );

    await this.persistQuestionAttemptSnapshot(attemptId, question, input, submittedAt);
    await this.persistQuestionEvaluationSnapshot(
      attemptId,
      question,
      input,
      submittedAt,
      evaluation,
    );

    return {
      attempt_id: attemptId,
      question_id: question.id,
      section: question.section,
      status: 'saved',
      evaluation,
    };
  }

  async processFinalizeStage(
    attemptId: string,
    rawStage: string,
    rawInput: unknown,
  ) {
    const stage = this.parseFinalizeStage(rawStage);
    const input = this.parseInput(rawInput);
    await this.ensureAttemptOwnership(attemptId, input.student_id || '', input.assessment_id);
    const bank = (await this.questionBank.getBank()) as Bank;
    const questions = bank.questions || [];
    const questionsById = new Map(
      questions.map((question) => [question.id, question]),
    );

    if (stage === 'DASHBOARD') {
      await this.persistFinalRuntimeSnapshots(attemptId, input, questions);
      const report = await this.persistDashboardReport(attemptId, input, bank);

      return {
        attempt_id: attemptId,
        report_id: this.textOutput((report as { id?: unknown }).id),
        stage,
        status: 'processed',
      };
    }

    const summary =
      stage === 'DSA' || stage === 'OOPs'
        ? await this.evaluateCodingSection(stage, questions, input, true)
        : stage === 'SQL'
          ? await this.evaluateSqlSection(questions, input, true)
          : await this.evaluateMcqSection(questions, input, true);

    await this.replaceEvaluationsForSection(attemptId, stage);
    await this.persistEvaluations(
      attemptId,
      questionsById,
      summary.evaluations,
    );
    await this.persistFinalRuntimeSnapshots(attemptId, input, questions);

    return {
      attempt_id: attemptId,
      stage,
      status: 'processed',
      score: summary.score,
    };
  }

  private async persistDashboardReport(
    attemptId: string,
    input: FinalizeInput,
    bank: Bank,
  ) {
    const questions = bank.questions || [];
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
    const hiddenTestPassRate = this.aggregateHiddenTestPassRate(
      questions,
      input,
    );
    const dashboardInput = this.buildDashboardInput(
      input,
      bank,
      deterministicScores,
      { DSA: dsa, SQL: sql, OOPs: oops, MCQ: mcq },
      hiddenTestPassRate,
    );
    const dashboardEvaluation = await this.dashboardEvaluation
      .evaluate(dashboardInput)
      .catch(() =>
        this.fallbackDashboard(
          input,
          bank,
          deterministicScores,
          hiddenTestPassRate,
        ),
      );

    await this.replaceReportForAttempt(attemptId);
    return this.persistReport({
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
  }

  private parseInput(rawInput: unknown): FinalizeInput {
    if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
      throw new BadRequestException('Finalize payload must be a JSON object');
    }

    const input = rawInput as FinalizeInput;
    const studentId = String(input.student_id || '').trim();
    if (!studentId) throw new BadRequestException('student_id is required');
    input.student_id = studentId;

    if (
      !input.answers ||
      typeof input.answers !== 'object' ||
      Array.isArray(input.answers)
    ) {
      throw new BadRequestException('answers are required');
    }

    for (const [questionId, answer] of Object.entries(input.answers)) {
      if (!questionId.trim()) {
        throw new BadRequestException(
          'answers must use non-empty question ids',
        );
      }
      if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
        throw new BadRequestException(
          `Answer for ${questionId} must be an object`,
        );
      }
    }

    return input;
  }

  private async evaluateCodingSection(
    section: 'DSA' | 'OOPs',
    questions: BankQuestion[],
    input: FinalizeInput,
    useAi = false,
  ): Promise<SectionSummary> {
    const sectionQuestions = questions.filter(
      (question) => question.section === section,
    );
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
        expected_code: question.expected_code,
        expected_time_complexity: question.expected_time_complexity,
        expected_space_complexity: question.expected_space_complexity,
        ideal_time: question.ideal_time,
        ideal_space: question.ideal_space,
        evaluator_context: question.evaluator_context,
        expected_oops_tags: question.expected_oops_tags || [],
        required_classes: question.required_classes || [],
        required_abstractions: question.required_abstractions || [],
        required_patterns: question.required_patterns || [],
        required_solid_principles: question.required_solid_principles || [],
        required_error_cases: question.required_error_cases || [],
        required_design_rules: question.required_design_rules || [],
        optional_oops_tags: question.optional_oops_tags || [],
        red_flag_tags: question.red_flag_tags || [],
        language: answer.language,
        submitted_code: answer.value || '',
        status: answer.status || 'unvisited',
        run_count: answer.runs || 0,
        submit_count: answer.submissions || 0,
        compiler_result_summary: answer.resultMessage || '',
        execution_time_ms: this.parseExecutionTimeMs(answer.executionTime),
        execution_memory_kb: this.nullableNumber(answer.executionMemory),
        testResults: answer.testResults || answer.test_results || null,
        test_results: answer.testResults || answer.test_results || null,
        open_test_cases: question.open_test_cases || [],
        hidden_test_cases: question.hidden_test_cases || [],
        all_doc_test_cases: question.test_cases || [],
      };
    });

    for (const detail of details) {
      if (section === 'DSA') {
        evaluations.push(await this.dsaEvaluation.evaluate(detail));
        continue;
      }

      evaluations.push(await this.oopsEvaluation.evaluate(detail));
    }

    return {
      score: this.average(
        evaluations.map((item) =>
          Number(item.output.overall_question_score || 0),
        ),
      ),
      evaluations,
      deterministic: { questions: details },
    };
  }

  private async runSqlVisibleQuery(
    questionId: string,
    query: string,
    attemptId?: string,
  ) {
    if (!String(query || '').trim()) {
      return {
        columns: [] as string[],
        rows: [] as Record<string, unknown>[],
        row_count: 0,
        execution_ms: null as number | null,
        error: '',
      };
    }

    try {
      return await this.sqlSandbox.run(
        {
          attempt_id: attemptId,
          question_id: questionId,
          query,
          mode: 'visible',
        },
        false,
      );
    } catch (error) {
      return {
        columns: [] as string[],
        rows: [] as Record<string, unknown>[],
        row_count: 0,
        execution_ms: null as number | null,
        error: error instanceof Error ? error.message : 'SQL execution failed',
      };
    }
  }

  private buildSqlEvaluationDetail(
    question: BankQuestion,
    answer: FinalizeAnswer | QuestionSubmitInput['answer'],
    sqlRun: {
      columns?: unknown;
      rows?: unknown;
      row_count?: unknown;
      execution_ms?: unknown;
      error?: unknown;
    },
  ) {
    return {
      question_id: question.id,
      question_title: question.title || question.id,
      prompt: question.prompt,
      topic: question.topic,
      expected_approach: question.expected_approach,
      expected_code: question.expected_code,
      evaluator_context: question.evaluator_context,
      schema_ref: question.schema_ref,
      expected_columns: question.expected_columns || [],
      visible_expected_rows: question.visible_expected_rows || [],
      result_match: question.result_match || { order_matters: false, numeric_tolerance: 0.01 },
      required_business_rules: question.required_business_rules || [],
      expected_sql_concepts: question.expected_sql_concepts || [],
      expected_sql_concept_tags:
        question.expected_sql_concept_tags || question.expected_sql_concepts || [],
      edge_cases: question.edge_cases || [],
      null_rules: question.null_rules || [],
      duplicate_rules: question.duplicate_rules || [],
      submitted_query: answer?.value || '',
      status: answer?.status || 'unvisited',
      run_count: answer?.runs || 0,
      submit_count: answer?.submissions || 0,
      execution_ms: this.nullableNumber(sqlRun.execution_ms ?? answer?.sqlExecutionMs),
      sql_result_summary:
        this.textOutput(answer?.resultMessage || '') ||
        this.textOutput(sqlRun.error || '') ||
        `Returned ${this.nullableNumber(sqlRun.row_count) || 0} row(s)`,
      sql_result_columns: Array.isArray(sqlRun.columns) ? sqlRun.columns : [],
      sql_result_rows: Array.isArray(sqlRun.rows) ? sqlRun.rows : [],
      sql_result_row_count: this.nullableNumber(sqlRun.row_count),
      sql_result_error: this.textOutput(sqlRun.error || ''),
      runtime_observation:
        this.textOutput(answer?.resultMessage || '') ||
        this.textOutput(sqlRun.error || ''),
    };
  }

  private async evaluateSqlSection(
    questions: BankQuestion[],
    input: FinalizeInput,
    useAi = false,
  ): Promise<SectionSummary> {
    const sectionQuestions = questions.filter(
      (question) => question.section === 'SQL',
    );
    const evaluations: EvaluationResult[] = [];
    const details: Record<string, unknown>[] = [];

    for (const question of sectionQuestions) {
      const answer = input.answers?.[question.id] || {};
      const sqlRun = await this.runSqlVisibleQuery(question.id, answer.value || '');
      const detail = this.buildSqlEvaluationDetail(question, answer, sqlRun);
      details.push(detail);
      const fallback = this.fallbackQuestionEvaluation('SQL', detail);
      try {
        evaluations.push(await this.sqlEvaluation.evaluate(detail));
      } catch (error) {
        evaluations.push({
          ...fallback,
          output: {
            ...fallback.output,
            evaluation_error:
              error instanceof Error
                ? error.message
                : 'SQL evaluation failed',
          },
        });
      }
    }

    return {
      score: this.average(
        evaluations.map((item) =>
          Number(item.output.overall_question_score || 0),
        ),
      ),
      evaluations,
      deterministic: { questions: details },
    };
  }

  private async evaluateMcqSection(
    questions: BankQuestion[],
    input: FinalizeInput,
    useAi = false,
  ): Promise<SectionSummary> {
    const sectionQuestions = questions.filter(
      (question) => question.section === 'MCQ',
    );
    const answers = sectionQuestions.map((question) => {
      const answer = input.answers?.[question.id] || {};
      const selected = answer.selectedOptions || [];
      const correct = question.correct_options || [];
      const score = this.sameStringSet(selected, correct) ? 100 : 0;
      return {
        section: 'MCQ',
        question_id: question.id,
        question_title: question.title || question.id,
        topic: question.topic || 'general',
        options: (question.options || []).map((option) => ({
          id: option.id || '',
          label: option.label || '',
          text: option.text || '',
        })),
        selected_options: selected,
        correct_options: correct,
        explanation: question.explanation || '',
        misconception_mapping: question.misconception_mapping || {},
        is_correct: this.sameStringSet(selected, correct),
        answer_change_count: 0,
        time_spent_seconds: 0,
        overall_question_score: score,
        overall_mcq_score: score,
        score_basis: 'selected_options_match',
      };
    });

    const score = this.average(answers.map((answer) => Number(answer.overall_question_score || 0)));
    const payload = {
      student_id: input.student_id,
      total_questions: sectionQuestions.length,
      correct_count: answers.filter((answer) => answer.is_correct).length,
      deterministic_score: score,
      answers,
      tab_events: input.tab_events || 0,
    };

    const sectionEvaluation = await this.tryEvaluate(
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
          time_behavior_summary:
            'Deterministic fallback based on selected answers.',
          revision_recommendation:
            'Review incorrect concepts from the MCQ section.',
          placement_readiness_label: 'Near Ready',
        },
      },
      useAi,
    );

    return {
      score,
      evaluations: answers.map((answer) => ({
        section: 'MCQ',
        prompt_version: 'mcq-question-deterministic.v1',
        model: 'deterministic',
        output: answer,
      })),
      deterministic: {
        questions: answers,
        section: sectionEvaluation.output,
      },
    };
  }

  private async tryEvaluate(
    section: string,
    evaluate: () => Promise<EvaluationResult>,
    fallback: EvaluationResult,
    useAi = false,
  ) {
    if (!useAi || !this.isFinalizeAiEvaluationEnabled()) {
      return fallback;
    }

    try {
      return await evaluate();
    } catch (error) {
      return {
        ...fallback,
        output: {
          ...fallback.output,
          evaluation_error:
            error instanceof Error
              ? error.message
              : `${section} evaluation failed`,
        },
      };
    }
  }

  private async tryEvaluateQuestionSubmit(
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
            error instanceof Error
              ? error.message
              : `${section} evaluation failed`,
        },
      };
    }
  }

  private async evaluateSingleSubmittedQuestion(
    section: Section,
    question: BankQuestion,
    input: QuestionSubmitInput,
  ): Promise<EvaluationResult> {
    const answer = input.answer || {};
    if (section === 'SQL') {
      const sqlRun = await this.runSqlVisibleQuery(
        question.id,
        answer.value || '',
        input.attempt_id,
      );
      const detail = this.buildSqlEvaluationDetail(question, answer, sqlRun);
      return this.tryEvaluateQuestionSubmit(
        'SQL',
        () => this.sqlEvaluation.evaluate(detail),
        this.fallbackQuestionEvaluation('SQL', detail),
      );
    }

    if (section === 'OOPs') {
      const detail = {
        question_id: question.id,
        question_title: question.title || question.id,
        prompt: question.prompt,
        topic: question.topic,
        difficulty: question.difficulty,
        expected_approach: question.expected_approach,
        expected_code: question.expected_code,
        evaluator_context: question.evaluator_context,
        expected_oops_tags: question.expected_oops_tags || [],
        required_classes: question.required_classes || [],
        required_abstractions: question.required_abstractions || [],
        required_patterns: question.required_patterns || [],
        required_solid_principles: question.required_solid_principles || [],
        required_error_cases: question.required_error_cases || [],
        required_design_rules: question.required_design_rules || [],
        optional_oops_tags: question.optional_oops_tags || [],
        red_flag_tags: question.red_flag_tags || [],
        language: answer.language,
        submitted_code: answer.value || '',
        status: answer.status || 'submitted',
        run_count: answer.runs || 0,
        submit_count: answer.submissions || 0,
        compiler_result_summary: answer.resultMessage || '',
        execution_time_ms: this.parseExecutionTimeMs(answer.executionTime),
        execution_memory_kb: this.nullableNumber(answer.executionMemory),
        testResults: input.test_results || answer.testResults || answer.test_results || null,
        test_results: input.test_results || answer.testResults || answer.test_results || null,
        open_test_cases: question.open_test_cases || [],
        hidden_test_cases: question.hidden_test_cases || [],
        all_doc_test_cases: question.test_cases || [],
      };
      return this.oopsEvaluation.evaluate(detail);
    }

    if (section === 'MCQ') {
      const selected = answer.selectedOptions || [];
      const correct = question.correct_options || [];
      const score = this.sameStringSet(selected, correct) ? 100 : 0;
      return {
        section: 'MCQ',
        prompt_version: 'mcq-question-deterministic.v1',
        model: 'deterministic',
        output: {
          section: 'MCQ',
          question_id: question.id,
          question_title: question.title || question.id,
          topic: question.topic || 'general',
          selected_options: selected,
          correct_options: correct,
          explanation: question.explanation || '',
          is_correct: this.sameStringSet(selected, correct),
          overall_question_score: score,
          overall_mcq_score: score,
          score_basis: 'selected_options_match',
          placement_readiness_label: score === 100 ? 'Strong Ready' : 'Needs Revision',
        },
      };
    }

    throw new BadRequestException(`${section} question submission is not supported`);
  }

  private isFinalizeAiEvaluationEnabled() {
    const value = String(
      this.config.get<string>('ASSESSMENT_FINALIZE_AI_EVALUATION') || '',
    )
      .trim()
      .toLowerCase();

    return ['1', 'true', 'yes', 'on'].includes(value);
  }

  private parseFinalizeStage(stage: string): FinalizeStage {
    const normalized = String(stage || '')
      .trim()
      .toUpperCase();
    if (normalized === 'DSA') return 'DSA';
    if (normalized === 'SQL') return 'SQL';
    if (normalized === 'OOPS') return 'OOPs';
    if (normalized === 'MCQ') return 'MCQ';
    if (normalized === 'DASHBOARD') return 'DASHBOARD';
    throw new BadRequestException('Invalid finalize processing stage');
  }

  private buildDashboardInput(
    input: FinalizeInput,
    bank: Bank,
    deterministicScores: Record<string, number>,
    summaries: Record<Section, SectionSummary>,
    hiddenTestPassRate = 0,
    submittedAt = input.submitted_at || new Date().toISOString(),
    durationMinutes = input.duration_minutes ||
      bank.assessment?.duration_minutes ||
      180,
  ) {
    return {
      student_id: input.student_id,
      student_email: input.student_email || '',
      student_name: input.student_email || input.student_id,
      assessment: bank.assessment,
      submitted_at: submittedAt,
      duration_minutes: durationMinutes,
      tab_events: input.tab_events || 0,
      hidden_test_pass_rate: hiddenTestPassRate,
      deterministic_scores: deterministicScores,
      weights: bank.assessment?.scoring_weights || {
        DSA: 40,
        SQL: 20,
        OOPs: 20,
        MCQ: 20,
      },
      section_evaluations: {
        DSA: summaries.DSA.evaluations.map((item) => item.output),
        SQL: summaries.SQL.evaluations.map((item) => item.output),
        OOPs: summaries.OOPs.evaluations.map((item) => item.output),
        MCQ: summaries.MCQ.evaluations.map((item) => item.output),
      },
      deterministic_details: {
        DSA: summaries.DSA.deterministic,
        SQL: summaries.SQL.deterministic,
        OOPs: summaries.OOPs.deterministic,
        MCQ: summaries.MCQ.deterministic,
      },
    };
  }

  private async upsertAssessmentAttempt(
    input: Pick<
      FinalizeInput,
      | 'student_id'
      | 'student_email'
      | 'assessment_id'
      | 'started_at'
      | 'submitted_at'
      | 'duration_minutes'
      | 'submission_mode'
      | 'integrity_status'
      | 'integrity_source'
      | 'integrity_message'
      | 'integrity_event_count'
    >,
    bank: Bank,
    submittedAt: string,
    durationMinutes: number,
    targetStatus: 'in_progress' | 'submitted' | 'auto_submitted' | 'disqualified',
  ) {
    const supabase = this.getSupabase();
    const sourceAssessmentId = input.assessment_id || bank.assessment?.id;
    if (!sourceAssessmentId) {
      throw new BadRequestException('assessment_id is required');
    }

    const { data: existingAttempt, error: existingAttemptError } =
      await supabase
        .from('student_assessment_attempts')
        .select('id,status,client_metadata')
        .eq('student_id', input.student_id)
        .contains('client_metadata', {
          source_assessment_id: sourceAssessmentId,
        })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existingAttemptError) {
      throw new InternalServerErrorException(
        `Could not check existing assessment attempts: ${existingAttemptError.message}`,
      );
    }

    if (existingAttempt?.id) {
      const existingStatus = String(existingAttempt.status || '');
      if (
        targetStatus === 'in_progress' &&
        ['submitted', 'auto_submitted', 'disqualified'].includes(existingStatus)
      ) {
        throw new ConflictException(
          'Assessment already completed or disqualified. A new attempt cannot be created.',
        );
      }

      const { error: updateError } = await supabase
        .from('student_assessment_attempts')
        .update({
          status: targetStatus,
          started_at: input.started_at || submittedAt,
          submitted_at:
            targetStatus === 'in_progress'
              ? null
              : submittedAt,
          duration_minutes: durationMinutes,
          tab_visibility_events: (input as { tab_events?: number }).tab_events || 0,
          last_seen_at: submittedAt,
          client_metadata: {
            ...(this.recordValue(existingAttempt.client_metadata) || {}),
            source_assessment_id: sourceAssessmentId,
            student_email: input.student_email,
            submission_mode: input.submission_mode || 'manual',
            camera_events: (input as { camera_events?: number }).camera_events || 0,
            integrity_status: input.integrity_status || null,
            integrity_source: input.integrity_source || null,
            integrity_message: input.integrity_message || null,
            integrity_event_count: input.integrity_event_count || null,
          },
        })
        .eq('id', existingAttempt.id);

      if (updateError) {
        throw new InternalServerErrorException(
          `Could not update assessment attempt: ${updateError.message}`,
        );
      }

      return String(existingAttempt.id);
    }

    const { data, error } = await supabase
      .from('student_assessment_attempts')
      .insert({
        student_id: input.student_id,
        assessment_id: this.uuidOrNull(sourceAssessmentId),
        status: targetStatus,
        started_at: input.started_at || submittedAt,
        submitted_at: targetStatus === 'in_progress' ? null : submittedAt,
        duration_minutes: durationMinutes,
        tab_visibility_events: (input as { tab_events?: number }).tab_events || 0,
        last_seen_at: submittedAt,
        client_metadata: {
          source_assessment_id: sourceAssessmentId,
          student_email: input.student_email,
          submission_mode: input.submission_mode || 'manual',
          camera_events: (input as { camera_events?: number }).camera_events || 0,
          integrity_status: input.integrity_status || null,
          integrity_source: input.integrity_source || null,
          integrity_message: input.integrity_message || null,
          integrity_event_count: input.integrity_event_count || null,
        },
      })
      .select('id')
      .single();

    if (error) {
      const message = error.message || '';
      if (
        error.code === '23505' ||
        message.toLowerCase().includes('duplicate key')
      ) {
        throw new ConflictException(
          'Assessment already completed or disqualified. A new attempt cannot be created.',
        );
      }
      throw new InternalServerErrorException(
        `Could not create assessment attempt: ${message}`,
      );
    }

    return String(data.id);
  }

  private async persistQuestionAttemptSnapshot(
    attemptId: string,
    question: BankQuestion,
    input: QuestionSubmitInput,
    submittedAt: string,
  ) {
    const answer = input.answer || {};
    const { error } = await this.getSupabase()
      .from('student_question_attempts')
      .upsert(
        {
          attempt_id: attemptId,
          question_id: question.id,
          section: question.section,
          answer_text: answer.value || '',
          selected_language: answer.language || null,
          selected_options: answer.selectedOptions || [],
          marked_for_review: Boolean(answer.marked),
          status: this.questionStatus(answer.status || 'submitted'),
          run_count: answer.runs || 0,
          submit_count: answer.submissions || 0,
          last_autosaved_at: submittedAt,
        },
        {
          onConflict: 'attempt_id,question_id',
        },
      );

    if (error) {
      throw new InternalServerErrorException(
        `Could not persist DSA question attempt: ${error.message}`,
      );
    }
  }

  private async persistQuestionEvaluationSnapshot(
    attemptId: string,
    question: BankQuestion,
    input: QuestionSubmitInput,
    submittedAt: string,
    evaluation: EvaluationResult,
  ) {
    const answer = input.answer || {};
    const output = this.recordValue(evaluation.output) || {};
    const scoreValue = this.numberOutput(output.overall_question_score);

    const row = {
      attempt_id: attemptId,
      question_id: question.id,
      section: question.section,
      deterministic_score: scoreValue,
      ai_evaluation: {
        source: `${String(question.section || '').toLowerCase()}-question-submit`,
        submitted_at: submittedAt,
        question_id: question.id,
        question_title: question.title || question.id,
        evaluation,
        answer_snapshot: {
          value: answer.value || '',
          language: answer.language || null,
          runs: answer.runs || 0,
          submissions: answer.submissions || 0,
          status: answer.status || 'submitted',
        },
      },
      final_score: scoreValue,
      question_attempt_id: null,
      assessment_question_id: null,
    };

    const { error } = await this.getSupabase()
      .from('student_question_evaluations')
      .upsert(row, {
        onConflict: 'attempt_id,question_id',
      });

    if (error) {
      throw new InternalServerErrorException(
        `Could not persist DSA question evaluation: ${error.message}`,
      );
    }
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

  private parseQuestionSubmitInput(rawInput: unknown): QuestionSubmitInput {
    if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
      throw new BadRequestException('Submission payload must be a JSON object');
    }

    const input = rawInput as QuestionSubmitInput;
    const studentId = String(input.student_id || '').trim();
    if (!studentId) throw new BadRequestException('student_id is required');
    input.student_id = studentId;

    const questionId = String(input.question_id || '').trim();
    if (!questionId) throw new BadRequestException('question_id is required');
    input.question_id = questionId;

    return input;
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
        const questionId = this.textOutput(output.question_id);
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

  private async replaceEvaluationsForSection(
    attemptId: string,
    section: Section,
  ) {
    const { error } = await this.getSupabase()
      .from('student_question_evaluations')
      .delete()
      .eq('attempt_id', attemptId)
      .eq('section', section);

    if (error) {
      throw new InternalServerErrorException(
        `Could not replace ${section} evaluations: ${error.message}`,
      );
    }
  }

  private async replaceReportForAttempt(attemptId: string) {
    const { error } = await this.getSupabase()
      .from('student_assessment_reports')
      .delete()
      .eq('attempt_id', attemptId);

    if (error) {
      throw new InternalServerErrorException(
        `Could not replace assessment report: ${error.message}`,
      );
    }
  }

  private async ensureAttemptOwnership(
    attemptId: string,
    studentId: string,
    assessmentId?: string,
  ) {
    if (!studentId) {
      throw new BadRequestException('student_id is required');
    }

    const { data: attempt, error } = await this.getSupabase()
      .from('student_assessment_attempts')
      .select('id,assessment_id,client_metadata')
      .eq('id', attemptId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        `Could not verify assessment attempt ownership: ${error.message}`,
      );
    }

    if (!attempt?.id) {
      throw new NotFoundException('Assessment attempt not found');
    }

    const attemptAssessmentId = this.textOutput(
      (attempt as {
        assessment_id?: unknown;
        client_metadata?: { source_assessment_id?: unknown } | null;
      }).client_metadata?.source_assessment_id ||
        (attempt as { assessment_id?: unknown }).assessment_id ||
        '',
    );

    if (assessmentId && attemptAssessmentId && attemptAssessmentId !== assessmentId) {
      throw new NotFoundException('Assessment attempt not found');
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
        const testSummary = this.codeTestSummary(question, answer);
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
          runtime_ms: this.parseExecutionTimeMs(answer.executionTime),
          memory_kb: this.nullableNumber(answer.executionMemory),
          open_tests_passed: testSummary.openPassed,
          open_tests_total: testSummary.openTotal,
          hidden_tests_passed: testSummary.hiddenPassed,
          hidden_tests_total: testSummary.hiddenTotal,
          test_results: this.submittedTestResults(answer)?.test_results || [],
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

    const { error } = await this.getSupabase()
      .from('student_code_runs')
      .insert(rows);
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
    const rows = [];
    for (const question of questions.filter((item) => item.engine === 'sql')) {
      const answer = input.answers?.[question.id] || {};
      const query = String(answer.value || '').trim();
      if (!query.length) continue;
      const sqlRun = await this.runSqlVisibleQuery(question.id, query, attemptId);
      rows.push({
        attempt_id: attemptId,
        question_id: question.id,
        assessment_question_id: null,
        question_attempt_id: null,
        run_type: answer.submissions ? 'submit' : 'run',
        query_text: query,
        columns: Array.isArray(sqlRun.columns) ? sqlRun.columns : [],
        rows: Array.isArray(sqlRun.rows) ? sqlRun.rows : [],
        row_count: this.nullableNumber(sqlRun.row_count) || 0,
        execution_ms: this.nullableNumber(sqlRun.execution_ms ?? answer.sqlExecutionMs),
        error_text:
          this.textOutput(sqlRun.error || '') || this.textOutput(answer.resultMessage || ''),
        comparison_result: {
          final_snapshot: true,
          run_count: answer.runs || 0,
          submit_count: answer.submissions || 0,
          result_message:
            this.textOutput(sqlRun.error || '') || this.textOutput(answer.resultMessage || ''),
          execution_ms: this.nullableNumber(sqlRun.execution_ms ?? answer.sqlExecutionMs),
        },
      });
    }

    if (!rows.length) return;

    const { error } = await this.getSupabase()
      .from('student_sql_runs')
      .insert(rows);
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

    const { error } = await this.getSupabase()
      .from('student_mcq_answers')
      .insert(rows);
    if (error) {
      throw new InternalServerErrorException(
        `Could not persist final MCQ answers: ${error.message}`,
      );
    }
  }

  private parseTestSummary(message: string | undefined) {
    const match = String(message || '').match(
      /Test results:\s*(\d+)\/(\d+)\s*passed/i,
    );
    if (!match) return null;
    return {
      passed: Number(match[1]),
      total: Number(match[2]),
    };
  }

  private submittedTestResults(answer: FinalizeAnswer) {
    const structured =
      answer.testResults ||
      answer.test_results ||
      (null as {
        test_results?: Array<{ passed?: boolean }>;
        total?: number;
        passed?: number;
      } | null);

    if (!structured || typeof structured !== 'object') return null;
    const rows = Array.isArray(structured.test_results)
      ? structured.test_results
      : [];
    if (!rows.length) return null;
    return {
      test_results: rows.filter(
        (item): item is { passed?: boolean } =>
          Boolean(item) && typeof item === 'object',
      ),
      total: this.nullableNumber(structured.total),
      passed: this.nullableNumber(structured.passed),
    };
  }

  private codeTestSummary(
    question: BankQuestion,
    answer: FinalizeAnswer,
  ): CodeTestSummary {
    const openTotal =
      question.open_test_cases?.length ||
      (question.test_cases?.length
        ? Math.min(question.test_cases.length, 5)
        : 0);
    const hiddenTotal = question.hidden_test_cases?.length || 0;
    const structured = this.submittedTestResults(answer);

    if (structured?.test_results?.length) {
      const results = structured.test_results;
      const countPassed = (items: Array<{ passed?: boolean }>) =>
        items.filter((item) => item.passed).length;
      const openResults = openTotal ? results.slice(0, openTotal) : [];
      const hiddenResults = hiddenTotal
        ? results.slice(openTotal, openTotal + hiddenTotal)
        : [];
      return {
        openPassed: openTotal ? countPassed(openResults) : null,
        openTotal: openTotal || null,
        hiddenPassed: hiddenTotal ? countPassed(hiddenResults) : null,
        hiddenTotal: hiddenTotal || null,
        totalPassed:
          structured.passed ?? countPassed(results) ?? results.length ?? null,
        totalTests: structured.total ?? results.length ?? null,
      };
    }

    const passSummary = this.parseTestSummary(answer.resultMessage);
    return {
      openPassed: passSummary?.passed ?? null,
      openTotal: passSummary?.total ?? null,
      hiddenPassed: null,
      hiddenTotal: hiddenTotal || null,
      totalPassed: passSummary?.passed ?? null,
      totalTests: passSummary?.total ?? null,
    };
  }

  private aggregateHiddenTestPassRate(
    questions: BankQuestion[],
    input: FinalizeInput,
  ) {
    const summaries = questions
      .filter((question) => question.engine === 'code')
      .map((question) =>
        this.codeTestSummary(question, input.answers?.[question.id] || {}),
      );
    const hiddenPassed = summaries.reduce(
      (sum, summary) => sum + Number(summary.hiddenPassed || 0),
      0,
    );
    const hiddenTotal = summaries.reduce(
      (sum, summary) => sum + Number(summary.hiddenTotal || 0),
      0,
    );
    return hiddenTotal > 0 ? Math.round((hiddenPassed / hiddenTotal) * 100) : 0;
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
    const persistedSectionScores = await this.loadPersistedSectionScores(
      params.attemptId,
    );
    const sectionScores = {
      DSA:
        persistedSectionScores.DSA ??
        this.numberOutput(output.dsa_score, params.deterministicScores.DSA),
      SQL:
        persistedSectionScores.SQL ??
        this.numberOutput(output.sql_score, params.deterministicScores.SQL),
      OOPs:
        persistedSectionScores.OOPs ??
        this.numberOutput(output.oops_score, params.deterministicScores.OOPs),
      MCQ:
        persistedSectionScores.MCQ ??
        this.numberOutput(output.mcq_score, params.deterministicScores.MCQ),
    };
    const marksScore = this.numberOutput(output.overall_marks_score);
    const capabilityScore = this.numberOutput(
      output.problem_solving_score,
      this.numberOutput(output.capability_score),
    );
    const approachScore = this.numberOutput(output.approach_score);
    const complexityScore = this.numberOutput(output.complexity_score);
    const codeQualityScore = this.numberOutput(output.code_quality_score);
    const hiddenTestPassRate = this.numberOutput(output.hidden_test_pass_rate);
    const bruteForceRisk = this.riskOutput(output.brute_force_risk);
    const hardcodingRisk = this.riskOutput(output.hardcoding_risk);
    const compilationBehaviour = this.compilationOutput(
      output.compilation_behaviour,
    );
    const runtimePercentile = this.textOutput(
      output.runtime_percentile,
      'Unknown',
    );
    const strongestSection = this.strongestArea(sectionScores);
    const weakestSection = this.weakestArea(sectionScores);
    const isDisqualified = params.input.integrity_status === 'disqualified';
    const integrity = isDisqualified
      ? {
          status: 'disqualified',
          source: params.input.integrity_source || 'tab_switch',
          message:
            params.input.integrity_message ||
            'Integrity violation detected. The attempt was stopped and marked as disqualified.',
          event_count: params.input.integrity_event_count || 1,
        }
      : null;
    const readiness = this.computeReadiness({
      marksScore,
      capabilityScore,
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
    const teacherAction = isDisqualified
      ? 'Disqualify the attempt and review the integrity incident.'
      : readiness.teacherAction;
    const companyRecommendation = isDisqualified
      ? 'Do not progress. Candidate was disqualified for cheating.'
      : readiness.companyRecommendation;
    const trainingRecommendation = isDisqualified
      ? 'No training recommendation because the attempt was disqualified for cheating.'
      : readiness.trainingRecommendation;
    const studentSummary = isDisqualified
      ? 'Assessment disqualified because a cheating signal was detected during the attempt.'
      : this.textOutput(output.student_summary);
    const facultyInsight = isDisqualified
      ? 'Assessment stopped due to an integrity violation and marked disqualified.'
      : this.textOutput(output.faculty_insight);
    const riskSummary = {
      ...readiness.riskSummary,
      integrity_status: integrity?.status || null,
      integrity_source: integrity?.source || null,
      integrity_message: integrity?.message || null,
      integrity_event_count: integrity?.event_count || null,
    };

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
      readiness_label: this.legacyReadinessLabel(readiness.bucket),
      readiness_bucket: readiness.bucket,
      readiness_reason: readiness.reason,
      strongest_section: strongestSection,
      weakest_section: weakestSection,
      training_priority: readiness.trainingPriority,
      teacher_action: teacherAction,
      risk_summary: riskSummary,
      training_recommendation: String(
        this.textOutput(output.training_recommendation, trainingRecommendation),
      ),
      faculty_insight: facultyInsight,
      company_recommendation: companyRecommendation,
      student_summary: studentSummary,
      detailed_strengths: this.stringArrayOutput(output.detailed_strengths),
      detailed_weaknesses: this.stringArrayOutput(output.detailed_weaknesses),
      next_3_learning_actions: this.stringArrayOutput(
        output.next_3_learning_actions,
      ),
      report_json: {
        dashboard_evaluation: params.dashboardEvaluation,
        section_evaluations: params.allEvaluations,
        dashboard_input: params.dashboardInput,
        deterministic_readiness: readiness,
        integrity,
      },
    };

    return this.insertReportRow(row);
  }

  private async insertReportRow(row: Record<string, unknown>) {
    const result = await this.getSupabase()
      .from('student_assessment_reports')
      .insert(row)
      .select('*')
      .single();

    if (!result.error) return result.data as Record<string, unknown>;

    throw new InternalServerErrorException(
      `Could not write dashboard report: ${result.error.message}`,
    );
  }

  private async loadPersistedSectionScores(attemptId: string) {
    const { data, error } = await this.getSupabase()
      .from('student_question_evaluations')
      .select(
        'question_id,section,deterministic_score,final_score,ai_evaluation,created_at',
      )
      .eq('attempt_id', attemptId);

    if (error || !Array.isArray(data)) return {};

    const latestByQuestion = new Map<
      string,
      {
        question_id?: unknown;
        section?: unknown;
        deterministic_score?: unknown;
        final_score?: unknown;
        ai_evaluation?: unknown;
        created_at?: unknown;
      }
    >();

    const createdAtTime = (value: unknown) => {
      const time = new Date(String(value || '')).getTime();
      return Number.isFinite(time) ? time : 0;
    };

    [...data]
      .sort(
        (left, right) =>
          createdAtTime(left.created_at) - createdAtTime(right.created_at),
      )
      .forEach((row) => {
        const questionId = this.textOutput(row.question_id);
        if (!questionId) return;
        latestByQuestion.set(questionId, row);
      });

    const grouped: Partial<Record<Section, number[]>> = {};
    latestByQuestion.forEach((row) => {
      const section = this.normalizeSection(row.section);
      if (!section) return;
      const output =
        this.recordValue(this.recordValue(row.ai_evaluation)?.output) || {};
      const score = this.numberOutput(
        row.final_score,
        this.numberOutput(
          row.deterministic_score,
          this.numberOutput(
            output.overall_question_score,
            this.numberOutput(output.overall_mcq_score),
          ),
        ),
      );
      grouped[section] = grouped[section] || [];
      grouped[section]?.push(score);
    });

    return Object.fromEntries(
      Object.entries(grouped).map(([section, scores]) => [
        section,
        scores.length
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          : 0,
      ]),
    ) as Partial<Record<Section, number>>;
  }

  private normalizeSection(value: unknown): Section | null {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    if (normalized === 'dsa') return 'DSA';
    if (normalized === 'sql') return 'SQL';
    if (normalized === 'oops') return 'OOPs';
    if (normalized === 'mcq') return 'MCQ';
    return null;
  }

  private fallbackQuestionEvaluation(
    section: Section,
    detail: Record<string, unknown>,
  ): EvaluationResult {
    const hasAnswer =
      this.textOutput(detail.submitted_code || detail.submitted_query).trim()
        .length > 0;
    const summary = this.parseTestSummary(
      this.textOutput(detail.compiler_result_summary),
    );
    const score = summary?.total
      ? Math.round((summary.passed / summary.total) * 100)
      : 0;
    const base = {
      section,
      question_id: this.textOutput(detail.question_id),
      question_title: this.textOutput(detail.question_title),
      overall_question_score: score,
      hardcoding_risk: 'Low',
      placement_readiness_label: 'Near Ready',
    };

    return {
      section,
      prompt_version: 'fallback',
      model: 'deterministic',
      output:
        section === 'SQL'
        ? {
                ...base,
                result_correctness_score: score,
                business_logic_score: score,
                sql_concept_score: score,
                edge_case_score: score,
                query_efficiency_score: score,
                formatting_score: score,
                alias_score: score,
                structure_score: score,
                simplicity_score: score,
                readability_score: score,
                null_duplicate_handling_score: score,
                query_quality_label: hasAnswer ? 'Average' : 'Incorrect',
                ai_returned_concept_tags: [],
                expected_sql_concept_tags: [],
                expected_concepts_used: [],
                missing_concepts: [],
                detected_mistakes: [],
                missing_business_rules: [],
                failed_case_analysis: [],
                runtime_observation: this.textOutput(detail.sql_result_summary),
                key_strengths: [],
                key_weaknesses: hasAnswer ? [] : ['No query submitted'],
                improvement_recommendation:
                  'Review joins, filters, NULLs, duplicates, and expected output.',
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
                improvement_recommendation:
                  'Improve class boundaries, abstractions, and extensibility.',
              },
    };
  }

  private fallbackDashboard(
    input: FinalizeInput,
    bank: Bank,
    scores: Record<string, number>,
    hiddenTestPassRate = 0,
  ): EvaluationResult {
    const weights = bank.assessment?.scoring_weights || {
      DSA: 40,
      SQL: 20,
      OOPs: 20,
      MCQ: 20,
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
        capability_score: Math.round(
          (scores.DSA + scores.SQL + scores.OOPs + scores.MCQ) / 4,
        ),
        dsa_score: scores.DSA,
        sql_score: scores.SQL,
        oops_score: scores.OOPs,
        mcq_score: scores.MCQ,
        approach_score: Math.round((scores.DSA + scores.SQL + scores.OOPs) / 3),
        complexity_score: Math.round((scores.DSA + scores.SQL) / 2),
        code_quality_score: Math.round((scores.DSA + scores.OOPs) / 2),
        hidden_test_pass_rate: hiddenTestPassRate,
        brute_force_risk: 'Low',
        hardcoding_risk: 'Low',
        compilation_behaviour: 'Clean',
        runtime_percentile: 'Unknown',
        strongest_area: this.strongestArea(scores),
        weakest_area: this.weakestArea(scores),
        readiness_label:
          weighted >= 70 ? 'Near Ready' : 'Trainable but Not Ready',
        company_recommendation:
          weighted >= 70
            ? 'Send only after mock interview'
            : 'Train for 2-3 weeks before sending',
        training_recommendation:
          'Review section-level weaknesses and rerun mock assessment.',
        faculty_insight:
          'Report generated with deterministic fallback because AI evaluation was unavailable.',
        student_summary:
          'Assessment submitted and scored from available evidence.',
        detailed_strengths: [],
        detailed_weaknesses: [],
        next_3_learning_actions: [
          'Review failed and unattempted questions',
          'Practice advanced edge cases',
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
    return (
      leftSet.size === rightSet.size &&
      [...leftSet].every((item) => rightSet.has(item))
    );
  }

  private average(values: number[]) {
    const valid = values.filter((value) => Number.isFinite(value));
    if (!valid.length) return 0;
    return Math.round(
      valid.reduce((sum, value) => sum + value, 0) / valid.length,
    );
  }

  private computeReadiness(params: {
    marksScore: number;
    capabilityScore: number;
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

    if (params.marksScore < 45)
      reasons.push(`Overall marks score is low at ${params.marksScore}.`);
    if (params.capabilityScore < 45)
      reasons.push(`Capability score is low at ${params.capabilityScore}.`);
    if (params.compilationBehaviour === 'Failed')
      reasons.push('Compilation failed on the submitted evidence.');
    if (params.bruteForceRisk === 'High')
      reasons.push('Brute-force risk is high.');
    if (params.hardcodingRisk === 'High')
      reasons.push('Hardcoding risk is high.');

    if (params.approachScore < 50)
      concerns.push(`Approach score needs work at ${params.approachScore}.`);
    if (params.complexityScore < 50)
      concerns.push(
        `Complexity handling is weak at ${params.complexityScore}.`,
      );
    if (params.codeQualityScore < 50)
      concerns.push(`Code quality is weak at ${params.codeQualityScore}.`);
    if (
      params.sectionScores[
        params.weakestSection as keyof typeof params.sectionScores
      ] < 50
    ) {
      concerns.push(
        `${params.weakestSection} is the weakest section and should be prioritized.`,
      );
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
      (params.bruteForceRisk === 'High' || params.hardcodingRisk === 'Medium')
    ) {
      label = 'Risky High Scorer';
    } else if (
      params.marksScore >= 85 &&
      params.capabilityScore >= 85 &&
      params.bruteForceRisk === 'Low' &&
      params.hardcodingRisk === 'Low'
    ) {
      label = 'Elite 1% Company Ready';
    } else if (
      params.marksScore >= 75 &&
      params.capabilityScore >= 75 &&
      (params.bruteForceRisk === 'Low' || params.bruteForceRisk === 'Medium') &&
      params.hardcodingRisk === 'Low'
    ) {
      label = 'Strong Company Ready';
    } else if (
      params.marksScore >= 60 &&
      params.capabilityScore >= 65 &&
      params.bruteForceRisk !== 'High' &&
      params.hardcodingRisk === 'Low'
    ) {
      label = 'Near Ready';
    } else if (
      (params.marksScore >= 45 && params.marksScore <= 60) ||
      (params.capabilityScore >= 45 && params.capabilityScore <= 65)
    ) {
      label = 'Trainable but Not Ready';
    } else if (severeRisk) {
      label = 'Not Ready';
    }

    const bucket = this.bucketFromReadinessLabel(label);
    const trainingPriority = this.trainingPriority(
      params.weakestSection,
      params.sectionScores,
    );
    const teacherAction = this.teacherAction(
      bucket,
      trainingPriority,
      severeRisk,
    );
    const companyRecommendation = this.companyRecommendation(label);
    const trainingRecommendation = this.trainingRecommendation(
      label,
      trainingPriority,
    );
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
        rules_triggered: reasons.length
          ? reasons
          : ['Profile is in the transition band and needs targeted practice.'],
        score_snapshot: {
          marks_score: params.marksScore,
          capability_score: params.capabilityScore,
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
    const score =
      sectionScores[weakestSection as keyof typeof sectionScores] ?? 0;
    if (weakestSection === 'DSA')
      return score < 45
        ? 'Core problem solving and edge-case handling'
        : 'Algorithmic optimization and edge-case practice';
    if (weakestSection === 'SQL')
      return score < 45
        ? 'SQL correctness, joins, and result validation'
        : 'SQL efficiency, NULL handling, and business rules';
    if (weakestSection === 'OOPs')
      return score < 45
        ? 'Object modelling, abstraction, and class design'
        : 'SOLID design, extensibility, and structure';
    return score < 45
      ? 'Fundamental CS revision and accuracy drills'
      : 'MCQ revision for weaker theory areas';
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

  private parseExecutionTimeMs(value: unknown) {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed * 1000);
  }

  private recordValue(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private riskOutput(value: unknown) {
    const text = this.textOutput(value).toLowerCase();
    if (text === 'high') return 'High';
    if (text === 'medium') return 'Medium';
    return 'Low';
  }

  private compilationOutput(value: unknown) {
    const text = this.textOutput(value).toLowerCase();
    if (text.includes('fail')) return 'Failed';
    if (text.includes('warn')) return 'Warnings';
    return 'Clean';
  }

  private textOutput(value: unknown, fallback = '') {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean')
      return String(value);
    return fallback;
  }

  private bucketFromReadinessLabel(label: ReadinessLabel): ReadinessBucket {
    if (label === 'Elite 1% Company Ready' || label === 'Strong Company Ready')
      return 'Ready';
    if (label === 'Not Ready' || label === 'Risky High Scorer') return 'Failed';
    return 'Training Needed';
  }

  private legacyReadinessLabel(bucket: ReadinessBucket) {
    if (bucket === 'Ready') return 'Ready';
    if (bucket === 'Training Needed') return 'Needs Practice';
    return 'At Risk';
  }

  private companyRecommendation(label: ReadinessLabel) {
    if (
      label === 'Elite 1% Company Ready' ||
      label === 'Strong Company Ready'
    ) {
      return 'Send to product/service company immediately';
    }
    if (label === 'Near Ready') return 'Send only after mock interview';
    if (label === 'Trainable but Not Ready')
      return 'Train for 6-8 weeks before sending';
    return 'Do not send to company yet';
  }

  private trainingRecommendation(
    label: ReadinessLabel,
    trainingPriority: string,
  ) {
    if (
      label === 'Elite 1% Company Ready' ||
      label === 'Strong Company Ready'
    ) {
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
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
      ? value
      : null;
  }

  private questionStatus(value?: string) {
    if (value === 'submitted' || value === 'ran' || value === 'saved')
      return value;
    return 'unvisited';
  }

  private strongestArea(scores: Record<string, number>) {
    return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'DSA';
  }

  private weakestArea(scores: Record<string, number>) {
    return Object.entries(scores).sort((a, b) => a[1] - b[1])[0]?.[0] || 'MCQ';
  }
}
