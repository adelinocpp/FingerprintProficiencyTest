import { env } from '@config/env';
import fs from 'fs';
import path from 'path';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: string;
  stack?: string;
}

class Logger {
  private logFile: string;
  private logLevel: LogLevel;

  constructor() {
    this.logFile = env.LOG_FILE;
    this.logLevel = this.parseLogLevel(env.LOG_LEVEL);
    this.ensureLogDirectory();
  }

  private parseLogLevel(level: string): LogLevel {
    const levels: Record<string, LogLevel> = {
      debug: LogLevel.DEBUG,
      info: LogLevel.INFO,
      warn: LogLevel.WARN,
      error: LogLevel.ERROR,
    };
    return levels[level.toLowerCase()] || LogLevel.INFO;
  }

  private ensureLogDirectory(): void {
    const dir = path.dirname(this.logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.logLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, message, context, error, stack } = entry;
    let log = `[${timestamp}] [${level}] ${message}`;

    if (context && Object.keys(context).length > 0) {
      log += ` | Context: ${JSON.stringify(context)}`;
    }

    if (error) {
      log += ` | Error: ${error}`;
    }

    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  }

  private writeToFile(log: string): void {
    try {
      fs.appendFileSync(this.logFile, log + '\n', 'utf-8');
    } catch (error) {
      console.error('Erro ao escrever log:', error);
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error?.message,
      stack: error?.stack,
    };

    const formattedLog = this.formatLog(entry);

    // Console output
    const consoleMethod = level === LogLevel.ERROR ? 'error' : level === LogLevel.WARN ? 'warn' : 'log';
    console[consoleMethod as keyof typeof console](formattedLog);

    // File output
    this.writeToFile(formattedLog);
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }
}

export const logger = new Logger();

/**
 * Middleware de logging para Elysia
 */
export function createLoggingMiddleware() {
  return {
    beforeHandle: ({ request, path }: any) => {
      logger.info(`${request.method} ${path}`, {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
      });
    },
    afterHandle: ({ request, path, response }: any) => {
      logger.info(`${request.method} ${path} - ${response.status}`, {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        status: response.status,
      });
    },
  };
}

/**
 * Cria entrada de log de acesso
 */
export function logAccess(
  participantId: string | null,
  ipAddress: string,
  endpoint: string,
  method: string,
  statusCode: number,
  userAgent: string
): void {
  logger.info(`Access: ${method} ${endpoint}`, {
    participant_id: participantId,
    ip_address: ipAddress,
    endpoint,
    method,
    status_code: statusCode,
    user_agent: userAgent,
  });
}

/**
 * Cria entrada de log de erro
 */
export function logError(
  message: string,
  error: Error,
  context?: Record<string, any>
): void {
  logger.error(message, error, context);
}

/**
 * Cria entrada de log de ação sensível
 */
export function logSensitiveAction(
  action: string,
  participantId: string,
  details: Record<string, any>
): void {
  logger.info(`Sensitive Action: ${action}`, {
    participant_id: participantId,
    ...details,
  });
}

/**
 * Tipos de eventos de segurança
 */
export type SecurityEventType =
  | 'AUTH_FAILURE'         // Login falhou (código inválido)
  | 'AUTH_UNVERIFIED'      // Login com email não verificado
  | 'RATE_LIMIT_HIT'      // Rate limit atingido
  | 'INVALID_TOKEN'       // Token JWT inválido/expirado
  | 'PATH_TRAVERSAL'      // Tentativa de path traversal
  | 'ORIGIN_REJECTED'     // Origin inválido (CSRF)
  | 'ACCOUNT_LOCKED'      // Conta bloqueada por tentativas
  | 'REFRESH_TOKEN_REUSE' // Tentativa de reutilizar refresh token
  | 'ACCOUNT_DELETED';    // Conta excluída

/**
 * Registra evento de segurança no banco e no log
 */
export function logSecurityEvent(
  eventType: SecurityEventType,
  ip: string | null,
  participantId: string | null,
  details?: Record<string, any>
): void {
  const detailsStr = details ? JSON.stringify(details) : null;

  logger.warn(`SECURITY [${eventType}]`, {
    event_type: eventType,
    ip_address: ip,
    participant_id: participantId,
    ...details,
  });

  // Persiste no banco de dados (async, sem bloquear)
  import('../database/db').then(({ insert }) => {
    import('../utils/helpers').then(({ generateUUID }) => {
      try {
        insert('security_events', {
          id: generateUUID(),
          event_type: eventType,
          participant_id: participantId,
          ip_address: ip,
          details: detailsStr,
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        // Não falha se não conseguir persistir
      }
    });
  }).catch(() => {
    // DB pode não estar inicializado ainda
  });
}
