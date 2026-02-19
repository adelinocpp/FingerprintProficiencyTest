import { mkdir, copyFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import { env } from '@/config/env';
import { logger } from '@middleware/logger';
import { applyEllipticalBlur } from './imageDegradationService';

interface GroupFiles {
  questionada: string;
  padroes: string[];
  matchedIndex: number | null;
}

/**
 * Obtém caminho completo de uma imagem
 */
export function getImageFullPath(filename: string): string {
  const path0 = join(env.getFingerprintImagesPath(0), filename);
  if (existsSync(path0)) {
    return path0;
  }
  
  const path1 = join(env.getFingerprintImagesPath(1), filename);
  if (existsSync(path1)) {
    return path1;
  }
  
  throw new Error(`Imagem não encontrada: ${filename}`);
}

/**
 * Cria estrutura de diretórios para uma amostra
 */
export async function createSampleDirectoryStructure(
  carryCode: string,
  groupId: string
): Promise<string> {
  const sampleDir = join(env.SAMPLES_PATH, carryCode);
  const groupDir = join(sampleDir, groupId);
  
  // Cria diretórios se não existirem
  if (!existsSync(sampleDir)) {
    await mkdir(sampleDir, { recursive: true });
  }
  
  if (!existsSync(groupDir)) {
    await mkdir(groupDir, { recursive: true });
  }
  
  return groupDir;
}

/**
 * Prepara arquivos físicos de um grupo
 */
export async function prepareGroupFiles(
  carryCode: string,
  groupId: string,
  files: GroupFiles
): Promise<void> {
  try {
    logger.info('Preparando arquivos do grupo', { carry_code: carryCode, group_id: groupId });
    
    const groupDir = await createSampleDirectoryStructure(carryCode, groupId);
    const sharp = (await import('sharp')).default;
    
    // 1. Processa imagem questionada
    const questionadaSource = getImageFullPath(files.questionada);
    const questionadaDest = join(groupDir, 'QUESTIONADA.jpg');
    
    logger.info('Processando questionada', { source: questionadaSource });
    
    //TODO_DEG - Aplica degradação elíptica (motion blur) na imagem questionada
    // O script Python processa a imagem em resolução original
    const degradedTempPath = join(groupDir, 'QUESTIONADA_degraded.png');
    await applyEllipticalBlur(questionadaSource, degradedTempPath);

    // Redimensiona a imagem degradada para 500px de largura
    await sharp(degradedTempPath)
      .resize(500, null, { withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toFile(questionadaDest);

    // Remove arquivo temporário
    const { unlink } = await import('fs/promises');
    await unlink(degradedTempPath).catch(() => {});
    
    // 2. Copia e renomeia imagens padrão (embaralhadas)
    const padroes = [...files.padroes];
    
    // Embaralha mantendo referência do índice do match
    const shuffledIndices = padroes.map((_, i) => i);
    for (let i = shuffledIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
    }
    
    // Redimensiona e salva arquivos com novos nomes
    for (let newIndex = 0; newIndex < padroes.length; newIndex++) {
      const originalIndex = shuffledIndices[newIndex];
      const padraoSource = getImageFullPath(padroes[originalIndex]);
      const padraoDest = join(groupDir, `PADRAO_${String(newIndex).padStart(2, '0')}.jpg`);
      
      // Redimensiona para 500px de largura mantendo proporção
      await sharp(padraoSource)
        .resize(500, null, { withoutEnlargement: true })
        .jpeg({ quality: 95 })
        .toFile(padraoDest);
    }
    
    logger.info('Arquivos do grupo preparados', { 
      group_dir: groupDir,
      total_files: padroes.length + 1 
    });
  } catch (error) {
    logger.error('Erro ao preparar arquivos do grupo', error as Error);
    throw error;
  }
}

/**
 * Compacta diretório da amostra em ZIP
 */
export async function compressSample(carryCode: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const sampleDir = join(env.SAMPLES_PATH, carryCode);
      const zipPath = join(env.SAMPLES_PATH, `${carryCode}.zip`);
      
      logger.info('Compactando amostra', { sample_dir: sampleDir, zip_path: zipPath });
      
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Máxima compressão
      });
      
      output.on('close', () => {
        logger.info('Amostra compactada', { 
          zip_path: zipPath,
          size_bytes: archive.pointer()
        });
        resolve(zipPath);
      });
      
      archive.on('error', (err: Error) => {
        logger.error('Erro ao compactar amostra', err);
        reject(err);
      });
      
      archive.pipe(output);
      archive.directory(sampleDir, carryCode);
      archive.finalize();
    } catch (error) {
      logger.error('Erro ao compactar amostra', error as Error);
      reject(error);
    }
  });
}

/**
 * Remove diretório e ZIP de uma amostra
 */
export async function cleanupSample(carryCode: string): Promise<void> {
  try {
    const sampleDir = join(env.SAMPLES_PATH, carryCode);
    const zipPath = join(env.SAMPLES_PATH, `${carryCode}.zip`);
    
    if (existsSync(sampleDir)) {
      await rm(sampleDir, { recursive: true, force: true });
      logger.info('Diretório da amostra removido', { sample_dir: sampleDir });
    }
    
    if (existsSync(zipPath)) {
      await rm(zipPath, { force: true });
      logger.info('ZIP da amostra removido', { zip_path: zipPath });
    }
  } catch (error) {
    logger.error('Erro ao limpar amostra', error as Error);
    throw error;
  }
}
