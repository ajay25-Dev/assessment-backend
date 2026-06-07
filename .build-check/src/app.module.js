"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const assessment_pipeline_module_1 = require("./assessment-pipeline/assessment-pipeline.module");
const auth_module_1 = require("./auth/auth.module");
const code_execution_module_1 = require("./code-execution/code-execution.module");
const evaluations_module_1 = require("./evaluations/evaluations.module");
const question_bank_module_1 = require("./question-bank/question-bank.module");
const sql_sandbox_module_1 = require("./sql-sandbox/sql-sandbox.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            auth_module_1.AuthModule,
            assessment_pipeline_module_1.AssessmentPipelineModule,
            evaluations_module_1.EvaluationsModule,
            code_execution_module_1.CodeExecutionModule,
            sql_sandbox_module_1.SqlSandboxModule,
            question_bank_module_1.QuestionBankModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map