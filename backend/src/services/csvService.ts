import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { env } from '@/config/env';
import { logger } from '@middleware/logger';
import type { PairwiseComparison } from '@/types';

/**
 * Lê comparações do arquivo CSV
 */
export async function loadPairwiseComparisons(): Promise<PairwiseComparison[]> {
  const comparisons: PairwiseComparison[] = [];

  return new Promise((resolve, reject) => {
    createReadStream(env.PAIRWISE_COMPARISONS_FILE)
      .pipe(parse({
        delimiter: ',',
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }))
      .on('data', (row: any) => {
        try {
          comparisons.push({
            arquivo_a: row.Arquivo_A,
            quali_a: parseFloat(row.Quali_A),
            arquivo_b: row.Arquivo_B,
            quali_b: parseFloat(row.Quali_B),
            mesma_fonte: parseInt(row.mesma_fonte) as 0 | 1,
            mesmo_arquivo: parseInt(row.mesmo_arquivo) as 0 | 1,
            score: parseFloat(row.score),
          });
        } catch (error) {
          logger.warn('Erro ao parsear linha do CSV', { row, error });
        }
      })
      .on('end', () => {
        logger.info('CSV carregado com sucesso', { 
          total_comparisons: comparisons.length 
        });
        resolve(comparisons);
      })
      .on('error', (error) => {
        logger.error('Erro ao ler CSV', error);
        reject(error);
      });
  });
}

/**
 * Busca comparações para um arquivo específico
 */
export async function getComparisonsForFile(
  filename: string,
  limit?: number
): Promise<PairwiseComparison[]> {
  const allComparisons = await loadPairwiseComparisons();
  
  const filtered = allComparisons.filter(
    (comp) => comp.arquivo_a === filename || comp.arquivo_b === filename
  );

  if (limit) {
    return filtered.slice(0, limit);
  }

  return filtered;
}

/**
 * Busca pares de mesma fonte (mesma_fonte = 1)
 */
export async function getSameSourcePairs(limit?: number): Promise<PairwiseComparison[]> {
  const allComparisons = await loadPairwiseComparisons();
  
  const sameSources = allComparisons.filter(
    (comp) => comp.mesma_fonte === 1 && comp.mesmo_arquivo === 0
  );

  if (limit) {
    return sameSources.slice(0, limit);
  }

  return sameSources;
}

/**
 * Busca pares de fontes diferentes (mesma_fonte = 0)
 */
export async function getDifferentSourcePairs(limit?: number): Promise<PairwiseComparison[]> {
  const allComparisons = await loadPairwiseComparisons();
  
  const differentSources = allComparisons.filter(
    (comp) => comp.mesma_fonte === 0
  );

  if (limit) {
    return differentSources.slice(0, limit);
  }

  return differentSources;
}

/**
 * Obtém lista de arquivos únicos no CSV
 */
export async function getUniqueFiles(): Promise<string[]> {
  const allComparisons = await loadPairwiseComparisons();
  
  const filesSet = new Set<string>();
  
  allComparisons.forEach((comp) => {
    filesSet.add(comp.arquivo_a);
    filesSet.add(comp.arquivo_b);
  });

  return Array.from(filesSet);
}
