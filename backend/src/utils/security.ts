import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { env } from '@config/env';
import { JwtPayload } from '@types/index';

/**
 * Sanitiza string para prevenir XSS
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * Valida email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

/**
 * Valida nome (apenas letras, espaços e hífens)
 */
export function isValidName(name: string): boolean {
  const nameRegex = /^[a-zA-ZÀ-ÿ\s\-']{2,255}$/;
  return nameRegex.test(name);
}

/**
 * Gera hash SHA256
 */
export function generateSHA256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Gera hash para arquivo
 */
export async function generateFileHash(filePath: string): Promise<string> {
  const fs = await import('fs').then(m => m.promises);
  const fileBuffer = await fs.readFile(filePath);
  return generateSHA256(fileBuffer);
}

/**
 * Gera token JWT
 */
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRATION,
  });
}

/**
 * Verifica token JWT
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Hash de senha com bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(password, salt);
}

/**
 * Compara senha com hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

/**
 * Gera CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Valida CSRF token
 */
export function validateCsrfToken(token: string, storedToken: string): boolean {
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(storedToken)
  );
}

/**
 * Sanitiza objeto para banco de dados (previne SQL injection)
 */
export function sanitizeDbInput(input: unknown): string {
  if (typeof input === 'string') {
    // Remove caracteres perigosos
    return input
      .replace(/['";\\]/g, '')
      .trim()
      .substring(0, 1000); // Limita tamanho
  }
  
  if (typeof input === 'number') {
    return input.toString();
  }

  if (typeof input === 'boolean') {
    return input ? '1' : '0';
  }

  return '';
}

/**
 * Valida código de participante (VOLUNTARY_CODE ou CARRY_CODE)
 */
export function isValidParticipantCode(code: string): boolean {
  // VOLUNTARY_CODE: 2 letras + 4 números
  // CARRY_CODE: 2 letras + 3 números
  const codeRegex = /^[A-Z]{2}\d{3,4}$/;
  return codeRegex.test(code.toUpperCase());
}

/**
 * Valida índice de imagem
 */
export function isValidImageIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index <= 9;
}

/**
 * Valida grau de compatibilidade
 */
export function isValidCompatibilityDegree(degree: number): boolean {
  return [1, 2, 3, 4].includes(degree);
}

/**
 * Escapa SQL (fallback para prepared statements)
 */
export function escapeSql(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/"/g, '\\"')
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z');
}

/**
 * Rate limiting - verifica se está dentro do limite
 */
export function checkRateLimit(
  attempts: Map<string, number[]>,
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const userAttempts = attempts.get(key) || [];

  // Remove tentativas fora da janela
  const recentAttempts = userAttempts.filter(
    (timestamp) => now - timestamp < windowMs
  );

  if (recentAttempts.length >= maxRequests) {
    return false;
  }

  recentAttempts.push(now);
  attempts.set(key, recentAttempts);

  return true;
}

/**
 * Valida URL para prevenir SSRF
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Apenas permite http e https
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Gera nonce para CSP
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Valida dados de entrada com schema
 */
export function validateInput<T>(
  data: unknown,
  schema: Record<string, (value: unknown) => boolean>
): T | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const obj = data as Record<string, unknown>;
  const validated: Record<string, unknown> = {};

  for (const [key, validator] of Object.entries(schema)) {
    if (!(key in obj)) {
      return null;
    }

    if (!validator(obj[key])) {
      return null;
    }

    validated[key] = obj[key];
  }

  return validated as T;
}
