import { verifyToken } from '@utils/security';
import { logger, logSecurityEvent } from './logger';
import { JwtPayload } from '../types/index';
import { env } from '@config/env';

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
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        logSecurityEvent('INVALID_TOKEN', ip, null, {
          endpoint: new URL(request.url).pathname,
        });
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
 * Middleware de validação de Origin (proteção CSRF para SPA)
 * Para SPAs com bearer tokens, verificar Origin é mais eficaz que tokens CSRF tradicionais
 */
export function createOriginValidation() {
  return {
    beforeHandle: ({ request, set }: any) => {
      // Apenas para métodos que modificam dados
      if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
        return;
      }

      // Em desenvolvimento, não valida (permite qualquer origin)
      if (env.NODE_ENV !== 'production') {
        return;
      }

      const origin = request.headers.get('origin');
      const referer = request.headers.get('referer');

      // Pelo menos um deve estar presente e apontar para o frontend
      const allowedOrigin = env.FRONTEND_URL;
      const originValid = origin && origin.startsWith(allowedOrigin);
      const refererValid = referer && referer.startsWith(allowedOrigin);

      if (!originValid && !refererValid) {
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        logSecurityEvent('ORIGIN_REJECTED', ip, null, {
          origin,
          referer,
          endpoint: new URL(request.url).pathname,
        });
        set.status = 403;
        return {
          success: false,
          error: 'Origin não permitido',
        };
      }
    },
  };
}

/**
 * Middleware para verificar CSRF token (mantido para compatibilidade)
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
 * Middleware para rate limiting com suporte a IP + conta
 * Rastreia por IP e opcionalmente por código de conta
 */
export function createRateLimitMiddleware(
  windowMs: number = 15 * 60 * 1000,
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
        logSecurityEvent('RATE_LIMIT_HIT', ip, null, {
          endpoint: new URL(request.url).pathname,
          count: recentRequests.length,
          limit: maxRequests,
        });
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
 * Rate limiter por conta (código do participante) com lockout
 * Bloqueia após N falhas consecutivas numa janela de tempo
 */
const accountFailures = new Map<string, { count: number; firstFailure: number; lockedUntil: number }>();

export function recordAccountFailure(code: string): void {
  const now = Date.now();
  const window = 15 * 60 * 1000; // 15 minutos
  const maxFailures = 10;
  const lockoutMs = 30 * 60 * 1000; // 30 minutos de lockout

  const record = accountFailures.get(code);

  if (!record || (now - record.firstFailure > window)) {
    // Nova janela
    accountFailures.set(code, { count: 1, firstFailure: now, lockedUntil: 0 });
    return;
  }

  record.count++;
  if (record.count >= maxFailures) {
    record.lockedUntil = now + lockoutMs;
    logSecurityEvent('ACCOUNT_LOCKED', null, null, {
      code,
      failures: record.count,
      locked_until: new Date(record.lockedUntil).toISOString(),
    });
  }
}

export function clearAccountFailures(code: string): void {
  accountFailures.delete(code);
}

export function isAccountLocked(code: string): boolean {
  const record = accountFailures.get(code);
  if (!record) return false;
  if (record.lockedUntil > Date.now()) return true;
  // Lockout expirou
  if (record.lockedUntil > 0) {
    accountFailures.delete(code);
  }
  return false;
}

// Limpa registros antigos a cada hora
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [code, record] of accountFailures) {
    if (record.firstFailure < cutoff && record.lockedUntil < Date.now()) {
      accountFailures.delete(code);
    }
  }
}, 60 * 60 * 1000);

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
