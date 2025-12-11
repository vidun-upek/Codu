import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import './App.css';

// @ts-ignore: handling JS files without types
import problems from './problems';
// @ts-ignore
import sumOfTwoNumbersTests from './testcases/sumOfTwoNumbers';
// @ts-ignore
import multiplyNumbersTests from './testcases/multiplyNumbers';

// --- Simplified Types ---
type Language = 'python' | 'javascript' | 'cpp';

interface TestResult {
  testNumber: number;
  status: 'passed' | 'failed' | 'running';
  message: string;
  input?: string;
  expected?: string;
  actual?: string;
  time?: string;
  memory?: number;
  error?: string;
}

const LANGUAGE_IDS: Record<Language, number> = {
  python: 71,
  javascript: 63,
  cpp: 54
};

const TEST_CASE_MAP: any = {
  sumOfTwoNumbers: sumOfTwoNumbersTests,
  multiplyNumbers: multiplyNumbersTests 
};

// --- Helper to clean up API Response logic ---
const parseResult = (result: any, testCase: any, index: number): TestResult => {
  const testNumber = index + 1;

  if (result.stdout && result.stdout.trim() === testCase.expectedOutput) {
    return {
      testNumber,
      status: 'passed',
      message: `Test Case ${testNumber} Passed`,
      input: testCase.input,
      expected: testCase.expectedOutput,
      actual: result.stdout.trim(),
      time: result.time,
      memory: result.memory
    };
  }
  
  // Handle various error states
  if (result.stderr) return { testNumber, status: 'failed', message: `Test Case ${testNumber} Failed - Runtime Error`, error: result.stderr };
  if (result.compile_output) return { testNumber, status: 'failed', message: `Test Case ${testNumber} Failed - Compilation Error`, error: result.compile_output };
  
  return {
    testNumber,
    status: 'failed',
    message: `Test Case ${testNumber} Failed - Wrong Answer`,
    input: testCase.input,
    expected: testCase.expectedOutput,
    actual: result.stdout ? result.stdout.trim() : 'No output'
  };
};

function App() {
  const [problemIdx, setProblemIdx] = useState(0);
  const [language, setLanguage] = useState<Language>('python');
  const [code, setCode] = useState<string>(problems[0].starterCode.python);
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const problem = problems[problemIdx];
  const testSuite = TEST_CASE_MAP[problem.testCaseFile]?.[language];

  // Reset code when problem or language changes
  const updateProblem = (idx: number) => {
    setProblemIdx(idx);
    setCode(problems[idx].starterCode[language]);
    setResults([]);
  };

  const updateLanguage = (lang: Language) => {
    setLanguage(lang);
    setCode(problem.starterCode[lang]);
    setResults([]);
  };

  const runCode = async () => {
    if (!testSuite) return alert("No tests found for this language.");
    
    setIsRunning(true);
    const fullCode = `${code}\n${testSuite.testCode}`;
    const cases = testSuite.testCases;

    // Initialize UI with "Running" state
    setResults(cases.map((_: any, i: number) => ({
      testNumber: i + 1,
      status: 'running',
      message: 'Running...'
    })));

    const newResults: TestResult[] = [];

    // Run tests sequentially
    for (let i = 0; i < cases.length; i++) {
      try {
        const { data } = await axios.post(
          'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true',
          {
            language_id: LANGUAGE_IDS[language],
            source_code: fullCode,
            stdin: cases[i].input
          },
          {
            headers: {
              'content-type': 'application/json',
              'X-RapidAPI-Key': import.meta.env.VITE_RAPIDAPI_KEY,
              'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
            }
          }
        );

        const result = parseResult(data, cases[i], i);
        newResults.push(result);
        
      } catch (err: any) {
        newResults.push({
          testNumber: i + 1,
          status: 'failed',
          message: `Test Case ${i + 1} Failed - API Error`,
          error: err.message
        });
      }
      
      // Update state incrementally so user sees progress
      setResults([...newResults, ...cases.slice(i + 1).map((_: any, idx: number) => ({
        testNumber: i + idx + 2,
        status: 'running',
        message: 'Waiting...'
      }))]);
    }
    
    setIsRunning(false);
  };

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;

  return (
    <div className="App">
      <header className="header">
        <h1>Code Challenge Platform</h1>
        <div className="header-controls">
          <select 
            value={problemIdx} 
            onChange={(e) => updateProblem(Number(e.target.value))}
            className="problem-select"
          >
            {problems.map((p: any, i: number) => (
              <option key={p.id} value={i}>{p.title} ({p.difficulty})</option>
            ))}
          </select>
        </div>
      </header>

      <main className="container">
        {/* Left: Problem Description */}
        <section className="problem-section">
          <span className="difficulty-badge">{problem.difficulty}</span>
          <h2>{problem.title}</h2>
          <p>{problem.description}</p>
          
          <div className="examples">
            <strong>Examples:</strong>
            {problem.examples.map((ex: any, i: number) => (
              <div key={i} className="example">
                <div><strong>Input:</strong> {ex.input}</div>
                <div><strong>Output:</strong> {ex.output}</div>
                {ex.explanation && <div><strong>Explanation:</strong> {ex.explanation}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* Right: Code Editor & Console */}
        <section className="editor-section">
          <div className="editor-header">
            <select 
              value={language} 
              onChange={(e) => updateLanguage(e.target.value as Language)}
              className="language-select"
            >
              <option value="python">Python 3</option>
              <option value="javascript">JavaScript (Node.js)</option>
              <option value="cpp">C++</option>
            </select>
            <button onClick={runCode} disabled={isRunning} className="run-button">
              ▶ {isRunning ? 'Running...' : 'Run Code'}
            </button>
          </div>
          
          <div className="editor-container">
            <Editor
              height="100%"
              language={language}
              value={code}
              onChange={(val) => setCode(val || '')}
              theme="vs-dark"
              options={{ fontSize: 14, minimap: { enabled: false }, automaticLayout: true }}
            />
          </div>

          <div className="console-section">
            <div className="console-header">
              <span className="console-icon">▶</span> Console
            </div>
            
            <div className="console-content">
              {results.length === 0 ? (
                <div className="console-empty">Click "Run Code" to start</div>
              ) : (
                results.map((res) => (
                  <div key={res.testNumber} className={`test-case-result ${res.status}`}>
                    <div className="test-case-header">
                      <span className="test-status-icon">
                        {res.status === 'passed' ? '✓' : res.status === 'failed' ? '✗' : '⟳'}
                      </span>
                      <span>{res.message}</span>
                    </div>
                    {res.status === 'failed' && res.input && (
                      <div className="test-case-details">
                         Expected: {res.expected} | Got: {res.actual}
                      </div>
                    )}
                    {res.error && <div className="test-case-error">{res.error}</div>}
                  </div>
                ))
              )}
            </div>

            {results.length > 0 && (
              <div className="console-summary">
                <div className="summary-left">
                  <span className="summary-item passed">✓ {passed} Passed</span>
                  <span className="summary-item failed">✗ {failed} Failed</span>
                </div>
                <div className="summary-right">
                  {results.length} / {testSuite?.testCases.length || 0} Cases
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;