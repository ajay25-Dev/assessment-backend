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
exports.CodeExecutionService = void 0;
const common_1 = require("@nestjs/common");
const language_map_1 = require("./language-map");
const judge0_adapter_1 = require("./judge0.adapter");
const test_harness_service_1 = require("./test-harness.service");
let CodeExecutionService = class CodeExecutionService {
    judge0;
    harness;
    constructor(judge0, harness) {
        this.judge0 = judge0;
        this.harness = harness;
    }
    getLanguages() {
        return language_map_1.supportedLanguages.map(({ id, label, judge0LanguageId }) => ({
            id,
            label,
            judge0_language_id: judge0LanguageId,
        }));
    }
    async warmup(languageId) {
        const languages = languageId
            ? language_map_1.supportedLanguages.filter((language) => language.id === languageId)
            : language_map_1.supportedLanguages;
        if (languageId && languages.length === 0) {
            throw new common_1.BadRequestException('Unsupported language');
        }
        const results = await Promise.allSettled(languages.map((language) => this.judge0.submitAndWait({
            languageId: language.judge0LanguageId,
            sourceCode: language.warmupSource,
        })));
        return {
            warmed: languages.map((language, index) => ({
                language: language.id,
                status: results[index].status,
            })),
        };
    }
    async run(input, runType) {
        const language = (0, language_map_1.findLanguage)(String(input.language || ''));
        if (!language)
            throw new common_1.BadRequestException('Unsupported language');
        const source = String(input.source_code || '');
        if (!source.trim())
            throw new common_1.BadRequestException('source_code is required');
        if (source.length > 200000) {
            throw new common_1.BadRequestException('source_code is too large');
        }
        if (!input.question_id)
            throw new common_1.BadRequestException('question_id is required');
        const sourceCode = await this.harness.buildSource({
            language: language.id,
            sourceCode: source,
            questionId: input.question_id,
            runType,
        });
        const result = await this.judge0.submitAndWait({
            languageId: language.judge0LanguageId,
            sourceCode,
            stdin: input.stdin || '',
        });
        return {
            ...result,
            test_results: this.extractTestResults(result.stdout || ''),
        };
    }
    extractTestResults(stdout) {
        const startMarker = '===TEST_RESULTS_START===';
        const endMarker = '===TEST_RESULTS_END===';
        const start = stdout.indexOf(startMarker);
        const end = stdout.indexOf(endMarker);
        if (start < 0 || end <= start)
            return null;
        const rawJson = stdout.slice(start + startMarker.length, end).trim();
        try {
            return JSON.parse(rawJson);
        }
        catch {
            return null;
        }
    }
};
exports.CodeExecutionService = CodeExecutionService;
exports.CodeExecutionService = CodeExecutionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [judge0_adapter_1.Judge0Adapter,
        test_harness_service_1.TestHarnessService])
], CodeExecutionService);
//# sourceMappingURL=code-execution.service.js.map