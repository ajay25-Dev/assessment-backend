export type SupportedLanguage = {
    id: string;
    label: string;
    judge0LanguageId: number;
    warmupSource: string;
};
export declare const supportedLanguages: SupportedLanguage[];
export declare function findLanguage(languageId: string): SupportedLanguage | undefined;
