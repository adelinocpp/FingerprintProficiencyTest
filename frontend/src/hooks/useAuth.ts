import { useState, useCallback, useEffect } from 'react';
import { Participant, LoginRequest, RegisterRequest } from '@types/index';
import { authAPI, saveToken, getToken, removeToken, decodeToken } from '@services/api';

export interface UseAuthReturn {
  participant: Participant | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  register: (data: RegisterRequest) => Promise<boolean>;
  login: (data: LoginRequest) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

/**
 * Hook para gerenciar autenticação
 */
export function useAuth(): UseAuthReturn {
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega token do localStorage na inicialização
  useEffect(() => {
    const savedToken = getToken();
    if (savedToken) {
      setToken(savedToken);
      // Valida token
      const decoded = decodeToken(savedToken);
      if (decoded && decoded.exp * 1000 > Date.now()) {
        // Token ainda é válido
      } else {
        // Token expirado
        removeToken();
        setToken(null);
      }
    }
  }, []);

  const register = useCallback(
    async (data: RegisterRequest): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await authAPI.register(data);

        if (!response.success) {
          setError(response.message || 'Erro ao registrar');
          return false;
        }

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const login = useCallback(
    async (data: LoginRequest): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await authAPI.login(data);

        if (!response.success || !response.data) {
          setError(response.message || 'Erro ao fazer login');
          return false;
        }

        const { token: newToken, participant: newParticipant } = response.data;

        saveToken(newToken);
        setToken(newToken);
        setParticipant(newParticipant);

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    removeToken();
    setToken(null);
    setParticipant(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    participant,
    token,
    isLoading,
    isAuthenticated: !!token && !!participant,
    error,
    register,
    login,
    logout,
    clearError,
  };
}
