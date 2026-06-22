export type SupportedLanguage = {
  id: string;
  label: string;
  judge0LanguageId: number;
  warmupSource: string;
};

export const supportedLanguages: SupportedLanguage[] = [
  {
    id: 'cpp',
    label: 'C++ 20 (GCC 14)',
    judge0LanguageId: 54,
    warmupSource: '#include <iostream>\nint main(){ std::cout << "ok"; return 0; }',
  },
  {
    id: 'java',
    label: 'Java 21',
    judge0LanguageId: 62,
    warmupSource:
      'public class Main { public static void main(String[] args) { System.out.println("ok"); } }',
  },
  {
    id: 'python',
    label: 'Python 3.12',
    judge0LanguageId: 71,
    warmupSource: 'print("ok")',
  },
  {
    id: 'c',
    label: 'C23 (GCC 14)',
    judge0LanguageId: 50,
    warmupSource: '#include <stdio.h>\nint main(){ printf("ok"); return 0; }',
  },
];

export function findLanguage(languageId: string) {
  return supportedLanguages.find((language) => language.id === languageId);
}
