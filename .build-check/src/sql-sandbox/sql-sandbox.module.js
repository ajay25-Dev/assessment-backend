"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlSandboxModule = void 0;
const common_1 = require("@nestjs/common");
const sql_sandbox_controller_1 = require("./sql-sandbox.controller");
const sql_sandbox_service_1 = require("./sql-sandbox.service");
const sql_safety_service_1 = require("./sql-safety.service");
let SqlSandboxModule = class SqlSandboxModule {
};
exports.SqlSandboxModule = SqlSandboxModule;
exports.SqlSandboxModule = SqlSandboxModule = __decorate([
    (0, common_1.Module)({
        controllers: [sql_sandbox_controller_1.SqlSandboxController],
        providers: [sql_sandbox_service_1.SqlSandboxService, sql_safety_service_1.SqlSafetyService],
        exports: [sql_sandbox_service_1.SqlSandboxService],
    })
], SqlSandboxModule);
//# sourceMappingURL=sql-sandbox.module.js.map