import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';

type TestCase = {
  number: number;
  input: string;
  expected?: string;
  expected_output: string;
  purpose: string;
};

type HarnessParams = {
  language: string;
  sourceCode: string;
  questionId: string;
  runType: 'run' | 'submit' | 'warmup';
};

@Injectable()
export class TestHarnessService {
  async buildSource(params: HarnessParams): Promise<string> {
    if (params.runType === 'warmup') {
      return params.sourceCode;
    }

    const testCases = await this.loadTestCases(params.questionId, params.runType);
    return this.wrapWithHarness(
      params.language,
      params.sourceCode,
      testCases,
      params.questionId,
    );
  }

  private async loadTestCases(questionId: string, runType: 'run' | 'submit'): Promise<TestCase[]> {
    try {
      const raw = await fs.readFile(
        join(__dirname, '..', 'question-bank', 'data', 'joraiq-question-bank.json'),
        'utf8',
      );
      const bank = JSON.parse(raw) as {
        questions?: Array<{
          id: string;
          open_test_cases?: TestCase[];
          hidden_test_cases?: TestCase[];
          test_cases?: Array<{
            number: number;
            input: string;
            expected?: string;
            expected_output: string;
            purpose: string;
          }>;
        }>;
      };

      const question = bank.questions?.find((q) => q.id === questionId);
      if (!question) return [];

      if (runType === 'run') {
        return (
          question.open_test_cases ||
          question.test_cases?.slice(0, 5) ||
          []
        );
      }

      if (question.open_test_cases?.length || question.hidden_test_cases?.length) {
        return [
          ...(question.open_test_cases || []),
          ...(question.hidden_test_cases || []),
        ];
      }

      return question.test_cases || [];
    } catch {
      return [];
    }
  }

  private wrapWithHarness(
    language: string,
    sourceCode: string,
    testCases: TestCase[],
    questionId: string,
  ): string {
    if (testCases.length === 0) return sourceCode;

    switch (language) {
      case 'python':
        return this.pythonHarness(sourceCode, testCases, questionId);
      case 'javascript':
        return this.javascriptHarness(sourceCode, testCases, questionId);
      case 'java':
        return this.javaHarness(sourceCode, testCases, questionId);
      case 'cpp':
        return this.cppHarness(sourceCode, testCases, questionId);
      case 'c':
        return this.cHarness(sourceCode, testCases, questionId);
      default:
        return sourceCode;
    }
  }

  private normalizedTestCases(testCases: TestCase[]) {
    return testCases.map((tc) => ({
      input: tc.input,
      expected: tc.expected_output || tc.expected || '',
      purpose: tc.purpose || '',
    }));
  }

  private escapedJsonForJava(value: unknown) {
    return JSON.stringify(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private escapedJsonForCpp(value: unknown) {
    return JSON.stringify(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private functionCandidates(questionId: string) {
    if (questionId === 'dsa_servicenow_incident_dependency') {
      return ['resolve_incidents', 'resolveIncidents', 'findOrder', 'topologicalSort', 'canFinish'];
    }
    if (questionId === 'dsa_amazon_delivery_routes') {
      return ['minimum_delivery_times', 'minimumDeliveryTimes'];
    }
    if (questionId === 'dsa_commvault_deduplication') {
      return ['new_chunks_per_file', 'newChunksPerFile'];
    }
    if (questionId === 'dsa_autodesk_versioned_kv') {
      return ['versioned_store_create', 'versionedStoreCreate'];
    }
    if (questionId === 'dsa_amazon_fraud_window') {
      return ['suspicious_customers', 'suspiciousCustomers'];
    }
    return [];
  }

  private escapeCppLiteral(value: string) {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
  }

  private javaHarness(sourceCode: string, testCases: TestCase[], questionId: string): string {
    const testCasesJson = this.escapedJsonForJava(this.normalizedTestCases(testCases));

    return `
${sourceCode}

class Main {
  static class TestCase {
    String input;
    String expected;
    String purpose;
    TestCase(String input, String expected, String purpose) {
      this.input = input;
      this.expected = expected;
      this.purpose = purpose;
    }
  }

  public static void main(String[] args) throws Exception {
    String questionId = "${questionId}";
    TestCase[] cases = parseCases("${testCasesJson}");
    Solution solution = new Solution();
    java.util.List<String> rows = new java.util.ArrayList<>();
    int passed = 0;

    for (int i = 0; i < cases.length; i++) {
      TestCase tc = cases[i];
      String actual = "";
      boolean ok = false;
      try {
        ${this.javaInvocation(questionId)}
        ok = compare(actual, tc.expected);
      } catch (Throwable error) {
        actual = "ERROR: " + error.getMessage();
        ok = false;
      }
      if (ok) passed++;
      rows.add(resultRow(i + 1, tc.input, tc.expected, actual, ok, tc.purpose));
    }

    System.out.println("===TEST_RESULTS_START===");
    System.out.println("{\\"test_results\\":[" + String.join(",", rows) + "],\\"total\\":" + cases.length + ",\\"passed\\":" + passed + "}");
    System.out.println("===TEST_RESULTS_END===");
  }

  static TestCase[] parseCases(String json) {
    java.util.List<TestCase> cases = new java.util.ArrayList<>();
    java.util.regex.Matcher m = java.util.regex.Pattern
      .compile("\\\\{\\\\\\"input\\\\\\":\\\\\\"(.*?)\\\\\\",\\\\\\"expected\\\\\\":\\\\\\"(.*?)\\\\\\",\\\\\\"purpose\\\\\\":\\\\\\"(.*?)\\\\\\"\\\\}")
      .matcher(json);
    while (m.find()) {
      cases.add(new TestCase(unescape(m.group(1)), unescape(m.group(2)), unescape(m.group(3))));
    }
    return cases.toArray(new TestCase[0]);
  }

  static String unescape(String value) {
    return value.replace("\\\\\\\\", "\\\\").replace("\\\\\\\"", "\\"");
  }

  static int parseIntValue(String input, String key) {
    java.util.regex.Matcher m = java.util.regex.Pattern.compile(key + "\\\\s*=\\\\s*(-?\\\\d+)").matcher(input);
    if (!m.find()) return 0;
    return Integer.parseInt(m.group(1));
  }

  static int[][] parseIntMatrix(String input, String key) {
    int start = input.indexOf(key + "=");
    if (start < 0) return new int[0][0];
    int first = input.indexOf("[[", start);
    if (first < 0) return new int[0][0];
    int depth = 0;
    int end = first;
    for (; end < input.length(); end++) {
      char ch = input.charAt(end);
      if (ch == '[') depth++;
      if (ch == ']') depth--;
      if (depth == 0) break;
    }
    String body = input.substring(first + 1, end);
    java.util.List<int[]> rows = new java.util.ArrayList<>();
    java.util.regex.Matcher rowMatcher = java.util.regex.Pattern.compile("\\\\[([^\\\\[\\\\]]*)\\\\]").matcher(body);
    while (rowMatcher.find()) {
      String[] parts = rowMatcher.group(1).trim().isEmpty() ? new String[0] : rowMatcher.group(1).split(",");
      int[] row = new int[parts.length];
      for (int i = 0; i < parts.length; i++) row[i] = Integer.parseInt(parts[i].trim());
      rows.add(row);
    }
    return rows.toArray(new int[0][]);
  }

  static String[][] parseStringMatrix(String input) {
    java.util.List<String[]> rows = new java.util.ArrayList<>();
    java.util.regex.Matcher rowMatcher = java.util.regex.Pattern.compile("\\\\[([^\\\\[\\\\]]*)\\\\]").matcher(input);
    while (rowMatcher.find()) {
      java.util.List<String> values = new java.util.ArrayList<>();
      java.util.regex.Matcher valueMatcher = java.util.regex.Pattern.compile("\\\\\\"([^\\\\\\"]*)\\\\\\"").matcher(rowMatcher.group(1));
      while (valueMatcher.find()) values.add(valueMatcher.group(1));
      if (!values.isEmpty()) rows.add(values.toArray(new String[0]));
    }
    return rows.toArray(new String[0][]);
  }

  static String[][] parseStringIntPairs(String input, String key) {
    java.util.List<String[]> rows = new java.util.ArrayList<>();
    java.util.regex.Matcher rowMatcher = java.util.regex.Pattern.compile("\\\\[\\\\s*\\\\\\"([^\\\\\\"]+)\\\\\\"\\\\s*,\\\\s*(-?\\\\d+)\\\\s*\\\\]").matcher(input);
    while (rowMatcher.find()) rows.add(new String[] { rowMatcher.group(1), rowMatcher.group(2) });
    return rows.toArray(new String[0][]);
  }

  ${questionId === 'dsa_autodesk_versioned_kv' ? `static String runVersionedStore(String input) {
    VersionedStore store = new VersionedStore();
    java.util.List<String> outputs = new java.util.ArrayList<>();
    for (String op : input.split(";")) {
      String trimmed = op.trim();
      java.util.regex.Matcher set = java.util.regex.Pattern.compile("set\\\\(\\\\\\"([^\\\\\\"]+)\\\\\\",\\\\s*(-?\\\\d+)\\\\)").matcher(trimmed);
      java.util.regex.Matcher get = java.util.regex.Pattern.compile("get\\\\(\\\\\\"([^\\\\\\"]+)\\\\\\",\\\\s*(-?\\\\d+)\\\\)").matcher(trimmed);
      if (set.find()) store.set(set.group(1), Integer.parseInt(set.group(2)));
      if (get.find()) outputs.add(store.get(get.group(1), Integer.parseInt(get.group(2))));
    }
    return String.join(", ", outputs);
  }` : ''}

  static boolean compare(String actual, String expected) {
    String e = expected.trim().toLowerCase();
    if (e.length() == 0 || e.startsWith("any") || e.contains("valid") || e.contains("before") || e.contains("within time")) return true;
    return normalize(actual).equals(normalize(expected));
  }

  static String normalize(String value) {
    return value.replaceAll("\\\\s+", "");
  }

  static String toJson(java.util.List<?> values) {
    StringBuilder sb = new StringBuilder("[");
    for (int i = 0; i < values.size(); i++) {
      if (i > 0) sb.append(",");
      Object value = values.get(i);
      if (value instanceof String) sb.append("\\\"").append(escape(String.valueOf(value))).append("\\\"");
      else sb.append(value);
    }
    return sb.append("]").toString();
  }

  static String toJson(long[] values) {
    StringBuilder sb = new StringBuilder("[");
    for (int i = 0; i < values.length; i++) {
      if (i > 0) sb.append(",");
      sb.append(values[i]);
    }
    return sb.append("]").toString();
  }

  static String toJson(int[] values) {
    StringBuilder sb = new StringBuilder("[");
    for (int i = 0; i < values.length; i++) {
      if (i > 0) sb.append(",");
      sb.append(values[i]);
    }
    return sb.append("]").toString();
  }

  static String escape(String value) {
    return value.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"");
  }

  static String resultRow(int number, String input, String expected, String actual, boolean passed, String purpose) {
    return "{\\"number\\":" + number + ",\\"input\\":\\"" + escape(input) + "\\",\\"expected\\":\\"" + escape(expected) + "\\",\\"actual\\":\\"" + escape(actual) + "\\",\\"passed\\":" + passed + ",\\"purpose\\":\\"" + escape(purpose) + "\\"}";
  }
}
`;
  }

  private javaInvocation(questionId: string) {
    if (questionId === 'dsa_servicenow_incident_dependency') {
      return `int n = parseIntValue(tc.input, "n");
        int[][] dependencies = parseIntMatrix(tc.input, "dependencies");
        actual = toJson(solution.resolveIncidents(n, dependencies));`;
    }
    if (questionId === 'dsa_amazon_delivery_routes') {
      return `int n = parseIntValue(tc.input, "n");
        int[][] roads = parseIntMatrix(tc.input, "roads");
        actual = toJson(solution.minimumDeliveryTimes(n, roads));`;
    }
    if (questionId === 'dsa_commvault_deduplication') {
      return `String[][] files = parseStringMatrix(tc.input);
        actual = toJson(solution.newChunksPerFile(files));`;
    }
    if (questionId === 'dsa_autodesk_versioned_kv') {
      return `actual = runVersionedStore(tc.input);`;
    }
    if (questionId === 'dsa_amazon_fraud_window') {
      return `String[][] transactions = parseStringIntPairs(tc.input, "transactions");
        int k = parseIntValue(tc.input, "k");
        int t = parseIntValue(tc.input, "t");
        actual = toJson(solution.suspiciousCustomers(transactions, k, t));`;
    }
    return `actual = "[ERROR] Unsupported question";`;
  }

  private cppHarness(sourceCode: string, testCases: TestCase[], questionId: string): string {
    return `
${sourceCode}

struct __JoraTestCase { string input; string expected; string purpose; };

static int __joraIntValue(const string& input, const string& key) {
  size_t pos = input.find(key + "=");
  if (pos == string::npos) return 0;
  pos = input.find("=", pos);
  if (pos == string::npos) return 0;
  pos++;
  while (pos < input.size() && isspace((unsigned char)input[pos])) pos++;
  int sign = 1;
  if (pos < input.size() && input[pos] == '-') { sign = -1; pos++; }
  int value = 0;
  while (pos < input.size() && isdigit((unsigned char)input[pos])) {
    value = value * 10 + (input[pos] - '0');
    pos++;
  }
  return value * sign;
}

static vector<vector<int>> __joraIntMatrix(const string& input, const string& key) {
  vector<vector<int>> rows;
  size_t start = input.find(key + "=");
  if (start == string::npos) return rows;
  size_t first = input.find("[[", start);
  if (first == string::npos) return rows;
  int depth = 0;
  size_t end = first;
  for (; end < input.size(); ++end) {
    if (input[end] == '[') depth++;
    if (input[end] == ']') depth--;
    if (depth == 0) break;
  }
  string body = input.substr(first + 1, end - first - 1);
  for (size_t p = 0; p < body.size(); ++p) {
    if (body[p] != '[') continue;
    vector<int> row;
    p++;
    while (p < body.size() && body[p] != ']') {
      while (p < body.size() && !isdigit((unsigned char)body[p]) && body[p] != '-') p++;
      if (p >= body.size() || body[p] == ']') break;
      int sign = 1;
      if (body[p] == '-') { sign = -1; p++; }
      int value = 0;
      while (p < body.size() && isdigit((unsigned char)body[p])) {
        value = value * 10 + (body[p] - '0');
        p++;
      }
      row.push_back(value * sign);
    }
    rows.push_back(row);
  }
  return rows;
}

static vector<vector<string>> __joraStringMatrix(const string& input) {
  vector<vector<string>> rows;
  for (size_t p = 0; p < input.size(); ++p) {
    if (input[p] != '[' || p + 1 >= input.size() || input[p + 1] == '[') continue;
    vector<string> row;
    while (p < input.size() && input[p] != ']') {
      if (input[p] == '"') {
        size_t q = input.find('"', p + 1);
        if (q == string::npos) break;
        row.push_back(input.substr(p + 1, q - p - 1));
        p = q;
      }
      p++;
    }
    if (!row.empty()) rows.push_back(row);
  }
  return rows;
}

static vector<pair<string,int>> __joraTransactions(const string& input) {
  vector<pair<string,int>> rows;
  for (size_t p = 0; p < input.size(); ++p) {
    if (input[p] != '"') continue;
    size_t q = input.find('"', p + 1);
    if (q == string::npos) break;
    string id = input.substr(p + 1, q - p - 1);
    p = q + 1;
    while (p < input.size() && !isdigit((unsigned char)input[p]) && input[p] != '-') p++;
    int sign = 1;
    if (p < input.size() && input[p] == '-') { sign = -1; p++; }
    int value = 0;
    while (p < input.size() && isdigit((unsigned char)input[p])) {
      value = value * 10 + (input[p] - '0');
      p++;
    }
    rows.push_back({id, value * sign});
  }
  return rows;
}

template <typename T>
static string __joraJsonVector(const vector<T>& values) {
  string out = "[";
  for (size_t i = 0; i < values.size(); ++i) {
    if (i) out += ",";
    out += to_string(values[i]);
  }
  return out + "]";
}

static string __joraJsonVector(const vector<string>& values) {
  string out = "[";
  for (size_t i = 0; i < values.size(); ++i) {
    if (i) out += ",";
    out += "\\"" + values[i] + "\\"";
  }
  return out + "]";
}

${questionId === 'dsa_autodesk_versioned_kv' ? `static string __joraRunVersionedStore(const string& input) {
  VersionedStore store;
  vector<string> outputs;
  regex setPattern("set\\\\(\\\\"([^\\\\"]+)\\\\",\\\\s*(-?\\\\d+)\\\\)");
  regex getPattern("get\\\\(\\\\"([^\\\\"]+)\\\\",\\\\s*(-?\\\\d+)\\\\)");
  stringstream ss(input);
  string op;
  while (getline(ss, op, ';')) {
    smatch match;
    if (regex_search(op, match, setPattern)) store.set(match[1], stoi(match[2]));
    if (regex_search(op, match, getPattern)) outputs.push_back(store.get(match[1], stoi(match[2])));
  }
  string out;
  for (size_t i = 0; i < outputs.size(); ++i) {
    if (i) out += ", ";
    out += outputs[i];
  }
  return out;
}` : ''}

static string __joraEscape(string value) {
  string out;
  for (char ch : value) {
    if (ch == '\\\\') out += "\\\\\\\\";
    else if (ch == '"') out += "\\\\\\\"";
    else if (ch == '\\n') out += "\\\\n";
    else out += ch;
  }
  return out;
}

static string __joraNormalize(string value) {
  string out;
  for (char ch : value) if (!isspace((unsigned char)ch)) out += ch;
  return out;
}

static bool __joraCompare(const string& actual, const string& expected) {
  string lower = expected;
  transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
  if (lower.empty() || lower.rfind("any", 0) == 0 || lower.find("valid") != string::npos || lower.find("before") != string::npos || lower.find("within time") != string::npos) return true;
  return __joraNormalize(actual) == __joraNormalize(expected);
}

static string __joraResultRow(int number, string input, string expected, string actual, bool passed, string purpose) {
  return "{\\"number\\":" + to_string(number) + ",\\"input\\":\\"" + __joraEscape(input) + "\\",\\"expected\\":\\"" + __joraEscape(expected) + "\\",\\"actual\\":\\"" + __joraEscape(actual) + "\\",\\"passed\\":" + string(passed ? "true" : "false") + ",\\"purpose\\":\\"" + __joraEscape(purpose) + "\\"}";
}

int main() {
  string questionId = "${questionId}";
  vector<__JoraTestCase> cases = {
${this.normalizedTestCases(testCases)
  .map(
    (tc) =>
      `    { "${this.escapeCppLiteral(tc.input)}", "${this.escapeCppLiteral(tc.expected)}", "${this.escapeCppLiteral(tc.purpose)}" }`,
  )
  .join(',\n')}
  };
  vector<string> rows;
  int passed = 0;
  Solution solution;
  for (size_t i = 0; i < cases.size(); ++i) {
    string actual;
    bool ok = false;
    try {
      ${this.cppInvocation(questionId)}
      ok = __joraCompare(actual, cases[i].expected);
    } catch (const exception& error) {
      actual = string("ERROR: ") + error.what();
      ok = false;
    }
    if (ok) passed++;
    rows.push_back(__joraResultRow((int)i + 1, cases[i].input, cases[i].expected, actual, ok, cases[i].purpose));
  }
  cout << "===TEST_RESULTS_START===\\n";
  cout << "{\\"test_results\\":[";
  for (size_t i = 0; i < rows.size(); ++i) {
    if (i) cout << ",";
    cout << rows[i];
  }
  cout << "],\\"total\\":" << cases.size() << ",\\"passed\\":" << passed << "}\\n";
  cout << "===TEST_RESULTS_END===\\n";
}
`;
  }

  private cppInvocation(questionId: string) {
    if (questionId === 'dsa_servicenow_incident_dependency') {
      return `int n = __joraIntValue(cases[i].input, "n");
        auto dependencies = __joraIntMatrix(cases[i].input, "dependencies");
        actual = __joraJsonVector(solution.resolveIncidents(n, dependencies));`;
    }
    if (questionId === 'dsa_amazon_delivery_routes') {
      return `int n = __joraIntValue(cases[i].input, "n");
        auto roads = __joraIntMatrix(cases[i].input, "roads");
        actual = __joraJsonVector(solution.minimumDeliveryTimes(n, roads));`;
    }
    if (questionId === 'dsa_commvault_deduplication') {
      return `auto files = __joraStringMatrix(cases[i].input);
        actual = __joraJsonVector(solution.newChunksPerFile(files));`;
    }
    if (questionId === 'dsa_autodesk_versioned_kv') {
      return `actual = __joraRunVersionedStore(cases[i].input);`;
    }
    if (questionId === 'dsa_amazon_fraud_window') {
      return `auto transactions = __joraTransactions(cases[i].input);
        int k = __joraIntValue(cases[i].input, "k");
        int t = __joraIntValue(cases[i].input, "t");
        actual = __joraJsonVector(solution.suspiciousCustomers(transactions, k, t));`;
    }
    return `actual = "[ERROR] Unsupported question";`;
  }

  private cHarness(sourceCode: string, testCases: TestCase[], questionId: string): string {
    return `
${sourceCode}
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

typedef struct { char input[4096]; char expected[1024]; char purpose[1024]; } JoraTestCase;

static void print_escaped(const char* s) {
  for (; *s; ++s) {
    if (*s == '\\\\' || *s == '"') putchar('\\\\');
    if (*s == '\\n') printf("\\\\n");
    else putchar(*s);
  }
}

static int parse_int_value(const char* input, const char* key) {
  const char* pos = strstr(input, key);
  if (!pos) return 0;
  pos = strchr(pos, '=');
  if (!pos) return 0;
  return atoi(pos + 1);
}

static int** parse_matrix(const char* input, const char* key, int* rows, int** colSizes) {
  *rows = 0;
  *colSizes = NULL;
  int capacity = 8;
  int** matrix = malloc(sizeof(int*) * capacity);
  const char* pos = strstr(input, key);
  if (!pos) return matrix;
  pos = strstr(pos, "[[");
  if (!pos) return matrix;
  while (*pos) {
    if (*pos == '[' && *(pos + 1) != '[') {
      int cols = 0;
      int colCap = 4;
      int* row = malloc(sizeof(int) * colCap);
      pos++;
      while (*pos && *pos != ']') {
        while (*pos && !isdigit((unsigned char)*pos) && *pos != '-') pos++;
        if (!*pos || *pos == ']') break;
        if (cols >= colCap) {
          colCap *= 2;
          row = realloc(row, sizeof(int) * colCap);
        }
        row[cols++] = (int)strtol(pos, (char**)&pos, 10);
      }
      if (*rows >= capacity) {
        capacity *= 2;
        matrix = realloc(matrix, sizeof(int*) * capacity);
      }
      matrix[*rows] = row;
      *colSizes = realloc(*colSizes, sizeof(int) * ((*rows) + 1));
      (*colSizes)[*rows] = cols;
      (*rows)++;
    }
    if (*pos == ']' && *(pos + 1) == ']') break;
    pos++;
  }
  return matrix;
}

static char*** parse_string_matrix(const char* input, int* rows, int** colSizes) {
  *rows = 0;
  *colSizes = NULL;
  int rowCap = 8;
  char*** matrix = malloc(sizeof(char**) * rowCap);
  const char* pos = input;
  while ((pos = strchr(pos, '[')) != NULL) {
    if (*(pos + 1) == '[') {
      pos++;
      continue;
    }
    int cols = 0;
    int colCap = 4;
    char** row = malloc(sizeof(char*) * colCap);
    const char* end = strchr(pos, ']');
    const char* cursor = pos;
    while (end && cursor < end && (cursor = strchr(cursor, '"')) != NULL && cursor < end) {
      const char* close = strchr(cursor + 1, '"');
      if (!close || close > end) break;
      if (cols >= colCap) {
        colCap *= 2;
        row = realloc(row, sizeof(char*) * colCap);
      }
      int len = (int)(close - cursor - 1);
      row[cols] = malloc((size_t)len + 1);
      memcpy(row[cols], cursor + 1, (size_t)len);
      row[cols][len] = '\\0';
      cols++;
      cursor = close + 1;
    }
    if (cols > 0) {
      if (*rows >= rowCap) {
        rowCap *= 2;
        matrix = realloc(matrix, sizeof(char**) * rowCap);
      }
      matrix[*rows] = row;
      *colSizes = realloc(*colSizes, sizeof(int) * ((*rows) + 1));
      (*colSizes)[*rows] = cols;
      (*rows)++;
    }
    pos = end ? end + 1 : pos + 1;
  }
  return matrix;
}

static void parse_transactions(const char* input, char*** customerIds, int** timestamps, int* size) {
  *size = 0;
  int cap = 8;
  *customerIds = malloc(sizeof(char*) * cap);
  *timestamps = malloc(sizeof(int) * cap);
  const char* cursor = input;
  while ((cursor = strchr(cursor, '"')) != NULL) {
    const char* close = strchr(cursor + 1, '"');
    if (!close) break;
    if (*size >= cap) {
      cap *= 2;
      *customerIds = realloc(*customerIds, sizeof(char*) * cap);
      *timestamps = realloc(*timestamps, sizeof(int) * cap);
    }
    int len = (int)(close - cursor - 1);
    (*customerIds)[*size] = malloc((size_t)len + 1);
    memcpy((*customerIds)[*size], cursor + 1, (size_t)len);
    (*customerIds)[*size][len] = '\\0';
    cursor = close + 1;
    while (*cursor && !isdigit((unsigned char)*cursor) && *cursor != '-') cursor++;
    (*timestamps)[*size] = (int)strtol(cursor, (char**)&cursor, 10);
    (*size)++;
  }
}

static void print_result_row(int number, const char* input, const char* expected, const char* actual, int passed, const char* purpose) {
  printf("{\\"number\\":%d,\\"input\\":\\"", number); print_escaped(input);
  printf("\\",\\"expected\\":\\""); print_escaped(expected);
  printf("\\",\\"actual\\":\\""); print_escaped(actual);
  printf("\\",\\"passed\\":%s,\\"purpose\\":\\"", passed ? "true" : "false"); print_escaped(purpose);
  printf("\\"}");
}

static void append_int_array(char* actual, const int* result, int size) {
  strcat(actual, "[");
  for (int j = 0; j < size; j++) {
    char buf[64];
    sprintf(buf, "%s%d", j ? "," : "", result[j]);
    strcat(actual, buf);
  }
  strcat(actual, "]");
}

static void append_long_array(char* actual, const long long* result, int size) {
  strcat(actual, "[");
  for (int j = 0; j < size; j++) {
    char buf[64];
    sprintf(buf, "%s%lld", j ? "," : "", result[j]);
    strcat(actual, buf);
  }
  strcat(actual, "]");
}

static void append_string_array(char* actual, char** result, int size) {
  strcat(actual, "[");
  for (int j = 0; j < size; j++) {
    strcat(actual, j ? ",\\"" : "\\"");
    strcat(actual, result[j] ? result[j] : "");
    strcat(actual, "\\"");
  }
  strcat(actual, "]");
}

int main(void) {
  JoraTestCase cases[] = {
${this.normalizedTestCases(testCases)
  .map(
    (tc) =>
      `    {"${tc.input.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}", "${tc.expected.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}", "${tc.purpose.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"}`,
  )
  .join(',\n')}
  };
  int total = sizeof(cases) / sizeof(cases[0]);
  int passed = 0;
  printf("===TEST_RESULTS_START===\\n{\\"test_results\\":[");
  for (int i = 0; i < total; i++) {
    char actual[4096] = {0};
    int ok = 0;
    ${this.cInvocation(questionId)}
    ok = strcmp(actual, cases[i].expected) == 0 || strstr(cases[i].expected, "Any") == cases[i].expected || strstr(cases[i].expected, "valid") != NULL || strstr(cases[i].expected, "before") != NULL;
    if (ok) passed++;
    if (i) printf(",");
    print_result_row(i + 1, cases[i].input, cases[i].expected, actual, ok, cases[i].purpose);
  }
  printf("],\\"total\\":%d,\\"passed\\":%d}\\n===TEST_RESULTS_END===\\n", total, passed);
  return 0;
}
`;
  }

  private cInvocation(questionId: string) {
    if (questionId === 'dsa_servicenow_incident_dependency') {
      return `int n = parse_int_value(cases[i].input, "n");
    int rows = 0;
    int* colSizes = NULL;
    int** matrix = parse_matrix(cases[i].input, "dependencies", &rows, &colSizes);
    int resultSize = 0;
    int* result = resolveIncidents(n, matrix, rows, colSizes, &resultSize);
    append_int_array(actual, result, resultSize);`;
    }
    if (questionId === 'dsa_amazon_delivery_routes') {
      return `int n = parse_int_value(cases[i].input, "n");
    int rows = 0;
    int* colSizes = NULL;
    int** matrix = parse_matrix(cases[i].input, "roads", &rows, &colSizes);
    long long* result = minimumDeliveryTimes(n, matrix, rows, colSizes);
    append_long_array(actual, result, n);`;
    }
    if (questionId === 'dsa_commvault_deduplication') {
      return `int filesSize = 0;
    int* filesColSize = NULL;
    char*** files = parse_string_matrix(cases[i].input, &filesSize, &filesColSize);
    int resultSize = 0;
    int* result = newChunksPerFile(files, filesSize, filesColSize, &resultSize);
    append_int_array(actual, result, resultSize);`;
    }
    if (questionId === 'dsa_autodesk_versioned_kv') {
      return `VersionedStore* store = versionedStoreCreate();
    char outputs[2048] = {0};
    const char* cursor = cases[i].input;
    while (*cursor) {
      if (strncmp(cursor, "set(", 4) == 0) {
        const char* q1 = strchr(cursor, '"');
        const char* q2 = q1 ? strchr(q1 + 1, '"') : NULL;
        const char* comma = q2 ? strchr(q2, ',') : NULL;
        if (q1 && q2 && comma) {
          char key[256] = {0};
          int len = (int)(q2 - q1 - 1);
          memcpy(key, q1 + 1, (size_t)len);
          int value = atoi(comma + 1);
          versionedStoreSet(store, key, value);
        }
      } else if (strncmp(cursor, "get(", 4) == 0) {
        const char* q1 = strchr(cursor, '"');
        const char* q2 = q1 ? strchr(q1 + 1, '"') : NULL;
        const char* comma = q2 ? strchr(q2, ',') : NULL;
        if (q1 && q2 && comma) {
          char key[256] = {0};
          int len = (int)(q2 - q1 - 1);
          memcpy(key, q1 + 1, (size_t)len);
          int version = atoi(comma + 1);
          const char* value = versionedStoreGet(store, key, version);
          if (outputs[0]) strcat(outputs, ", ");
          strcat(outputs, value ? value : "NULL");
        }
      }
      const char* semi = strchr(cursor, ';');
      if (!semi) break;
      cursor = semi + 1;
      while (*cursor == ' ') cursor++;
    }
    strcat(actual, outputs);`;
    }
    if (questionId === 'dsa_amazon_fraud_window') {
      return `char** customerIds = NULL;
    int* timestamps = NULL;
    int transactionsSize = 0;
    parse_transactions(cases[i].input, &customerIds, &timestamps, &transactionsSize);
    int k = parse_int_value(cases[i].input, "k");
    int t = parse_int_value(cases[i].input, "t");
    int resultSize = 0;
    char** result = suspiciousCustomers(customerIds, timestamps, transactionsSize, k, t, &resultSize);
    append_string_array(actual, result, resultSize);`;
    }
    return `strcat(actual, "[ERROR] Unsupported question");`;
  }

  private pythonHarness(sourceCode: string, testCases: TestCase[], questionId: string): string {
    const testCasesJson = JSON.stringify(
      testCases.map((tc) => ({
        input: tc.input,
        expected: tc.expected_output || tc.expected || '',
        purpose: tc.purpose,
      })),
    );
    const candidatesJson = JSON.stringify(this.functionCandidates(questionId));

    return `
import json, sys, traceback

# === USER CODE START ===
${sourceCode}
# === USER CODE END ===

TEST_CASES = json.loads("""${testCasesJson.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}""")
CANDIDATES = json.loads("""${candidatesJson.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}""")

def try_parse_input(input_str):
    """Parse standard input format: n=X, dependencies=[[...]]"""
    n = None
    dependencies = []
    for part in input_str.split(", "):
        if "=" in part:
            key, val = part.split("=", 1)
            key = key.strip()
            val = val.strip()
            if key == "n":
                n = int(val)
            elif key == "dependencies":
                dependencies = json.loads(val)
    return n, dependencies

def find_user_func():
    """Try to locate the user's solution function."""
    namespace = globals()
    for name in CANDIDATES:
        candidate = namespace.get(name)
        if callable(candidate):
            return candidate
    # Check if Solution class exists
    Sol = namespace.get('Solution')
    if isinstance(Sol, type):
        solver = Sol()
        for name in CANDIDATES:
            if hasattr(solver, name):
                candidate = getattr(solver, name)
                if callable(candidate):
                    return candidate
    return None

def compare_outputs(result, expected_str):
    """Compare actual result with expected string."""
    expected_lower = expected_str.strip().lower()
    if not expected_lower or expected_lower.startswith("any"):
        # "Any valid order" or "Any order containing..." → accept
        return True
    
    result_str = str(result)
    
    # Try JSON comparison first
    if expected_str.startswith("["):
        try:
            expected_list = json.loads(expected_str)
            if isinstance(result, list):
                return result == expected_list
        except:
            pass
    
    # If expected says "[]" (empty list)
    if expected_str.strip() == "[]":
        return isinstance(result, list) and len(result) == 0
    
    # For cycle detection, expected might be "[]" or "empty"
    if "empty" in expected_lower or "[]" in expected_lower:
        return isinstance(result, list) and len(result) == 0
    
    # String comparison fallback
    return result_str.strip() == expected_str.strip()

results = []
func = find_user_func()

for tc in TEST_CASES:
    result_entry = {
        "number": len(results) + 1,
        "input": tc["input"],
        "expected": tc.get("expected", ""),
        "actual": "",
        "passed": False,
        "purpose": tc.get("purpose", "")
    }
    
    try:
        if func is None:
            result_entry["actual"] = "[ERROR] No matching function found"
        else:
            n, deps = try_parse_input(tc["input"])
            output = func(n, deps) if n is not None else func(deps)
            result_entry["actual"] = json.dumps(output) if isinstance(output, (list, dict)) else str(output)
            result_entry["passed"] = compare_outputs(output, tc.get("expected", ""))
    except Exception as e:
        result_entry["actual"] = f"ERROR: {str(e)}"
        result_entry["passed"] = False
    
    results.append(result_entry)

print("===TEST_RESULTS_START===")
print(json.dumps({
    "test_results": results,
    "total": len(results),
    "passed": sum(1 for r in results if r["passed"])
}, indent=2))
print("===TEST_RESULTS_END===")
`;
  }

  private javascriptHarness(sourceCode: string, testCases: TestCase[], questionId: string): string {
    const testCasesJson = JSON.stringify(
      testCases.map((tc) => ({
        input: tc.input,
        expected: tc.expected_output || tc.expected || '',
        purpose: tc.purpose,
      })),
    );
    const candidatesJson = JSON.stringify(this.functionCandidates(questionId));

    return `
// === USER CODE START ===
${sourceCode}
// === USER CODE END ===

const TEST_CASES = ${testCasesJson};
const CANDIDATES = ${candidatesJson};

function parseInput(inputStr) {
    let n = null;
    let dependencies = [];
    for (const part of inputStr.split(", ")) {
        const eqIdx = part.indexOf("=");
        if (eqIdx > 0) {
            const key = part.substring(0, eqIdx).trim();
            const val = part.substring(eqIdx + 1).trim();
            if (key === "n") n = parseInt(val);
            else if (key === "dependencies") dependencies = JSON.parse(val);
        }
    }
    return { n, dependencies };
}

function findUserFunc() {
    const namespace = globalThis;
    for (const name of CANDIDATES) {
        const candidate = namespace[name];
        if (typeof candidate === 'function') return candidate.bind(namespace);
    }
    return null;
}

function compareOutputs(result, expectedStr) {
    const lower = expectedStr.trim().toLowerCase();
    if (!lower || lower.startsWith("any")) return true;
    if (expectedStr.trim() === "[]") return Array.isArray(result) && result.length === 0;
    if (lower.includes("empty")) return Array.isArray(result) && result.length === 0;
    
    const resultStr = JSON.stringify(result);
    try {
        const expectedParsed = JSON.parse(expectedStr);
        return JSON.stringify(result) === JSON.stringify(expectedParsed);
    } catch(e) {
        return resultStr === expectedStr.trim();
    }
}

const func = findUserFunc();
const results = [];

for (const tc of TEST_CASES) {
    const entry = {
        number: results.length + 1,
        input: tc.input,
        expected: tc.expected,
        actual: "",
        passed: false,
        purpose: tc.purpose || ""
    };
    
    try {
        if (!func) {
            entry.actual = "[ERROR] No matching function found";
        } else {
            const { n, dependencies } = parseInput(tc.input);
            const output = n !== null ? func(n, dependencies) : func(dependencies);
            entry.actual = JSON.stringify(output);
            entry.passed = compareOutputs(output, tc.expected);
        }
    } catch(e) {
        entry.actual = "ERROR: " + (e.message || String(e));
        entry.passed = false;
    }
    results.push(entry);
}

console.log("===TEST_RESULTS_START===");
console.log(JSON.stringify({
    test_results: results,
    total: results.length,
    passed: results.filter(r => r.passed).length
}));
console.log("===TEST_RESULTS_END===");
`;
  }
}
