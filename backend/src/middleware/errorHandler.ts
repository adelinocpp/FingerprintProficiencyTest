import { logger } from './logger';
import { ApiError, ApiResponse } from '@types/index';

/**
 * Classe base para erros da aplicação
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Erro de validação
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

/**
 * Erro de autenticação
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Não autorizado') {
    super(401, 'AUTHENTICATION_ERROR', message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Erro de autorização
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Acesso negado') {
    super(403, 'AUTHORIZATION_ERROR', message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Erro de recurso não encontrado
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Recurso') {
    super(404, 'NOT_FOUND', `${resource} não encontrado`);
    this.name = 'NotFoundError';
  }
}

/**
 * Erro de conflito
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
    this.name = 'ConflictError';
  }
}

/**
 * Erro de limite de taxa
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Muitas requisições') {
    super(429, 'RATE_LIMIT_EXCEEDED', message);
    this.name = 'RateLimitError';
  }
}

/**
 * Erro interno do servidor
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Erro interno do servidor') {
    super(500, 'INTERNAL_SERVER_ERROR', message);
    this.name = 'InternalServerError';
  }
}

/**
 * Erro de serviço indisponível
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Serviço indisponível') {
    super(503, 'SERVICE_UNAVAILABLE', message);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Formata resposta de erro
 */
export function formatErrorResponse(error: AppError | Error): ApiResponse<null> {
  if (error instanceof AppError) {
    return {
      success: false,
      error: error.code,
      message: error.message,
      data: null,
    };
  }

  return {
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Erro interno do servidor',
    data: null,
  };
}

/**
 * Middleware de tratamento de erros
 */
export function createErrorHandlerMiddleware() {
  return {
    onError: ({ error, set, request }: any) => {
      const ip = request.headers.get('x-forwarded-for') || 'unknown';

      if (error instanceof AppError) {
        logger.warn(`${error.code}: ${error.message}`, {
          ip,
          code: error.code,
          statusCode: error.statusCode,
          details: error.details,
        });

        set.status = error.statusCode;
        return formatErrorResponse(error);
      }

      // Log de erro não tratado
      logger.error('Erro não tratado', error as Error, {
        ip,
        path: request.url,
        method: request.method,
      });

      set.status = 500;
      return {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Erro interno do servidor',
        data: null,
      };
    },
  };
}

/**
 * Wrapper para funções assíncronas
 */
export function asyncHandler(
  fn: (req: any, res: any, next: any) => Promise<any>
) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Valida erro e lança AppError apropriado
 */
export function handleDatabaseError(error: any): never {
  logger.error('Database error', error as Error);

  if (error.code === 'SQLITE_CONSTRAINT') {
    if (error.message.includes('UNIQUE')) {
      throw new ConflictError('Registro duplicado');
    }
    throw new ValidationError('Violação de constraint do banco de dados');
  }

  if (error.code === 'SQLITE_CANTOPEN') {
    throw new ServiceUnavailableError('Banco de dados indisponível');
  }

  throw new InternalServerError('Erro ao acessar banco de dados');
}

/**
 * Valida erro de email
 */
export function handleEmailError(error: any): never {
  logger.error('Email error', error as Error);

  if (error.code === 'EAUTH') {
    throw new ServiceUnavailableError('Erro de autenticação de email');
  }

  if (error.code === 'ECONNREFUSED') {
    throw new ServiceUnavailableError('Servidor de email indisponível');
  }

  throw new ServiceUnavailableError('Erro ao enviar email');
}

/**
 * Valida erro de arquivo
 */
export function handleFileError(error: any): never {
  logger.error('File error', error as Error);

  if (error.code === 'ENOENT') {
    throw new NotFoundError('Arquivo');
  }

  if (error.code === 'EACCES') {
    throw new AuthorizationError('Permissão negada para acessar arquivo');
  }

  throw new InternalServerError('Erro ao acessar arquivo');
}

/**
 * Cria resposta de sucesso
 */
export function successResponse<T>(
  data: T,
  message?: string
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

/**
 * Cria resposta de erro
 */
export function errorResponse(
  error: string,
  message: string,
  statusCode: number = 400
): ApiResponse<null> {
  return {
    success: false,
    error,
    message,
    data: null,
  };
}
