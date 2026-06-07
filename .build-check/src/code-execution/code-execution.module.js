"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeExecutionModule = void 0;
const common_1 = require("@nestjs/common");
const code_execution_controller_1 = require("./code-execution.controller");
const code_execution_service_1 = require("./code-execution.service");
const judge0_adapter_1 = require("./judge0.adapter");
const test_harness_service_1 = require("./test-harness.service");
let CodeExecutionModule = class CodeExecutionModule {
};
exports.CodeExecutionModule = CodeExecutionModule;
exports.CodeExecutionModule = CodeExecutionModule = __decorate([
    (0, common_1.Module)({
        controllers: [code_execution_controller_1.CodeExecutionController],
        providers: [code_execution_service_1.CodeExecutionService, judge0_adapter_1.Judge0Adapter, test_harness_service_1.TestHarnessService],
        exports: [code_execution_service_1.CodeExecutionService],
    })
], CodeExecutionModule);
//# sourceMappingURL=code-execution.module.js.map