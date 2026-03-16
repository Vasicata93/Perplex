// src/services/langflowService.ts
import { AppSettings, ModelProvider } from '../../types';

export interface LangflowResponse {
  text: string;
  sessionId: string;
}

export async function askLangflow(
  message: string,
  sessionId: string,
  settings: AppSettings
): Promise<LangflowResponse> {
  if (!settings.langflowEnabled) {
    throw new Error('Langflow nu este activat în Settings');
  }

  const body: Record<string, any> = {
    message,
    sessionId,
    flowId: settings.langflowFlowId,
    langflowUrl: settings.langflowUrl,
    langflowApiKey: settings.langflowApiKey,
  };

  // Sincronizare OpenRouter — trimite key+model din Settings
  // astfel flow-ul Langflow folosește același model selectat în Perplex
  if (
    settings.langflowSyncOpenRouter &&
    settings.modelProvider === ModelProvider.OPENROUTER &&
    settings.openRouterApiKey &&
    settings.openRouterModelId
  ) {
    body.openRouterApiKey = settings.openRouterApiKey;
    body.openRouterModelId = settings.openRouterModelId;
  }

  const response = await fetch('/api/langflow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Eroare necunoscută' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  return response.json();
}
