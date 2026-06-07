"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssessmentPipelineModule = void 0;
const common_1 = require("@nestjs/common");
const evaluations_module_1 = require("../evaluations/evaluations.module");
const question_bank_module_1 = require("../question-bank/question-bank.module");
const assessment_pipeline_controller_1 = require("./assessment-pipeline.controller");
const assessment_pipeline_service_1 = require("./assessment-pipeline.service");
let AssessmentPipelineModule = class AssessmentPipelineModule {
};
exports.AssessmentPipelineModule = AssessmentPipelineModule;
exports.AssessmentPipelineModule = AssessmentPipelineModule = __decorate([
    (0, common_1.Module)({
        imports: [evaluations_module_1.EvaluationsModule, question_bank_module_1.QuestionBankModule],
        controllers: [assessment_pipeline_controller_1.AssessmentPipelineController],
        providers: [assessment_pipeline_service_1.AssessmentPipelineService],
    })
], AssessmentPipelineModule);
//# sourceMappingURL=assessment-pipeline.module.js.map