import { BadRequestException, Injectable } from '@nestjs/common';
import { findLanguage, supportedLanguages } from './language-map';
import { Judge0Adapter } from './judge0.adapter';
import { TestHarnessService } from './test-harness.service';

type CodeRunInput = {
  attempt_id?: string;
  question_id?: string;
  language?: string;
  source_code?: string;
  stdin?: string;
  run_type?: 'run' | 'submit';
};

@Injectable()
export class CodeExecutionService {
  constructor(
    private readonly judge0: Judge0Adapter,
    private readonly harness: TestHarnessService,
  ) {}

  getLanguages() {
    return supportedLanguages.map(({ id, label, judge0LanguageId }) => ({
      id,
      label,
      judge0_language_id: judge0LanguageId,
    }));
  }

  async warmup(languageId?: string) {
    const languages = languageId
      ? supportedLanguages.filter((language) => language.id === languageId)
      : supportedLanguages;

    if (languageId && languages.length === 0) {
      throw new BadRequestException('Unsupported language');
    }

    const results = await Promise.allSettled(
      languages.map((language) =>
        this.judge0.submitAndWait({
          languageId: language.judge0LanguageId,
          sourceCode: language.warmupSource,
        }),
      ),
    );

    return {
      warmed: languages.map((language, index) => ({
        language: language.id,
        status: results[index].status,
      })),
    };
  }

  async run(input: CodeRunInput, runType: 'run' | 'submit') {
    const language = findLanguage(String(input.language || ''));
    if (!language) throw new BadRequestException('Unsupported language');
    const source = String(input.source_code || '');
    if (!source.trim())
      throw new BadRequestException('source_code is required');
    if (source.length > 200000) {
      throw new BadRequestException('source_code is too large');
    }
    if (!input.question_id)
      throw new BadRequestException('question_id is required');

    const sourceCode = await this.harness.buildSource({
      language: language.id,
      sourceCode: source,
      questionId: input.question_id,
      runType,
    });

    return this.judge0.submitAndWait({
      languageId: language.judge0LanguageId,
      sourceCode,
      stdin: input.stdin || '',
    });
  }
}
