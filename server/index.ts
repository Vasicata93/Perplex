import express from 'express';
import cors from 'cors';
import { handleExecute } from './routes/execute';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// E2B Execution Route
app.post('/api/execute', handleExecute);

// Basic health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});


app.listen(PORT, () => {
    console.log(`[Server] Perplex API running on http://localhost:${PORT}`);
    console.log(`[Server] Proxy target for /api/execute is active.`);
});
