"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlSandboxService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs_1 = require("fs");
const path_1 = require("path");
const pg_1 = require("pg");
const sql_safety_service_1 = require("./sql-safety.service");
const schemaFiles = {
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
let SqlSandboxService = class SqlSandboxService {
    config;
    safety;
    pool;
    constructor(config, safety) {
        this.config = config;
        this.safety = safety;
    }
    async getSchema(questionId) {
        const files = this.getFiles(questionId);
        const schemaSql = await this.readSql(files.schema);
        return {
            question_id: questionId,
            schema_sql: schemaSql,
            tables: this.extractTables(schemaSql),
        };
    }
    async run(input, submit = false) {
        if (!input.question_id)
            throw new common_1.BadRequestException('question_id is required');
        const query = this.safety.assertSafeSelect(String(input.query || ''));
        const files = this.getFiles(input.question_id);
        const schemaName = this.schemaName(input.attempt_id || 'preview', input.question_id, submit);
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
            await client.query(await this.readSql(submit ? files.hidden : files.visible));
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
        }
        catch (error) {
            await client.query('ROLLBACK').catch(() => undefined);
            const message = error instanceof Error ? error.message : 'SQL execution failed';
            return {
                question_id: input.question_id,
                mode: submit ? 'submit' : 'run',
                columns: [],
                rows: [],
                row_count: 0,
                execution_ms: Date.now() - startedAt,
                error: message,
            };
        }
        finally {
            client.release();
        }
    }
    getPool() {
        if (this.pool)
            return this.pool;
        const connectionString = this.config.get('SQL_SANDBOX_DATABASE_URL');
        if (!connectionString) {
            throw new common_1.InternalServerErrorException('SQL_SANDBOX_DATABASE_URL is not configured');
        }
        this.pool = new pg_1.Pool({ connectionString });
        return this.pool;
    }
    getFiles(questionId) {
        const files = schemaFiles[questionId];
        if (!files)
            throw new common_1.BadRequestException('Unknown SQL question');
        return files;
    }
    readSql(file) {
        return fs_1.promises.readFile((0, path_1.join)(__dirname, '..', 'question-bank', 'data', 'sql', file), 'utf8');
    }
    schemaName(attemptId, questionId, submit) {
        const raw = `sandbox_${attemptId}_${questionId}_${submit ? 'submit' : 'run'}`;
        return raw
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .slice(0, 60);
    }
    extractTables(schemaSql) {
        const matches = [
            ...schemaSql.matchAll(/create\s+table\s+([a-z_][a-z0-9_]*)/gi),
        ];
        return matches.map((match) => ({ name: match[1] }));
    }
};
exports.SqlSandboxService = SqlSandboxService;
exports.SqlSandboxService = SqlSandboxService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        sql_safety_service_1.SqlSafetyService])
], SqlSandboxService);
//# sourceMappingURL=sql-sandbox.service.js.map