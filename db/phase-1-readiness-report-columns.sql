ALTER TABLE public.student_assessment_reports
  ADD COLUMN IF NOT EXISTS readiness_bucket TEXT,
  ADD COLUMN IF NOT EXISTS readiness_reason JSONB,
  ADD COLUMN IF NOT EXISTS strongest_section TEXT,
  ADD COLUMN IF NOT EXISTS weakest_section TEXT,
  ADD COLUMN IF NOT EXISTS training_priority TEXT,
  ADD COLUMN IF NOT EXISTS teacher_action TEXT,
  ADD COLUMN IF NOT EXISTS risk_summary JSONB;
