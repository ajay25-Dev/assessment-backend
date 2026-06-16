import { JsonSchema } from '../ai.types';

const readinessLabels = [
  'Elite 1% Company Ready',
  'Strong Company Ready',
  'Near Ready',
  'Trainable but Not Ready',
  'Risky High Scorer',
  'Not Ready',
];

const riskLevels = ['Low', 'Medium', 'High'];
const stringArray: JsonSchema = { type: 'array', items: { type: 'string' } };

function strictObject(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

const score = { type: 'integer' };
const text = { type: 'string' };
const bool = { type: 'boolean' };
const scoreOrText: JsonSchema = { anyOf: [score, text] };
const complexityRankEnum = Array.from({ length: 50 }, (_, index) => index + 1);

export const dsaComplexityOutputSchema = strictObject({
  student_time_complexity_rank: {
    type: 'integer',
    enum: complexityRankEnum,
  },
  student_space_complexity_rank: {
    type: 'integer',
    enum: complexityRankEnum,
  },
});

export const dsaApproachOutputSchema = strictObject({
  detected_tags: stringArray,
});

export const sqlConceptTagsOutputSchema = strictObject({
  detected_tags: stringArray,
});

export const oopsEvidenceOutputSchema = strictObject({
  detected_oops_tags: stringArray,
  detected_classes: stringArray,
  detected_abstractions: stringArray,
  detected_patterns: stringArray,
  detected_solid_principles: stringArray,
  detected_error_cases: stringArray,
  detected_design_rules: stringArray,
  detected_red_flags: stringArray,
  reasoning_summary: text,
  missing_components: stringArray,
  key_strengths: stringArray,
  key_weaknesses: stringArray,
  improvement_recommendation: text,
});

export const dsaExpectedCodeOutputSchema = strictObject({
  expected_code_score: score,
});

export const dsaEvaluationOutputSchema = strictObject({
  section: { type: 'string', enum: ['DSA'] },
  question_id: text,
  question_title: text,
  score_basis: text,
  correctness_score: score,
  open_test_case_score: score,
  hidden_test_case_score: scoreOrText,
  expected_code_score: score,
  matched_expected_code: stringArray,
  missing_expected_code: stringArray,
  approach_match_percentage: score,
  expected_approach_used: {
    type: 'string',
    enum: ['Yes', 'Partial', 'No'],
  },
  approach_score: score,
  expected_approach_tags: stringArray,
  ai_returned_approach_tags: stringArray,
  expected_time_complexity: text,
  expected_time_complexity_rank: score,
  expected_time_complexity_label: text,
  student_time_complexity_rank: score,
  student_time_complexity_label: text,
  time_complexity_rank_gap: score,
  time_complexity_score: score,
  expected_space_complexity: text,
  expected_space_complexity_rank: score,
  expected_space_complexity_label: text,
  student_space_complexity_rank: score,
  student_space_complexity_label: text,
  space_complexity_rank_gap: score,
  space_complexity_score: score,
  edge_case_score: scoreOrText,
  edge_cases_passed: scoreOrText,
  overall_question_score: score,
  failed_case_analysis: stringArray,
  missed_edge_cases: stringArray,
  open_tests_passed: text,
  hidden_tests_passed: scoreOrText,
  total_tests_passed: scoreOrText,
});

export const sqlEvaluationOutputSchema = strictObject({
  section: { type: 'string', enum: ['SQL'] },
  question_id: text,
  question_title: text,
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
  overall_question_score: score,
  hardcoding_risk: { type: 'string', enum: riskLevels },
  query_quality_label: {
    type: 'string',
    enum: ['Excellent', 'Good', 'Average', 'Weak', 'Incorrect'],
  },
  ai_returned_concept_tags: stringArray,
  expected_sql_concept_tags: stringArray,
  expected_concepts_used: stringArray,
  missing_concepts: stringArray,
  detected_mistakes: stringArray,
  missing_business_rules: stringArray,
  failed_case_analysis: stringArray,
  runtime_observation: text,
  key_strengths: stringArray,
  key_weaknesses: stringArray,
  improvement_recommendation: text,
  placement_readiness_label: { type: 'string', enum: readinessLabels },
});

export const oopsEvaluationOutputSchema = strictObject({
  section: { type: 'string', enum: ['OOPs'] },
  question_id: text,
  question_title: text,
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
  overall_question_score: score,
  design_maturity_label: {
    type: 'string',
    enum: ['Excellent', 'Good', 'Average', 'Weak', 'Procedural'],
  },
  identified_classes: stringArray,
  identified_interfaces_or_abstractions: stringArray,
  design_patterns_detected: stringArray,
  missing_components: stringArray,
  red_flags: stringArray,
  key_strengths: stringArray,
  key_weaknesses: stringArray,
  improvement_recommendation: text,
  placement_readiness_label: { type: 'string', enum: readinessLabels },
});

export const mcqEvaluationOutputSchema = strictObject({
  section: { type: 'string', enum: ['MCQ'] },
  student_id: text,
  overall_mcq_score: score,
  subject_scores: strictObject({
    operating_systems: score,
    computer_networks: score,
    cybersecurity: score,
    computer_architecture: score,
    cloud_computing: score,
    ms_office_excel: score,
    oops: score,
  }),
  topic_scores: {
    type: 'object',
    properties: {},
    additionalProperties: { type: 'integer' },
    required: [],
  },
  strong_topics: stringArray,
  weak_topics: stringArray,
  misconceptions_detected: stringArray,
  guessing_risk: { type: 'string', enum: riskLevels },
  confidence_signal: { type: 'string', enum: ['Strong', 'Moderate', 'Weak'] },
  time_behavior_summary: text,
  revision_recommendation: text,
  placement_readiness_label: { type: 'string', enum: readinessLabels },
});

export const dashboardEvaluationOutputSchema = strictObject({
  student_id: text,
  student_name: text,
  overall_marks_score: score,
  capability_score: score,
  problem_solving_score: score,
  readiness_score: score,
  dsa_score: score,
  sql_score: score,
  oops_score: score,
  mcq_score: score,
  approach_score: score,
  complexity_score: score,
  code_quality_score: score,
  hidden_test_pass_rate: score,
  brute_force_risk: { type: 'string', enum: riskLevels },
  hardcoding_risk: { type: 'string', enum: riskLevels },
  compilation_behaviour: text,
  runtime_percentile: text,
  strongest_area: text,
  weakest_area: text,
  readiness_label: { type: 'string', enum: readinessLabels },
  company_recommendation: {
    type: 'string',
    enum: [
      'Send to product/service company immediately',
      'Send only after mock interview',
      'Train for 2-3 weeks before sending',
      'Train for 6-8 weeks before sending',
      'Do not send to company yet',
    ],
  },
  training_recommendation: text,
  faculty_insight: text,
  student_summary: text,
  detailed_strengths: stringArray,
  detailed_weaknesses: stringArray,
  next_3_learning_actions: stringArray,
});
