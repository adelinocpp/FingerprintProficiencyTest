import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Gera UUID v4
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Gera VOLUNTARY_CODE (2 letras + 4 números)
 */
export function generateVoluntaryCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetters = Array.from({ length: 2 })
    .map(() => letters[Math.floor(Math.random() * letters.length)])
    .join('');

  const randomNumbers = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');

  return `${randomLetters}${randomNumbers}`;
}

/**
 * Gera CARRY_CODE (2 letras + 3 números)
 */
export function generateCarryCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetters = Array.from({ length: 2 })
    .map(() => letters[Math.floor(Math.random() * letters.length)])
    .join('');

  const randomNumbers = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');

  return `${randomLetters}${randomNumbers}`;
}

/**
 * Gera ID de grupo (4 letras + 5 números)
 */
export function generateGroupId(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetters = Array.from({ length: 4 })
    .map(() => letters[Math.floor(Math.random() * letters.length)])
    .join('');

  const randomNumbers = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0');

  return `${randomLetters}${randomNumbers}`;
}

/**
 * Formata data para ISO string
 */
export function formatDate(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Formata data para formato legível
 */
export function formatDateReadable(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calcula data de expiração
 */
export function calculateExpirationDate(daysFromNow: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
}

/**
 * Verifica se data está expirada
 */
export function isExpired(expirationDate: Date | string): boolean {
  const expDate = typeof expirationDate === 'string'
    ? new Date(expirationDate)
    : expirationDate;
  return expDate < new Date();
}

/**
 * Calcula dias restantes
 */
export function getDaysRemaining(expirationDate: Date | string): number {
  const expDate = typeof expirationDate === 'string'
    ? new Date(expirationDate)
    : expirationDate;
  const now = new Date();
  const diffTime = expDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Gera número aleatório entre min e max
 */
export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Embaralha array
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Seleciona elemento aleatório de array
 */
export function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Cria delay (promise)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calcula média
 */
export function calculateMean(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * Calcula desvio padrão
 */
export function calculateStdDev(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const mean = calculateMean(numbers);
  const squareDiffs = numbers.map((n) => Math.pow(n - mean, 2));
  const avgSquareDiff = calculateMean(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

/**
 * Calcula percentil
 */
export function calculatePercentile(numbers: number[], percentile: number): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Formata bytes para tamanho legível
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Cria slug a partir de string
 */
export function createSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Capitaliza primeira letra
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Capitaliza todas as palavras
 */
export function capitalizeWords(str: string): string {
  return str
    .split(' ')
    .map((word) => capitalize(word))
    .join(' ');
}

/**
 * Trunca string
 */
export function truncate(str: string, length: number, suffix = '...'): string {
  if (str.length <= length) return str;
  return str.substring(0, length - suffix.length) + suffix;
}

/**
 * Remove duplicatas de array
 */
export function removeDuplicates<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * Agrupa array por propriedade
 */
export function groupBy<T>(
  array: T[],
  key: keyof T
): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const groupKey = String(item[key]);
      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(item);
      return result;
    },
    {} as Record<string, T[]>
  );
}

/**
 * Mapeia array para objeto
 */
export function arrayToObject<T extends Record<string, any>>(
  array: T[],
  key: keyof T
): Record<string, T> {
  return array.reduce(
    (result, item) => {
      result[String(item[key])] = item;
      return result;
    },
    {} as Record<string, T>
  );
}

/**
 * Mescla objetos
 */
export function mergeObjects<T extends Record<string, any>>(
  ...objects: T[]
): T {
  return objects.reduce((result, obj) => {
    return { ...result, ...obj };
  }, {} as T);
}

/**
 * Clona objeto profundamente
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as any;
  }

  if (obj instanceof Object) {
    const clonedObj: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }

  return obj;
}

/**
 * Valida se objeto tem todas as propriedades necessárias
 */
export function hasAllProperties<T extends Record<string, any>>(
  obj: T,
  properties: (keyof T)[]
): boolean {
  return properties.every((prop) => prop in obj && obj[prop] !== undefined);
}

/**
 * Extrai propriedades específicas de objeto
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  return keys.reduce(
    (result, key) => {
      result[key] = obj[key];
      return result;
    },
    {} as Pick<T, K>
  );
}

/**
 * Omite propriedades específicas de objeto
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => {
    delete result[key];
  });
  return result as Omit<T, K>;
}
