-- JoraIQ Assessment Platform - Additive Migration For Existing Supabase Schema
-- Run this in the Supabase SQL editor.
-- This script assumes your current tables already include:
-- profiles, colleges, batches, batch_students, assessments, assessment_sections,
-- assessment_questions, subjects, assessment_subjects, student_section_evaluations,
-- student_assessment_reports.
--
-- It only adds missing columns/tables needed for the 3-hour JoraIQ assessment runtime.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.set_attempt_expires_at()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.expires_at = NEW.started_at + make_interval(mins => NEW.duration_minutes);
  ELSIF NEW.expires_at IS NULL
     OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN
    NEW.expires_at = NEW.started_at + make_interval(mins => NEW.duration_minutes);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Existing Table Extensions
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS source_key TEXT,
  ADD COLUMN IF NOT EXISTS scoring_weights JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.assessment_questions
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_question_id TEXT,
  ADD COLUMN IF NOT EXISTS engine TEXT,
  ADD COLUMN IF NOT EXISTS constraints_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS expected_approach JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evaluator_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS function_signature TEXT,
  ADD COLUMN IF NOT EXISTS allowed_languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS starter_code JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS all_doc_test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS explanation TEXT,
  ADD COLUMN IF NOT EXISTS misconception_mapping JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.student_assessment_reports
  ADD COLUMN IF NOT EXISTS attempt_id UUID,
  ADD COLUMN IF NOT EXISTS dsa_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sql_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS oops_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mcq_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS readiness_bucket TEXT,
  ADD COLUMN IF NOT EXISTS readiness_reason JSONB,
  ADD COLUMN IF NOT EXISTS strongest_section TEXT,
  ADD COLUMN IF NOT EXISTS weakest_section TEXT,
  ADD COLUMN IF NOT EXISTS training_priority TEXT,
  ADD COLUMN IF NOT EXISTS training_recommendation TEXT,
  ADD COLUMN IF NOT EXISTS teacher_action TEXT,
  ADD COLUMN IF NOT EXISTS risk_summary JSONB,
  ADD COLUMN IF NOT EXISTS runtime_percentile TEXT,
  ADD COLUMN IF NOT EXISTS student_summary TEXT,
  ADD COLUMN IF NOT EXISTS detailed_strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS detailed_weaknesses JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS next_3_learning_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS report_json JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Your existing question_type constraint allows core_cs. The UI/data layer uses MCQ.
-- Keep DB-compatible values by importing MCQs as question_type='core_cs' and question_format='mcq',
-- or relax the constraint manually if you want literal 'mcq' in question_type.

-- ---------------------------------------------------------------------------
-- Missing Assessment Setup Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.assessment_batches (
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assessment_batches_pkey PRIMARY KEY (assessment_id, batch_id)
);

CREATE TABLE IF NOT EXISTS public.question_test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  case_type TEXT NOT NULL CHECK (case_type IN ('open', 'hidden', 'doc')),
  case_number INT NOT NULL DEFAULT 0,
  input_data JSONB,
  input_text TEXT,
  expected_output JSONB,
  expected_output_text TEXT,
  purpose TEXT,
  is_sample BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sql_question_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  dialect TEXT NOT NULL DEFAULT 'postgres',
  schema_sql TEXT NOT NULL,
  visible_seed_sql TEXT,
  hidden_seed_sql TEXT,
  expected_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_result_query TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id)
);

DROP TRIGGER IF EXISTS sql_question_schemas_set_updated_at ON public.sql_question_schemas;
CREATE TRIGGER sql_question_schemas_set_updated_at
BEFORE UPDATE ON public.sql_question_schemas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.question_bank_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL,
  source_version TEXT,
  imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  import_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Student Runtime / Timer / Autosave / Submissions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('not_started', 'in_progress', 'submitted', 'auto_submitted', 'disqualified', 'expired', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  duration_minutes INT NOT NULL DEFAULT 180,
  expires_at TIMESTAMPTZ,
  tab_visibility_events INT NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  client_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_assessment_attempts_unique_student_assessment
  ON public.student_assessment_attempts(student_id, assessment_id)
  WHERE assessment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_assessment_attempts_unique_source_assessment
  ON public.student_assessment_attempts (
    student_id,
    (client_metadata->>'source_assessment_id')
  )
  WHERE client_metadata ? 'source_assessment_id';

DROP TRIGGER IF EXISTS student_assessment_attempts_set_updated_at ON public.student_assessment_attempts;
CREATE TRIGGER student_assessment_attempts_set_updated_at
BEFORE UPDATE ON public.student_assessment_attempts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS student_assessment_attempts_set_expires_at ON public.student_assessment_attempts;
CREATE TRIGGER student_assessment_attempts_set_expires_at
BEFORE INSERT OR UPDATE OF started_at, duration_minutes, expires_at ON public.student_assessment_attempts
FOR EACH ROW EXECUTE FUNCTION public.set_attempt_expires_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_assessment_reports_attempt_id_fkey'
  ) THEN
    ALTER TABLE public.student_assessment_reports
      ADD CONSTRAINT student_assessment_reports_attempt_id_fkey
      FOREIGN KEY (attempt_id)
      REFERENCES public.student_assessment_attempts(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_assessment_reports_assessment_id_fkey'
  ) THEN
    ALTER TABLE public.student_assessment_reports
      ADD CONSTRAINT student_assessment_reports_assessment_id_fkey
      FOREIGN KEY (assessment_id)
      REFERENCES public.assessments(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.student_question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.student_assessment_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  assessment_question_id UUID REFERENCES public.assessment_questions(id) ON DELETE SET NULL,
  section TEXT NOT NULL CHECK (section IN ('DSA', 'SQL', 'OOPs', 'MCQ')),
  answer_text TEXT,
  selected_language TEXT,
  selected_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  marked_for_review BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'unvisited'
    CHECK (status IN ('unvisited', 'saved', 'ran', 'submitted')),
  run_count INT NOT NULL DEFAULT 0,
  submit_count INT NOT NULL DEFAULT 0,
  time_spent_seconds INT NOT NULL DEFAULT 0,
  answer_change_count INT NOT NULL DEFAULT 0,
  last_autosaved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

DROP TRIGGER IF EXISTS student_question_attempts_set_updated_at ON public.student_question_attempts;
CREATE TRIGGER student_question_attempts_set_updated_at
BEFORE UPDATE ON public.student_question_attempts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.student_code_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.student_assessment_attempts(id) ON DELETE CASCADE,
  question_attempt_id UUID REFERENCES public.student_question_attempts(id) ON DELETE SET NULL,
  question_id TEXT NOT NULL,
  assessment_question_id UUID REFERENCES public.assessment_questions(id) ON DELETE SET NULL,
  language TEXT NOT NULL,
  run_type TEXT NOT NULL CHECK (run_type IN ('run', 'submit', 'hidden', 'warmup')),
  source_code TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'judge0',
  provider_submission_id TEXT,
  status TEXT,
  stdout TEXT,
  stderr TEXT,
  compile_output TEXT,
  runtime_ms INT,
  memory_kb INT,
  open_tests_passed INT,
  open_tests_total INT,
  hidden_tests_passed INT,
  hidden_tests_total INT,
  test_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_provider_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_sql_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.student_assessment_attempts(id) ON DELETE CASCADE,
  question_attempt_id UUID REFERENCES public.student_question_attempts(id) ON DELETE SET NULL,
  question_id TEXT NOT NULL,
  assessment_question_id UUID REFERENCES public.assessment_questions(id) ON DELETE SET NULL,
  run_type TEXT NOT NULL CHECK (run_type IN ('run', 'submit', 'hidden')),
  query_text TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  row_count INT NOT NULL DEFAULT 0,
  execution_ms INT,
  error_text TEXT,
  comparison_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_mcq_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.student_assessment_attempts(id) ON DELETE CASCADE,
  question_attempt_id UUID REFERENCES public.student_question_attempts(id) ON DELETE SET NULL,
  question_id TEXT NOT NULL,
  assessment_question_id UUID REFERENCES public.assessment_questions(id) ON DELETE SET NULL,
  selected_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_correct BOOLEAN,
  answer_change_count INT NOT NULL DEFAULT 0,
  time_spent_seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

DROP TRIGGER IF EXISTS student_mcq_answers_set_updated_at ON public.student_mcq_answers;
CREATE TRIGGER student_mcq_answers_set_updated_at
BEFORE UPDATE ON public.student_mcq_answers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.student_assessment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.student_assessment_attempts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  question_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Evaluation / Reports
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_question_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.student_assessment_attempts(id) ON DELETE CASCADE,
  question_attempt_id UUID REFERENCES public.student_question_attempts(id) ON DELETE SET NULL,
  question_id TEXT NOT NULL,
  assessment_question_id UUID REFERENCES public.assessment_questions(id) ON DELETE SET NULL,
  section TEXT NOT NULL CHECK (section IN ('DSA', 'SQL', 'OOPs', 'MCQ')),
  deterministic_score NUMERIC,
  ai_evaluation JSONB,
  final_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

-- ---------------------------------------------------------------------------
-- Helpful Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_college_id ON public.profiles(college_id);
CREATE INDEX IF NOT EXISTS idx_batches_college_id ON public.batches(college_id);
CREATE INDEX IF NOT EXISTS idx_batch_students_student_id ON public.batch_students(student_id);
CREATE INDEX IF NOT EXISTS idx_batch_students_batch_id ON public.batch_students(batch_id);

CREATE INDEX IF NOT EXISTS idx_assessments_status ON public.assessments(status);
CREATE INDEX IF NOT EXISTS idx_assessment_sections_assessment_id ON public.assessment_sections(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment_id ON public.assessment_questions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_section_id ON public.assessment_questions(section_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_subject_id ON public.assessment_questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_source_question_id ON public.assessment_questions(source_question_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_questions_source_question
ON public.assessment_questions(assessment_id, source_question_id)
WHERE source_question_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assessment_batches_batch_id ON public.assessment_batches(batch_id);
CREATE INDEX IF NOT EXISTS idx_assessment_subjects_subject_id ON public.assessment_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_question_test_cases_question_id ON public.question_test_cases(question_id);

CREATE INDEX IF NOT EXISTS idx_student_attempts_student_id ON public.student_assessment_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_attempts_assessment_id ON public.student_assessment_attempts(assessment_id);
CREATE INDEX IF NOT EXISTS idx_student_attempts_status ON public.student_assessment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_student_attempts_expires_at ON public.student_assessment_attempts(expires_at);
CREATE INDEX IF NOT EXISTS idx_student_question_attempts_attempt_id ON public.student_question_attempts(attempt_id);
CREATE INDEX IF NOT EXISTS idx_student_code_runs_attempt_id ON public.student_code_runs(attempt_id);
CREATE INDEX IF NOT EXISTS idx_student_code_runs_question_id ON public.student_code_runs(question_id);
CREATE INDEX IF NOT EXISTS idx_student_sql_runs_attempt_id ON public.student_sql_runs(attempt_id);
CREATE INDEX IF NOT EXISTS idx_student_sql_runs_question_id ON public.student_sql_runs(question_id);
CREATE INDEX IF NOT EXISTS idx_student_mcq_answers_attempt_id ON public.student_mcq_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_student_events_attempt_id ON public.student_assessment_events(attempt_id);
CREATE INDEX IF NOT EXISTS idx_question_evaluations_attempt_id ON public.student_question_evaluations(attempt_id);
CREATE INDEX IF NOT EXISTS idx_assessment_reports_student_id ON public.student_assessment_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_reports_attempt_id ON public.student_assessment_reports(attempt_id);

-- ---------------------------------------------------------------------------
-- Starter subject rows matching the JoraIQ sections.
-- ---------------------------------------------------------------------------

INSERT INTO public.subjects (name, code, subject_type, duration_minutes, description)
SELECT v.name, v.code, v.subject_type, v.duration_minutes, v.description
FROM (
  VALUES
    ('DSA', 'DSA', 'coding_without_data', 90, 'Hard real-world DSA coding questions'),
    ('SQL', 'SQL', 'coding_with_data', 30, 'Scenario-based SQL sandbox questions'),
    ('OOPs', 'OOPS', 'coding_without_data', 30, 'Scenario-based OOPs design questions'),
    ('Core CS MCQ', 'MCQ', 'text', 30, 'Core CS, cloud, security, architecture and Excel MCQs')
) AS v(name, code, subject_type, duration_minutes, description)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subjects s
  WHERE s.name = v.name
     OR s.code = v.code
);
