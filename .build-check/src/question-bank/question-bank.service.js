"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionBankService = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const vagueExpectedPattern = /\b(any|valid|before|within\s+time|correct\s+.*\s+(count|list|operations))\b|\.{3}/i;
let QuestionBankService = class QuestionBankService {
    async getBank() {
        try {
            const raw = await fs_1.promises.readFile((0, path_1.join)(__dirname, 'data', 'joraiq-question-bank.json'), 'utf8');
            const bank = JSON.parse(raw);
            this.assertValidBank(bank);
            return bank;
        }
        catch (error) {
            if (error instanceof common_1.InternalServerErrorException)
                throw error;
            throw new common_1.InternalServerErrorException('Question bank could not be read');
        }
    }
    async getImportPreview() {
        const bank = await this.getBank();
        const assessment = bank.assessment;
        const questions = Array.isArray(bank.questions) ? bank.questions : [];
        return {
            title: assessment?.title || 'Untitled assessment',
            sections: assessment?.sections || [],
            question_count: questions.length,
            counts_by_section: questions.reduce((counts, item) => {
                const section = String(item.section || 'UNKNOWN');
                counts[section] = (counts[section] || 0) + 1;
                return counts;
            }, {}),
            next_step: 'Wire this preview into the admin import flow, then upsert rows into Supabase.',
        };
    }
    assertValidBank(bank) {
        const questions = Array.isArray(bank.questions) ? bank.questions : null;
        if (!questions) {
            throw new common_1.InternalServerErrorException('Question bank is missing questions array');
        }
        const counts = questions.reduce((summary, item) => {
            const section = String(item.section || '');
            summary[section] = (summary[section] || 0) + 1;
            return summary;
        }, {});
        const expectedCounts = {
            DSA: 5,
            SQL: 3,
            OOPs: 3,
            MCQ: 20,
        };
        Object.entries(expectedCounts).forEach(([section, expected]) => {
            if (counts[section] !== expected) {
                throw new common_1.InternalServerErrorException(`Question bank must contain ${expected} ${section} questions`);
            }
        });
        questions.forEach((item) => {
            const question = item;
            if (!question.id || !question.prompt) {
                throw new common_1.InternalServerErrorException('Every question requires id and prompt');
            }
            if (question.section === 'DSA') {
                if (question.test_cases?.length !== 15 ||
                    question.open_test_cases?.length !== 5 ||
                    question.hidden_test_cases?.length !== 10) {
                    throw new common_1.InternalServerErrorException(`${question.id} must include 15 doc test cases, 5 open cases and 10 hidden cases`);
                }
                this.assertAuthenticDsaCases(question);
            }
            if (question.section === 'MCQ') {
                if (!question.options?.length || !question.correct_options?.length) {
                    throw new common_1.InternalServerErrorException(`${question.id} must include options and correct_options`);
                }
                this.assertMcqAnswerKeys(question);
            }
            if (question.section === 'SQL') {
                this.assertSqlMetadata(question);
            }
        });
    }
    assertAuthenticDsaCases(question) {
        const cases = [
            ...(question.open_test_cases || []),
            ...(question.hidden_test_cases || []),
            ...(question.test_cases || []),
        ];
        cases.forEach((testCase) => {
            const label = `${question.id}:${testCase.id || testCase.number || '?'}`;
            const input = String(testCase.input || '');
            const expected = String(testCase.expected_output || testCase.expected || '');
            if (!input.trim() || !expected.trim()) {
                throw new common_1.InternalServerErrorException(`${label} must include non-empty input and expected output`);
            }
            if (vagueExpectedPattern.test(input) || vagueExpectedPattern.test(expected)) {
                throw new common_1.InternalServerErrorException(`${label} contains a placeholder or non-deterministic expected output`);
            }
            this.assertDsaCaseParseable(String(question.id), input, expected, label);
        });
    }
    assertDsaCaseParseable(questionId, input, expected, label) {
        if (questionId === 'dsa_servicenow_incident_dependency') {
            this.parseIntValue(input, 'n', label);
            this.parseJsonMatrix(input, 'dependencies', label);
            this.parseJsonArray(expected, label);
            return;
        }
        if (questionId === 'dsa_amazon_delivery_routes') {
            this.parseIntValue(input, 'n', label);
            this.parseJsonMatrix(input, 'roads', label);
            this.parseJsonArray(expected, label);
            return;
        }
        if (questionId === 'dsa_commvault_deduplication') {
            this.parseJsonArray(input, label);
            this.parseJsonArray(expected, label);
            return;
        }
        if (questionId === 'dsa_autodesk_versioned_kv') {
            if (!/^(set|get)\("/.test(input.trim())) {
                throw new common_1.InternalServerErrorException(`${label} must contain executable set/get operations`);
            }
            return;
        }
        if (questionId === 'dsa_amazon_fraud_window') {
            this.parseJsonMatrix(input, 'transactions', label);
            this.parseIntValue(input, 'k', label);
            this.parseIntValue(input, 't', label);
            this.parseJsonArray(expected, label);
        }
    }
    parseIntValue(input, key, label) {
        if (!new RegExp(`${key}\\s*=\\s*-?\\d+`).test(input)) {
            throw new common_1.InternalServerErrorException(`${label} is missing ${key}`);
        }
    }
    parseJsonMatrix(input, key, label) {
        const start = input.indexOf(`${key}=`);
        if (start < 0) {
            throw new common_1.InternalServerErrorException(`${label} is missing ${key}`);
        }
        const first = input.indexOf('[[', start);
        if (first < 0)
            return [];
        let depth = 0;
        let end = first;
        for (; end < input.length; end += 1) {
            if (input[end] === '[')
                depth += 1;
            if (input[end] === ']')
                depth -= 1;
            if (depth === 0)
                break;
        }
        return this.parseJsonArray(input.slice(first, end + 1), label);
    }
    parseJsonArray(value, label) {
        try {
            const parsed = JSON.parse(value);
            if (!Array.isArray(parsed))
                throw new Error('not an array');
            return parsed;
        }
        catch {
            throw new common_1.InternalServerErrorException(`${label} must contain valid JSON array data`);
        }
    }
    assertMcqAnswerKeys(question) {
        const labels = new Set((question.options || []).map((option) => option.label));
        const invalid = (question.correct_options || []).filter((option) => !labels.has(option));
        if (invalid.length) {
            throw new common_1.InternalServerErrorException(`${question.id} has correct_options not present in options`);
        }
    }
    assertSqlMetadata(question) {
        const files = question.schema_files;
        if (!files?.schema || !files.visible_seed || !files.hidden_seed) {
            throw new common_1.InternalServerErrorException(`${question.id} must define schema, visible_seed and hidden_seed files`);
        }
        if (!question.expected_columns?.length) {
            throw new common_1.InternalServerErrorException(`${question.id} must define expected_columns`);
        }
    }
};
exports.QuestionBankService = QuestionBankService;
exports.QuestionBankService = QuestionBankService = __decorate([
    (0, common_1.Injectable)()
], QuestionBankService);
//# sourceMappingURL=question-bank.service.js.map