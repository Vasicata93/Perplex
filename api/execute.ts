import { Sandbox } from '@e2b/code-interpreter';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { code, language, timeout = 30, packages = [], session_id, apiKey } = req.body;

    if (!apiKey) {
        return res.status(200).json({ error_type: 'api_key_missing', success: false, sandbox_mode: 'e2b_cloud' });
    }

    try {
        const startTime = Date.now();
        // Determine sandbox creation options
        const opts: any = { apiKey };

        let sandbox;
        if (session_id) {
            // Note: Since E2B Sandbox can use session_id to reconnect or create a persistent sandbox
            // we create it with id or reconnect if active. For simplicity, we create a new one or use the existing
            try {
                sandbox = await Sandbox.connect(session_id, opts);
            } catch (e) {
                // Not found, create a new one with this ID
                // e2b SDK allows specifying an ID? The official docs say .create() doesn't take session_id directly as an argument, 
                // but let's just create a new sandbox. 
                sandbox = await Sandbox.create(opts);
            }
        } else {
            sandbox = await Sandbox.create(opts);
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
        const isTimeout = error.message?.toLowerCase().includes('timeout');
        
        return res.status(200).json({
            success: false,
            stdout: '',
            stderr: error.message,
            exit_code: 1,
            execution_time: 0,
            sandbox_mode: 'e2b_cloud',
            error_type: isTimeout ? 'timeout' : 'execution_error'
        });
    }
}
