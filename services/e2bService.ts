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
    sandbox_mode: 'local_pyodide' | 'local_webworker';
    error_type: 'timeout' | 'execution_error' | null;
}

// Singleton for Pyodide instance
let pyodideInstance: any = null;
let pyodideLoading: Promise<any> | null = null;

async function getPyodide(): Promise<any> {
    if (pyodideInstance) return pyodideInstance;
    if (pyodideLoading) return pyodideLoading;

    pyodideLoading = (async () => {
        if (!(window as any).loadPyodide) {
            await new Promise<void>((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js';
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('Failed to load Pyodide'));
                document.head.appendChild(script);
            });
        }
        pyodideInstance = await (window as any).loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/'
        });
        return pyodideInstance;
    })();

    return pyodideLoading;
}

export class LocalSandboxService {

    static async executeCode(params: ExecuteCodeParams): Promise<ExecuteCodeResult> {
        if (params.language === 'python') {
            return this.executePython(params);
        } else {
            return this.executeJavaScript(params);
        }
    }

    private static async executePython(params: ExecuteCodeParams): Promise<ExecuteCodeResult> {
        const startTime = Date.now();
        try {
            const pyodide = await getPyodide();

            if (params.packages && params.packages.length > 0) {
                await pyodide.loadPackagesFromImports(params.code);
                try {
                    await pyodide.runPythonAsync(`
import micropip
await micropip.install([${params.packages.map(p => `'${p}'`).join(', ')}])
                    `);
                } catch (e) {
                    console.warn('[Pyodide] Package install warning:', e);
                }
            }

            await pyodide.runPythonAsync(`
import sys
import io
_stdout_capture = io.StringIO()
sys.stdout = _stdout_capture
            `);

            await pyodide.runPythonAsync(params.code);

            const stdout = await pyodide.runPythonAsync(`
sys.stdout = sys.__stdout__
_stdout_capture.getvalue()
            `);

            return {
                success: true,
                stdout: String(stdout || ''),
                stderr: '',
                exit_code: 0,
                execution_time: Date.now() - startTime,
                sandbox_mode: 'local_pyodide',
                error_type: null
            };
        } catch (err: any) {
            return {
                success: false,
                stdout: '',
                stderr: err.message || String(err),
                exit_code: 1,
                execution_time: Date.now() - startTime,
                sandbox_mode: 'local_pyodide',
                error_type: 'execution_error'
            };
        }
    }

    private static executeJavaScript(params: ExecuteCodeParams): Promise<ExecuteCodeResult> {
        const startTime = Date.now();
        return new Promise((resolve) => {
            const workerCode = `
                self.onmessage = async function(e) {
                    const { code } = e.data;
                    let logs = [];
                    const _log = console.log;
                    console.log = (...args) => {
                        logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
                    };
                    try {
                        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                        await new AsyncFunction(code)();
                        self.postMessage({ success: true, stdout: logs.join('\\n'), stderr: '' });
                    } catch (err) {
                        self.postMessage({ success: false, stdout: logs.join('\\n'), stderr: err.toString() });
                    } finally {
                        console.log = _log;
                    }
                };
            `;
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            const worker = new Worker(workerUrl);
            const timeoutId = setTimeout(() => {
                worker.terminate();
                URL.revokeObjectURL(workerUrl);
                resolve({ success: false, stdout: '', stderr: 'Execution timed out', exit_code: 1, execution_time: Date.now() - startTime, sandbox_mode: 'local_webworker', error_type: 'timeout' });
            }, (params.timeout || 30) * 1000);

            worker.onmessage = (e) => {
                clearTimeout(timeoutId);
                worker.terminate();
                URL.revokeObjectURL(workerUrl);
                resolve({ ...e.data, exit_code: e.data.success ? 0 : 1, execution_time: Date.now() - startTime, sandbox_mode: 'local_webworker', error_type: e.data.success ? null : 'execution_error' });
            };
            worker.onerror = (err) => {
                clearTimeout(timeoutId);
                worker.terminate();
                URL.revokeObjectURL(workerUrl);
                resolve({ success: false, stdout: '', stderr: err.message, exit_code: 1, execution_time: Date.now() - startTime, sandbox_mode: 'local_webworker', error_type: 'execution_error' });
            };
            worker.postMessage({ code: params.code });
        });
    }
}

export { LocalSandboxService as E2BService };
