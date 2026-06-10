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

  private escapeJavaLiteral(value: string) {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
  }

  private escapeCppLiteral(value: string) {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
  }

  private functionCandidates(questionId: string) {
    if (questionId === 'dsa_servicenow_incident_dependency') {
      return ['max_on_time_incidents', 'maxOnTimeIncidents'];
    }
    if (questionId === 'dsa_amazon_delivery_routes') {
      return ['max_on_time_deliveries', 'maxOnTimeDeliveries'];
    }
    if (questionId === 'dsa_commvault_deduplication') {
      return ['unique_chunks_in_ranges', 'uniqueChunksInRanges'];
    }
    if (questionId === 'dsa_autodesk_versioned_kv') {
      return ['VersionedStore', 'versioned_store_create', 'versionedStoreCreate'];
    }
    return [];
  }

  // ====================================================================
  // Java harness
  // ====================================================================

  private javaHarness(sourceCode: string, testCases: TestCase[], questionId: string): string {
    const cases = this.normalizedTestCases(testCases)
      .map(
        (tc) =>
          `      new TestCase("${this.escapeJavaLiteral(tc.input)}", "${this.escapeJavaLiteral(tc.expected)}", "${this.escapeJavaLiteral(tc.purpose)}")`,
      )
      .join(',\n');

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
    TestCase[] cases = new TestCase[] {
${cases}
    };
    Solution solution = new Solution();
    java.util.List<String> rows = new java.util.ArrayList<>();
    int passed = 0;

    for (int i = 0; i < cases.length; i++) {
      TestCase tc = cases[i];
      String actual = "";
      boolean ok = false;
      try {
        ${this.javaInvocation(questionId)}
        ok = compare(questionId, actual, tc.expected, tc.input);
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
    java.util.regex.Matcher keyMatcher = java.util.regex.Pattern.compile(key + "\\\\s*=\\\\s*").matcher(input);
    if (!keyMatcher.find()) return new int[0][0];
    int valueStart = keyMatcher.end();
    if (input.substring(valueStart).trim().startsWith("[]")) return new int[0][0];
    int first = input.indexOf("[[", valueStart);
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

  static int[] parseOneDIntArray(String input, String key) {
    java.util.regex.Matcher keyMatcher = java.util.regex.Pattern.compile(key + "\\\\s*=\\\\s*\\\\[").matcher(input);
    if (!keyMatcher.find()) return new int[0];
    int start = keyMatcher.end();
    int end = input.indexOf("]", start);
    if (end < 0) return new int[0];
    String body = input.substring(start, end).trim();
    if (body.isEmpty()) return new int[0];
    String[] parts = body.split(",");
    int[] result = new int[parts.length];
    for (int i = 0; i < parts.length; i++) result[i] = Integer.parseInt(parts[i].trim());
    return result;
  }

  static String[][] parseStringMatrix(String input) {
    java.util.List<String[]> rows = new java.util.ArrayList<>();
    // Track bracket depth: 0=outside, 1=in outer array, 2=in inner array
    int depth = 0;
    java.util.List<String> currentRow = new java.util.ArrayList<>();
    int tokenStart = -1;
    boolean inStr = false;
    for (int i = 0; i < input.length(); i++) {
      char c = input.charAt(i);
      if (c == '\\\\') { i++; continue; }
      if (c == '"') {
        if (tokenStart < 0) tokenStart = i + 1;
        else {
          currentRow.add(input.substring(tokenStart, i));
          tokenStart = -1;
        }
        inStr = !inStr;
        continue;
      }
      if (!inStr) {
        if (c == '[') {
          depth++;
          if (depth == 2) currentRow = new java.util.ArrayList<>();
          continue;
        }
        if (c == ']') {
          depth--;
          if (depth == 1) {
            // End of an inner array — add row (even if empty)
            rows.add(currentRow.toArray(new String[0]));
            currentRow = new java.util.ArrayList<>();
          }
          continue;
        }
      }
    }
    return rows.toArray(new String[0][]);
  }

  static String[][] parseStringMatrixByKey(String input, String key) {
    java.util.regex.Matcher keyMatcher = java.util.regex.Pattern.compile(key + "\\\\s*=\\\\s*").matcher(input);
    if (!keyMatcher.find()) return new String[0][0];
    int start = keyMatcher.end();
    if (input.substring(start).trim().startsWith("[]")) return new String[0][0];
    int bracketStart = input.indexOf("[", start);
    if (bracketStart < 0) return new String[0][0];
    int depth = 0;
    int bracketEnd = bracketStart;
    for (; bracketEnd < input.length(); bracketEnd++) {
      if (input.charAt(bracketEnd) == '[') depth++;
      if (input.charAt(bracketEnd) == ']') depth--;
      if (depth == 0) break;
    }
    return parseStringMatrix(input.substring(bracketStart, bracketEnd + 1));
  }

  static String[][] parseStringIntPairs(String input, String key) {
    java.util.List<String[]> rows = new java.util.ArrayList<>();
    java.util.regex.Matcher rowMatcher = java.util.regex.Pattern.compile("\\\\[\\\\s*\\\\\\"([^\\\\\\"]+)\\\\\\"\\\\s*,\\\\s*(-?\\\\d+)\\\\s*\\\\]").matcher(input);
    while (rowMatcher.find()) rows.add(new String[] { rowMatcher.group(1), rowMatcher.group(2) });
    return rows.toArray(new String[0][]);
  }

  /**
   * Resolve a version token: either a literal integer like "0" or a variable name like "v1".
   */
  static int resolveJavaVersion(String token, java.util.Map<String, Integer> vars) {
    token = token.trim();
    if (token.matches("-?\\\\d+")) {
      return Integer.parseInt(token);
    }
    Integer v = vars.get(token);
    return v != null ? v : 0;
  }

  ${questionId === 'dsa_autodesk_versioned_kv' ? `static String runVersionedStore(String input) {
    VersionedStore store = new VersionedStore();
    java.util.List<String> outputs = new java.util.ArrayList<>();
    java.util.Map<String, Integer> vars = new java.util.HashMap<>();
    // Base version 0 is always available
    vars.put("0", 0);
    for (String op : input.split(";")) {
      String trimmed = op.trim();
      if (trimmed.isEmpty()) continue;
      // Match: v1=set(baseVersion,"key",value)
      java.util.regex.Matcher setAssign = java.util.regex.Pattern.compile(
        "(\\\\w+)\\\\s*=\\\\s*set\\\\s*\\\\(\\\\s*([^,]+)\\\\s*,\\\\s*\\\\\\"([^\\\\\\"]+)\\\\\\"\\\\s*,\\\\s*(-?\\\\d+)\\\\s*\\\\)"
      ).matcher(trimmed);
      // Match: set(baseVersion,"key",value)  (no assignment)
      java.util.regex.Matcher setNoAssign = java.util.regex.Pattern.compile(
        "set\\\\s*\\\\(\\\\s*([^,]+)\\\\s*,\\\\s*\\\\\\"([^\\\\\\"]+)\\\\\\"\\\\s*,\\\\s*(-?\\\\d+)\\\\s*\\\\)"
      ).matcher(trimmed);
      // Match: get(versionVar,"key")
      java.util.regex.Matcher getOp = java.util.regex.Pattern.compile(
        "get\\\\s*\\\\(\\\\s*([^,]+)\\\\s*,\\\\s*\\\\\\"([^\\\\\\"]+)\\\\\\"\\\\s*\\\\)"
      ).matcher(trimmed);
      if (setAssign.find()) {
        String targetVar = setAssign.group(1);
        String baseToken = setAssign.group(2);
        String key = setAssign.group(3);
        int value = Integer.parseInt(setAssign.group(4));
        int baseVersion = resolveJavaVersion(baseToken, vars);
        int newVersion = store.set(baseVersion, key, value);
        vars.put(targetVar, newVersion);
      } else if (setNoAssign.find()) {
        // standalone set with no assignment (shouldn't happen in valid tests)
        String baseToken = setNoAssign.group(1);
        String key = setNoAssign.group(2);
        int value = Integer.parseInt(setNoAssign.group(3));
        int baseVersion = resolveJavaVersion(baseToken, vars);
        store.set(baseVersion, key, value);
      } else if (getOp.find()) {
        String versionToken = getOp.group(1);
        String key = getOp.group(2);
        int version = resolveJavaVersion(versionToken, vars);
        String result = store.get(version, key);
        outputs.add(result != null ? result : "NULL");
      }
    }
    return String.join(", ", outputs);
  }` : ''}

  static boolean compare(String questionId, String actual, String expected, String input) {
    return normalize(actual).equals(normalize(expected));
  }

  static int[] parseIntArray(String value) {
    java.util.List<Integer> values = new java.util.ArrayList<>();
    java.util.regex.Matcher m = java.util.regex.Pattern.compile("-?\\\\d+").matcher(value);
    while (m.find()) values.add(Integer.parseInt(m.group()));
    int[] result = new int[values.size()];
    for (int i = 0; i < values.size(); i++) result[i] = values.get(i);
    return result;
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
        int[] durations = parseOneDIntArray(tc.input, "durations");
        int[] deadlines = parseOneDIntArray(tc.input, "deadlines");
        actual = String.valueOf(solution.maxOnTimeIncidents(n, dependencies, durations, deadlines));`;
    }
    if (questionId === 'dsa_amazon_delivery_routes') {
      return `int n = parseIntValue(tc.input, "n");
        int[][] roads = parseIntMatrix(tc.input, "roads");
        int[][] packages = parseIntMatrix(tc.input, "packages");
        actual = String.valueOf(solution.maxOnTimeDeliveries(n, roads, packages));`;
    }
    if (questionId === 'dsa_commvault_deduplication') {
      return `String[][] files = parseStringMatrixByKey(tc.input, "files");
        int[][] queries = parseIntMatrix(tc.input, "queries");
        actual = toJson(solution.uniqueChunksInRanges(files, queries));`;
    }
    if (questionId === 'dsa_autodesk_versioned_kv') {
      return `actual = runVersionedStore(tc.input);`;
    }
    return `actual = "[ERROR] Unsupported question";`;
  }

  // ====================================================================
  // C++ harness
  // ====================================================================

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

static vector<int> __joraOneDArray(const string& input, const string& key) {
  vector<int> values;
  string searchKey = key + "=[";
  size_t pos = input.find(searchKey);
  if (pos == string::npos) return values;
  pos = input.find("[", pos);
  size_t end = input.find("]", pos);
  if (end == string::npos) return values;
  string body = input.substr(pos + 1, end - pos - 1);
  istringstream ss(body);
  string token;
  while (getline(ss, token, ',')) {
    size_t s = token.find_first_not_of(" ");
    size_t e = token.find_last_not_of(" ");
    if (s != string::npos) values.push_back(stoi(token.substr(s, e - s + 1)));
  }
  return values;
}

static vector<vector<string>> __joraStringMatrix(const string& input) {
  vector<vector<string>> rows;
  // Track bracket depth: 0=outside, 1=in outer array, 2=in inner array
  int depth = 0;
  vector<string> currentRow;
  for (size_t p = 0; p < input.size(); ++p) {
    if (input[p] == '\\\\') { ++p; continue; }
    if (input[p] == '"') {
      if (p + 1 < input.size()) {
        size_t q = input.find('"', p + 1);
        if (q == string::npos) break;
        currentRow.push_back(input.substr(p + 1, q - p - 1));
        p = q;
      }
      continue;
    }
    if (input[p] == '[') {
      depth++;
      if (depth == 2) currentRow.clear();
      continue;
    }
    if (input[p] == ']') {
      depth--;
      if (depth == 1) {
        // End of an inner array — add row (even if empty)
        rows.push_back(currentRow);
        currentRow.clear();
      }
      continue;
    }
  }
  return rows;
}

static vector<vector<string>> __joraStringMatrixByKey(const string& input, const string& key) {
  string searchKey = key + "=";
  size_t keyPos = input.find(searchKey);
  if (keyPos == string::npos) return {};
  size_t bracketStart = input.find("[", keyPos);
  if (bracketStart == string::npos) return {};
  int depth = 0;
  size_t bracketEnd = bracketStart;
  for (; bracketEnd < input.size(); ++bracketEnd) {
    if (input[bracketEnd] == '[') depth++;
    if (input[bracketEnd] == ']') depth--;
    if (depth == 0) break;
  }
  return __joraStringMatrix(input.substr(bracketStart, bracketEnd - bracketStart + 1));
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

/**
 * Resolve a version token: either a literal integer like "0" or a variable name like "v1".
 */
static int __joraResolveVersion(const string& token, const map<string, int>& vars) {
  if (!token.empty() && (isdigit((unsigned char)token[0]) || token[0] == '-')) {
    return stoi(token);
  }
  auto it = vars.find(token);
  if (it != vars.end()) return it->second;
  return 0;
}

${questionId === 'dsa_autodesk_versioned_kv' ? `static string __joraRunVersionedStore(const string& input) {
  VersionedStore store;
  vector<string> outputs;
  map<string, int> vars;
  vars["0"] = 0;
  // Split by semicolons
  stringstream ss(input);
  string op;
  while (getline(ss, op, ';')) {
    string trimmed = op;
    // Trim whitespace
    size_t first = trimmed.find_first_not_of(" \\t");
    if (first == string::npos) continue;
    trimmed = trimmed.substr(first);
    // Pattern: vX=set(baseVersion,"key",value)
    regex setAssignPattern("(\\\\w+)\\\\s*=\\\\s*set\\\\s*\\\\(\\\\s*([^,]+)\\\\s*,\\\\s*\\\\\\"([^\\\\\\"]+)\\\\\\"\\\\s*,\\\\s*(-?\\\\d+)\\\\s*\\\\)");
    // Pattern: get(versionVar,"key")
    regex getPattern("get\\\\s*\\\\(\\\\s*([^,]+)\\\\s*,\\\\s*\\\\\\"([^\\\\\\"]+)\\\\\\"\\\\s*\\\\)");
    smatch match;
    if (regex_match(trimmed, match, setAssignPattern)) {
      string targetVar = match[1];
      string baseToken = match[2];
      string key = match[3];
      int value = stoi(match[4]);
      int baseVersion = __joraResolveVersion(baseToken, vars);
      int newVersion = store.set(baseVersion, key, value);
      vars[targetVar] = newVersion;
    } else if (regex_match(trimmed, match, getPattern)) {
      string versionToken = match[1];
      string key = match[2];
      int version = __joraResolveVersion(versionToken, vars);
      string result = store.get(version, key);
      outputs.push_back(result.empty() ? "NULL" : result);
    }
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

static vector<int> __joraIntArray(const string& value) {
  vector<int> values;
  regex numberPattern("-?\\\\d+");
  for (sregex_iterator it(value.begin(), value.end(), numberPattern), end; it != end; ++it) {
    values.push_back(stoi((*it).str()));
  }
  return values;
}

static bool __joraCompare(const string& questionId, const string& actual, const string& expected, const string& input) {
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
      ok = __joraCompare(questionId, actual, cases[i].expected, cases[i].input);
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
        auto durations = __joraOneDArray(cases[i].input, "durations");
        auto deadlines = __joraOneDArray(cases[i].input, "deadlines");
        actual = to_string(solution.maxOnTimeIncidents(n, dependencies, durations, deadlines));`;
    }
    if (questionId === 'dsa_amazon_delivery_routes') {
      return `int n = __joraIntValue(cases[i].input, "n");
        auto roads = __joraIntMatrix(cases[i].input, "roads");
        auto packages = __joraIntMatrix(cases[i].input, "packages");
        actual = to_string(solution.maxOnTimeDeliveries(n, roads, packages));`;
    }
    if (questionId === 'dsa_commvault_deduplication') {
      return `auto files = __joraStringMatrixByKey(cases[i].input, "files");
        auto queries = __joraIntMatrix(cases[i].input, "queries");
        actual = __joraJsonVector(solution.uniqueChunksInRanges(files, queries));`;
    }
    if (questionId === 'dsa_autodesk_versioned_kv') {
      return `actual = __joraRunVersionedStore(cases[i].input);`;
    }
    return `actual = "[ERROR] Unsupported question";`;
  }

  // ====================================================================
  // C harness
  // ====================================================================

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

static int* parse_one_d_array(const char* input, const char* key, int* size) {
  *size = 0;
  const char* pos = strstr(input, key);
  if (!pos) return NULL;
  pos = strchr(pos, '[');
  if (!pos) return NULL;
  pos++;
  const char* end = strchr(pos, ']');
  if (!end) return NULL;
  int cap = 16;
  int* result = malloc(sizeof(int) * cap);
  while (pos < end) {
    while (*pos && (*pos == ' ' || *pos == ',')) pos++;
    if (pos >= end || !*pos) break;
    if (*size >= cap) { cap *= 2; result = realloc(result, sizeof(int) * cap); }
    result[*size] = (int)strtol(pos, (char**)&pos, 10);
    (*size)++;
  }
  return result;
}

static char*** parse_string_matrix(const char* input, int* rows, int** colSizes) {
  *rows = 0;
  *colSizes = NULL;
  int rowCap = 8;
  char*** matrix = malloc(sizeof(char**) * rowCap);
  // Track bracket depth: 0=outside, 1=in outer array, 2=in inner array
  int depth = 0;
  const char* pos = input;
  while (*pos) {
    if (*pos == '\\\\') { pos++; continue; }
    if (*pos == '"') {
      const char* end = strchr(pos + 1, '"');
      if (!end) break;
      // Collect later when we exit inner array
      pos = end;
      continue;
    }
    if (*pos == '[') {
      depth++;
      if (depth == 2) {
        // Start a new inner array — collect quoted strings until we reach the inner ']'
        int colCap = 4;
        int cols = 0;
        char** row = malloc(sizeof(char*) * colCap);
        const char* inner = pos + 1;
        while (*inner && depth == 2) {
          if (*inner == '\\\\') { inner++; continue; }
          if (*inner == '"') {
            const char* q2 = strchr(inner + 1, '"');
            if (!q2) break;
            int strLen = (int)(q2 - inner - 1);
            if (cols >= colCap) {
              colCap *= 2;
              row = realloc(row, sizeof(char*) * colCap);
            }
            row[cols] = malloc((size_t)strLen + 1);
            memcpy(row[cols], inner + 1, (size_t)strLen);
            row[cols][strLen] = '\\0';
            cols++;
            inner = q2 + 1;
          } else if (*inner == ']') {
            depth--;
            // End of inner array — add even if empty
            if (*rows >= rowCap) {
              rowCap *= 2;
              matrix = realloc(matrix, sizeof(char**) * rowCap);
            }
            matrix[*rows] = row;
            *colSizes = realloc(*colSizes, sizeof(int) * ((*rows) + 1));
            (*colSizes)[*rows] = cols;
            (*rows)++;
            pos = inner;
          } else {
            inner++;
          }
        }
      } else {
        pos++;
      }
      continue;
    }
    if (*pos == ']') {
      depth--;
      if (depth == 0) break;
    }
    pos++;
  }
  return matrix;
}

static char*** parse_string_matrix_by_key(const char* input, const char* key, int* rows, int** colSizes) {
  const char* pos = strstr(input, key);
  if (!pos) { *rows = 0; *colSizes = NULL; return NULL; }
  pos = strchr(pos, '[');
  if (!pos) { *rows = 0; *colSizes = NULL; return NULL; }
  /* Find matching end bracket */
  const char* cursor = pos;
  int depth = 0;
  const char* end = pos;
  for (; *end; end++) {
    if (*end == '[') depth++;
    if (*end == ']') depth--;
    if (depth == 0) break;
  }
  /* Create a temporary null-terminated substring */
  int len = (int)(end - pos + 1);
  char* tmp = malloc((size_t)len + 1);
  memcpy(tmp, pos, (size_t)len);
  tmp[len] = '\\0';
  char*** result = parse_string_matrix(tmp, rows, colSizes);
  free(tmp);
  return result;
}

/**
 * Resolve a version token: either a literal integer or a variable name.
 */
static int resolve_c_version(const char* token, int* varMap, const char** varNames, int varCount) {
  if (*token == '-' || isdigit((unsigned char)*token)) {
    return atoi(token);
  }
  for (int i = 0; i < varCount; i++) {
    if (varNames[i] && strcmp(varNames[i], token) == 0) {
      return varMap[i];
    }
  }
  return 0;
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

static int parse_int_array(const char* value, int* out, int capacity) {
  int size = 0;
  const char* cursor = value;
  while (*cursor && size < capacity) {
    while (*cursor && !isdigit((unsigned char)*cursor) && *cursor != '-') cursor++;
    if (!*cursor) break;
    out[size++] = (int)strtol(cursor, (char**)&cursor, 10);
  }
  return size;
}

static int compare_result(const char* questionId, const char* actual, const char* expected, const char* input) {
  return strcmp(actual, expected) == 0;
}

int main(void) {
  const char* questionId = "${questionId}";
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
    ok = compare_result(questionId, actual, cases[i].expected, cases[i].input);
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
    int depRows = 0;
    int* depColSizes = NULL;
    int** dependencies = parse_matrix(cases[i].input, "dependencies", &depRows, &depColSizes);
    int durSize = 0;
    int* durations = parse_one_d_array(cases[i].input, "durations", &durSize);
    int deadSize = 0;
    int* deadlines = parse_one_d_array(cases[i].input, "deadlines", &deadSize);
    int result = maxOnTimeIncidents(n, dependencies, depRows, depColSizes, durations, durSize, deadlines, deadSize);
    sprintf(actual, "%d", result);`;
    }
    if (questionId === 'dsa_amazon_delivery_routes') {
      return `int n = parse_int_value(cases[i].input, "n");
    int rows = 0;
    int* colSizes = NULL;
    int** roads = parse_matrix(cases[i].input, "roads", &rows, &colSizes);
    int packageRows = 0;
    int* packageColSizes = NULL;
    int** packages = parse_matrix(cases[i].input, "packages", &packageRows, &packageColSizes);
    int result = maxOnTimeDeliveries(n, roads, rows, colSizes, packages, packageRows, packageColSizes);
    sprintf(actual, "%d", result);`;
    }
    if (questionId === 'dsa_commvault_deduplication') {
      return `int filesSize = 0;
    int* filesColSize = NULL;
    char*** files = parse_string_matrix_by_key(cases[i].input, "files", &filesSize, &filesColSize);
    int queriesRows = 0;
    int* queriesColSizes = NULL;
    int** queries = parse_matrix(cases[i].input, "queries", &queriesRows, &queriesColSizes);
    int resultSize = 0;
    int* result = uniqueChunksInRanges(files, filesSize, filesColSize, queries, queriesRows, queriesColSizes, &resultSize);
    append_int_array(actual, result, resultSize);`;
    }
    if (questionId === 'dsa_autodesk_versioned_kv') {
      return `VersionedStore* store = versionedStoreCreate();
    char outputs[2048] = {0};
    int varMap[64] = {0};
    const char* varNames[64];
    int varCount = 0;
    varNames[varCount] = "0";
    varMap[varCount] = 0;
    varCount++;
    const char* cursor = cases[i].input;
    while (*cursor) {
      // Try to match: vX=set(baseVersion,"key",value)
      char targetVar[64] = {0};
      char baseToken[64] = {0};
      char key[256] = {0};
      int value = 0;
      int parsed = 0;
      // Skip spaces
      while (*cursor == ' ') cursor++;
      // Check for vX=set(
      if (strncmp(cursor, "set(", 4) != 0 && strncmp(cursor, "get(", 4) != 0) {
        // Try to extract vX= prefix
        const char* eq = strchr(cursor, '=');
        if (eq && (strncmp(eq + 1, "set(", 4) == 0 || strncmp(eq + 1, "set (", 5) == 0)) {
          int namLen = (int)(eq - cursor);
          if (namLen > 0 && namLen < 64) {
            memcpy(targetVar, cursor, (size_t)namLen);
            targetVar[namLen] = '\\0';
          }
          cursor = eq + 1;
        }
      }
      if (strncmp(cursor, "set", 3) == 0) {
        const char* pos = strchr(cursor, '(');
        if (pos) {
          const char* comma1 = strchr(pos + 1, ',');
          const char* q1 = comma1 ? strchr(comma1 + 1, '"') : NULL;
          const char* q2 = q1 ? strchr(q1 + 1, '"') : NULL;
          const char* comma2 = q2 ? strchr(q2 + 1, ',') : NULL;
          if (comma1 && q1 && q2 && comma2) {
            // Extract base token
            int btLen = (int)(comma1 - pos - 1);
            if (btLen > 0 && btLen < 64) {
              memcpy(baseToken, pos + 1, (size_t)btLen);
              baseToken[btLen] = '\\0';
            }
            // Trim whitespace from baseToken
            char* ts = baseToken;
            while (*ts == ' ') ts++;
            memmove(baseToken, ts, strlen(ts) + 1);
            // Extract key
            int kLen = (int)(q2 - q1 - 1);
            if (kLen > 0 && kLen < 256) {
              memcpy(key, q1 + 1, (size_t)kLen);
              key[kLen] = '\\0';
            }
            // Extract value
            const char* valStart = comma2 + 1;
            while (*valStart == ' ') valStart++;
            value = atoi(valStart);
            // Resolve base version
            int baseVersion = resolve_c_version(baseToken, varMap, varNames, varCount);
            int newVersion = versionedStoreSet(store, baseVersion, key, value);
            // Store the return value if target variable was specified
            if (targetVar[0] != '\\0') {
              if (varCount < 64) {
                varNames[varCount] = strdup(targetVar);
                varMap[varCount] = newVersion;
                varCount++;
              }
            }
            parsed = 1;
          }
        }
      } else if (strncmp(cursor, "get", 3) == 0) {
        const char* pos = strchr(cursor, '(');
        if (pos) {
          const char* comma = strchr(pos + 1, ',');
          const char* q1 = comma ? strchr(comma + 1, '"') : NULL;
          const char* q2 = q1 ? strchr(q1 + 1, '"') : NULL;
          if (comma && q1 && q2) {
            // Extract version token
            int vtLen = (int)(comma - pos - 1);
            char versionToken[64] = {0};
            if (vtLen > 0 && vtLen < 64) {
              memcpy(versionToken, pos + 1, (size_t)vtLen);
              versionToken[vtLen] = '\\0';
            }
            // Trim
            char* ts = versionToken;
            while (*ts == ' ') ts++;
            memmove(versionToken, ts, strlen(ts) + 1);
            // Extract key
            int kLen = (int)(q2 - q1 - 1);
            if (kLen > 0 && kLen < 256) {
              memcpy(key, q1 + 1, (size_t)kLen);
              key[kLen] = '\\0';
            }
            int version = resolve_c_version(versionToken, varMap, varNames, varCount);
            const char* value = versionedStoreGet(store, version, key);
            if (outputs[0]) strcat(outputs, ", ");
            strcat(outputs, value ? value : "NULL");
            parsed = 1;
          }
        }
      }
      if (!parsed) {
        const char* semi = strchr(cursor, ';');
        if (!semi) break;
        cursor = semi + 1;
      } else {
        const char* semi = strchr(cursor, ';');
        if (!semi) break;
        cursor = semi + 1;
      }
      while (*cursor == ' ') cursor++;
    }
    strcat(actual, outputs);`;
    }
    return `strcat(actual, "[ERROR] Unsupported question");`;
  }

  // ====================================================================
  // Python harness
  // ====================================================================

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
import json, re, sys, traceback

# === USER CODE START ===
${sourceCode}
# === USER CODE END ===

TEST_CASES = json.loads("""${testCasesJson.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}""")
CANDIDATES = json.loads("""${candidatesJson.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}""")

def int_value(input_str, key):
    match = re.search(rf"{re.escape(key)}\\s*=\\s*(-?\\d+)", input_str)
    return int(match.group(1)) if match else None

def matrix_value(input_str, key):
    match = re.search(rf"{re.escape(key)}\\s*=\\s*", input_str)
    if not match:
        return []
    value_start = match.end()
    if input_str[value_start:].lstrip().startswith("[]"):
        return []
    first = input_str.find("[[", value_start)
    if first < 0:
        return []
    depth = 0
    end = first
    while end < len(input_str):
        if input_str[end] == "[":
            depth += 1
        elif input_str[end] == "]":
            depth -= 1
            if depth == 0:
                break
        end += 1
    return json.loads(input_str[first:end + 1])

def one_d_array_value(input_str, key):
    match = re.search(rf"{re.escape(key)}\\s*=\\s*\\[", input_str)
    if not match:
        return []
    start = match.end()
    end = input_str.find("]", start)
    if end < 0:
        return []
    body = input_str[start:end].strip()
    if not body:
        return []
    return [int(x.strip()) for x in body.split(",")]

def resolve_version(token, vars_dict):
    token = token.strip()
    if token.lstrip('-').isdigit():
        return int(token)
    return vars_dict.get(token, 0)

def invoke_user_func(question_id, func, input_str):
    if question_id == "dsa_servicenow_incident_dependency":
        return func(int_value(input_str, "n"), matrix_value(input_str, "dependencies"), one_d_array_value(input_str, "durations"), one_d_array_value(input_str, "deadlines"))
    if question_id == "dsa_amazon_delivery_routes":
        return func(int_value(input_str, "n"), matrix_value(input_str, "roads"), matrix_value(input_str, "packages"))
    if question_id == "dsa_commvault_deduplication":
        return func(matrix_value(input_str, "files"), matrix_value(input_str, "queries"))
    if question_id == "dsa_autodesk_versioned_kv":
        store = func()
        outputs = []
        vars_dict = {"0": 0}
        for op in input_str.split(";"):
            op = op.strip()
            if not op:
                continue
            # Match: vX=set(baseVersion,"key",value)
            set_assign_match = re.match(r'(\\w+)\\s*=\\s*set\\s*\\(\\s*([^,]+)\\s*,\\s*"([^"]+)"\\s*,\\s*(-?\\d+)\\s*\\)', op)
            # Match: get(versionVar,"key")
            get_match = re.match(r'get\\s*\\(\\s*([^,]+)\\s*,\\s*"([^"]+)"\\s*\\)', op)
            if set_assign_match:
                target_var = set_assign_match.group(1)
                base_token = set_assign_match.group(2)
                key = set_assign_match.group(3)
                value = int(set_assign_match.group(4))
                base_version = resolve_version(base_token, vars_dict)
                new_version = store.set(base_version, key, value)
                vars_dict[target_var] = new_version
            elif get_match:
                version_token = get_match.group(1)
                key = get_match.group(2)
                version = resolve_version(version_token, vars_dict)
                result = store.get(version, key)
                outputs.append("NULL" if result is None else str(result))
        return ", ".join(outputs)
    return func(input_str)

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

def compare_outputs(question_id, result, expected_str, input_str):
    if isinstance(result, (list, dict)):
        try:
            return result == json.loads(expected_str)
        except Exception:
            return json.dumps(result, separators=(",", ":")) == expected_str.replace(" ", "")
    return str(result).strip().replace(" ", "") == expected_str.strip().replace(" ", "")
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
            output = invoke_user_func("${questionId}", func, tc["input"])
            result_entry["actual"] = json.dumps(output) if isinstance(output, (list, dict)) else str(output)
            result_entry["passed"] = compare_outputs("${questionId}", output, tc.get("expected", ""), tc["input"])
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

  // ====================================================================
  // JavaScript harness
  // ====================================================================

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

function intValue(inputStr, key) {
    const match = inputStr.match(new RegExp(key + "\\s*=\\s*(-?\\d+)"));
    return match ? Number(match[1]) : null;
}

function matrixValue(inputStr, key) {
    const match = inputStr.match(new RegExp(key + "\\s*=\\s*"));
    if (!match || match.index === undefined) return [];
    const valueStart = match.index + match[0].length;
    if (inputStr.slice(valueStart).trimStart().startsWith("[]")) return [];
    const first = inputStr.indexOf("[[", valueStart);
    if (first < 0) return [];
    let depth = 0;
    let end = first;
    for (; end < inputStr.length; end++) {
        if (inputStr[end] === "[") depth++;
        if (inputStr[end] === "]") depth--;
        if (depth === 0) break;
    }
    return JSON.parse(inputStr.slice(first, end + 1));
}

function oneDArrayValue(inputStr, key) {
    const match = inputStr.match(new RegExp(key + "\\s*=\\s*\\["));
    if (!match) return [];
    const start = match.index + match[0].length;
    const end = inputStr.indexOf("]", start);
    if (end < 0) return [];
    const body = inputStr.slice(start, end).trim();
    if (!body) return [];
    return body.split(",").map(x => Number(x.trim()));
}

function resolveVersion(token, vars) {
    token = token.trim();
    if (/^-?\\d+$/.test(token)) {
        return Number(token);
    }
    return vars[token] !== undefined ? vars[token] : 0;
}

function invokeUserFunc(questionId, func, inputStr) {
    if (questionId === "dsa_servicenow_incident_dependency") return func(intValue(inputStr, "n"), matrixValue(inputStr, "dependencies"), oneDArrayValue(inputStr, "durations"), oneDArrayValue(inputStr, "deadlines"));
    if (questionId === "dsa_amazon_delivery_routes") return func(intValue(inputStr, "n"), matrixValue(inputStr, "roads"), matrixValue(inputStr, "packages"));
    if (questionId === "dsa_commvault_deduplication") return func(matrixValue(inputStr, "files"), matrixValue(inputStr, "queries"));
    if (questionId === "dsa_autodesk_versioned_kv") {
        let store;
        try {
            store = new func();
        } catch(e) {
            store = func();
        }
        const outputs = [];
        const vars = { "0": 0 };
        for (const op of inputStr.split(";")) {
            const trimmed = op.trim();
            if (!trimmed) continue;
            // Match: vX=set(baseVersion,"key",value)
            const setAssignMatch = trimmed.match(/^(\\w+)\\s*=\\s*set\\s*\\(\\s*([^,]+)\\s*,\\s*"([^"]+)"\\s*,\\s*(-?\\d+)\\s*\\)/);
            // Match: get(versionVar,"key")
            const getMatch = trimmed.match(/^get\\s*\\(\\s*([^,]+)\\s*,\\s*"([^"]+)"\\s*\\)/);
            if (setAssignMatch) {
                const targetVar = setAssignMatch[1];
                const baseToken = setAssignMatch[2];
                const key = setAssignMatch[3];
                const value = Number(setAssignMatch[4]);
                const baseVersion = resolveVersion(baseToken, vars);
                const newVersion = store.set(baseVersion, key, value);
                vars[targetVar] = newVersion;
            } else if (getMatch) {
                const versionToken = getMatch[1];
                const key = getMatch[2];
                const version = resolveVersion(versionToken, vars);
                const value = store.get(version, key);
                outputs.push(value === null || value === undefined ? "NULL" : String(value));
            }
        }
        return outputs.join(", ");
    }
    return func(inputStr);
}
function findUserFunc() {
    const namespace = globalThis;
    for (const name of CANDIDATES) {
        const candidate = namespace[name];
        if (typeof candidate === 'function') return candidate.bind(namespace);
    }
    return null;
}

function compareOutputs(questionId, result, expectedStr, inputStr) {
    if (Array.isArray(result) || (result && typeof result === "object")) {
        try {
            return JSON.stringify(result) === JSON.stringify(JSON.parse(expectedStr));
        } catch(e) {
            return JSON.stringify(result) === expectedStr.replace(/\s+/g, "");
        }
    }
    return String(result).trim().replace(/\s+/g, "") === expectedStr.trim().replace(/\s+/g, "");
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
            const output = invokeUserFunc("${questionId}", func, tc.input);
            entry.actual = JSON.stringify(output);
            entry.passed = compareOutputs("${questionId}", output, tc.expected, tc.input);
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