import * as webllm from "@mlc-ai/web-llm";

const CUSTOM_MODEL_RECORDS: Record<string, webllm.ModelRecord> = {
  'LFM2-1B-MLC': {
    model: 'https://huggingface.co/mlc-ai/LFM2-1B-Instruct-q4f16_1-MLC',
    model_id: 'LFM2-1B-Instruct-q4f16_1-MLC',
    model_lib:
      webllm.modelLibURLPrefix +
      webllm.modelVersion +
      '/LFM2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm',
    vram_required_MB: 850,
    low_resource_required: true,
    overrides: { context_window_size: 4096 },
  },
};

class WebLLMService {
  private engine: webllm.MLCEngine | null = null;
  private currentModelId: string | null = null;
  private _isLoading: boolean = false;
  // Flag setat de UI când userul apasă Cancel
  private _cancelRequested: boolean = false;

  /**
   * Încarcă modelul cu progres smooth și suport cancel.
   * onProgress(percent, text, phase)
   * - percent: 0-100, GARANTAT monoton crescător (nu scade niciodată)
   * - text: descriere fază curentă
   * - phase: 'fetch' | 'cache' | 'init' | 'done'
   */
  async loadModel(
    modelId: string,
    onProgress?: (progress: number, text: string, phase: string) => void
  ): Promise<'success' | 'cancelled'> {
    if (this.engine && this.currentModelId === modelId) return 'success';

    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
      this.currentModelId = null;
    }

    this._isLoading = true;
    this._cancelRequested = false;

    // Progres smooth — nu permite scăderi
    let lastReportedPercent = 0;
    // WebLLM raportează 3 faze, fiecare 0→1.
    // Le mapăm în segmente: fetch=0-60%, cache=60-90%, init=90-99%
    let currentPhase = 'fetch';
    let phaseOffset = 0;
    let phaseScale = 60;

    const detectPhase = (text: string): { offset: number; scale: number; phase: string } => {
      const t = text.toLowerCase();
      if (t.includes('cache') || t.includes('loading cache')) {
        return { offset: 60, scale: 30, phase: 'cache' };
      }
      if (t.includes('init') || t.includes('model loading') || t.includes('compiling')) {
        return { offset: 90, scale: 9, phase: 'init' };
      }
      return { offset: 0, scale: 60, phase: 'fetch' };
    };

    const initConfig: webllm.MLCEngineConfig = {
      initProgressCallback: (report: webllm.InitProgressReport) => {
        const phaseInfo = detectPhase(report.text);
        phaseOffset = phaseInfo.offset;
        phaseScale = phaseInfo.scale;
        currentPhase = phaseInfo.phase;

        const rawPercent = phaseOffset + Math.round(report.progress * phaseScale);
        // GARANTAT monoton — nu permite scăderi
        const smoothPercent = Math.max(lastReportedPercent, Math.min(rawPercent, 99));
        lastReportedPercent = smoothPercent;

        onProgress?.(smoothPercent, report.text, currentPhase);
      },
    };

    try {
      const customRecord = CUSTOM_MODEL_RECORDS[modelId];
      if (customRecord) {
        this.engine = await webllm.CreateMLCEngine(
          customRecord.model_id,
          { ...initConfig, appConfig: { model_list: [customRecord] } }
        );
        this.currentModelId = modelId;
      } else {
        this.engine = await webllm.CreateMLCEngine(modelId, initConfig);
        this.currentModelId = modelId;
      }

      // Verifică dacă userul a anulat în timp ce așteptam
      if (this._cancelRequested) {
        await this.unload();
        return 'cancelled';
      }

      return 'success';
    } finally {
      this._isLoading = false;
      this._cancelRequested = false;
    }
  }

  /** Apelat de UI când userul apasă butonul Cancel */
  cancelLoad(): void {
    this._cancelRequested = true;
  }

  async *streamChat(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    temperature = 0.7,
    maxTokens = 1024
  ): AsyncGenerator<string> {
    if (!this.engine) throw new Error('[WebLLM] No model loaded.');
    const stream = await this.engine.chat.completions.create({
      messages, temperature, max_tokens: maxTokens, stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  async chat(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    temperature = 0.7,
    maxTokens = 1024
  ): Promise<string> {
    let result = '';
    for await (const chunk of this.streamChat(messages, temperature, maxTokens)) result += chunk;
    return result;
  }

  isModelLoaded(modelId: string): boolean {
    return this.currentModelId === modelId && this.engine !== null;
  }

  get loading(): boolean { return this._isLoading; }
  get activeModelId(): string | null { return this.currentModelId; }

  async unload(): Promise<void> {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
      this.currentModelId = null;
    }
  }
}

export const webLLMService = new WebLLMService();