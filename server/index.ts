import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { handleExecute } from './routes/execute';
import { handleLangflow } from './routes/langflow';

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(cors());
    app.use(express.json({ limit: '1mb' }));

    // E2B Execution Route
    app.post('/api/execute', handleExecute);
    app.post('/api/langflow', handleLangflow);

    // Basic health check
    app.get('/api/health', (req, res) => {
        res.json({ status: 'ok' });
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
        
        // Fallback to index.html for SPA routing in development
        app.use('*', async (req, res) => {
            try {
                const url = req.originalUrl || '/';
                const indexPath = path.resolve(process.cwd(), 'index.html');
                let template = fs.readFileSync(indexPath, 'utf-8');
                template = await vite.transformIndexHtml(url, template);
                res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
            } catch (e: any) {
                console.error('Error serving index.html:', e.message);
                res.status(500).end('Internal Server Error');
            }
        });
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
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
