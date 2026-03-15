import { Request, Response } from 'express';
import { Agent } from '@mastra/core/agent';
import { ALL_AGENT_SKILLS } from '../../src/agent/skills';

// Skills injection logic (reused from previous client implementation)
function getDynamicInstructions(intent: string) {
    const relevantSkills = ALL_AGENT_SKILLS.filter(skill =>
        intent.toLowerCase().includes(skill.name.toLowerCase()) ||
        intent.toLowerCase().includes(skill.id.split('_')[1])
    );

    if (relevantSkills.length === 0) return '';

    return `\n\nRELEVANT SKILLS ACTIVATED:\n${relevantSkills.map(s => `--- ${s.name} ---\n${s.instructions}`).join('\n\n')}`;
}

export const handleAgentMax = async (req: Request, res: Response) => {
    const { prompt, threadId, provider, apiKey, modelId } = req.body;

    console.log(`[Agent Max] Request for thread: ${threadId} | Provider: ${provider} | Model: ${modelId}`);

    // Resolve credentials: use provided ones or fallback to server env
    const getApiKeyForProvider = () => {
        if (apiKey) return apiKey;
        if (provider === 'openrouter') return process.env.OPENROUTER_API_KEY;
        // Default to Google/Gemini key
        return process.env.API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    };

    const effectiveApiKey = getApiKeyForProvider();
    const effectiveModelId = modelId || 'google/gemini-1.5-pro-latest';

    if (!effectiveApiKey) {
        console.error('[Agent Max] ERROR: API_KEY is missing for provider:', provider);
        return res.status(400).json({ error: `API_KEY is missing for provider: ${provider}. Please check your settings.` });
    }

    try {
        // Create a dynamic agent for this request
        const dynamicAgent = new Agent({
            id: `agent-max-${threadId || 'default'}`,
            name: 'Agent Max',
            instructions: `You are Agent Max, a high-performance assistant. 
            You have access to professional skills.
            Always lead with the most relevant information.`,
            model: {
                provider: provider, // CRITICAL: Specify the provider (e.g., 'google', 'openrouter')
                id: effectiveModelId,
                apiKey: effectiveApiKey,
                // Add baseURL for OpenRouter as it's a non-standard endpoint
                ...(provider === 'openrouter' && { baseURL: 'https://openrouter.ai/api/v1' }),
            },
            // Agent Max currently does not use tools as per this simplified implementation.
        });

        const dynamicInstructions = getDynamicInstructions(prompt);
        const fullPrompt = `${prompt}${dynamicInstructions}`;

        const result = await dynamicAgent.generate(fullPrompt, {
            memory: {
                thread: threadId || 'backend-default',
                resource: 'server-root'
            } as any
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
