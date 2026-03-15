import { Sandbox } from '@e2b/code-interpreter';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { code, language, timeout = 30, packages = [], session_id, apiKey: rawApiKey } = req.body;
    const apiKey = rawApiKey?.trim();

    if (!apiKey) {
        return res.status(200).json({ error_type: 'api_key_missing', success: false, sandbox_mode: 'e2b_cloud' });
    }

    console.log(`[E2B] Attempting execution. Key: ${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`);

    try {
        const startTime = Date.now();

        // Determine sandbox creation options

        let sandbox;
        if (session_id) {
            try {
                // e2b SDK allows Sandbox.connect for existing sessions
                sandbox = await Sandbox.connect(session_id, { apiKey });
            } catch (e) {
                sandbox = await Sandbox.create({ apiKey });
            }
        } else {
            sandbox = await Sandbox.create({ apiKey });
        }


        // Install packages if any
        if (packages.length > 0) {
            const pkgStr = packages.join(' ');
            if (language === 'python') {
                await sandbox.commands.run(`pip install ${pkgStr}`);
            } else if (language === 'typescript' || language === 'javascript') {
                await sandbox.commands.run(`npm install ${pkgStr}`);
            }
        }

        // Execute code
        let execResult;
        let fileExt = language === 'python' ? 'py' : language === 'typescript' ? 'ts' : 'js';
        let command = language === 'python' ? `python /tmp/script.${fileExt}` : language === 'typescript' ? `npx tsx /tmp/script.${fileExt}` : `node /tmp/script.${fileExt}`;
        
        // Write the script to a file
        await sandbox.files.write(`/tmp/script.${fileExt}`, code);

        // Run the script
        execResult = await sandbox.commands.run(command, { timeoutMs: timeout * 1000 });

        const execution_time = Date.now() - startTime;

        // If not using a persistent session, we should kill the sandbox if we want.
        // Wait, the spec says: "If the execution was per-request (no session_id), destroy the sandbox immediately after execution."
        if (!session_id && sandbox) {
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
        console.error(`[E2B] Error: ${error.message}`, error);
        const isTimeout = error.message?.toLowerCase().includes('timeout');
        const isAuthError = error.message?.toLowerCase().includes('unauthorized') || error.message?.toLowerCase().includes('apiKey');
        
        return res.status(200).json({
            success: false,
            stdout: '',
            stderr: error.message,
            exit_code: 1,
            execution_time: 0,
            sandbox_mode: 'e2b_cloud',
            error_type: isTimeout ? 'timeout' : isAuthError ? 'execution_error' : 'execution_error'
        });
    }
}
