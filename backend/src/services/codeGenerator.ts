import { generateVoluntaryCode, generateCarryCode, generateGroupId } from '@utils/helpers';
import { queryAll } from '@database/db';

/**
 * Gera VOLUNTARY_CODE único
 */
export async function generateUniqueVoluntaryCode(): Promise<string> {
  let code: string;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    code = generateVoluntaryCode();
    const exists = queryAll(
      'SELECT id FROM participants WHERE voluntary_code = :code',
      { code }
    );
    
    if (exists.length === 0) {
      return code;
    }
    
    attempts++;
  } while (attempts < maxAttempts);

  throw new Error('Não foi possível gerar código único após múltiplas tentativas');
}

/**
 * Gera CARRY_CODE único
 */
export async function generateUniqueCarryCode(): Promise<string> {
  let code: string;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    code = generateCarryCode();
    const exists = queryAll(
      'SELECT id FROM samples WHERE carry_code = :code',
      { code }
    );
    
    if (exists.length === 0) {
      return code;
    }
    
    attempts++;
  } while (attempts < maxAttempts);

  throw new Error('Não foi possível gerar código único após múltiplas tentativas');
}

/**
 * Gera ID de grupo único
 */
export async function generateUniqueGroupId(): Promise<string> {
  let id: string;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    id = generateGroupId();
    const exists = queryAll(
      'SELECT id FROM groups WHERE group_id = :id',
      { id }
    );
    
    if (exists.length === 0) {
      return id;
    }
    
    attempts++;
  } while (attempts < maxAttempts);

  throw new Error('Não foi possível gerar ID de grupo único após múltiplas tentativas');
}

/**
 * Valida formato de código
 */
export function isValidCodeFormat(code: string): boolean {
  // VOLUNTARY_CODE: 2 letras + 4 números
  // CARRY_CODE: 2 letras + 3 números
  const codeRegex = /^[A-Z]{2}\d{3,4}$/;
  return codeRegex.test(code.toUpperCase());
}

/**
 * Valida formato de ID de grupo
 */
export function isValidGroupIdFormat(groupId: string): boolean {
  // 4 letras + 5 números
  const groupIdRegex = /^[A-Z]{4}\d{5}$/;
  return groupIdRegex.test(groupId.toUpperCase());
}
