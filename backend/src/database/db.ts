import { Database } from 'bun:sqlite';
import { env } from '@config/env';
import { schema, initQueries, cleanupQueries } from './schema';
import { logger } from '@middleware/logger';
import fs from 'fs';
import path from 'path';

let db: Database | null = null;

/**
 * Inicializa conexão com banco de dados
 */
export function initializeDatabase(): Database {
  try {
    // Cria diretório se não existir
    const dbDir = path.dirname(env.DATABASE_URL);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Abre conexão
    db = new Database(env.DATABASE_URL, { create: true });
    
    logger.info('Conectado ao banco de dados', {
      path: env.DATABASE_URL,
    });

    // Executa queries de inicialização
    for (const query of initQueries) {
      db.run(query);
    }

    // Cria schema
    db.run(schema);

    logger.info('Schema do banco de dados criado/verificado');

    // Executa limpeza de dados antigos
    performCleanup(db);

    return db;
  } catch (error) {
    logger.error('Erro ao inicializar banco de dados', error as Error);
    throw error;
  }
}

/**
 * Obtém instância do banco de dados
 */
export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Fecha conexão com banco de dados
 */
export function closeDatabase(): void {
  if (db) {
    try {
      db.close();
      db = null;
      logger.info('Banco de dados fechado');
    } catch (error) {
      logger.error('Erro ao fechar banco de dados', error as Error);
    }
  }
}

/**
 * Executa limpeza de dados antigos
 */
function performCleanup(database: Database): void {
  try {
    for (const query of cleanupQueries) {
      const stmt = database.query(query);
      const result = stmt.run();
      if (result.changes > 0) {
        logger.info(`Limpeza executada: ${result.changes} registros removidos`);
      }
    }
  } catch (error) {
    logger.warn('Erro durante limpeza de dados', { error: (error as Error).message });
  }
}

/**
 * Executa transação
 */
export function transaction<T>(
  fn: (db: Database) => T
): T {
  const database = getDatabase();
  const transaction = database.transaction(fn);
  return transaction(database);
}

/**
 * Executa query com prepared statement
 */
export function execute(
  query: string,
  params: Record<string, any> = {}
): any {
  const database = getDatabase();
  
  // Bun SQLite usa $param em vez de :param
  // Converter query e parâmetros para formato correto
  let convertedQuery = query;
  const convertedParams: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(params)) {
    convertedQuery = convertedQuery.replace(`:${key}`, `$${key}`);
    convertedParams[`$${key}`] = value;
  }
  
  const stmt = database.query(convertedQuery);
  return stmt.run(convertedParams);
}

/**
 * Executa query e retorna um registro
 */
export function queryOne<T>(
  query: string,
  params: Record<string, any> = {}
): T | undefined {
  const database = getDatabase();
  
  // Converter query e parâmetros para formato $param
  let convertedQuery = query;
  const convertedParams: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(params)) {
    convertedQuery = convertedQuery.replace(`:${key}`, `$${key}`);
    convertedParams[`$${key}`] = value;
  }
  
  const stmt = database.query<T, Record<string, any>>(convertedQuery);
  return stmt.get(convertedParams);
}

/**
 * Executa query e retorna múltiplos registros
 */
export function queryAll<T>(
  query: string,
  params: Record<string, any> = {}
): T[] {
  const database = getDatabase();
  
  // Converter query e parâmetros para formato $param
  let convertedQuery = query;
  const convertedParams: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(params)) {
    convertedQuery = convertedQuery.replace(`:${key}`, `$${key}`);
    convertedParams[`$${key}`] = value;
  }
  
  const stmt = database.query(convertedQuery);
  return stmt.all(convertedParams) as T[];
}

/**
 * Conta registros
 */
export function count(
  table: string,
  where: Record<string, any> = {}
): number {
  const database = getDatabase();
  const conditions = Object.keys(where)
    .map((key) => `${key} = :${key}`)
    .join(' AND ');
  
  const query = `SELECT COUNT(*) as count FROM ${table} ${conditions ? `WHERE ${conditions}` : ''}`;
  const result = queryOne<{ count: number }>(query, where);
  return result?.count || 0;
}

/**
 * Insere registro
 */
export function insert(
  table: string,
  data: Record<string, any>
): any {
  const keys = Object.keys(data);
  const placeholders = keys.map((key) => `$${key}`).join(', ');
  const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  
  // Debug: log da query e dados
  logger.info('INSERT Query Debug', {
    table,
    query,
    keys,
    placeholders,
    data
  });
  
  return execute(query, data);
}

/**
 * Atualiza registro
 */
export function update(
  table: string,
  data: Record<string, any>,
  where: Record<string, any>
): any {
  const sets = Object.keys(data)
    .map((key) => `${key} = $${key}`)
    .join(', ');
  
  const conditions = Object.keys(where)
    .map((key) => `${key} = $where_${key}`)
    .join(' AND ');
  
  const params = {
    ...data,
    ...Object.fromEntries(
      Object.entries(where).map(([key, value]) => [`where_${key}`, value])
    ),
  };
  
  const query = `UPDATE ${table} SET ${sets} WHERE ${conditions}`;
  
  logger.info('UPDATE Query Debug', {
    table,
    query,
    params
  });
  
  return execute(query, params);
}

/**
 * Deleta registro
 */
export function deleteRecord(
  table: string,
  where: Record<string, any>
): any {
  const conditions = Object.keys(where)
    .map((key) => `${key} = :${key}`)
    .join(' AND ');
  
  const query = `DELETE FROM ${table} WHERE ${conditions}`;
  return execute(query, where);
}

/**
 * Verifica se registro existe
 */
export function exists(
  table: string,
  where: Record<string, any>
): boolean {
  return count(table, where) > 0;
}

/**
 * Obtém registro por ID
 */
export function findById<T>(
  table: string,
  id: string
): T | undefined {
  return queryOne<T>(
    `SELECT * FROM ${table} WHERE id = :id`,
    { id }
  );
}

/**
 * Obtém registros com paginação
 */
export function paginate<T>(
  table: string,
  page: number = 1,
  limit: number = 10,
  where: Record<string, any> = {},
  orderBy: string = 'created_at DESC'
): { data: T[]; total: number; page: number; limit: number; pages: number } {
  const offset = (page - 1) * limit;
  const conditions = Object.keys(where)
    .map((key) => `${key} = :${key}`)
    .join(' AND ');
  
  const whereClause = conditions ? `WHERE ${conditions}` : '';
  
  const total = count(table, where);
  const data = queryAll<T>(
    `SELECT * FROM ${table} ${whereClause} ORDER BY ${orderBy} LIMIT :limit OFFSET :offset`,
    { ...where, limit, offset }
  );
  
  return {
    data,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

/**
 * Exporta dados para backup
 */
export function exportDatabase(outputPath: string): void {
  try {
    // Copia o arquivo do banco de dados
    fs.copyFileSync(env.DATABASE_URL, outputPath);
    logger.info('Banco de dados exportado', { path: outputPath });
  } catch (error) {
    logger.error('Erro ao exportar banco de dados', error as Error);
    throw error;
  }
}

/**
 * Restaura banco de dados de backup
 */
export function restoreDatabase(backupPath: string): void {
  try {
    closeDatabase();
    fs.copyFileSync(backupPath, env.DATABASE_URL);
    initializeDatabase();
    logger.info('Banco de dados restaurado', { path: backupPath });
  } catch (error) {
    logger.error('Erro ao restaurar banco de dados', error as Error);
    throw error;
  }
}

/**
 * Obtém informações do banco de dados
 */
export function getDatabaseInfo(): {
  path: string;
  size: number;
  tables: number;
  indexes: number;
} {
  try {
    const database = getDatabase();
    const stats = fs.statSync(env.DATABASE_URL);
    const tables = queryAll<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const indexes = queryAll<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index'"
    );

    return {
      path: env.DATABASE_URL,
      size: stats.size,
      tables: tables.length,
      indexes: indexes.length,
    };
  } catch (error) {
    logger.error('Erro ao obter informações do banco de dados', error as Error);
    throw error;
  }
}
