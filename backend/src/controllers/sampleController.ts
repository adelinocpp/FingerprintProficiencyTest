import { queryOne, queryAll, insert } from '@database/db';
import { NotFoundError, successResponse } from '@middleware/errorHandler';
import { Sample, Group, GroupImage } from '../types/index';
import { logger } from '@middleware/logger';

/**
 * Obtém amostras do participante
 */
export async function getParticipantSamples(participantId: string): Promise<any> {
  try {
    const samples = queryAll<Sample>(
      'SELECT * FROM samples WHERE participant_id = :participant_id ORDER BY created_at DESC',
      { participant_id: participantId }
    );

    // Carrega grupos para cada amostra
    const samplesWithGroups = await Promise.all(
      samples.map(async (sample) => {
        const groups = queryAll<Group>(
          'SELECT * FROM groups WHERE sample_id = :sample_id ORDER BY group_index ASC',
          { sample_id: sample.id }
        );
        return { ...sample, groups };
      })
    );

    return successResponse(samplesWithGroups, 'Amostras obtidas com sucesso');
  } catch (error) {
    logger.error('Erro ao obter amostras', error as Error);
    throw error;
  }
}

/**
 * Obtém detalhes de uma amostra
 */
export async function getSampleDetails(
  participantId: string,
  sampleId: string
): Promise<any> {
  try {
    const sample = queryOne<Sample>(
      'SELECT * FROM samples WHERE id = :id AND participant_id = :participant_id',
      { id: sampleId, participant_id: participantId }
    );

    if (!sample) {
      throw new NotFoundError('Amostra');
    }

    // Carrega grupos
    const groups = queryAll<Group>(
      'SELECT * FROM groups WHERE sample_id = :sample_id ORDER BY group_index ASC',
      { sample_id: sampleId }
    );

    // Carrega imagens para cada grupo
    const groupsWithImages = await Promise.all(
      groups.map(async (group) => {
        const images = queryAll<GroupImage>(
          'SELECT * FROM group_images WHERE group_id = :group_id ORDER BY image_type DESC, image_index ASC',
          { group_id: group.id }
        );
        return { ...group, images };
      })
    );

    return successResponse(
      { ...sample, groups: groupsWithImages },
      'Detalhes da amostra obtidos com sucesso'
    );
  } catch (error) {
    logger.error('Erro ao obter detalhes da amostra', error as Error);
    throw error;
  }
}

/**
 * Obtém grupos de uma amostra
 */
export async function getSampleGroups(
  participantId: string,
  sampleId: string
): Promise<any> {
  try {
    const sample = queryOne<Sample>(
      'SELECT * FROM samples WHERE id = :id AND participant_id = :participant_id',
      { id: sampleId, participant_id: participantId }
    );

    if (!sample) {
      throw new NotFoundError('Amostra');
    }

    const groups = queryAll<Group>(
      'SELECT * FROM groups WHERE sample_id = :sample_id ORDER BY group_index ASC',
      { sample_id: sampleId }
    );

    return successResponse(groups, 'Grupos obtidos com sucesso');
  } catch (error) {
    logger.error('Erro ao obter grupos', error as Error);
    throw error;
  }
}

/**
 * Obtém detalhes de um grupo
 */
export async function getGroupDetails(
  participantId: string,
  groupId: string
): Promise<any> {
  try {
    const group = queryOne<Group>(
      `SELECT g.* FROM groups g
       JOIN samples s ON g.sample_id = s.id
       WHERE g.group_id = :group_id AND s.participant_id = :participant_id`,
      { group_id: groupId, participant_id: participantId }
    );

    if (!group) {
      throw new NotFoundError('Grupo');
    }

    // Carrega imagens do grupo
    const images = queryAll<GroupImage>(
      'SELECT * FROM group_images WHERE group_id = :group_id ORDER BY image_type DESC, image_index ASC',
      { group_id: group.id }
    );

    // Carrega resultado se existir
    const result = queryOne<any>(
      'SELECT * FROM results WHERE group_id = :group_id',
      { group_id: group.id }
    );

    return successResponse(
      { ...group, images, result },
      'Detalhes do grupo obtidos com sucesso'
    );
  } catch (error) {
    logger.error('Erro ao obter detalhes do grupo', error as Error);
    throw error;
  }
}

/**
 * Obtém imagens de um grupo
 */
export async function getGroupImages(
  participantId: string,
  groupId: string
): Promise<any> {
  try {
    const group = queryOne<Group>(
      `SELECT g.* FROM groups g
       JOIN samples s ON g.sample_id = s.id
       WHERE g.group_id = :group_id AND s.participant_id = :participant_id`,
      { group_id: groupId, participant_id: participantId }
    );

    if (!group) {
      throw new NotFoundError('Grupo');
    }

    const images = queryAll<GroupImage>(
      'SELECT * FROM group_images WHERE group_id = :group_id ORDER BY image_type DESC, image_index ASC',
      { group_id: group.id }
    );

    return successResponse(images, 'Imagens obtidas com sucesso');
  } catch (error) {
    logger.error('Erro ao obter imagens do grupo', error as Error);
    throw error;
  }
}

/**
 * Obtém imagem específica
 */
export async function getImage(
  participantId: string,
  imageId: string
): Promise<any> {
  try {
    const image = queryOne<GroupImage>(
      `SELECT gi.* FROM group_images gi
       JOIN groups g ON gi.group_id = g.id
       JOIN samples s ON g.sample_id = s.id
       WHERE gi.id = :image_id AND s.participant_id = :participant_id`,
      { image_id: imageId, participant_id: participantId }
    );

    if (!image) {
      throw new NotFoundError('Imagem');
    }

    return successResponse(image, 'Imagem obtida com sucesso');
  } catch (error) {
    logger.error('Erro ao obter imagem', error as Error);
    throw error;
  }
}

/**
 * Obtém progresso de uma amostra
 */
export async function getSampleProgress(
  participantId: string,
  sampleId: string
): Promise<any> {
  try {
    const sample = queryOne<Sample>(
      'SELECT * FROM samples WHERE id = :id AND participant_id = :participant_id',
      { id: sampleId, participant_id: participantId }
    );

    if (!sample) {
      throw new NotFoundError('Amostra');
    }

    const totalGroups = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM groups WHERE sample_id = :sample_id',
      { sample_id: sampleId }
    );

    const completedGroups = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM results WHERE sample_id = :sample_id',
      { sample_id: sampleId }
    );

    const total = totalGroups?.count || 0;
    const completed = completedGroups?.count || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return successResponse(
      {
        total,
        completed,
        remaining: total - completed,
        percentage,
        status: sample.status,
      },
      'Progresso obtido com sucesso'
    );
  } catch (error) {
    logger.error('Erro ao obter progresso', error as Error);
    throw error;
  }
}
