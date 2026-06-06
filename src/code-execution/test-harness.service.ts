import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';

type TestCase = {
  number: number;
  input: string;
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
    return this.wrapWithHarness(params.language, params.sourceCode, testCases);
  }

  private async loadTestCases(questionId: string, runType: 'run' | 'submit'): Promise<TestCase[]> {
    try {
      const raw = await fs.readFile(
        join(process.cwd(), '..', 'assessment-data', 'joraiq-question-bank.json'),
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
            expected_output: string;
            purpose: string;
          }>;
        }>;
      };

      const question = bank.questions?.find((q) => q.id === questionId);
      if (!question) return [];

      // 'test_cases' contains ALL 15 cases (open + hidden combined)
      if (question.test_cases && question.test_cases.length > 0) {
        return question.test_cases;
      }

      // Fall back to open/hidden split
      if (runType === 'run') {
        return question.open_test_cases || [];
      }
      return [...(question.open_test_cases || []), ...(question.hidden_test_cases || [])];
    } catch {
      return [];
    }
  }

  private wrapWithHarness(language: string, sourceCode: string, testCases: TestCase[]): string {
    if (testCases.length === 0) return sourceCode;

    switch (language) {
      case 'python':
        return this.pythonHarness(sourceCode, testCases);
      case 'javascript':
        return this.javascriptHarness(sourceCode, testCases);
      case 'java':
      case 'cpp':
      case 'c':
      default:
        // For non-Python/JS languages, just pass through source code.
        // The Judge0 compiler will return raw stdout/stderr which the
        // frontend can display as a single test result.
        return sourceCode;
    }
  }

  private pythonHarness(sourceCode: string, testCases: TestCase[]): string {
    const testCasesJson = JSON.stringify(
      testCases.map((tc) => ({
        input: tc.input,
        expected: tc.expected_output,
        purpose: tc.purpose,
      })),
    );

    return `
import json, sys, traceback

# === USER CODE START ===
${sourceCode}
# === USER CODE END ===

TEST_CASES = json.loads("""${testCasesJson.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}""")

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
    import builtins
    candidates = ['resolve_incidents', 'resolveIncidents', 'findOrder', 'topologicalSort', 'canFinish']
    for name in candidates:
        if name in dir() and callable(globals().get(name)):
            return globals()[name]
    # Check if Solution class exists
    if 'Solution' in dir():
        Sol = globals()['Solution']
        if isinstance(Sol, type):
            solver = Sol()
            for name in candidates:
                if hasattr(solver, name):
                    return getattr(solver, name)
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
        "expected": tc["expected"],
        "actual": "",
        "passed": False,
        "purpose": tc.get("purpose", "")
    }
    
    try:
        if func is None:
            result_entry["actual"] = "[ERROR] No matching function found"
        else:
            n, deps = try_parse_input(tc["input"])
            if "number" in tc["input"].lower():
                # Try numeric parsing differently
                n, deps = try_for_numeric(tc["input"])
            
            output = func(n, deps) if n is not None else func(deps)
            result_entry["actual"] = json.dumps(output) if isinstance(output, (list, dict)) else str(output)
            result_entry["passed"] = compare_outputs(output, tc["expected"])
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

  private javascriptHarness(sourceCode: string, testCases: TestCase[]): string {
    const testCasesJson = JSON.stringify(
      testCases.map((tc) => ({
        input: tc.input,
        expected: tc.expected_output,
        purpose: tc.purpose,
      })),
    );

    return `
// === USER CODE START ===
${sourceCode}
// === USER CODE END ===

const TEST_CASES = ${testCasesJson};

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
    const candidates = ['resolveIncidents', 'resolve_incidents', 'findOrder', 'topologicalSort', 'canFinish'];
    // Check global scope
    for (const name of candidates) {
        if (typeof globalThis[name] === 'function') return globalThis[name].bind(globalThis);
        if (typeof eval(name) === 'function') return eval(name).bind(globalThis);
    }
    // Check if resolveIncidents is defined in this scope
    for (const name of candidates) {
        try {
            if (typeof eval(name) === 'function') return eval(name);
        } catch(e) {}
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