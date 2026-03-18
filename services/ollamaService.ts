export const ollamaService = {
    async checkAvailability(url = 'http://localhost:11434'): Promise<{ available: boolean; models: string[] }> {
        try {
            const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(2000) });
            if (!res.ok) return { available: false, models: [] };

            const data = await res.json();
            const models = data.models?.map((m: any) => m.name) ?? [];
            return { available: true, models };
        } catch (e) {
            return { available: false, models: [] };
        }
    }
};