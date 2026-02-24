import { useState, useCallback, useEffect } from 'react';
import { Participant, LoginRequest, RegisterRequest } from '../types/index';
import {
  authAPI,
  saveToken, getToken, removeToken,
  saveRefreshToken, getRefreshToken, removeRefreshToken,
  decodeToken,
} from '../services/api';

export interface UseAuthReturn {
  participant: Participant | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  register: (data: RegisterRequest) => Promise<any>;
  login: (data: LoginRequest) => Promise<any>;
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
      const decoded = decodeToken(savedToken);
      if (decoded && decoded.exp * 1000 > Date.now()) {
        setToken(savedToken);
      } else {
        // Access token expirado - tenta refresh
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          authAPI.refresh(refreshToken).then((res: any) => {
            if (res.success && res.data?.token) {
              saveToken(res.data.token);
              if (res.data.refresh_token) {
                saveRefreshToken(res.data.refresh_token);
              }
              setToken(res.data.token);
            } else {
              removeToken();
              removeRefreshToken();
            }
          });
        } else {
          removeToken();
        }
      }
    }
  }, []);

  const register = useCallback(
    async (data: RegisterRequest): Promise<any> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await authAPI.register(data);

        if (!response.success) {
          setError(response.message || 'Erro ao registrar');
          return response;
        }

        return response;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const login = useCallback(
    async (data: LoginRequest): Promise<any> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await authAPI.login(data);

        if (!response.success || !response.data) {
          setError(response.message || response.error || 'Erro ao fazer login');
          return response;
        }

        const { token: newToken, refresh_token: newRefreshToken, participant: newParticipant } = response.data as any;

        saveToken(newToken);
        setToken(newToken);
        setParticipant(newParticipant);

        // Salva refresh token se recebido
        if (newRefreshToken) {
          saveRefreshToken(newRefreshToken);
        }

        return response;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    // Invalida refresh token no servidor (best-effort)
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      authAPI.logout(refreshToken).catch(() => {});
    }

    removeToken();
    removeRefreshToken();
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
