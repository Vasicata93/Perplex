export async function askAgentMax(
    prompt: string,
    threadId: string = 'default-max-thread',
    provider?: string,
    apiKey?: string,
    modelId?: string,
    tavilyApiKey?: string,
    braveApiKey?: string,
    searchProvider?: string,
    memoryContext?: string,
    calendarEvents?: any[],
    workspaceFiles?: any[],
    notes?: any[]
) {
    try {
        const response = await fetch('/api/agent-max', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt, threadId, provider, apiKey, modelId,
                tavilyApiKey, braveApiKey, searchProvider,
                memoryContext, calendarEvents, workspaceFiles, notes
            }),
        });

        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
            const text = await response.text();
            console.error('[Agent Max] Non-JSON response:', text);
            throw new Error(`Server returned non-JSON response (${response.status})`);
        }

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to reach Agent Max');
        return result;

    } catch (error: any) {
        console.error('[Agent Max Proxy Error]:', error);
        if (error.message?.includes('Unexpected end of JSON')) {
            throw new Error('Connection Error: Unexpected end of JSON input');
        }
        throw error;
    }
}
