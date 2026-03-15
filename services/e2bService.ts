import { AppSettings } from '../types';

export interface ExecuteCodeParams {
    code: string;
    language: 'python' | 'typescript';
    timeout?: number;
    packages?: string[];
    session_id?: string;
}

export interface ExecuteCodeResult {
    success: boolean;
    stdout: string;
    stderr: string;
    exit_code: number;
    execution_time: number;
    sandbox_mode: 'e2b_cloud' | 'local_fallback';
    error_type: 'api_key_missing' | 'timeout' | 'execution_error' | null;
}

export class E2BService {
    /**
     * Executes code using E2B Cloud Sandbox or falls back to local Web Worker execution.
     */
    static async executeCode(params: ExecuteCodeParams, settings: AppSettings): Promise<ExecuteCodeResult> {
        const hasInternet = navigator.onLine;

        // Condition for Local Fallback
        if (!settings.e2bApiKey || !hasInternet) {
            return this.executeLocalFallback(params);
        }

        try {
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...params,
                    apiKey: settings.e2bApiKey
                })
            });

            if (!response.ok) {
                // If the E2B service returns an error, fallback to local
                return this.executeLocalFallback(params);
            }

            const data: ExecuteCodeResult = await response.json();
            return data;

        } catch (error) {
            // Network error to the serverless function -> fallback
            return this.executeLocalFallback(params);
        }
    }

    /**
     * Executes code locally in the browser via a Web Worker (JavaScript/TypeScript only).
     * Python is not supported in the local fallback.
     */
    private static async executeLocalFallback(params: ExecuteCodeParams): Promise<ExecuteCodeResult> {
        const startTime = Date.now();

        if (params.language === 'python') {
            return {
                success: false,
                stdout: '',
                stderr: 'Python is not supported in local fallback mode. Please configure your E2B API Key in Settings.',
                exit_code: 1,
                execution_time: Date.now() - startTime,
                sandbox_mode: 'local_fallback',
                error_type: 'execution_error'
            };
        }

        // Web Worker execution for JS/TS
        return new Promise((resolve) => {
            const workerCode = `
                self.onmessage = async function(e) {
                    const { code } = e.data;
                    let logs = [];
                    const originalConsoleLog = console.log;
                    console.log = (...args) => {
                        logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
                    };

                    try {
                        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                        const fn = new AsyncFunction(code);
                        await fn();
                        self.postMessage({ success: true, stdout: logs.join('\\n'), stderr: '' });
                    } catch (err) {
                        self.postMessage({ success: false, stdout: logs.join('\\n'), stderr: err.toString() });
                    } finally {
                        console.log = originalConsoleLog;
                    }
                };
            `;

            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            const worker = new Worker(workerUrl);

            let timeoutId: NodeJS.Timeout;

            worker.onmessage = (e) => {
                clearTimeout(timeoutId);
                worker.terminate();
                URL.revokeObjectURL(workerUrl);
                resolve({
                    success: e.data.success,
                    stdout: e.data.stdout,
                    stderr: e.data.stderr,
                    exit_code: e.data.success ? 0 : 1,
                    execution_time: Date.now() - startTime,
                    sandbox_mode: 'local_fallback',
                    error_type: e.data.success ? null : 'execution_error'
                });
            };

            worker.onerror = (err) => {
                clearTimeout(timeoutId);
                worker.terminate();
                URL.revokeObjectURL(workerUrl);
                resolve({
                    success: false,
                    stdout: '',
                    stderr: err.message,
                    exit_code: 1,
                    execution_time: Date.now() - startTime,
                    sandbox_mode: 'local_fallback',
                    error_type: 'execution_error'
                });
            };

            timeoutId = setTimeout(() => {
                worker.terminate();
                URL.revokeObjectURL(workerUrl);
                resolve({
                    success: false,
                    stdout: '',
                    stderr: 'Execution timed out',
                    exit_code: 1,
                    execution_time: Date.now() - startTime,
                    sandbox_mode: 'local_fallback',
                    error_type: 'timeout'
                });
            }, (params.timeout || 30) * 1000);

            // Send code
            // Strip ts types if needed, or assume code is JS. For simplicity, we just evaluate it.
            // In a real app we'd transpile TS to JS first (e.g., using ts script), but this is a simple fallback
            worker.postMessage({ code: params.code });
        });
    }

    /**
     * Checks if the E2B API key is valid by sending a test execution.
     */
    static async verifyConnection(apiKey: string): Promise<boolean> {
        try {
            console.log("[E2B] Testing connection...");
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey,
                    code: 'print("success")',
                    language: 'python',
                    timeout: 5
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log("[E2B] Connection test result:", data);
                return data.success;
            }
            console.error("[E2B] Connection test failed with status:", response.status);
            return false;
        } catch (error) {
            console.error("[E2B] Connection test network error:", error);
            return false;
        }
    }
}
