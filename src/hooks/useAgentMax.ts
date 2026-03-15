
import { useState, useCallback } from 'react';
import { askAgentMax } from '../services/agentMaxService';

export function useAgentMax() {
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAgentMax = useCallback(() => {
    setIsActive(prev => !prev);
  }, []);

  const sendMessageToMax = useCallback(async (prompt: string, threadId?: string) => {
    if (!isActive) return null;
    
    setIsLoading(true);
    setError(null);
    try {
      const result = await askAgentMax(prompt, threadId);
      return result;
    } catch (err: any) {
      setError(err.message || 'Error communicating with Agent Max');
      console.error('[Agent Max Hook Error]:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isActive]);

  return {
    isActive,
    toggleAgentMax,
    sendMessageToMax,
    isLoading,
    error
  };
}
