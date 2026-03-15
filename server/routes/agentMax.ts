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

const agentMaxServer = new Agent({
    id: 'agent-max-server',
    name: 'Agent Max',
    instructions: `You are Agent Max, a high-performance Mastra-powered assistant. 
    You have advanced memory capabilities and access to professional skills.
    Always lead with the most relevant information and use your tools to provide accurate, real-time data.`,
    model: {
        id: 'google/gemini-1.5-pro-latest',
        apiKey: process.env.API_KEY
    } as any
});

export const handleAgentMax = async (req: Request, res: Response) => {
    try {
        const { prompt, threadId } = req.body;
        const dynamicInstructions = getDynamicInstructions(prompt);
        const fullPrompt = `${prompt}${dynamicInstructions}`;
        
        const result = await agentMaxServer.generate(fullPrompt, {
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
