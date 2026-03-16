import { Request, Response } from 'express';
import { Sandbox } from '@e2b/code-interpreter';
import { sessionManager } from '../sessions';

export const handleExecute = async (req: Request, res: Response) => {
    const { code, language, timeout = 30, packages = [], session_id, apiKey: rawApiKey } = req.body;
    const apiKey = rawApiKey?.trim();

    if (!apiKey) {
        return res.status(200).json({
            success: false,
            stdout: "",
            stderr: "E2B API key is missing",
            exit_code: 1,
            sandbox_mode: "e2b_cloud",
            error_type: "api_key_missing"
        });
    }

    try {
        const startTime = Date.now();
        let sandbox: Sandbox;

        if (session_id) {
            sandbox = await sessionManager.getOrCreateSandbox(session_id, apiKey);
        } else {
            // Create a standard sandbox
            sandbox = await Sandbox.create({ apiKey });
        }

        // Install packages if requested
        if (packages && Array.isArray(packages) && packages.length > 0) {
            const pkgStr = packages.join(' ');
            if (language === 'python') {
                await sandbox.commands.run(`pip install ${pkgStr}`);
            } else if (language === 'typescript' || language === 'javascript') {
                await sandbox.commands.run(`npm install ${pkgStr}`);
            }
        }

        // Determine execution command based on language
        let fileExt = language === 'python' ? 'py' : language === 'typescript' ? 'ts' : 'js';
        let command = language === 'python'
            ? `python3 /tmp/script.${fileExt}`
            : (language === 'typescript' ? `npx tsx /tmp/script.${fileExt}` : `node /tmp/script.${fileExt}`);

        // Write script to sandbox
        await sandbox.files.write(`/tmp/script.${fileExt}`, code);

        // Run the command
        const execResult = await sandbox.commands.run(command, { timeoutMs: timeout * 1000 });

        const execution_time = Date.now() - startTime;

        // Cleanup if no session
        if (!session_id) {
            await sandbox.kill();
        }

        return res.status(200).json({
            success: execResult.exitCode === 0,
            stdout: execResult.stdout,
            stderr: execResult.stderr,
            exit_code: execResult.exitCode,
            execution_time,
            sandbox_mode: 'e2b_cloud',
            error_type: null
        });

    } catch (error: any) {
        console.error(`[E2B Error]`, error);

        const isTimeout = error.message?.toLowerCase().includes('timeout');
        const isAuthError = error.message?.toLowerCase().includes('api key') || error.message?.toLowerCase().includes('unauthorized');

        return res.status(200).json({
            success: false,
            stdout: '',
            stderr: error.message || "Unknown execution error",
            exit_code: 1,
            execution_time: 0,
            sandbox_mode: 'e2b_cloud',
            error_type: isAuthError ? 'api_key_invalid' : (isTimeout ? 'timeout' : 'execution_error')
        });
    }
};
