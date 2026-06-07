export declare class SqlSafetyService {
    assertSafeSelect(query: string): string;
    private hasMultipleStatements;
    private stripCommentsAndStrings;
}
