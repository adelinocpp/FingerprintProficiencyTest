import { generateSampleGroups } from '@/services/groupGeneratorService';
import { insert, update, queryOne, queryAll } from '@database/db';
import { generateUUID, formatDate } from '@/utils/helpers';
import { successResponse, errorResponse } from '@middleware/errorHandler';
import { logger } from '@middleware/logger';
import { env } from '@/config/env';
import type { Group, Sample } from '@/types';

/**
 * Gera ID único para o grupo (4 letras + 5 números)
 */
function generateGroupId(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetters = Array.from({ length: 4 }, () => 
    letters[Math.floor(Math.random() * letters.length)]
  ).join('');
  
  const randomNumbers = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  
  return `${randomLetters}${randomNumbers}`;
}

/**
 * Cria grupos para uma amostra
 */
export async function createGroupsForSample(
  sampleId: string,
  participantId?: string
): Promise<any> {
  try {
    logger.info('Iniciando criação de grupos', { 
      sample_id: sampleId,
      participant_id: participantId 
    });

    // Verifica se amostra existe
    const sample = queryOne<Sample>(
      'SELECT * FROM samples WHERE id = $id',
      { id: sampleId }
    );

    if (!sample) {
      return errorResponse('Amostra não encontrada', 'NOT_FOUND');
    }

    // Gera grupos usando o serviço com controle de arquivos por participante
    const groupCandidates = await generateSampleGroups(
      env.GROUPS_PER_SAMPLE,
      participantId
    );

    if (groupCandidates.length === 0) {
      return errorResponse('Não foi possível gerar grupos', 'GENERATION_ERROR');
    }

    const now = formatDate();
    const createdGroups = [];

    // Insere cada grupo no banco
    for (let index = 0; index < groupCandidates.length; index++) {
      const candidate = groupCandidates[index];
      const groupId = generateUUID();
      const groupCode = generateGroupId();

      const groupData = {
        id: groupId,
        sample_id: sampleId,
        group_index: index,
        group_id: groupCode,
        has_same_source: candidate.has_same_source ? 1 : 0,
        questionada_filename: candidate.questionada,
        padroes_filenames: JSON.stringify(candidate.padroes),
        matched_image_index: candidate.matched_index,
        created_at: now,
        status: 'pending',
      };

      insert('groups', groupData);
      createdGroups.push(groupData);

      logger.info('Grupo criado', {
        group_id: groupCode,
        sample_id: sampleId,
        has_match: candidate.has_same_source,
      });
    }

    // Atualiza status da amostra
    update('samples', 
      { status: 'in_progress', updated_at: now },
      { id: sampleId }
    );

    logger.info('Grupos criados com sucesso', {
      sample_id: sampleId,
      total_groups: createdGroups.length,
    });

    return successResponse(
      {
        sample_id: sampleId,
        groups: createdGroups,
        total: createdGroups.length,
      },
      'Grupos criados com sucesso'
    );
  } catch (error) {
    logger.error('Erro ao criar grupos', error as Error);
    throw error;
  }
}

/**
 * Obtém um grupo específico
 */
export async function getGroupById(groupId: string): Promise<any> {
  try {
    const group = queryOne(
      'SELECT * FROM groups WHERE id = $id',
      { id: groupId }
    );

    if (!group) {
      return errorResponse('Grupo não encontrado', 'NOT_FOUND');
    }

    // Parse dos padrões
    const groupData = {
      ...group,
      padroes_filenames: JSON.parse(group.padroes_filenames || '[]'),
    };

    return successResponse(groupData, 'Grupo obtido com sucesso');
  } catch (error) {
    logger.error('Erro ao obter grupo', error as Error);
    throw error;
  }
}

/**
 * Obtém todos os grupos de uma amostra
 */
export async function getGroupsBySample(sampleId: string): Promise<any> {
  try {
    const groups = queryAll(
      'SELECT * FROM groups WHERE sample_id = $sample_id ORDER BY group_index ASC',
      { sample_id: sampleId }
    );

    // Parse dos padrões para cada grupo
    const parsedGroups = groups.map((group: any) => ({
      ...group,
      padroes_filenames: JSON.parse(group.padroes_filenames || '[]'),
    }));

    return successResponse(
      {
        sample_id: sampleId,
        groups: parsedGroups,
        total: parsedGroups.length,
      },
      'Grupos obtidos com sucesso'
    );
  } catch (error) {
    logger.error('Erro ao obter grupos da amostra', error as Error);
    throw error;
  }
}
