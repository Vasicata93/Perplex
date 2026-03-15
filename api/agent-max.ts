import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Agent } from '@mastra/core/agent';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { ALL_AGENT_SKILLS } from '../src/agent/skills';

function getDynamicInstructions(intent: string) {
    const relevantSkills = ALL_AGENT_SKILLS.filter(skill =>
        intent.toLowerCase().includes(skill.name.toLowerCase()) ||
        intent.toLowerCase().includes(skill.id.split('_')[1])
    );
    if (relevantSkills.length === 0) return '';
    return `\n\nRELEVANT SKILLS ACTIVATED:\n${relevantSkills.map(s => `--- ${s.name} ---\n${s.instructions}`).join('\n\n')}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, threadId, provider, apiKey, modelId } = req.body;

    const getApiKey = () => {
        if (apiKey) return apiKey;
        if (provider === 'openrouter') return process.env.OPENROUTER_API_KEY;
        return process.env.API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    };

    const effectiveApiKey = getApiKey();
    if (!effectiveApiKey) {
        return res.status(400).json({ error: `API key missing for provider: ${provider}` });
    }

    let mastraModel: any;
    try {
        if (provider === 'openrouter') {
            const openrouter = createOpenRouter({ apiKey: effectiveApiKey });
            mastraModel = openrouter(modelId || 'google/gemini-pro');
        } else {
            const google = createGoogleGenerativeAI({ apiKey: effectiveApiKey });
            // Remove 'google/' prefix for the sdk if present to match model IDs
            const geminiModelId = (modelId || 'gemini-1.5-pro-latest').replace('google/', '');
            mastraModel = google(geminiModelId);
        }
    } catch (err: any) {
        return res.status(500).json({ error: `Model init failed: ${err.message}` });
    }

    try {
        const dynamicAgent = new Agent({
            id: `agent-max-${threadId || 'default'}`,
            name: 'Agent Max',
            instructions: `You are Agent Max, a high-performance assistant. Always lead with the most relevant information.`,
            model: mastraModel,
        });

        // Append dynamic skills to the prompt
        const fullPrompt = `${prompt}${getDynamicInstructions(prompt)}`;
        const result = await dynamicAgent.generate(fullPrompt);

        return res.status(200).json({ text: result.text, usage: result.usage });
    } catch (error: any) {
        console.error('[Agent Max Error]:', error);
        return res.status(500).json({ error: error.message });
    }
}