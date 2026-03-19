import express from 'express';
import cors from 'cors';
import path from 'path';
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
    app.get('/api/health', (_req, res) => {
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
        app.use('*', async (_req, res) => {
            try {
                const url = _req.originalUrl || '/';
                const template = await vite.transformIndexHtml(url, `<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>Perplex Clone</title>
    <meta name="theme-color" content="#191A1A" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="icon" href="/logo.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/logo.svg">
    <meta name="description" content="A high-fidelity clone of Perplex AI.">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/index.tsx"><\/script>
  </body>
</html>`);
                res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
            } catch (e: any) {
                console.error('Error transforming index.html:', e.message);
                res.status(500).end('Internal Server Error');
            }
        });
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
