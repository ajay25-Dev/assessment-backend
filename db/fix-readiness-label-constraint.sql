-- Production compatibility fix for current readiness labels.
--
-- Older databases may still have:
--   student_assessment_reports_readiness_label_check
-- with a smaller enum than the application now writes.
--
-- Apply this once in Supabase SQL editor or your production DB migration runner.

ALTER TABLE public.student_assessment_reports
  DROP CONSTRAINT IF EXISTS student_assessment_reports_readiness_label_check;

ALTER TABLE public.student_assessment_reports
  ADD CONSTRAINT student_assessment_reports_readiness_label_check
  CHECK (
    readiness_label IS NULL OR readiness_label IN (
      'Elite 1% Company Ready',
      'Strong Company Ready',
      'Near Ready',
      'Trainable but Not Ready',
      'Risky High Scorer',
      'Not Ready',
      'Ready',
      'Training Needed',
      'Failed'
    )
  );

ALTER TABLE public.student_assessment_reports
  DROP CONSTRAINT IF EXISTS student_assessment_reports_readiness_bucket_check;

ALTER TABLE public.student_assessment_reports
  ADD CONSTRAINT student_assessment_reports_readiness_bucket_check
  CHECK (
    readiness_bucket IS NULL OR readiness_bucket IN (
      'Ready',
      'Training Needed',
      'Failed'
    )
  );
