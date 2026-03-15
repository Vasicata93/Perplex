import express from 'express';
import cors from 'cors';
import path from 'path';
import 'dotenv/config';
import { createServer as createViteServer } from 'vite';
import { handleExecute } from './routes/execute';
import { handleAgentMax } from './routes/agentMax';

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(cors());
    app.use(express.json({ limit: '1mb' }));

    // Agent Max Route
    app.post('/api/agent-max', handleAgentMax);

    // E2B Execution Route
    app.post('/api/execute', handleExecute);

    // Basic health check
    app.get('/api/health', (_req, res) => {
        res.json({ status: 'ok' });
    });

    // Diagnostic route to check if API_KEY is loaded
    app.get('/api/test-env', (_req, res) => {
        res.json({ 
            hasApiKey: !!(process.env.API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
            nodeEnv: process.env.NODE_ENV || 'development'
        });
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Server] Perplex Unified Server running on http://localhost:${PORT}`);
    });
}

startServer().catch(err => {
    console.error('Failed to start server:', err);
});
