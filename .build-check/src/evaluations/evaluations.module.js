"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvaluationsModule = void 0;
const common_1 = require("@nestjs/common");
const ai_module_1 = require("../ai/ai.module");
const dashboard_evaluation_service_1 = require("./dashboard-evaluation.service");
const dsa_evaluation_service_1 = require("./dsa-evaluation.service");
const evaluations_controller_1 = require("./evaluations.controller");
const mcq_evaluation_service_1 = require("./mcq-evaluation.service");
const oops_evaluation_service_1 = require("./oops-evaluation.service");
const sql_evaluation_service_1 = require("./sql-evaluation.service");
let EvaluationsModule = class EvaluationsModule {
};
exports.EvaluationsModule = EvaluationsModule;
exports.EvaluationsModule = EvaluationsModule = __decorate([
    (0, common_1.Module)({
        imports: [ai_module_1.AiModule],
        controllers: [evaluations_controller_1.EvaluationsController],
        providers: [
            dsa_evaluation_service_1.DsaEvaluationService,
            sql_evaluation_service_1.SqlEvaluationService,
            oops_evaluation_service_1.OopsEvaluationService,
            mcq_evaluation_service_1.McqEvaluationService,
            dashboard_evaluation_service_1.DashboardEvaluationService,
        ],
        exports: [
            dsa_evaluation_service_1.DsaEvaluationService,
            sql_evaluation_service_1.SqlEvaluationService,
            oops_evaluation_service_1.OopsEvaluationService,
            mcq_evaluation_service_1.McqEvaluationService,
            dashboard_evaluation_service_1.DashboardEvaluationService,
        ],
    })
], EvaluationsModule);
//# sourceMappingURL=evaluations.module.js.map