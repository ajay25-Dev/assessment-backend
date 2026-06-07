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
exports.CodeExecutionController = void 0;
const common_1 = require("@nestjs/common");
const code_execution_service_1 = require("./code-execution.service");
let CodeExecutionController = class CodeExecutionController {
    codeExecution;
    constructor(codeExecution) {
        this.codeExecution = codeExecution;
    }
    getLanguages() {
        return this.codeExecution.getLanguages();
    }
    warmup(body) {
        return this.codeExecution.warmup(body?.language);
    }
    run(body) {
        return this.codeExecution.run(body, 'run');
    }
    submit(body) {
        return this.codeExecution.run(body, 'submit');
    }
    getRun(id) {
        return {
            id,
            status: 'external-provider',
            message: 'Run persistence is reserved for the assessment attempt store integration.',
        };
    }
};
exports.CodeExecutionController = CodeExecutionController;
__decorate([
    (0, common_1.Get)('languages'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CodeExecutionController.prototype, "getLanguages", null);
__decorate([
    (0, common_1.Post)('warmup'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CodeExecutionController.prototype, "warmup", null);
__decorate([
    (0, common_1.Post)('run'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CodeExecutionController.prototype, "run", null);
__decorate([
    (0, common_1.Post)('submit'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CodeExecutionController.prototype, "submit", null);
__decorate([
    (0, common_1.Get)('runs/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CodeExecutionController.prototype, "getRun", null);
exports.CodeExecutionController = CodeExecutionController = __decorate([
    (0, common_1.Controller)('code'),
    __metadata("design:paramtypes", [code_execution_service_1.CodeExecutionService])
], CodeExecutionController);
//# sourceMappingURL=code-execution.controller.js.map