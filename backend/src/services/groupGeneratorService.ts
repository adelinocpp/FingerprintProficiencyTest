import { randomBytes } from 'crypto';
import { env } from '@/config/env';
import { logger } from '@middleware/logger';
import { loadPairwiseComparisons } from './csvService';
import { filterUnusedFiles, trackMultipleFiles } from './fileTrackingService';
import type { PairwiseComparison } from '@/types';

interface GroupCandidate {
  questionada: string;
  padroes: string[];
  has_same_source: boolean;
  matched_index: number | null;
}

/**
 * Gera ID único para o grupo
 */
function generateGroupId(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetters = Array.from({ length: 4 }, () => 
    letters[Math.floor(Math.random() * letters.length)]
  ).join('');
  
  const randomNumbers = randomBytes(3).toString('hex').slice(0, 5).toUpperCase();
  
  return `${randomLetters}${randomNumbers}`;
}

/**
 * Embaralha array usando Fisher-Yates
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Seleciona imagens padrão para um grupo
 */
async function selectStandardImages(
  questionada: string,
  hasSameSource: boolean,
  comparisons: PairwiseComparison[]
): Promise<{ padroes: string[]; matchedIndex: number | null }> {
  const numPadroes = env.IMAGES_PER_GROUP - 1; // 10 padrões (11 total - 1 questionada)
  
  if (hasSameSource) {
    // Busca imagens da mesma fonte (mesma_fonte = 1, mesmo_arquivo = 0)
    const sameSources = comparisons.filter(
      (comp) => 
        (comp.arquivo_a === questionada || comp.arquivo_b === questionada) &&
        comp.mesma_fonte === 1 &&
        comp.mesmo_arquivo === 0
    );

    if (sameSources.length === 0) {
      logger.warn('Nenhuma imagem da mesma fonte encontrada', { questionada });
      return { padroes: [], matchedIndex: null };
    }

    // Ordena por score CRESCENTE (menor score primeiro)
    // Especificação: selecionar arquivo com MENOR score da mesma fonte
    sameSources.sort((a, b) => a.score - b.score);

    // Seleciona uma imagem da mesma fonte (menor score)
    const matchedFile = sameSources[0].arquivo_a === questionada 
      ? sameSources[0].arquivo_b 
      : sameSources[0].arquivo_a;

    // Agora seleciona os demais padrões de fontes DIFERENTES com MAIOR score
    const differentSources = comparisons.filter(
      (comp) =>
        (comp.arquivo_a === questionada || comp.arquivo_b === questionada) &&
        comp.mesma_fonte === 0
    );

    // Ordena por score DECRESCENTE (maior score primeiro) para fontes diferentes
    differentSources.sort((a, b) => b.score - a.score);

    // Extrai NNNN (ID da fonte) dos nomes de arquivo
    const extractSourceId = (filename: string): string | null => {
      const match = filename.match(/fingerprint_(\d{4})/);
      return match ? match[1] : null;
    };

    const questionadaSourceId = extractSourceId(questionada);
    const matchedSourceId = extractSourceId(matchedFile);
    const usedSources = new Set<string>(
      [questionadaSourceId, matchedSourceId].filter((id): id is string => id !== null)
    );
    const selectedDifferent: string[] = [];

    // Seleciona padrões de fontes diferentes (NNNN único) com maior score
    for (const comp of differentSources) {
      const fileB = comp.arquivo_a === questionada ? comp.arquivo_b : comp.arquivo_a;
      const sourceId = extractSourceId(fileB);
      
      if (sourceId && !usedSources.has(sourceId)) {
        usedSources.add(sourceId);
        selectedDifferent.push(fileB);
        
        if (selectedDifferent.length >= numPadroes - 1) break; // -1 pois já temos matched
      }
    }

    if (selectedDifferent.length < numPadroes - 1) {
      logger.warn('Não há padrões suficientes de fontes diferentes', {
        questionada,
        found: selectedDifferent.length,
        needed: numPadroes - 1
      });
      return { padroes: [], matchedIndex: null };
    }

    // Combina matched com os diferentes e embaralha
    const allPadroes = [matchedFile, ...selectedDifferent];
    const shuffledPadroes = shuffleArray(allPadroes);
    
    // Encontra novo índice do matched após embaralhar
    const matchedIndex = shuffledPadroes.indexOf(matchedFile);

    return { padroes: shuffledPadroes, matchedIndex };
  } else {
    // Sem match: seleciona APENAS fontes diferentes com MAIOR score
    const differentSources = comparisons.filter(
      (comp) =>
        (comp.arquivo_a === questionada || comp.arquivo_b === questionada) &&
        comp.mesma_fonte === 0
    );

    if (differentSources.length < numPadroes) {
      logger.warn('Não há imagens suficientes de fontes diferentes', { 
        questionada,
        found: differentSources.length,
        needed: numPadroes
      });
      return { padroes: [], matchedIndex: null };
    }

    // Ordena por score DECRESCENTE (maior score primeiro)
    differentSources.sort((a, b) => b.score - a.score);

    // Extrai NNNN (ID da fonte) dos nomes de arquivo
    const extractSourceId = (filename: string): string | null => {
      const match = filename.match(/fingerprint_(\d{4})/);
      return match ? match[1] : null;
    };

    const questionadaSourceId = extractSourceId(questionada);
    const usedSources = new Set<string>(
      [questionadaSourceId].filter((id): id is string => id !== null)
    );
    const selectedDifferent: string[] = [];

    // Seleciona padrões de fontes diferentes (NNNN único) com maior score
    for (const comp of differentSources) {
      const fileB = comp.arquivo_a === questionada ? comp.arquivo_b : comp.arquivo_a;
      const sourceId = extractSourceId(fileB);
      
      if (sourceId && !usedSources.has(sourceId)) {
        usedSources.add(sourceId);
        selectedDifferent.push(fileB);
        
        if (selectedDifferent.length >= numPadroes) break;
      }
    }

    if (selectedDifferent.length < numPadroes) {
      logger.warn('Não há padrões suficientes de fontes diferentes', {
        questionada,
        found: selectedDifferent.length,
        needed: numPadroes
      });
      return { padroes: [], matchedIndex: null };
    }

    // Embaralha os padrões
    const shuffledPadroes = shuffleArray(selectedDifferent);

    return { padroes: shuffledPadroes, matchedIndex: null };
  }
}

/**
 * Gera um grupo de imagens
 */
export async function generateGroup(
  comparisons: PairwiseComparison[],
  participantId?: string
): Promise<GroupCandidate | null> {
  try {
    // Obtém lista de arquivos únicos que são "arquivo_a" (questionadas)
    const questionadasSet = new Set<string>();
    comparisons.forEach((comp) => questionadasSet.add(comp.arquivo_a));
    let questionadas = Array.from(questionadasSet);
    
    // Se participantId fornecido, filtra arquivos já usados
    if (participantId) {
      questionadas = filterUnusedFiles(participantId, questionadas);
      logger.info('Questionadas disponíveis após filtro', { 
        participant_id: participantId,
        available: questionadas.length 
      });
    }

    if (questionadas.length === 0) {
      logger.error('Nenhuma imagem questionada disponível');
      return null;
    }

    // Seleciona uma questionada aleatória
    const questionada = questionadas[Math.floor(Math.random() * questionadas.length)];

    // Decide se terá match (85% de probabilidade)
    const hasSameSource = Math.random() < env.HAS_SAME_SOURCE_PROBABILITY;

    // Seleciona imagens padrão
    const { padroes, matchedIndex } = await selectStandardImages(
      questionada,
      hasSameSource,
      comparisons
    );

    if (padroes.length === 0) {
      logger.warn('Não foi possível gerar grupo', { questionada });
      return null;
    }

    return {
      questionada,
      padroes,
      has_same_source: hasSameSource,
      matched_index: matchedIndex,
    };
  } catch (error) {
    logger.error('Erro ao gerar grupo', error as Error);
    return null;
  }
}

/**
 * Gera múltiplos grupos para uma amostra
 */
export async function generateSampleGroups(
  numGroups: number = env.GROUPS_PER_SAMPLE,
  participantId?: string
): Promise<GroupCandidate[]> {
  try {
    logger.info('Iniciando geração de grupos', { 
      numGroups,
      participant_id: participantId 
    });

    // Carrega todas as comparações
    const comparisons = await loadPairwiseComparisons();

    if (comparisons.length === 0) {
      logger.error('CSV vazio ou não encontrado');
      return [];
    }

    const groups: GroupCandidate[] = [];
    const allUsedFiles: string[] = [];

    for (let i = 0; i < numGroups; i++) {
      const group = await generateGroup(comparisons, participantId);
      
      if (group) {
        groups.push(group);
        
        // Coleta todos os arquivos usados neste grupo
        allUsedFiles.push(group.questionada);
        allUsedFiles.push(...group.padroes);
      } else {
        logger.warn('Falha ao gerar grupo', { index: i });
      }
    }

    // Registra todos os arquivos usados de uma vez
    if (participantId && allUsedFiles.length > 0) {
      try {
        trackMultipleFiles(participantId, allUsedFiles);
        logger.info('Arquivos registrados para controle', {
          participant_id: participantId,
          total_files: allUsedFiles.length
        });
      } catch (error) {
        logger.error('Erro ao registrar arquivos usados', { 
          participant_id: participantId,
          error 
        });
      }
    }

    logger.info('Grupos gerados com sucesso', { 
      generated: groups.length,
      expected: numGroups,
      participant_id: participantId 
    });

    return groups;
  } catch (error) {
    logger.error('Erro ao gerar grupos da amostra', error as Error);
    return [];
  }
}
