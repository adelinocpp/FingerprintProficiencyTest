import { ApiResponse, LoginRequest, RegisterRequest, ResultSubmission } from '../types/index';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Flag para evitar múltiplas tentativas de refresh simultâneas
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Tenta renovar o access token usando o refresh token
 */
async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  // Se já está renovando, aguarda a tentativa em andamento
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const data = await response.json();

      if (data.success && data.data?.token && data.data?.refresh_token) {
        saveToken(data.data.token);
        saveRefreshToken(data.data.refresh_token);
        return true;
      }

      // Refresh falhou - limpa tokens
      removeToken();
      removeRefreshToken();
      return false;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Faz requisição HTTP com auto-refresh de token
 */
async function request<T>(
  endpoint: string,
  options: RequestInit & { token?: string; _retried?: boolean } = {}
): Promise<ApiResponse<T>> {
  const { token, _retried, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (fetchOptions.headers) {
    Object.assign(headers, fetchOptions.headers);
  }

  // Usa token passado explicitamente ou o armazenado
  const authToken = token || getToken();
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    const data = await response.json();

    // Se 401 e não é retry, tenta refresh
    if (response.status === 401 && !_retried && !endpoint.includes('/auth/')) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        // Retry com novo token
        return request<T>(endpoint, { ...options, _retried: true });
      }
    }

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Erro na requisição');
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      message: (error as Error).message,
    };
  }
}

// Auth API
export const authAPI = {
  register: (data: RegisterRequest) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: LoginRequest) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  refresh: (refreshToken: string) =>
    request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  logout: (refreshToken: string | null) =>
    request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  checkEmailExists: (email: string) =>
    request(`/auth/check-email?email=${encodeURIComponent(email)}`, {
      method: 'GET',
    }),

  checkCodeExists: (code: string) =>
    request(`/auth/check-code?code=${encodeURIComponent(code)}`, {
      method: 'GET',
    }),
};

// Participant API
export const participantAPI = {
  getMe: (token: string) =>
    request('/participant/me', {
      method: 'GET',
      token,
    }),

  updateMe: (token: string, data: any) =>
    request('/participant/me', {
      method: 'PUT',
      token,
      body: JSON.stringify(data),
    }),
};

// Samples API
export const samplesAPI = {
  getAll: (token: string) =>
    request('/samples', {
      method: 'GET',
      token,
    }),

  getOne: (token: string, sampleId: string) =>
    request(`/samples/${sampleId}`, {
      method: 'GET',
      token,
    }),

  getProgress: (token: string, sampleId: string) =>
    request(`/samples/${sampleId}/progress`, {
      method: 'GET',
      token,
    }),

  getGroups: (token: string, sampleId: string) =>
    request(`/samples/${sampleId}/groups`, {
      method: 'GET',
      token,
    }),
};

// Groups API
export const groupsAPI = {
  getOne: (token: string, groupId: string) =>
    request(`/groups/${groupId}`, {
      method: 'GET',
      token,
    }),

  getImages: (token: string, groupId: string) =>
    request(`/groups/${groupId}/images`, {
      method: 'GET',
      token,
    }),
};

// Results API
export const resultsAPI = {
  submit: (token: string, data: ResultSubmission) =>
    request('/results/submit', {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    }),

  getStatistics: (token: string) =>
    request('/results/statistics', {
      method: 'GET',
      token,
    }),

  getGroupResult: (token: string, groupId: string) =>
    request(`/results/group/${groupId}`, {
      method: 'GET',
      token,
    }),

  getSampleResults: (token: string, sampleId: string) =>
    request(`/results/sample/${sampleId}`, {
      method: 'GET',
      token,
    }),
};

/**
 * Salva access token no localStorage
 */
export function saveToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

/**
 * Obtém access token do localStorage
 */
export function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

/**
 * Remove access token do localStorage
 */
export function removeToken(): void {
  localStorage.removeItem('auth_token');
}

/**
 * Salva refresh token no localStorage
 */
export function saveRefreshToken(token: string): void {
  localStorage.setItem('refresh_token', token);
}

/**
 * Obtém refresh token do localStorage
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem('refresh_token');
}

/**
 * Remove refresh token do localStorage
 */
export function removeRefreshToken(): void {
  localStorage.removeItem('refresh_token');
}

/**
 * Verifica se usuário está autenticado
 */
export function isAuthenticated(): boolean {
  return !!getToken();
}

/**
 * Decodifica token JWT (sem validação)
 */
export function decodeToken(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
}
