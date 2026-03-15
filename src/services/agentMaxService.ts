
// Client proxy for Agent Max. Calls the server route to avoid bundling heavy Node.js-based Mastra core in the browser.
export async function askAgentMax(prompt: string, threadId: string = 'default-max-thread') {
    try {
        const response = await fetch('/api/agent-max', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, threadId }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to reach Agent Max');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('[Agent Max Proxy Error]:', error);
        throw error;
    }
}
