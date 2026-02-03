import { existsSync } from 'fs';
import { join } from 'path';
import { env } from '@/config/env';
import { logger } from '@middleware/logger';
import { errorResponse } from '@middleware/errorHandler';

/**
 * Obtém caminho completo de uma imagem
 */
function getImagePath(filename: string): string | null {
  // Primeiro tenta em FP_gen_0
  const path0 = join(env.getFingerprintImagesPath(0), filename);
  if (existsSync(path0)) {
    return path0;
  }

  // Depois tenta em FP_gen_1
  const path1 = join(env.getFingerprintImagesPath(1), filename);
  if (existsSync(path1)) {
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
    // Converte nome do arquivo: .png original -> nome processado .jpg
    let processedFilename = filename;
    
    if (filename.includes('_v') && filename.endsWith('.png')) {
      // É uma imagem original (ex: fingerprint_7519_v04.png)
      // Determina se é questionada ou padrão pelo contexto
      // Por enquanto, busca por QUESTIONADA.jpg ou PADRAO_XX.jpg
      
      // Tenta primeiro como QUESTIONADA
      const questionadaPath = join(env.SAMPLES_PATH, carryCode, groupId, 'QUESTIONADA.jpg');
      if (existsSync(questionadaPath)) {
        return {
          success: true,
          path: questionadaPath,
          filename: 'QUESTIONADA.jpg',
        };
      }
      
      // Se não é questionada, pode ser um dos padrões - precisa encontrar qual
      // Lista todos os padrões e retorna o primeiro disponível (isso é temporário)
      for (let i = 0; i < 20; i++) {
        const padraoPath = join(env.SAMPLES_PATH, carryCode, groupId, `PADRAO_${String(i).padStart(2, '0')}.jpg`);
        if (existsSync(padraoPath)) {
          // Por enquanto retorna o path do padrão (precisaria de mapeamento melhor)
          // Vamos criar uma abordagem diferente
          break;
        }
      }
    }
    
    // Tenta caminho direto (nome já processado)
    const directPath = join(env.SAMPLES_PATH, carryCode, groupId, processedFilename);
    if (existsSync(directPath)) {
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
