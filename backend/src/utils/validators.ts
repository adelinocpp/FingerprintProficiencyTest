import { z } from 'zod';

/**
 * Schema de validação para registro de participante
 */
export const RegisterSchema = z.object({
  voluntary_email: z
    .string()
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  voluntary_name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(255, 'Nome muito longo')
    .regex(/^[a-zA-ZÀ-ÿ\s\-']+$/, 'Nome contém caracteres inválidos'),
  terms_accepted: z
    .boolean()
    .refine((val) => val === true, 'Você deve aceitar os termos'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

/**
 * Schema de validação para login
 */
export const LoginSchema = z.object({
  code: z
    .string()
    .min(5, 'Código inválido')
    .max(6, 'Código inválido')
    .regex(/^[A-Z]{2}\d{3,4}$/i, 'Código deve conter 2 letras e 3-4 números'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * Schema de validação para submissão de resultado
 */
export const ResultSubmissionSchema = z.object({
  group_id: z
    .string()
    .regex(/^[A-Z]{4}\d{5}$/, 'ID do grupo inválido'),
  conclusive: z
    .boolean()
    .describe('Se o exame foi conclusivo'),
  has_match: z
    .boolean()
    .nullable()
    .describe('Se há correspondência (null se inconclusivo)'),
  matched_image_index: z
    .number()
    .int()
    .min(0)
    .max(9)
    .nullable()
    .describe('Índice da imagem correspondente'),
  compatibility_degree: z
    .number()
    .int()
    .min(1)
    .max(4)
    .nullable()
    .describe('Grau de compatibilidade (1-4)'),
  notes: z
    .string()
    .max(1000)
    .nullable()
    .optional()
    .describe('Notas adicionais'),
});

export type ResultSubmissionInput = z.infer<typeof ResultSubmissionSchema>;

/**
 * Schema de validação para batch de resultados
 */
export const ResultBatchSchema = z.object({
  sample_id: z
    .string()
    .uuid('ID da amostra inválido'),
  results: z
    .array(ResultSubmissionSchema)
    .min(1, 'Pelo menos um resultado deve ser fornecido'),
});

export type ResultBatchInput = z.infer<typeof ResultBatchSchema>;

/**
 * Schema de validação para paginação
 */
export const PaginationSchema = z.object({
  page: z
    .number()
    .int()
    .min(1, 'Página deve ser maior que 0')
    .default(1),
  limit: z
    .number()
    .int()
    .min(1, 'Limite deve ser maior que 0')
    .max(100, 'Limite máximo é 100')
    .default(10),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

/**
 * Função genérica para validar com Zod
 */
export function validateWithZod<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(err.message);
      });
      return { success: false, errors };
    }
    return {
      success: false,
      errors: { general: ['Erro de validação desconhecido'] },
    };
  }
}

/**
 * Valida se um valor está dentro de um intervalo
 */
export function isWithinRange(
  value: number,
  min: number,
  max: number
): boolean {
  return value >= min && value <= max;
}

/**
 * Valida se uma string é um UUID válido
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Valida se uma data é válida
 */
export function isValidDate(date: string): boolean {
  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime());
}

/**
 * Valida se uma data não está expirada
 */
export function isNotExpired(expirationDate: string): boolean {
  return new Date(expirationDate) > new Date();
}

/**
 * Valida se um arquivo tem extensão permitida
 */
export function isAllowedFileExtension(
  filename: string,
  allowedExtensions: string[]
): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? allowedExtensions.includes(ext) : false;
}

/**
 * Valida tamanho de arquivo
 */
export function isValidFileSize(
  sizeInBytes: number,
  maxSizeInMB: number
): boolean {
  return sizeInBytes <= maxSizeInMB * 1024 * 1024;
}

/**
 * Valida se um número é inteiro
 */
export function isInteger(value: unknown): boolean {
  return Number.isInteger(value);
}

/**
 * Valida se um valor é booleano
 */
export function isBoolean(value: unknown): boolean {
  return typeof value === 'boolean';
}

/**
 * Valida se um valor é string
 */
export function isString(value: unknown): boolean {
  return typeof value === 'string';
}

/**
 * Valida se um valor é número
 */
export function isNumber(value: unknown): boolean {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Valida se um valor é array
 */
export function isArray(value: unknown): boolean {
  return Array.isArray(value);
}

/**
 * Valida se um valor é objeto
 */
export function isObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
