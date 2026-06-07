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
exports.SqlSandboxController = void 0;
const common_1 = require("@nestjs/common");
const sql_sandbox_service_1 = require("./sql-sandbox.service");
let SqlSandboxController = class SqlSandboxController {
    sqlSandbox;
    constructor(sqlSandbox) {
        this.sqlSandbox = sqlSandbox;
    }
    getSchema(questionId) {
        return this.sqlSandbox.getSchema(questionId);
    }
    run(body) {
        return this.sqlSandbox.run(body, false);
    }
    submit(body) {
        return this.sqlSandbox.run(body, true);
    }
    getRun(id) {
        return {
            id,
            status: 'stored-after-attempt-integration',
        };
    }
};
exports.SqlSandboxController = SqlSandboxController;
__decorate([
    (0, common_1.Get)('questions/:questionId/schema'),
    __param(0, (0, common_1.Param)('questionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SqlSandboxController.prototype, "getSchema", null);
__decorate([
    (0, common_1.Post)('run'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SqlSandboxController.prototype, "run", null);
__decorate([
    (0, common_1.Post)('submit'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SqlSandboxController.prototype, "submit", null);
__decorate([
    (0, common_1.Get)('runs/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SqlSandboxController.prototype, "getRun", null);
exports.SqlSandboxController = SqlSandboxController = __decorate([
    (0, common_1.Controller)('sql'),
    __metadata("design:paramtypes", [sql_sandbox_service_1.SqlSandboxService])
], SqlSandboxController);
//# sourceMappingURL=sql-sandbox.controller.js.map