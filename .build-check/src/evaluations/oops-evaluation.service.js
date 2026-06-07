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
exports.OopsEvaluationService = void 0;
const common_1 = require("@nestjs/common");
const oops_evaluator_v1_1 = require("../ai/prompts/oops-evaluator.v1");
const evaluation_output_schemas_1 = require("../ai/schemas/evaluation-output.schemas");
const openai_client_service_1 = require("../ai/openai-client.service");
const base_evaluator_service_1 = require("./base-evaluator.service");
let OopsEvaluationService = class OopsEvaluationService extends base_evaluator_service_1.BaseEvaluatorService {
    constructor(aiClient) {
        super(aiClient);
    }
    evaluate(input) {
        return this.evaluateWithPrompt({
            section: 'OOPs',
            promptVersion: oops_evaluator_v1_1.OOPS_EVALUATOR_PROMPT_VERSION,
            schemaName: 'oops_evaluation',
            schema: evaluation_output_schemas_1.oopsEvaluationOutputSchema,
            systemPrompt: oops_evaluator_v1_1.OOPS_EVALUATOR_PROMPT,
            input,
        });
    }
};
exports.OopsEvaluationService = OopsEvaluationService;
exports.OopsEvaluationService = OopsEvaluationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_client_service_1.OpenAiClientService])
], OopsEvaluationService);
//# sourceMappingURL=oops-evaluation.service.js.map