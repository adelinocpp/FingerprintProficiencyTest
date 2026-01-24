import { verifyToken } from '@utils/security';
import { logger } from './logger';
import { JwtPayload } from '../types/index';

/**
 * Extrai token do header Authorization
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Valida token JWT
 */
export function validateAuthToken(token: string | null): JwtPayload | null {
  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    logger.warn('Token inválido ou expirado');
    return null;
  }

  return payload;
}

/**
 * Cria middleware de autenticação
 */
export function createAuthMiddleware(app: any) {
  return app.derive(({ request, set }: any) => {
    const authHeader = request.headers.get('authorization');
    const token = extractToken(authHeader);
    const payload = validateAuthToken(token);

    if (!payload) {
      set.status = 401;
      throw new Error('Não autorizado');
    }

    return {
      user: payload
    };
  });
}

/**
 * Verifica se usuário está autenticado
 */
export function isAuthenticated(user: JwtPayload | undefined): boolean {
  return !!user && !!user.participant_id;
}

/**
 * Valida se o participante é o dono do recurso
 */
export function isResourceOwner(
  user: JwtPayload | undefined,
  resourceOwnerId: string
): boolean {
  return isAuthenticated(user) && user!.participant_id === resourceOwnerId;
}

/**
 * Middleware para verificar autenticação obrigatória
 */
export function requireAuth() {
  return {
    beforeHandle: ({ request, set }: any) => {
      const authHeader = request.headers.get('authorization');
      const token = extractToken(authHeader);
      const payload = validateAuthToken(token);

      if (!payload) {
        set.status = 401;
        return {
          success: false,
          error: 'Não autorizado',
          message: 'Token de autenticação necessário',
        };
      }

      request.user = payload;
    },
  };
}

/**
 * Middleware para verificar CSRF token
 */
export function verifyCsrfToken() {
  return {
    beforeHandle: ({ request, set }: any) => {
      // CSRF check apenas para métodos que modificam dados
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
        const csrfToken = request.headers.get('x-csrf-token');
        const sessionCsrfToken = request.cookies?.csrf_token;

        if (!csrfToken || !sessionCsrfToken || csrfToken !== sessionCsrfToken) {
          set.status = 403;
          return {
            success: false,
            error: 'CSRF validation failed',
            message: 'Token CSRF inválido',
          };
        }
      }
    },
  };
}

/**
 * Middleware para rate limiting
 */
export function createRateLimitMiddleware(
  windowMs: number = 15 * 60 * 1000, // 15 minutos
  maxRequests: number = 100
) {
  const requestCounts = new Map<string, number[]>();

  return {
    beforeHandle: ({ request, set }: any) => {
      const ip = request.headers.get('x-forwarded-for') || 'unknown';
      const now = Date.now();

      // Limpa requisições antigas
      const userRequests = requestCounts.get(ip) || [];
      const recentRequests = userRequests.filter((time) => now - time < windowMs);

      if (recentRequests.length >= maxRequests) {
        set.status = 429;
        return {
          success: false,
          error: 'Too many requests',
          message: 'Muitas requisições. Tente novamente mais tarde.',
        };
      }

      recentRequests.push(now);
      requestCounts.set(ip, recentRequests);
    },
  };
}

/**
 * Middleware para validar content-type
 */
export function validateContentType(allowedTypes: string[]) {
  return {
    beforeHandle: ({ request, set }: any) => {
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const contentType = request.headers.get('content-type');

        if (!contentType || !allowedTypes.some((type) => contentType.includes(type))) {
          set.status = 415;
          return {
            success: false,
            error: 'Unsupported Media Type',
            message: `Content-Type deve ser um dos: ${allowedTypes.join(', ')}`,
          };
        }
      }
    },
  };
}

/**
 * Middleware para adicionar headers de segurança
 */
export function securityHeaders() {
  return {
    beforeHandle: ({ set }: any) => {
      set.headers = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'",
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      };
    },
  };
}
