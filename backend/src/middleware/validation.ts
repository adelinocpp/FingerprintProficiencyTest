import { z } from 'zod';
import { ValidationError } from './errorHandler';

/**
 * Valida dados com schema Zod
 */
export function validateWithZod<T>(schema: z.ZodSchema<T>, data: any): { success: boolean; data?: T; errors?: Record<string, string[]> } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
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
    throw error;
  }
}

/**
 * Valida body da requisição
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return async (body: any): Promise<T> => {
    try {
      return await schema.parseAsync(body);
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
        throw new ValidationError('Validação falhou', errors);
      }
      throw error;
    }
  };
}

/**
 * Valida query parameters
 */
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return async (query: any): Promise<T> => {
    try {
      return await schema.parseAsync(query);
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
        throw new ValidationError('Parâmetros inválidos', errors);
      }
      throw error;
    }
  };
}

/**
 * Valida parâmetros de rota
 */
export function validateParams<T>(schema: z.ZodSchema<T>) {
  return async (params: any): Promise<T> => {
    try {
      return await schema.parseAsync(params);
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
        throw new ValidationError('Parâmetros de rota inválidos', errors);
      }
      throw error;
    }
  };
}

/**
 * Cria schema de validação para paginação
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

/**
 * Cria schema de validação para filtros
 */
export const filterSchema = z.object({
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

/**
 * Combina schemas
 */
export function combineSchemas<T extends Record<string, z.ZodSchema>>(
  schemas: T
): z.ZodObject<T> {
  return z.object(schemas);
}

/**
 * Cria schema condicional
 */
export function conditionalSchema<T>(
  condition: boolean,
  schema: z.ZodSchema<T>,
  fallback: z.ZodSchema<any> = z.any()
): z.ZodSchema<T> {
  return condition ? schema : fallback;
}

/**
 * Valida se valor está em lista
 */
export function enumSchema<T extends readonly string[]>(values: T) {
  return z.enum(values);
}

/**
 * Valida se valor é um dos tipos
 */
export function unionSchema<T extends z.ZodSchema[]>(schemas: T) {
  return z.union(schemas);
}

/**
 * Valida se valor é um dos tipos com discriminador
 */
export function discriminatedUnionSchema<T extends readonly string[]>(
  discriminator: string,
  schemas: Record<string, z.ZodSchema>
) {
  return z.discriminatedUnion(discriminator as any, Object.values(schemas) as any);
}

/**
 * Transforma valor antes de validar
 */
export function transformSchema<T, U>(
  schema: z.ZodSchema<T>,
  transform: (value: T) => U
): z.ZodSchema<U> {
  return schema.transform(transform) as z.ZodSchema<U>;
}

/**
 * Refina validação
 */
export function refineSchema<T>(
  schema: z.ZodSchema<T>,
  refine: (value: T) => boolean | Promise<boolean>,
  message: string
): z.ZodSchema<T> {
  return schema.refine(refine, { message });
}

/**
 * Valida se dois campos são iguais
 */
export function matchFieldsSchema<T extends Record<string, any>>(
  schema: z.ZodSchema<T>,
  field1: keyof T,
  field2: keyof T,
  message: string
): z.ZodSchema<T> {
  return schema.refine(
    (data) => data[field1] === data[field2],
    {
      message,
      path: [String(field2)],
    }
  );
}

/**
 * Valida se campo é requerido quando outro está presente
 */
export function conditionalRequiredSchema<T extends Record<string, any>>(
  schema: z.ZodSchema<T>,
  condition: (data: T) => boolean,
  field: keyof T,
  message: string
): z.ZodSchema<T> {
  return schema.refine(
    (data) => {
      if (condition(data) && !data[field]) {
        return false;
      }
      return true;
    },
    {
      message,
      path: [String(field)],
    }
  );
}
