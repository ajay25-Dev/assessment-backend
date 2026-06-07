"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseEvaluatorService = void 0;
const common_1 = require("@nestjs/common");
class BaseEvaluatorService {
    aiClient;
    constructor(aiClient) {
        this.aiClient = aiClient;
    }
    async evaluateWithPrompt(params) {
        const input = this.assertJsonObject(params.input);
        const output = await this.aiClient.generateStructuredJson({
            schemaName: params.schemaName,
            schema: params.schema,
            systemPrompt: params.systemPrompt,
            input,
        });
        return {
            section: params.section,
            prompt_version: params.promptVersion,
            model: this.aiClient.model,
            output,
        };
    }
    assertJsonObject(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            throw new common_1.BadRequestException('Evaluation input must be a JSON object');
        }
        return input;
    }
}
exports.BaseEvaluatorService = BaseEvaluatorService;
//# sourceMappingURL=base-evaluator.service.js.map