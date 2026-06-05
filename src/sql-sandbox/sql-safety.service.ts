import { BadRequestException, Injectable } from '@nestjs/common';

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

@Injectable()
export class SqlSafetyService {
  assertSafeSelect(query: string) {
    const normalized = query.trim();

    if (!normalized) throw new BadRequestException('SQL query is required');
    if (normalized.length > 20000) {
      throw new BadRequestException('SQL query is too large');
    }

    const sanitized = this.stripCommentsAndStrings(normalized);

    if (!/^(select|with)\b/i.test(sanitized.trim())) {
      throw new BadRequestException('Only SELECT/WITH queries are allowed');
    }

    if (this.hasMultipleStatements(sanitized)) {
      throw new BadRequestException('Multiple SQL statements are not allowed');
    }

    const blocked = blockedPatterns.find((pattern) => pattern.test(sanitized));
    if (blocked) {
      throw new BadRequestException('Only read-only SQL is allowed');
    }

    return normalized.replace(/;+\s*$/g, '');
  }

  private hasMultipleStatements(query: string) {
    const parts = query
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean);

    return parts.length > 1;
  }

  private stripCommentsAndStrings(query: string) {
    return query
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\$\$[\s\S]*?\$\$/g, '$$')
      .replace(/'([^']|'')*'/g, "''")
      .replace(/"([^"]|"")*"/g, '""');
  }
}
