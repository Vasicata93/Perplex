
import { Request, Response } from 'express';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';

// For the server-side, we'll use a stateless version or simpler storage for now.
// Real persistent memory for Agent Max is on the client via IndexedDB.
const agentMaxServer = new Agent({
    name: 'Agent Max Server',
    instructions: 'You are the backend component of Agent Max. You handle server-side tasks or proxy requests when needed.',
    model: {
        id: 'google/gemini-1.5-pro-latest',
        apiKey: process.env.API_KEY
    }
});

export const handleAgentMax = async (req: Request, res: Response) => {
    try {
        const { prompt, threadId } = req.body;
        
        const result = await agentMaxServer.generate(prompt, {
            threadId: threadId || 'backend-default'
        });
        
        res.json({
            text: result.text,
            usage: result.usage
        });
    } catch (error: any) {
        console.error('[Agent Max Route Error]:', error);
        res.status(500).json({ error: error.message });
    }
};
