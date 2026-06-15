import { BadRequestException } from '@nestjs/common';
import { SqlSafetyService } from './sql-safety.service';

describe('SqlSafetyService', () => {
  const service = new SqlSafetyService();

  it('allows SELECT and strips trailing semicolon', () => {
    expect(service.assertSafeSelect('SELECT * FROM customers;')).toBe(
      'SELECT * FROM customers',
    );
  });

  it('allows CTE read queries', () => {
    expect(
      service.assertSafeSelect(
        'WITH rows AS (SELECT 1 AS id) SELECT * FROM rows',
      ),
    ).toContain('WITH rows');
  });

  it('allows sandbox mutation and alter statements', () => {
    expect(service.assertSafeSelect("INSERT INTO users(id) VALUES (1);")).toBe(
      "INSERT INTO users(id) VALUES (1)",
    );
    expect(service.assertSafeSelect("UPDATE users SET name = 'A';")).toBe(
      "UPDATE users SET name = 'A'",
    );
    expect(service.assertSafeSelect('DELETE FROM users;')).toBe(
      'DELETE FROM users',
    );
    expect(
      service.assertSafeSelect('ALTER TABLE users ADD COLUMN age int;'),
    ).toBe('ALTER TABLE users ADD COLUMN age int');
  });

  it('rejects dangerous database operations', () => {
    expect(() =>
      service.assertSafeSelect('SELECT * FROM users; DROP TABLE users'),
    ).toThrow(BadRequestException);
    expect(() =>
      service.assertSafeSelect('ALTER DATABASE app OWNER TO other_user'),
    ).toThrow(BadRequestException);
  });

  it('rejects multiple statements', () => {
    expect(() => service.assertSafeSelect('SELECT 1; SELECT 2')).toThrow(
      BadRequestException,
    );
  });

  it('ignores blocked words inside strings', () => {
    expect(service.assertSafeSelect("SELECT 'drop table' AS text")).toBe(
      "SELECT 'drop table' AS text",
    );
  });
});
