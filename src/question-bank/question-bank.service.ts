import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';

@Injectable()
export class QuestionBankService {
  async getBank() {
    try {
      const raw = await fs.readFile(
        join(
          process.cwd(),
          '..',
          'assessment-data',
          'joraiq-question-bank.json',
        ),
        'utf8',
      );
      const bank = JSON.parse(raw) as Record<string, unknown>;
      this.assertValidBank(bank);
      return bank;
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException('Question bank could not be read');
    }
  }

  async getImportPreview() {
    const bank = await this.getBank();
    const assessment = bank.assessment as
      | { title?: string; sections?: unknown[] }
      | undefined;
    const questions = Array.isArray(bank.questions) ? bank.questions : [];

    return {
      title: assessment?.title || 'Untitled assessment',
      sections: assessment?.sections || [],
      question_count: questions.length,
      counts_by_section: questions.reduce<Record<string, number>>(
        (counts, item) => {
          const section = String(
            (item as { section?: string }).section || 'UNKNOWN',
          );
          counts[section] = (counts[section] || 0) + 1;
          return counts;
        },
        {},
      ),
      next_step:
        'Wire this preview into the admin import flow, then upsert rows into Supabase.',
    };
  }

  private assertValidBank(bank: Record<string, unknown>) {
    const questions = Array.isArray(bank.questions) ? bank.questions : null;
    if (!questions) {
      throw new InternalServerErrorException(
        'Question bank is missing questions array',
      );
    }

    const counts = questions.reduce<Record<string, number>>((summary, item) => {
      const section = String((item as { section?: string }).section || '');
      summary[section] = (summary[section] || 0) + 1;
      return summary;
    }, {});

    const expectedCounts: Record<string, number> = {
      DSA: 5,
      SQL: 3,
      OOPs: 3,
      MCQ: 20,
    };

    Object.entries(expectedCounts).forEach(([section, expected]) => {
      if (counts[section] !== expected) {
        throw new InternalServerErrorException(
          `Question bank must contain ${expected} ${section} questions`,
        );
      }
    });

    questions.forEach((item) => {
      const question = item as {
        id?: string;
        section?: string;
        prompt?: string;
        test_cases?: unknown[];
        open_test_cases?: unknown[];
        hidden_test_cases?: unknown[];
        options?: unknown[];
        correct_options?: unknown[];
      };

      if (!question.id || !question.prompt) {
        throw new InternalServerErrorException(
          'Every question requires id and prompt',
        );
      }

      if (question.section === 'DSA') {
        if (
          question.test_cases?.length !== 15 ||
          question.open_test_cases?.length !== 5 ||
          question.hidden_test_cases?.length !== 10
        ) {
          throw new InternalServerErrorException(
            `${question.id} must include 15 doc test cases, 5 open cases and 10 hidden cases`,
          );
        }
      }

      if (question.section === 'MCQ') {
        if (!question.options?.length || !question.correct_options?.length) {
          throw new InternalServerErrorException(
            `${question.id} must include options and correct_options`,
          );
        }
      }
    });
  }
}
