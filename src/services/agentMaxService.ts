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

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('[Agent Max] Non-JSON response received:', text);
            throw new Error(`Server returned non-JSON response (${response.status}). See console for details.`);
        }

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to reach Agent Max');
        }

        return result;
    } catch (error: any) {
        console.error('[Agent Max Proxy Error]:', error);
        // Ensure we provide a clear message even if it's a "Unexpected end of JSON input"
        if (error.message.includes('Unexpected end of JSON input')) {
            throw new Error('Connection Error: Server closed the connection unexpectedly. The AI might be taking too long or the server crashed.');
        }
        throw error;
    }
}
