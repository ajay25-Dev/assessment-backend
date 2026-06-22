CREATE TABLE IF NOT EXISTS assessment_security_settings (
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

CREATE TABLE IF NOT EXISTS student_assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  assessment_id UUID,
  status VARCHAR(30) NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('not_started', 'in_progress', 'submitted', 'auto_submitted', 'disqualified', 'expired', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  duration_minutes INT NOT NULL DEFAULT 180,
  tab_visibility_events INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_assessment_attempts_unique_student_assessment
  ON student_assessment_attempts(student_id, assessment_id)
  WHERE assessment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_assessment_attempts_unique_source_assessment
  ON student_assessment_attempts (
    student_id,
    (client_metadata->>'source_assessment_id')
  )
  WHERE client_metadata ? 'source_assessment_id';

CREATE TABLE IF NOT EXISTS student_question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES student_assessment_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  section TEXT NOT NULL,
  answer_text TEXT,
  selected_language TEXT,
  selected_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  marked_for_review BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(30) NOT NULL DEFAULT 'unvisited',
  run_count INT NOT NULL DEFAULT 0,
  submit_count INT NOT NULL DEFAULT 0,
  last_autosaved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS student_code_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES student_assessment_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  language TEXT NOT NULL,
  run_type VARCHAR(20) NOT NULL,
  source_code TEXT NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'judge0',
  provider_submission_id TEXT,
  status VARCHAR(60),
  stdout TEXT,
  stderr TEXT,
  compile_output TEXT,
  runtime_ms INT,
  memory_kb INT,
  test_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_sql_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES student_assessment_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  run_type VARCHAR(20) NOT NULL,
  query_text TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  row_count INT NOT NULL DEFAULT 0,
  execution_ms INT,
  error_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_mcq_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES student_assessment_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  selected_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  answer_change_count INT NOT NULL DEFAULT 0,
  time_spent_seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS student_question_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES student_assessment_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  section TEXT NOT NULL,
  deterministic_score INT,
  ai_evaluation JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS student_assessment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  assessment_id UUID,
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


