import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';

type BankQuestion = {
  id?: string;
  section?: string;
  prompt?: string;
  test_cases?: TestCase[];
  open_test_cases?: TestCase[];
  hidden_test_cases?: TestCase[];
  options?: Array<{ label?: string; text?: string }>;
  correct_options?: string[];
  schema_files?: Record<string, string>;
  expected_columns?: unknown[];
  expected_approach?: unknown[];
  expected_code?: unknown[];
  expected_time_complexity?: string;
  expected_space_complexity?: string;
  ideal_time?: unknown;
  ideal_space?: unknown;
  visible_expected_rows?: unknown[];
  result_match?: {
    order_matters?: boolean;
    numeric_tolerance?: number;
  };
  required_business_rules?: unknown[];
  expected_sql_concepts?: unknown[];
  expected_sql_concept_tags?: unknown[];
  edge_cases?: unknown[];
  null_rules?: unknown[];
  duplicate_rules?: unknown[];
  evaluator_context?: {
    domain_rules?: unknown[];
    required_components?: unknown[];
    design_constraints?: unknown[];
    acceptance_signals?: unknown[];
    red_flags?: unknown[];
  };
};

type TestCase = {
  id?: string;
  number?: number;
  input?: string;
  expected?: string;
  expected_output?: string;
  tags?: string[];
};

type SampleDataTable = {
  name: string;
  columns: string[];
  rows: string[][];
};

const vagueExpectedPattern =
  /\b(any|valid|before|within\s+time|correct\s+.*\s+(count|list|operations))\b|\.{3}/i;

@Injectable()
export class QuestionBankService {
  async getBank() {
    try {
      const raw = await fs.readFile(
        join(__dirname, 'data', 'joraiq-question-bank.json'),
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

  async getPublicBank() {
    const bank = (await this.getBank()) as {
      questions?: Array<Record<string, unknown>>;
    };

    return {
      ...bank,
      questions: await Promise.all(
        (bank.questions || []).map(async (question) => {
          const normalizedQuestion = {
            ...question,
            title: this.normalizeDisplayText(question.title),
            prompt: this.normalizeDisplayText(question.prompt),
          };

          if (question.section === 'SQL') {
            const files = question.schema_files as
              | { schema?: string; visible_seed?: string }
              | undefined;
            const sampleDataSql = files?.visible_seed
              ? await this.readDataFile(files.visible_seed)
              : '';
            const schemaSql = files?.schema
              ? await this.readDataFile(files.schema)
              : '';
            return {
              ...normalizedQuestion,
              sample_data_sql: this.normalizeDisplayText(sampleDataSql),
              sample_data_tables: this.parseSampleDataTables(
                schemaSql,
                sampleDataSql,
              ),
            };
          }

          if (question.section !== 'MCQ') return normalizedQuestion;

          const { correct_options, explanation, ...sanitizedQuestion } =
            question as {
              correct_options?: unknown[];
              explanation?: unknown;
              [key: string]: unknown;
            };
          const publicQuestion = sanitizedQuestion as Record<string, unknown>;

          return {
            ...publicQuestion,
            title: this.normalizeDisplayText(publicQuestion.title),
            prompt: this.normalizeDisplayText(publicQuestion.prompt),
            options: (
              (publicQuestion.options || []) as Array<{
                label?: string;
                text?: string;
              }>
            ).map((option) => ({
              ...option,
              label: this.normalizeDisplayText(option.label),
              text: this.normalizeDisplayText(option.text),
            })),
            allow_multiple_answers: (correct_options || []).length > 1,
          };
        }),
      ),
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
      DSA: 4,
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
      const question = item as BankQuestion;
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
        this.assertDsaApproachTags(question);
        this.assertDsaPerformanceTargets(question);
        this.assertAuthenticDsaCases(question);
      }

      if (question.section === 'MCQ') {
        if (!question.options?.length || !question.correct_options?.length) {
          throw new InternalServerErrorException(
            `${question.id} must include options and correct_options`,
          );
        }
        this.assertMcqAnswerKeys(question);
      }

      if (question.section === 'SQL') {
        this.assertSqlMetadata(question);
      }

      if (question.section === 'OOPs') {
        this.assertOopsContext(question);
      }
    });
  }

  private assertAuthenticDsaCases(question: BankQuestion) {
    const cases = [
      ...(question.open_test_cases || []),
      ...(question.hidden_test_cases || []),
      ...(question.test_cases || []),
    ];

    cases.forEach((testCase) => {
      const label = `${question.id}:${testCase.id || testCase.number || '?'}`;
      const input = String(testCase.input || '');
      const expected = String(
        testCase.expected_output || testCase.expected || '',
      );

      if (!input.trim() || !expected.trim()) {
        throw new InternalServerErrorException(
          `${label} must include non-empty input and expected output`,
        );
      }
      if (
        vagueExpectedPattern.test(input) ||
        vagueExpectedPattern.test(expected)
      ) {
        throw new InternalServerErrorException(
          `${label} contains a placeholder or non-deterministic expected output`,
        );
      }
      this.assertDsaCaseParseable(String(question.id), input, expected, label);
    });
  }

  private assertDsaApproachTags(question: BankQuestion) {
    const tags = question.expected_approach || [];
    if (!tags.length) {
      throw new InternalServerErrorException(
        `${question.id} must include expected_approach tags`,
      );
    }

    const invalid = tags.filter(
      (tag) => typeof tag !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag),
    );

    if (invalid.length) {
      throw new InternalServerErrorException(
        `${question.id} has non-slug expected_approach entries`,
      );
    }

    if (new Set(tags).size !== tags.length) {
      throw new InternalServerErrorException(
        `${question.id} has duplicate expected_approach tags`,
      );
    }
  }

  private assertDsaPerformanceTargets(question: BankQuestion) {
    const idealTime = Number(question.ideal_time);
    const idealSpace = Number(question.ideal_space);

    if (!Number.isInteger(idealTime) || idealTime <= 0) {
      throw new InternalServerErrorException(
        `${question.id} must include a positive integer ideal_time`,
      );
    }

    if (!Number.isInteger(idealSpace) || idealSpace <= 0) {
      throw new InternalServerErrorException(
        `${question.id} must include a positive integer ideal_space`,
      );
    }
  }

  private assertDsaCaseParseable(
    questionId: string,
    input: string,
    expected: string,
    label: string,
  ) {
    if (questionId === 'dsa_servicenow_incident_dependency') {
      this.parseIntValue(input, 'n', label);
      this.parseJsonMatrix(input, 'dependencies', label);
      this.parseExpectedInteger(expected, label);
      return;
    }
    if (questionId === 'dsa_amazon_delivery_routes') {
      this.parseIntValue(input, 'n', label);
      this.parseJsonMatrix(input, 'roads', label);
      this.parseJsonMatrix(input, 'packages', label);
      this.parseExpectedInteger(expected, label);
      return;
    }
    if (questionId === 'dsa_commvault_deduplication') {
      this.parseJsonMatrix(input, 'files', label);
      this.parseJsonMatrix(input, 'queries', label);
      this.parseJsonArray(expected, label);
      return;
    }
    if (questionId === 'dsa_autodesk_versioned_kv') {
      if (!/(?:^|;)\s*(?:v\d+\s*=\s*)?(set|get)\(/i.test(input.trim())) {
        throw new InternalServerErrorException(
          `${label} must contain executable set/get operations`,
        );
      }
      return;
    }
    // No additional parseable format defined for this question
  }

  private parseIntValue(input: string, key: string, label: string) {
    if (!new RegExp(`${key}\\s*=\\s*-?\\d+`).test(input)) {
      throw new InternalServerErrorException(`${label} is missing ${key}`);
    }
  }

  private parseJsonMatrix(input: string, key: string, label: string) {
    const start = input.indexOf(`${key}=`);
    if (start < 0) {
      throw new InternalServerErrorException(`${label} is missing ${key}`);
    }
    const first = input.indexOf('[[', start);
    if (first < 0) return [];
    let depth = 0;
    let end = first;
    for (; end < input.length; end += 1) {
      if (input[end] === '[') depth += 1;
      if (input[end] === ']') depth -= 1;
      if (depth === 0) break;
    }
    return this.parseJsonArray(input.slice(first, end + 1), label);
  }

  private parseJsonArray(value: string, label: string) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) throw new Error('not an array');
      return parsed;
    } catch {
      throw new InternalServerErrorException(
        `${label} must contain valid JSON array data`,
      );
    }
  }

  private readDataFile(file: string) {
    return fs.readFile(join(__dirname, 'data', file), 'utf8');
  }

  private normalizeDisplayText(value: unknown) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/â€œ|â€/g, '"')
      .replace(/â€˜|â€™/g, "'")
      .replace(/â€“|â€”/g, '-')
      .trim();
  }

  private parseSampleDataTables(
    schemaSql: string,
    sampleDataSql: string,
  ): SampleDataTable[] {
    const columnsByTable = this.parseTableColumns(schemaSql);
    const tables: SampleDataTable[] = [];
    const insertPattern =
      /INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+VALUES\s*([\s\S]*?);/gi;
    let match: RegExpExecArray | null;

    while ((match = insertPattern.exec(sampleDataSql)) !== null) {
      const tableName = match[1];
      const rows = this.extractTupleValues(match[2]).map((tuple) =>
        this.splitSqlValues(tuple).map((value) => this.formatSqlValue(value)),
      );

      tables.push({
        name: tableName,
        columns: columnsByTable[tableName] || [],
        rows,
      });
    }

    return tables;
  }

  private parseTableColumns(schemaSql: string) {
    const columnsByTable: Record<string, string[]> = {};
    const createPattern =
      /CREATE\s+TABLE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([\s\S]*?)\);/gi;
    let match: RegExpExecArray | null;

    while ((match = createPattern.exec(schemaSql)) !== null) {
      columnsByTable[match[1]] = match[2]
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/,$/, ''))
        .filter(Boolean)
        .filter(
          (line) => !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(line),
        )
        .map((line) => line.split(/\s+/)[0])
        .filter(Boolean);
    }

    return columnsByTable;
  }

  private extractTupleValues(valuesBlock: string) {
    const tuples: string[] = [];
    let start = -1;
    let depth = 0;
    let inQuote = false;

    for (let index = 0; index < valuesBlock.length; index += 1) {
      const char = valuesBlock[index];
      const next = valuesBlock[index + 1];

      if (char === "'" && inQuote && next === "'") {
        index += 1;
        continue;
      }

      if (char === "'") {
        inQuote = !inQuote;
        continue;
      }

      if (inQuote) continue;

      if (char === '(') {
        if (depth === 0) start = index + 1;
        depth += 1;
        continue;
      }

      if (char === ')') {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          tuples.push(valuesBlock.slice(start, index));
          start = -1;
        }
      }
    }

    return tuples;
  }

  private splitSqlValues(tuple: string) {
    const values: string[] = [];
    let current = '';
    let depth = 0;
    let inQuote = false;

    for (let index = 0; index < tuple.length; index += 1) {
      const char = tuple[index];
      const next = tuple[index + 1];

      if (char === "'" && inQuote && next === "'") {
        current += "''";
        index += 1;
        continue;
      }

      if (char === "'") {
        inQuote = !inQuote;
        current += char;
        continue;
      }

      if (!inQuote) {
        if (char === '(') depth += 1;
        if (char === ')') depth -= 1;
        if (char === ',' && depth === 0) {
          values.push(current.trim());
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) values.push(current.trim());
    return values;
  }

  private formatSqlValue(value: string) {
    const trimmed = value.trim();
    if (/^NULL$/i.test(trimmed)) return 'NULL';
    if (/^TRUE$/i.test(trimmed)) return 'TRUE';
    if (/^FALSE$/i.test(trimmed)) return 'FALSE';
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1).replace(/''/g, "'");
    }
    return trimmed;
  }

  private parseExpectedInteger(value: string, label: string) {
    if (!/^-?\d+$/.test(value.trim())) {
      throw new InternalServerErrorException(
        `${label} must contain an integer expected output`,
      );
    }
  }

  private assertMcqAnswerKeys(question: BankQuestion) {
    const labels = new Set(
      (question.options || []).map((option) => option.label),
    );
    const invalid = (question.correct_options || []).filter(
      (option) => !labels.has(option),
    );
    if (invalid.length) {
      throw new InternalServerErrorException(
        `${question.id} has correct_options not present in options`,
      );
    }
  }

  private assertSqlMetadata(question: BankQuestion) {
    const files = question.schema_files;
    if (!files?.schema || !files.visible_seed || !files.hidden_seed) {
      throw new InternalServerErrorException(
        `${question.id} must define schema, visible_seed and hidden_seed files`,
      );
    }
    if (!question.expected_columns?.length) {
      throw new InternalServerErrorException(
        `${question.id} must define expected_columns`,
      );
    }
    if (!question.visible_expected_rows?.length) {
      throw new InternalServerErrorException(
        `${question.id} must define visible_expected_rows`,
      );
    }
    if (!question.result_match || typeof question.result_match !== 'object') {
      throw new InternalServerErrorException(
        `${question.id} must define result_match`,
      );
    }
    if (!question.required_business_rules?.length) {
      throw new InternalServerErrorException(
        `${question.id} must define required_business_rules`,
      );
    }
    if (
      !question.expected_sql_concept_tags?.length &&
      !question.expected_sql_concepts?.length
    ) {
      throw new InternalServerErrorException(
        `${question.id} must define expected_sql_concept_tags or expected_sql_concepts`,
      );
    }
    if (!question.edge_cases?.length) {
      throw new InternalServerErrorException(
        `${question.id} must define edge_cases`,
      );
    }
    if (!question.null_rules?.length) {
      throw new InternalServerErrorException(
        `${question.id} must define null_rules`,
      );
    }
    if (!question.duplicate_rules?.length) {
      throw new InternalServerErrorException(
        `${question.id} must define duplicate_rules`,
      );
    }
  }

  private assertOopsContext(question: BankQuestion) {
    const context = question.evaluator_context;
    const requiredKeys: Array<
      keyof NonNullable<BankQuestion['evaluator_context']>
    > = [
      'domain_rules',
      'required_components',
      'design_constraints',
      'acceptance_signals',
      'red_flags',
    ];

    requiredKeys.forEach((key) => {
      const values = context?.[key];
      if (!Array.isArray(values) || !values.length) {
        throw new InternalServerErrorException(
          `${question.id} must define evaluator_context.${key}`,
        );
      }
    });
  }
}
