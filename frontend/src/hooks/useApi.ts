import { useState, useCallback } from 'react';
import { ApiResponse } from '@types/index';

export interface UseApiReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  execute: (fn: () => Promise<ApiResponse<T>>) => Promise<T | null>;
  reset: () => void;
}

/**
 * Hook para fazer requisições de API
 */
export function useApi<T>(): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (fn: () => Promise<ApiResponse<T>>): Promise<T | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fn();

        if (!response.success) {
          setError(response.message || 'Erro na requisição');
          return null;
        }

        if (response.data) {
          setData(response.data);
          return response.data;
        }

        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    data,
    isLoading,
    error,
    execute,
    reset,
  };
}
