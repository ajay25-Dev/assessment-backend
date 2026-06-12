import { BadRequestException, Injectable } from '@nestjs/common';
import { EvaluationResult } from './evaluation.types';

type McqAnswer = {
  topic?: unknown;
  selected_options?: unknown;
  correct_options?: unknown;
  question_title?: unknown;
  explanation?: unknown;
  misconception_mapping?: unknown;
  is_correct?: unknown;
  answer_change_count?: unknown;
  time_spent_seconds?: unknown;
};

type McqEvaluationInput = {
  student_id?: unknown;
  total_questions?: unknown;
  correct_count?: unknown;
  deterministic_score?: unknown;
  answers?: unknown;
  tab_events?: unknown;
};

type SubjectKey =
  | 'operating_systems'
  | 'computer_networks'
  | 'cybersecurity'
  | 'computer_architecture'
  | 'cloud_computing'
  | 'ms_office_excel'
  | 'oops';

@Injectable()
export class McqEvaluationService {
  evaluate(input: unknown): Promise<EvaluationResult> {
    const record = this.assertObject(input) as McqEvaluationInput;
    const answers = this.asAnswerArray(record.answers);
    const grouped = this.groupByTopic(answers);
    const totalQuestions = answers.length;
    const correctCount = answers.filter((answer) =>
      this.sameStringSet(answer.selected_options, answer.correct_options),
    ).length;
    const overallScore = totalQuestions
      ? Math.round((correctCount / totalQuestions) * 100)
      : this.numberValue(record.deterministic_score, 0);

    const subjectScores = this.computeSubjectScores(grouped);
    const topicScores = this.computeTopicScores(grouped);
    const strongTopics = Object.entries(grouped)
      .filter(([, items]) => this.scoreForGroup(items) >= 75)
      .map(([topic]) => topic)
      .sort((left, right) => left.localeCompare(right));
    const weakTopics = Object.entries(grouped)
      .filter(([, items]) => this.scoreForGroup(items) <= 40)
      .map(([topic]) => topic)
      .sort((left, right) => left.localeCompare(right));

    const misconceptionsDetected = this.collectMisconceptions(grouped);
    const guessingRisk = this.deriveGuessingRisk(
      overallScore,
      Number(record.tab_events || 0),
    );
    const confidenceSignal = this.deriveConfidenceSignal(
      overallScore,
      answers.length,
    );
    const placementReadinessLabel = this.deriveReadinessLabel(
      overallScore,
      confidenceSignal,
      guessingRisk,
      subjectScores,
    );

    return Promise.resolve({
      section: 'MCQ',
      prompt_version: 'mcq-deterministic.v1',
      model: 'deterministic',
      output: {
        section: 'MCQ',
        student_id: this.textValue(record.student_id),
        overall_mcq_score: overallScore,
        subject_scores: subjectScores,
        topic_scores: topicScores,
        strong_topics: strongTopics,
        weak_topics: weakTopics,
        misconceptions_detected: misconceptionsDetected,
        guessing_risk: guessingRisk,
        confidence_signal: confidenceSignal,
        time_behavior_summary: this.timeBehaviorSummary(
          answers.length,
          Number(record.tab_events || 0),
        ),
        revision_recommendation: this.revisionRecommendation(
          weakTopics,
          strongTopics,
        ),
        placement_readiness_label: placementReadinessLabel,
      },
    });
  }

  private assertObject(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException(
        'MCQ evaluation input must be a JSON object',
      );
    }
    return value as Record<string, unknown>;
  }

  private asAnswerArray(value: unknown): McqAnswer[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? (item as McqAnswer)
          : null,
      )
      .filter((item): item is McqAnswer => Boolean(item));
  }

  private groupByTopic(answers: McqAnswer[]) {
    return answers.reduce<Record<string, McqAnswer[]>>((acc, answer) => {
      const topic = this.normalizeTopic(
        this.textValue(answer.topic) || 'General',
      );
      acc[topic] = acc[topic] || [];
      acc[topic].push(answer);
      return acc;
    }, {});
  }

  private computeSubjectScores(grouped: Record<string, McqAnswer[]>) {
    const subjects: Record<SubjectKey, number> = {
      operating_systems: 0,
      computer_networks: 0,
      cybersecurity: 0,
      computer_architecture: 0,
      cloud_computing: 0,
      ms_office_excel: 0,
      oops: 0,
    };

    const buckets: Record<SubjectKey, McqAnswer[]> = {
      operating_systems: [],
      computer_networks: [],
      cybersecurity: [],
      computer_architecture: [],
      cloud_computing: [],
      ms_office_excel: [],
      oops: [],
    };

    for (const [topic, answers] of Object.entries(grouped)) {
      buckets[this.subjectForTopic(topic)].push(...answers);
    }

    for (const [key, items] of Object.entries(buckets) as Array<
      [SubjectKey, McqAnswer[]]
    >) {
      subjects[key] = this.scoreForGroup(items);
    }

    return subjects;
  }

  private computeTopicScores(grouped: Record<string, McqAnswer[]>) {
    return Object.entries(grouped).reduce<Record<string, number>>(
      (acc, [topic, answers]) => {
        acc[topic] = this.scoreForGroup(answers);
        return acc;
      },
      {},
    );
  }

  private collectMisconceptions(grouped: Record<string, McqAnswer[]>) {
    const findings = new Set<string>();

    for (const [topic, answers] of Object.entries(grouped)) {
      for (const answer of answers) {
        const isCorrect = this.sameStringSet(
          answer.selected_options,
          answer.correct_options,
        );
        if (isCorrect) continue;

        const explanation = this.textValue(answer.explanation);
        if (explanation)
          findings.add(
            `${topic}: revisit the core concept in the explanation.`,
          );

        const mapping = this.assertObjectOrNull(answer.misconception_mapping);
        if (mapping) {
          for (const [key, value] of Object.entries(mapping)) {
            if (
              key.toLowerCase().includes('option') ||
              key.toLowerCase().includes('choice')
            ) {
              findings.add(String(value));
            }
          }
        }
      }
    }

    return [...findings].slice(0, 8);
  }

  private deriveGuessingRisk(score: number, tabEvents: number) {
    if (score >= 80 && tabEvents <= 1) return 'Low';
    if (score >= 50 && tabEvents <= 2) return 'Medium';
    return score < 50 || tabEvents > 2 ? 'High' : 'Low';
  }

  private deriveConfidenceSignal(score: number, totalQuestions: number) {
    if (totalQuestions === 0) return 'Weak';
    if (score >= 80) return 'Strong';
    if (score >= 50) return 'Moderate';
    return 'Weak';
  }

  private deriveReadinessLabel(
    score: number,
    confidenceSignal: 'Strong' | 'Moderate' | 'Weak',
    guessingRisk: 'Low' | 'Medium' | 'High',
    subjectScores: Record<SubjectKey, number>,
  ) {
    const strongestSubject = Math.max(...Object.values(subjectScores));
    const weakestSubject = Math.min(...Object.values(subjectScores));

    if (
      score >= 90 &&
      confidenceSignal === 'Strong' &&
      guessingRisk === 'Low'
    ) {
      return 'Elite 1% Company Ready';
    }
    if (score >= 75 && confidenceSignal !== 'Weak' && weakestSubject >= 65) {
      return 'Strong Company Ready';
    }
    if (score >= 60 && weakestSubject >= 45) {
      return 'Near Ready';
    }
    if (guessingRisk === 'High') {
      return 'Risky High Scorer';
    }
    if (score >= 45 || strongestSubject >= 60) {
      return 'Trainable but Not Ready';
    }
    return 'Not Ready';
  }

  private revisionRecommendation(weakTopics: string[], strongTopics: string[]) {
    if (weakTopics.length) {
      return `Review ${weakTopics.slice(0, 3).join(', ')} and compare each answer against the correct option.`;
    }
    if (strongTopics.length) {
      return `Maintain current practice on ${strongTopics.slice(0, 3).join(', ')} and keep revising other MCQ topics.`;
    }
    return 'Review the correct answers and retry the MCQ set with focused practice.';
  }

  private timeBehaviorSummary(totalQuestions: number, tabEvents: number) {
    return `MCQ evaluated from ${totalQuestions} answer(s) and ${tabEvents} tab event(s); scoring is based on correct answer matching only.`;
  }

  private scoreForGroup(answers: McqAnswer[]) {
    if (!answers.length) return 0;
    const correct = answers.filter((answer) =>
      this.sameStringSet(answer.selected_options, answer.correct_options),
    ).length;
    return Math.round((correct / answers.length) * 100);
  }

  private subjectForTopic(topic: string): SubjectKey {
    const value = topic.toLowerCase();
    if (value.includes('operating system')) return 'operating_systems';
    if (value.includes('computer network')) return 'computer_networks';
    if (value.includes('network security')) return 'cybersecurity';
    if (value.includes('computer architecture')) return 'computer_architecture';
    if (value.includes('cloud')) return 'cloud_computing';
    if (value.includes('excel')) return 'ms_office_excel';
    if (value.includes('oop')) return 'oops';
    return 'operating_systems';
  }

  private normalizeTopic(topic: string) {
    return topic.trim() || 'General';
  }

  private textValue(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private numberValue(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
  }

  private asStringArray(value: unknown) {
    return Array.isArray(value)
      ? value
          .map((item) =>
            typeof item === 'string' ? item.trim() : String(item),
          )
          .filter((item) => item.length > 0)
      : [];
  }

  private assertObjectOrNull(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null;
    return value as Record<string, unknown>;
  }

  private sameStringSet(left: unknown, right: unknown) {
    const leftSet = new Set(this.asStringArray(left));
    const rightSet = new Set(this.asStringArray(right));
    return (
      leftSet.size === rightSet.size &&
      [...leftSet].every((item) => rightSet.has(item))
    );
  }
}
