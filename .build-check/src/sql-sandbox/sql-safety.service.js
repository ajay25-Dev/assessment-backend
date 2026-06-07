"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlSafetyService = void 0;
const common_1 = require("@nestjs/common");
const blockedPatterns = [
    /\binsert\b/i,
    /\bupdate\b/i,
    /\bdelete\b/i,
    /\bdrop\b/i,
    /\balter\b/i,
    /\bcreate\b/i,
    /\btruncate\b/i,
    /\bcopy\b/i,
    /\bgrant\b/i,
    /\brevoke\b/i,
    /\bexecute\b/i,
    /\bcall\b/i,
    /\bdo\b/i,
    /\bmerge\b/i,
    /\bset\b/i,
    /\breset\b/i,
    /\bprepare\b/i,
    /\bdeallocate\b/i,
    /\bnotify\b/i,
    /\blisten\b/i,
    /\bunlisten\b/i,
    /\bvacuum\b/i,
    /\banalyze\b/i,
    /\bexplain\s+analyze\b/i,
];
let SqlSafetyService = class SqlSafetyService {
    assertSafeSelect(query) {
        const normalized = query.trim();
        if (!normalized)
            throw new common_1.BadRequestException('SQL query is required');
        if (normalized.length > 20000) {
            throw new common_1.BadRequestException('SQL query is too large');
        }
        const sanitized = this.stripCommentsAndStrings(normalized);
        if (!/^(select|with)\b/i.test(sanitized.trim())) {
            throw new common_1.BadRequestException('Only SELECT/WITH queries are allowed');
        }
        if (this.hasMultipleStatements(sanitized)) {
            throw new common_1.BadRequestException('Multiple SQL statements are not allowed');
        }
        const blocked = blockedPatterns.find((pattern) => pattern.test(sanitized));
        if (blocked) {
            throw new common_1.BadRequestException('Only read-only SQL is allowed');
        }
        return normalized.replace(/;+\s*$/g, '');
    }
    hasMultipleStatements(query) {
        const parts = query
            .split(';')
            .map((part) => part.trim())
            .filter(Boolean);
        return parts.length > 1;
    }
    stripCommentsAndStrings(query) {
        return query
            .replace(/--.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\$\$[\s\S]*?\$\$/g, '$$')
            .replace(/'([^']|'')*'/g, "''")
            .replace(/"([^"]|"")*"/g, '""');
    }
};
exports.SqlSafetyService = SqlSafetyService;
exports.SqlSafetyService = SqlSafetyService = __decorate([
    (0, common_1.Injectable)()
], SqlSafetyService);
//# sourceMappingURL=sql-safety.service.js.map