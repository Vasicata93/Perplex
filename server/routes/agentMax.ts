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
    const effectiveApiKey = apiKey || (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : (process.env.API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY));
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
            Always lead with the most relevant information and use your tools to provide accurate data.`,
            model: {
                id: effectiveModelId,
                apiKey: effectiveApiKey,
                // Mastra handles different providers; for OpenRouter we might need specific logic if standard OpenAI/Gemini doesn't work.
                // But generally Mastra maps model IDs to providers.
            } as any
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
