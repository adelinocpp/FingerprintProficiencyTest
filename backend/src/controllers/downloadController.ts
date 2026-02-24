import { queryOne } from '@database/db';
import { NotFoundError } from '@middleware/errorHandler';
import { logger } from '@middleware/logger';
import { existsSync } from 'fs';
import { join } from 'path';
import { env } from '@/config/env';

interface Sample {
  id: string;
  participant_id: string;
  carry_code: string;
  status: string;
}

/**
 * Faz download do ZIP da amostra
 */
export async function downloadSample(sampleId: string, participantId?: string): Promise<{ filePath: string; fileName: string }> {
  try {
    logger.info('Solicitação de download de amostra', { sample_id: sampleId, participant_id: participantId });

    const sample = queryOne<Sample>(
      'SELECT * FROM samples WHERE id = $id',
      { id: sampleId }
    );

    if (!sample) {
      throw new NotFoundError('Amostra não encontrada');
    }

    // Verifica se a amostra pertence ao participante
    if (participantId && sample.participant_id !== participantId) {
      throw new NotFoundError('Amostra não encontrada');
    }

    const zipPath = join(env.SAMPLES_PATH, `${sample.carry_code}.zip`);

    if (!existsSync(zipPath)) {
      logger.error('Arquivo ZIP não encontrado', new Error(`ZIP não encontrado: ${zipPath}`));
      throw new NotFoundError('Arquivo ZIP da amostra não encontrado. Entre em contato com o administrador.');
    }

    logger.info('Download de amostra iniciado', { 
      sample_id: sampleId,
      carry_code: sample.carry_code,
      zip_path: zipPath 
    });

    return {
      filePath: zipPath,
      fileName: `${sample.carry_code}.zip`
    };
  } catch (error) {
    logger.error('Erro ao fazer download da amostra', error as Error);
    throw error;
  }
}
