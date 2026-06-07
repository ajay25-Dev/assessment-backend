"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedLanguages = void 0;
exports.findLanguage = findLanguage;
exports.supportedLanguages = [
    {
        id: 'python',
        label: 'Python',
        judge0LanguageId: 71,
        warmupSource: 'print("ok")',
    },
    {
        id: 'javascript',
        label: 'JavaScript',
        judge0LanguageId: 63,
        warmupSource: 'console.log("ok");',
    },
    {
        id: 'java',
        label: 'Java',
        judge0LanguageId: 62,
        warmupSource: 'public class Main { public static void main(String[] args) { System.out.println("ok"); } }',
    },
    {
        id: 'cpp',
        label: 'C++',
        judge0LanguageId: 54,
        warmupSource: '#include <iostream>\nint main(){ std::cout << "ok"; return 0; }',
    },
    {
        id: 'c',
        label: 'C',
        judge0LanguageId: 50,
        warmupSource: '#include <stdio.h>\nint main(){ printf("ok"); return 0; }',
    },
];
function findLanguage(languageId) {
    return exports.supportedLanguages.find((language) => language.id === languageId);
}
//# sourceMappingURL=language-map.js.map