import { Request, Response } from 'express';

// Ruta /api/execute nu mai este necesară — execuția se face local în browser.
// Păstrăm endpoint-ul activ dar îl facem no-op pentru compatibilitate.
export const handleExecute = async (req: Request, res: Response) => {
    res.status(200).json({
        success: false,
        stdout: '',
        stderr: 'Server-side execution is disabled. All code runs locally in the browser.',
        exit_code: 1,
        sandbox_mode: 'local_fallback',
        error_type: 'execution_error'
    });
};
