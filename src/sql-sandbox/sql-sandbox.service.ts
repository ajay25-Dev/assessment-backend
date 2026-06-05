import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { SqlSafetyService } from './sql-safety.service';

type SqlRunInput = {
  attempt_id?: string;
  question_id?: string;
  query?: string;
  mode?: 'visible' | 'hidden';
};

const schemaFiles: Record<
  string,
  { schema: string; visible: string; hidden: string }
> = {
  sql_amazon_delivery_promise: {
    schema: 'q1_schema.sql',
    visible: 'q1_visible_seed.sql',
    hidden: 'q1_hidden_seed.sql',
  },
  sql_commvault_failure_streak: {
    schema: 'q2_schema.sql',
    visible: 'q2_visible_seed.sql',
    hidden: 'q2_hidden_seed.sql',
  },
  sql_autodesk_license_usage: {
    schema: 'q3_schema.sql',
    visible: 'q3_visible_seed.sql',
    hidden: 'q3_hidden_seed.sql',
  },
};

@Injectable()
export class SqlSandboxService {
  private pool?: Pool;

  constructor(
    private readonly config: ConfigService,
    private readonly safety: SqlSafetyService,
  ) {}

  async getSchema(questionId: string) {
    const files = this.getFiles(questionId);
    const schemaSql = await this.readSql(files.schema);
    return {
      question_id: questionId,
      schema_sql: schemaSql,
      tables: this.extractTables(schemaSql),
    };
  }

  async run(input: SqlRunInput, submit = false) {
    if (!input.question_id)
      throw new BadRequestException('question_id is required');
    const query = this.safety.assertSafeSelect(String(input.query || ''));
    const files = this.getFiles(input.question_id);
    const schemaName = this.schemaName(
      input.attempt_id || 'preview',
      input.question_id,
      submit,
    );
    const pool = this.getPool();
    const startedAt = Date.now();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      await client.query(`CREATE SCHEMA ${schemaName}`);
      await client.query(`SET LOCAL search_path TO ${schemaName}`);
      await client.query('SET LOCAL statement_timeout = 5000');
      await client.query(await this.readSql(files.schema));
      await client.query(
        await this.readSql(submit ? files.hidden : files.visible),
      );
      const result = await client.query(`${query} LIMIT 500`);
      await client.query('ROLLBACK');

      return {
        question_id: input.question_id,
        mode: submit ? 'submit' : 'run',
        columns: result.fields.map((field) => field.name),
        rows: result.rows,
        row_count: result.rowCount,
        execution_ms: Date.now() - startedAt,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      const message =
        error instanceof Error ? error.message : 'SQL execution failed';
      return {
        question_id: input.question_id,
        mode: submit ? 'submit' : 'run',
        columns: [],
        rows: [],
        row_count: 0,
        execution_ms: Date.now() - startedAt,
        error: message,
      };
    } finally {
      client.release();
    }
  }

  private getPool() {
    if (this.pool) return this.pool;
    const connectionString = this.config.get<string>(
      'SQL_SANDBOX_DATABASE_URL',
    );
    if (!connectionString) {
      throw new InternalServerErrorException(
        'SQL_SANDBOX_DATABASE_URL is not configured',
      );
    }
    this.pool = new Pool({ connectionString });
    return this.pool;
  }

  private getFiles(questionId: string) {
    const files = schemaFiles[questionId];
    if (!files) throw new BadRequestException('Unknown SQL question');
    return files;
  }

  private readSql(file: string) {
    return fs.readFile(
      join(process.cwd(), '..', 'assessment-data', 'sql', file),
      'utf8',
    );
  }

  private schemaName(attemptId: string, questionId: string, submit: boolean) {
    const raw = `sandbox_${attemptId}_${questionId}_${submit ? 'submit' : 'run'}`;
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 60);
  }

  private extractTables(schemaSql: string) {
    const matches = [
      ...schemaSql.matchAll(/create\s+table\s+([a-z_][a-z0-9_]*)/gi),
    ];
    return matches.map((match) => ({ name: match[1] }));
  }
}
