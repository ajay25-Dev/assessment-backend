-- JoraIQ Assessment Platform - Full Supabase/Postgres Schema
-- Run this in the Supabase SQL editor.
-- This script is intentionally additive: it uses CREATE IF NOT EXISTS and does not drop existing data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Shared updated_at helper.
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
-- Users / Admin / Students
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  roll_number TEXT,
  role TEXT NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'admin')),
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Colleges / Batches / Subjects
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.colleges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  city TEXT,
  state TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS colleges_set_updated_at ON public.colleges;
CREATE TRIGGER colleges_set_updated_at
BEFORE UPDATE ON public.colleges
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID REFERENCES public.colleges(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  starts_at DATE,
  ends_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS batches_set_updated_at ON public.batches;
CREATE TRIGGER batches_set_updated_at
BEFORE UPDATE ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.batch_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  subject_type TEXT NOT NULL DEFAULT 'subjective'
    CHECK (subject_type IN ('coding_with_data', 'coding_without_data', 'text', 'subjective')),
  duration_minutes INT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS subjects_set_updated_at ON public.subjects;
CREATE TRIGGER subjects_set_updated_at
BEFORE UPDATE ON public.subjects
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Assessment Setup
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL DEFAULT 180,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  source_key TEXT,
  scoring_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS assessments_set_updated_at ON public.assessments;
CREATE TRIGGER assessments_set_updated_at
BEFORE UPDATE ON public.assessments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.assessment_security_settings (
  assessment_id TEXT PRIMARY KEY,
  tab_switch_protection_enabled BOOLEAN NOT NULL DEFAULT false,
  max_tab_switch_events INT NOT NULL DEFAULT 2 CHECK (max_tab_switch_events > 0),
  auto_submit_on_max_events BOOLEAN NOT NULL DEFAULT false,
  camera_proctoring_enabled BOOLEAN NOT NULL DEFAULT false,
  max_camera_events INT NOT NULL DEFAULT 2 CHECK (max_camera_events > 0),
  auto_submit_on_camera_events BOOLEAN NOT NULL DEFAULT false,
  copy_paste_block_enabled BOOLEAN NOT NULL DEFAULT false,
  inspect_mode_block_enabled BOOLEAN NOT NULL DEFAULT false,
  restart_timer_on_login BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS assessment_security_settings_set_updated_at ON public.assessment_security_settings;
CREATE TRIGGER assessment_security_settings_set_updated_at
BEFORE UPDATE ON public.assessment_security_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.assessment_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration_minutes INT,
  focus_area TEXT,
  difficulty TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, name)
);

DROP TRIGGER IF EXISTS assessment_sections_set_updated_at ON public.assessment_sections;
CREATE TRIGGER assessment_sections_set_updated_at
BEFORE UPDATE ON public.assessment_sections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.assessment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, batch_id)
);

CREATE TABLE IF NOT EXISTS public.assessment_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, subject_id)
);

CREATE TABLE IF NOT EXISTS public.assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.assessment_sections(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  source_question_id TEXT,
  question_type TEXT NOT NULL DEFAULT 'subjective',
  question_format TEXT,
  engine TEXT,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  prompt_rich_text TEXT,
  difficulty TEXT,
  marks INT,
  constraints_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_approach JSONB NOT NULL DEFAULT '[]'::jsonb,
  function_signature TEXT,
  allowed_languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  starter_code JSONB NOT NULL DEFAULT '{}'::jsonb,
  open_test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
  hidden_test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
  all_doc_test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
  time_limit_ms INT,
  memory_limit_mb INT,
  compilation_attempt_limit INT,
  expected_answer TEXT,
  correct_answer TEXT,
  allow_multiple_answers BOOLEAN NOT NULL DEFAULT FALSE,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  topic TEXT,
  explanation TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, source_question_id)
);

DROP TRIGGER IF EXISTS assessment_questions_set_updated_at ON public.assessment_questions;
CREATE TRIGGER assessment_questions_set_updated_at
BEFORE UPDATE ON public.assessment_questions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
  imported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  import_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Student Runtime / Timer / Autosave / Submissions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.student_question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.student_assessment_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  assessment_question_id UUID REFERENCES public.assessment_questions(id) ON DELETE SET NULL,
  section TEXT NOT NULL,
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
  section TEXT NOT NULL,
  deterministic_score INT,
  ai_evaluation JSONB,
  final_score INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.student_assessment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL,
  attempt_id UUID REFERENCES public.student_assessment_attempts(id) ON DELETE SET NULL,
  assessment_title TEXT,
  marks_score INT,
  capability_score INT,
  problem_solving_score INT,
  dsa_score INT,
  sql_score INT,
  oops_score INT,
  mcq_score INT,
  approach_score INT,
  complexity_score INT,
  code_quality_score INT,
  hidden_test_pass_rate INT,
  brute_force_risk TEXT,
  hardcoding_risk TEXT,
  compilation_behaviour TEXT,
  runtime_percentile TEXT,
  readiness_label TEXT,
  readiness_bucket TEXT,
  readiness_reason JSONB,
  strongest_section TEXT,
  weakest_section TEXT,
  training_priority TEXT,
  training_recommendation TEXT,
  teacher_action TEXT,
  risk_summary JSONB,
  faculty_insight TEXT,
  company_recommendation TEXT,
  student_summary TEXT,
  detailed_strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  detailed_weaknesses JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_3_learning_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  report_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Helpful Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_batches_college_id ON public.batches(college_id);
CREATE INDEX IF NOT EXISTS idx_batch_students_student_id ON public.batch_students(student_id);
CREATE INDEX IF NOT EXISTS idx_batch_students_batch_id ON public.batch_students(batch_id);

CREATE INDEX IF NOT EXISTS idx_assessments_status ON public.assessments(status);
CREATE INDEX IF NOT EXISTS idx_assessment_sections_assessment_id ON public.assessment_sections(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment_id ON public.assessment_questions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_section_id ON public.assessment_questions(section_id);
CREATE INDEX IF NOT EXISTS idx_assessment_batches_batch_id ON public.assessment_batches(batch_id);
CREATE INDEX IF NOT EXISTS idx_assessment_subjects_assessment_id ON public.assessment_subjects(assessment_id);
CREATE INDEX IF NOT EXISTS idx_question_test_cases_question_id ON public.question_test_cases(question_id);

CREATE INDEX IF NOT EXISTS idx_student_attempts_student_id ON public.student_assessment_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_attempts_assessment_id ON public.student_assessment_attempts(assessment_id);
CREATE INDEX IF NOT EXISTS idx_student_attempts_status ON public.student_assessment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_student_question_attempts_attempt_id ON public.student_question_attempts(attempt_id);
CREATE INDEX IF NOT EXISTS idx_student_code_runs_attempt_id ON public.student_code_runs(attempt_id);
CREATE INDEX IF NOT EXISTS idx_student_sql_runs_attempt_id ON public.student_sql_runs(attempt_id);
CREATE INDEX IF NOT EXISTS idx_student_mcq_answers_attempt_id ON public.student_mcq_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_student_events_attempt_id ON public.student_assessment_events(attempt_id);
CREATE INDEX IF NOT EXISTS idx_question_evaluations_attempt_id ON public.student_question_evaluations(attempt_id);
CREATE INDEX IF NOT EXISTS idx_assessment_reports_student_id ON public.student_assessment_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_reports_attempt_id ON public.student_assessment_reports(attempt_id);

-- ---------------------------------------------------------------------------
-- Optional starter subjects matching the JoraIQ sections.
-- Safe to rerun because code is unique.
-- ---------------------------------------------------------------------------

INSERT INTO public.subjects (name, code, subject_type, duration_minutes, description)
VALUES
  ('DSA', 'DSA', 'coding_without_data', 90, 'Hard real-world DSA coding questions'),
  ('SQL', 'SQL', 'coding_with_data', 30, 'Scenario-based SQL sandbox questions'),
  ('OOPs', 'OOPS', 'coding_without_data', 30, 'Scenario-based OOPs design questions'),
  ('Core CS MCQ', 'MCQ', 'text', 30, 'Core CS, cloud, security, architecture and Excel MCQs')
ON CONFLICT (code) DO NOTHING;


