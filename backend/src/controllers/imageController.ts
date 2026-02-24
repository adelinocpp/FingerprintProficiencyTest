import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { env } from '@/config/env';
import { logger, logSecurityEvent } from '@middleware/logger';
import { errorResponse } from '@middleware/errorHandler';

/**
 * Valida componente de path para prevenir path traversal
 * Rejeita '..', '/', '\' e caracteres de controle
 */
function isSafePathComponent(component: string): boolean {
  if (!component || component.length === 0 || component.length > 255) return false;
  if (component.includes('..') || component.includes('/') || component.includes('\\')) return false;
  if (component.includes('\0') || component.includes('\n') || component.includes('\r')) return false;
  return true;
}

/**
 * Verifica se o path resolvido está dentro do diretório permitido
 */
function isWithinDirectory(filePath: string, allowedDir: string): boolean {
  const resolvedPath = resolve(filePath);
  const resolvedDir = resolve(allowedDir);
  return resolvedPath.startsWith(resolvedDir + '/');
}

/**
 * Obtém caminho completo de uma imagem
 */
function getImagePath(filename: string): string | null {
  if (!isSafePathComponent(filename)) {
    logSecurityEvent('PATH_TRAVERSAL', null, null, { filename, context: 'getImagePath' });
    return null;
  }

  // Primeiro tenta em FP_gen_0
  const dir0 = env.getFingerprintImagesPath(0);
  const path0 = join(dir0, filename);
  if (isWithinDirectory(path0, dir0) && existsSync(path0)) {
    return path0;
  }

  // Depois tenta em FP_gen_1
  const dir1 = env.getFingerprintImagesPath(1);
  const path1 = join(dir1, filename);
  if (isWithinDirectory(path1, dir1) && existsSync(path1)) {
    return path1;
  }

  return null;
}

/**
 * Serve uma imagem de impressão digital
 */
export async function serveImage(filename: string): Promise<any> {
  try {
    const imagePath = getImagePath(filename);

    if (!imagePath) {
      logger.warn('Imagem não encontrada', { filename });
      return errorResponse('Imagem não encontrada', 'NOT_FOUND');
    }

    logger.info('Servindo imagem', { filename, path: imagePath });

    return {
      success: true,
      path: imagePath,
      filename,
    };
  } catch (error) {
    logger.error('Erro ao servir imagem', error as Error);
    throw error;
  }
}

/**
 * Verifica se uma imagem existe
 */
export async function checkImageExists(filename: string): Promise<any> {
  try {
    const imagePath = getImagePath(filename);

    return {
      success: true,
      exists: imagePath !== null,
      filename,
    };
  } catch (error) {
    logger.error('Erro ao verificar imagem', error as Error);
    throw error;
  }
}

/**
 * Serve uma imagem processada de um grupo de amostra
 * Converte automaticamente nomes .png para .jpg
 */
export async function serveSampleImage(
  carryCode: string,
  groupId: string,
  filename: string
): Promise<any> {
  try {
    // Valida todos os componentes do path contra traversal
    if (!isSafePathComponent(carryCode) || !isSafePathComponent(groupId) || !isSafePathComponent(filename)) {
      logSecurityEvent('PATH_TRAVERSAL', null, null, { carryCode, groupId, filename, context: 'serveSampleImage' });
      return errorResponse('Parâmetros inválidos', 'BAD_REQUEST');
    }

    const samplesDir = resolve(env.SAMPLES_PATH);

    // Converte nome do arquivo: .png original -> nome processado .jpg
    let processedFilename = filename;

    if (filename.includes('_v') && filename.endsWith('.png')) {
      // É uma imagem original (ex: fingerprint_7519_v04.png)
      const questionadaPath = join(env.SAMPLES_PATH, carryCode, groupId, 'QUESTIONADA.jpg');
      if (isWithinDirectory(questionadaPath, samplesDir) && existsSync(questionadaPath)) {
        return {
          success: true,
          path: questionadaPath,
          filename: 'QUESTIONADA.jpg',
        };
      }

      for (let i = 0; i < 20; i++) {
        const padraoPath = join(env.SAMPLES_PATH, carryCode, groupId, `PADRAO_${String(i).padStart(2, '0')}.jpg`);
        if (isWithinDirectory(padraoPath, samplesDir) && existsSync(padraoPath)) {
          break;
        }
      }
    }

    // Tenta caminho direto (nome já processado)
    const directPath = join(env.SAMPLES_PATH, carryCode, groupId, processedFilename);
    if (isWithinDirectory(directPath, samplesDir) && existsSync(directPath)) {
      return {
        success: true,
        path: directPath,
        filename: processedFilename,
      };
    }

    logger.warn('Imagem processada não encontrada', {
      carryCode,
      groupId,
      filename,
      processedFilename
    });

    return errorResponse('Imagem não encontrada', 'NOT_FOUND');
  } catch (error) {
    logger.error('Erro ao servir imagem da amostra', error as Error);
    throw error;
  }
}
