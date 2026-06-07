ALTER TABLE public.student_assessment_reports
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
  ADD COLUMN IF NOT EXISTS next_3_learning_actions JSONB NOT NULL DEFAULT '[]'::jsonb;
