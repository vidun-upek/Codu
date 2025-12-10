import React, { useState, ChangeEvent } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import './App.css';

// You will likely need to convert these files to .ts/.tsx or allow JS imports
// @ts-ignore
import problems from './problems';
// @ts-ignore
import sumOfTwoNumbersTests from './testcases/sumOfTwoNumbers';
// @ts-ignore
import multiplyNumbersTests from './testcases/multiplyNumbers';

// --- Types & Interfaces ---

type Language = 'python' | 'javascript' | 'cpp';

interface TestCase {
  input: string;
  expectedOutput: string;
}

interface TestSuite {
  testCode: string;
  testCases: TestCase[];
}

interface TestCaseMap {
  [key: string]: {
    [key in Language]?: TestSuite;
  };
}

interface Example {
  input: string;
  output: string;
  explanation?: string;
}

interface Problem {
  id: number;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  examples: Example[];
  starterCode: Record<Language, string>;
  testCaseFile: string;
}

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

interface Judge0Response {
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  time?: string;
  memory?: number;
}

// --- Constants ---

const testCaseMap: TestCaseMap = {
  sumOfTwoNumbers: sumOfTwoNumbersTests,
  multiplyNumbers: multiplyNumbersTests 
};

const languageIds: Record<Language, number> = {
  python: 71,
  javascript: 63,
  cpp: 54
};

// --- Component ---

function App() {
  const [currentProblemIndex, setCurrentProblemIndex] = useState<number>(0);
  const [language, setLanguage] = useState<Language>('python');
  const [code, setCode] = useState<string>(problems[0].starterCode.python);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const currentProblem: Problem = problems[currentProblemIndex];
  // Safe access to test cases based on language
  const testCases = testCaseMap[currentProblem.testCaseFile]?.[language];

  const handleProblemChange = (index: number) => {
    setCurrentProblemIndex(index);
    setCode(problems[index].starterCode[language]);
    setTestResults([]);
  };

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    setCode(currentProblem.starterCode[newLang]);
    setTestResults([]);
  };

  const runCode = async () => {
    if (!testCases) {
      alert("Test cases not available for this language.");
      return;
    }

    setIsRunning(true);
    const fullCode = code + '\n' + testCases.testCode;
    
    const initialResults: TestResult[] = testCases.testCases.map((_, index) => ({
      testNumber: index + 1,
      status: 'running',
      message: 'Running...'
    }));
    setTestResults(initialResults);

    const results: TestResult[] = [];

    for (let i = 0; i < testCases.testCases.length; i++) {
      const testCase = testCases.testCases[i];

      try {
        const response = await axios.post(
          'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true',
          {
            language_id: languageIds[language],
            source_code: fullCode,
            stdin: testCase.input
          },
          {
            headers: {
              'content-type': 'application/json',
              // Changed from process.env to import.meta.env for Vite
              'X-RapidAPI-Key': import.meta.env.VITE_RAPIDAPI_KEY,
              'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
            }
          }
        );

        const result: Judge0Response = response.data;
        let testResult: TestResult;

        if (result.stdout && result.stdout.trim() === testCase.expectedOutput) {
          testResult = {
            testNumber: i + 1,
            status: 'passed',
            message: `Test Case ${i + 1} Passed`,
            input: testCase.input,
            expected: testCase.expectedOutput,
            actual: result.stdout.trim(),
            time: result.time,
            memory: result.memory
          };
        } else if (result.stderr) {
          testResult = {
            testNumber: i + 1,
            status: 'failed',
            message: `Test Case ${i + 1} Failed - Runtime Error`,
            error: result.stderr
          };
        } else if (result.compile_output) {
          testResult = {
            testNumber: i + 1,
            status: 'failed',
            message: `Test Case ${i + 1} Failed - Compilation Error`,
            error: result.compile_output
          };
        } else {
          testResult = {
            testNumber: i + 1,
            status: 'failed',
            message: `Test Case ${i + 1} Failed - Wrong Answer`,
            input: testCase.input,
            expected: testCase.expectedOutput,
            actual: result.stdout ? result.stdout.trim() : 'No output'
          };
        }

        results.push(testResult);
        // Functional update to ensure we don't overwrite concurrent state updates if any
        setTestResults((prev) => {
             const newResults = [...prev];
             newResults[i] = testResult;
             return newResults;
        });

      } catch (error: any) {
        const errorResult: TestResult = {
          testNumber: i + 1,
          status: 'failed',
          message: `Test Case ${i + 1} Failed - API Error`,
          error: error.message || 'Unknown error'
        };
        
        results.push(errorResult);
        setTestResults((prev) => {
             const newResults = [...prev];
             newResults[i] = errorResult;
             return newResults;
        });
      }
    }

    setIsRunning(false);
  };

  const passedCount = testResults.filter(r => r.status === 'passed').length;
  const failedCount = testResults.filter(r => r.status === 'failed').length;

  return (
    <div className="App">
      <div className="header">
        <h1>Code Challenge Platform</h1>
        <div className="header-controls">
          <select 
            value={currentProblemIndex} 
            onChange={(e: ChangeEvent<HTMLSelectElement>) => handleProblemChange(Number(e.target.value))}
            className="problem-select"
          >
            {problems.map((problem: Problem, index: number) => (
              <option key={problem.id} value={index}>
                {problem.title} ({problem.difficulty})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="container">
        {/* LEFT SIDE */}
        <div className="problem-section">
          <div className="difficulty-badge">{currentProblem.difficulty}</div>
          <h2>{currentProblem.title}</h2>
          <p>{currentProblem.description}</p>
          
          <div className="examples">
            <strong>Examples:</strong>
            {currentProblem.examples.map((example, index) => (
              <div key={index} className="example">
                <div><strong>Input:</strong> {example.input}</div>
                <div><strong>Output:</strong> {example.output}</div>
                {example.explanation && (
                  <div><strong>Explanation:</strong> {example.explanation}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="editor-section">
          <div className="editor-header">
            <select 
              value={language} 
              onChange={(e: ChangeEvent<HTMLSelectElement>) => handleLanguageChange(e.target.value as Language)}
              className="language-select"
            >
              <option value="python">Python 3</option>
              <option value="javascript">JavaScript (Node.js)</option>
              <option value="cpp">C++</option>
            </select>
            <button 
              onClick={runCode} 
              disabled={isRunning}
              className="run-button"
            >
              ▶ {isRunning ? 'Running...' : 'Run Code'}
            </button>
          </div>
          
          <div className="editor-container">
            <Editor
              height="100%"
              language={language}
              value={code}
              onChange={(value) => setCode(value || '')}
              theme="vs-dark"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                roundedSelection: false,
                automaticLayout: true
              }}
            />
          </div>

          {/* CONSOLE */}
          <div className="console-section">
            <div className="console-header">
              <span className="console-icon">▶</span>
              <span>Console</span>
            </div>
            
            <div className="console-content">
              {testResults.length === 0 ? (
                <div className="console-empty">
                  Click "Run Code" to execute test cases
                </div>
              ) : (
                testResults.map((result) => (
                  <div 
                    key={result.testNumber} 
                    className={`test-case-result ${result.status}`}
                  >
                    <div className="test-case-header">
                      <span className="test-status-icon">
                        {result.status === 'passed' && '✓'}
                        {result.status === 'failed' && '✗'}
                        {result.status === 'running' && '⟳'}
                      </span>
                      <span>{result.message}</span>
                    </div>
                    
                    {result.status === 'passed' && (
                      <div className="test-case-details">
                        Input: {result.input} | Expected: {result.expected} | 
                        Time: {result.time}s | Memory: {result.memory}KB
                      </div>
                    )}
                    
                    {result.status === 'failed' && result.input && (
                      <div className="test-case-details">
                        Input: {result.input} | Expected: {result.expected} | Got: {result.actual}
                      </div>
                    )}
                    
                    {result.error && (
                      <div className="test-case-error">{result.error}</div>
                    )}
                  </div>
                ))
              )}
            </div>

            {testResults.length > 0 && (
              <div className="console-summary">
                <div className="summary-left">
                  <div className="summary-item passed">
                    ✓ {passedCount} Passed
                  </div>
                  <div className="summary-item failed">
                    ✗ {failedCount} Failed
                  </div>
                </div>
                <div className="summary-right">
                  {testResults.length} / {testCases?.testCases.length || 0} Test Cases
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;