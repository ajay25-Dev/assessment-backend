"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const sql_safety_service_1 = require("./sql-safety.service");
describe('SqlSafetyService', () => {
    const service = new sql_safety_service_1.SqlSafetyService();
    it('allows SELECT and strips trailing semicolon', () => {
        expect(service.assertSafeSelect('SELECT * FROM customers;')).toBe('SELECT * FROM customers');
    });
    it('allows CTE read queries', () => {
        expect(service.assertSafeSelect('WITH rows AS (SELECT 1 AS id) SELECT * FROM rows')).toContain('WITH rows');
    });
    it('rejects mutation keywords', () => {
        expect(() => service.assertSafeSelect('SELECT * FROM users; DROP TABLE users')).toThrow(common_1.BadRequestException);
    });
    it('rejects multiple statements', () => {
        expect(() => service.assertSafeSelect('SELECT 1; SELECT 2')).toThrow(common_1.BadRequestException);
    });
    it('ignores blocked words inside strings', () => {
        expect(service.assertSafeSelect("SELECT 'drop table' AS text")).toBe("SELECT 'drop table' AS text");
    });
});
//# sourceMappingURL=sql-safety.service.spec.js.map