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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvaluationsController = void 0;
const common_1 = require("@nestjs/common");
const dashboard_evaluation_service_1 = require("./dashboard-evaluation.service");
const dsa_evaluation_service_1 = require("./dsa-evaluation.service");
const mcq_evaluation_service_1 = require("./mcq-evaluation.service");
const oops_evaluation_service_1 = require("./oops-evaluation.service");
const sql_evaluation_service_1 = require("./sql-evaluation.service");
let EvaluationsController = class EvaluationsController {
    dsaEvaluation;
    sqlEvaluation;
    oopsEvaluation;
    mcqEvaluation;
    dashboardEvaluation;
    constructor(dsaEvaluation, sqlEvaluation, oopsEvaluation, mcqEvaluation, dashboardEvaluation) {
        this.dsaEvaluation = dsaEvaluation;
        this.sqlEvaluation = sqlEvaluation;
        this.oopsEvaluation = oopsEvaluation;
        this.mcqEvaluation = mcqEvaluation;
        this.dashboardEvaluation = dashboardEvaluation;
    }
    evaluateDsa(body) {
        return this.dsaEvaluation.evaluate(body);
    }
    evaluateSql(body) {
        return this.sqlEvaluation.evaluate(body);
    }
    evaluateOops(body) {
        return this.oopsEvaluation.evaluate(body);
    }
    evaluateMcq(body) {
        return this.mcqEvaluation.evaluate(body);
    }
    evaluateDashboard(body) {
        return this.dashboardEvaluation.evaluate(body);
    }
};
exports.EvaluationsController = EvaluationsController;
__decorate([
    (0, common_1.Post)('dsa'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EvaluationsController.prototype, "evaluateDsa", null);
__decorate([
    (0, common_1.Post)('sql'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EvaluationsController.prototype, "evaluateSql", null);
__decorate([
    (0, common_1.Post)('oops'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EvaluationsController.prototype, "evaluateOops", null);
__decorate([
    (0, common_1.Post)('mcq'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EvaluationsController.prototype, "evaluateMcq", null);
__decorate([
    (0, common_1.Post)('dashboard'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EvaluationsController.prototype, "evaluateDashboard", null);
exports.EvaluationsController = EvaluationsController = __decorate([
    (0, common_1.Controller)('evaluations'),
    __metadata("design:paramtypes", [dsa_evaluation_service_1.DsaEvaluationService,
        sql_evaluation_service_1.SqlEvaluationService,
        oops_evaluation_service_1.OopsEvaluationService,
        mcq_evaluation_service_1.McqEvaluationService,
        dashboard_evaluation_service_1.DashboardEvaluationService])
], EvaluationsController);
//# sourceMappingURL=evaluations.controller.js.map