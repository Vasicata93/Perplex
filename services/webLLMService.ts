import * as webllm from "@mlc-ai/web-llm";

// ─────────────────────────────────────────────
// Singleton Engine Manager
// ─────────────────────────────────────────────
class WebLLMService {
    private engine: webllm.MLCEngine | null = null;
    private currentModelId: string | null = null;
    private isLoading: boolean = false;

    /**
     * Loads (or reuses) a model engine.
     * @param modelId  — modelId from LocalModelConfig (e.g. "Llama-3.2-1B-Instruct-q4f16_1")
     * @param onProgress — callback for download/init progress (0–100)
     */
    async loadModel(
        modelId: string,
        onProgress?: (progress: number, text: string) => void
    ): Promise<void> {
        // Already loaded — skip
        if (this.engine && this.currentModelId === modelId) return;

        // Unload previous engine
        if (this.engine) {
            await this.engine.unload();
            this.engine = null;
            this.currentModelId = null;
        }

        this.isLoading = true;

        try {
            this.engine = await webllm.CreateMLCEngine(modelId, {
                initProgressCallback: (report: webllm.InitProgressReport) => {
                    const percent = Math.round(report.progress * 100);
                    onProgress?.(percent, report.text);
                },
            });
            this.currentModelId = modelId;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Streams a chat completion using the loaded model.
     * Throws if no model is loaded.
     */
    async *streamChat(
        messages: { role: "system" | "user" | "assistant"; content: string }[],
        temperature = 0.7,
        maxTokens = 1024
    ): AsyncGenerator<string> {
        if (!this.engine) {
            throw new Error("[WebLLM] No model loaded. Call loadModel() first.");
        }

        const stream = await this.engine.chat.completions.create({
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: true,
        });

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) yield delta;
        }
    }

    /** Check if a specific model is currently loaded */
    isModelLoaded(modelId: string): boolean {
        return this.currentModelId === modelId && this.engine !== null;
    }

    /** Check if any model is currently being initialized */
    get loading(): boolean {
        return this.isLoading;
    }

    /** Currently active model ID */
    get activeModelId(): string | null {
        return this.currentModelId;
    }

    /** Unload engine to free memory */
    async unload(): Promise<void> {
        if (this.engine) {
            await this.engine.unload();
            this.engine = null;
            this.currentModelId = null;
        }
    }
}

// Export singleton
export const webLLMService = new WebLLMService();