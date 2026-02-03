import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { queryAll, queryOne, insert } from '@database/db';
import { generateUUID, formatDate } from '@/utils/helpers';
import { logger } from '@middleware/logger';
import { getImageFullPath } from './samplePreparationService';

interface FileTracking {
  id: string;
  participant_id: string;
  file_name: string;
  file_path: string;
  sha256_hash: string;
  used_at: string;
}

/**
 * Calcula hash SHA256 de um arquivo
 */
export function calculateFileSHA256(filePath: string): string {
  try {
    const fileBuffer = readFileSync(filePath);
    const hashSum = createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (error) {
    logger.error('Erro ao calcular SHA256', { filePath, error });
    throw error;
  }
}

/**
 * Verifica se um arquivo já foi usado por um participante
 */
export function hasFileBeenUsed(
  participantId: string,
  fileName: string
): boolean {
  try {
    const tracking = queryOne<FileTracking>(
      'SELECT * FROM file_tracking WHERE participant_id = $participant_id AND file_name = $file_name',
      { participant_id: participantId, file_name: fileName }
    );
    
    return tracking !== undefined;
  } catch (error) {
    logger.error('Erro ao verificar uso de arquivo', { participantId, fileName, error });
    return false;
  }
}

/**
 * Obtém lista de arquivos já usados por um participante
 */
export function getUsedFilesByParticipant(participantId: string): string[] {
  try {
    const tracking = queryAll<FileTracking>(
      'SELECT file_name FROM file_tracking WHERE participant_id = $participant_id',
      { participant_id: participantId }
    );
    
    return tracking.map(t => t.file_name);
  } catch (error) {
    logger.error('Erro ao obter arquivos usados', { participantId, error });
    return [];
  }
}

/**
 * Registra uso de um arquivo por um participante
 */
export function trackFileUsage(
  participantId: string,
  fileName: string
): void {
  try {
    const filePath = getImageFullPath(fileName);
    const sha256Hash = calculateFileSHA256(filePath);
    const now = formatDate();
    
    insert('file_tracking', {
      id: generateUUID(),
      participant_id: participantId,
      file_name: fileName,
      file_path: filePath,
      sha256_hash: sha256Hash,
      used_at: now,
    });
    
    logger.info('Arquivo rastreado', { 
      participant_id: participantId, 
      file_name: fileName,
      sha256: sha256Hash.substring(0, 16) + '...'
    });
  } catch (error) {
    logger.error('Erro ao rastrear arquivo', { participantId, fileName, error });
    throw error;
  }
}

/**
 * Registra múltiplos arquivos de uma vez
 */
export function trackMultipleFiles(
  participantId: string,
  fileNames: string[]
): void {
  try {
    for (const fileName of fileNames) {
      // Verifica se já foi registrado para evitar duplicatas
      if (!hasFileBeenUsed(participantId, fileName)) {
        trackFileUsage(participantId, fileName);
      }
    }
    
    logger.info('Múltiplos arquivos rastreados', { 
      participant_id: participantId, 
      total: fileNames.length 
    });
  } catch (error) {
    logger.error('Erro ao rastrear múltiplos arquivos', { participantId, error });
    throw error;
  }
}

/**
 * Filtra lista de arquivos removendo os já usados por um participante
 */
export function filterUnusedFiles(
  participantId: string,
  fileNames: string[]
): string[] {
  const usedFiles = getUsedFilesByParticipant(participantId);
  const usedSet = new Set(usedFiles);
  
  const unusedFiles = fileNames.filter(fileName => !usedSet.has(fileName));
  
  logger.info('Arquivos filtrados', {
    participant_id: participantId,
    total: fileNames.length,
    used: usedFiles.length,
    available: unusedFiles.length
  });
  
  return unusedFiles;
}
