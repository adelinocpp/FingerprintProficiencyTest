import { ApiResponse, LoginRequest, RegisterRequest, ResultSubmission } from '@types/index';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Faz requisição HTTP
 */
async function request<T>(
  endpoint: string,
  options: RequestInit & { token?: string } = {}
): Promise<ApiResponse<T>> {
  const { token, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Erro na requisição');
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
 * Salva token no localStorage
 */
export function saveToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

/**
 * Obtém token do localStorage
 */
export function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

/**
 * Remove token do localStorage
 */
export function removeToken(): void {
  localStorage.removeItem('auth_token');
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
