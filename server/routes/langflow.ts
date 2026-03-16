import { Request, Response } from 'express';

export async function handleLangflow(req: Request, res: Response) {
  const {
    message,
    sessionId,
    flowId,
    langflowUrl,
    langflowApiKey,
    // OpenRouter params — trimise din frontend când syncOpenRouter e true
    openRouterApiKey,
    openRouterModelId,
  } = req.body;

  if (!message || !flowId) {
    return res.status(400).json({ error: 'message și flowId sunt obligatorii' });
  }

  const baseUrl = langflowUrl || process.env.LANGFLOW_URL || 'http://localhost:7860';
  const apiKey = langflowApiKey || process.env.LANGFLOW_API_KEY || '';

  // Construim payload-ul pentru Langflow
  // Dacă sync OpenRouter e activ, trimitem tweaks ca să suprascrie
  // modelul și API key-ul din flow cu cele din Settings Perplex
  const tweaks: Record<string, any> = {};

  if (openRouterApiKey && openRouterModelId) {
    // Numele nodului OpenRouter din flow este "OpenRouter-XXXXX"
    // Langflow acceptă tweaks ca { "ComponentType-NodeId": { field: value } }
    // Folosim wildcard pe tipul componentei
    tweaks['OpenRouterComponent'] = {
      api_key: openRouterApiKey,
      model_name: openRouterModelId,
    };
    // Fallback — unele versiuni Langflow cer numele exact al nodului
    tweaks['OpenRouter'] = {
      api_key: openRouterApiKey,
      model_name: openRouterModelId,
    };
  }

  const payload: Record<string, any> = {
    input_type: 'chat',
    output_type: 'chat',
    input_value: message,
    session_id: sessionId || crypto.randomUUID(),
  };

  if (Object.keys(tweaks).length > 0) {
    payload.tweaks = tweaks;
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const response = await fetch(
      `${baseUrl}/api/v1/run/${flowId}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        // Timeout de 120s — agentul poate folosi multiple tool calls
        signal: AbortSignal.timeout(120_000),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Langflow] Error response:', errText);
      return res.status(response.status).json({
        error: `Langflow error ${response.status}`,
        details: errText,
      });
    }

    const data = await response.json();

    // Extrage textul din structura de răspuns Langflow
    // Structura: outputs[0].outputs[0].results.message.text
    // sau:       outputs[0].outputs[0].messages[0].message
    const text =
      data?.outputs?.[0]?.outputs?.[0]?.results?.message?.text ||
      data?.outputs?.[0]?.outputs?.[0]?.messages?.[0]?.message ||
      data?.outputs?.[0]?.outputs?.[0]?.artifacts?.message ||
      (typeof data?.outputs?.[0]?.outputs?.[0]?.results === 'string'
        ? data.outputs[0].outputs[0].results
        : null) ||
      JSON.stringify(data);

    return res.json({ text, sessionId: payload.session_id });
  } catch (err: any) {
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Langflow timeout după 120s' });
    }
    console.error('[Langflow] Fetch error:', err);
    return res.status(500).json({ error: err.message });
  }
}
