import { insert, queryOne, queryAll, update } from '@database/db';
import { validateWithZod } from '@middleware/validation';
import { ResultSubmissionSchema } from '@utils/validators';
import { ValidationError, NotFoundError, successResponse } from '@middleware/errorHandler';
import { Result, Sample, Group } from '../types/index';
import { generateUUID, formatDate } from '@utils/helpers';
import { isValidImageIndex, isValidCompatibilityDegree } from '@utils/security';
import { sendEmail, getCertificateEmailTemplate } from '@services/emailService';
import { createCertificateData, generateCertificateHTML, generateCertificatePDF } from '@services/certificateService';
import { logger } from '@middleware/logger';
import { env } from '@config/env';

/**
 * Submete resultado de um grupo
 */
export async function submitGroupResult(
  participantId: string,
  body: any
): Promise<any> {
  try {
    // Valida entrada
    const validation = validateWithZod(ResultSubmissionSchema, body);
    if (!validation.success) {
      throw new ValidationError('Dados de entrada inválidos', validation.errors);
    }

    const {
      group_id,
      conclusive,
      has_match,
      matched_image_index,
      compatibility_degree,
      notes,
    } = validation.data;

    // Busca o grupo pelo group_id (código ABCD12345)
    logger.info('Buscando grupo:', { group_id });
    logger.info('Query SQL:', 'SELECT * FROM groups WHERE group_id = :group_id');
    logger.info('Params:', { group_id });
    const group = queryOne<Group>(
      'SELECT * FROM groups WHERE group_id = :group_id',
      { group_id }
    );
    logger.info('Grupo encontrado:', group);
    logger.info('Tipo do resultado:', typeof group);

    if (!group) {
      logger.error(`Grupo não encontrado no banco: ${group_id}`);
      throw new NotFoundError('Grupo');
    }

    // Busca a amostra
    const sample = queryOne<Sample>(
      'SELECT * FROM samples WHERE id = :id AND participant_id = :participant_id',
      { id: group.sample_id, participant_id: participantId }
    );

    if (!sample) {
      throw new ValidationError('Você não tem permissão para acessar este grupo');
    }

    // Valida dados do resultado
    if (conclusive) {
      if (has_match === null || has_match === undefined) {
        throw new ValidationError('Você deve indicar se há correspondência');
      }

      if (has_match && (matched_image_index === null || matched_image_index === undefined)) {
        throw new ValidationError('Você deve indicar qual imagem corresponde');
      }

      if (has_match && !isValidImageIndex(matched_image_index)) {
        throw new ValidationError('Índice de imagem inválido');
      }

      if (has_match && (compatibility_degree === null || compatibility_degree === undefined)) {
        throw new ValidationError('Você deve indicar o grau de compatibilidade');
      }

      if (has_match && !isValidCompatibilityDegree(compatibility_degree)) {
        throw new ValidationError('Grau de compatibilidade inválido (deve ser 1-4)');
      }
    }

    // Verifica se já existe resultado para este grupo
    const existingResult = queryOne<Result>(
      'SELECT id FROM results WHERE sample_id = :sample_id AND group_id = :group_id',
      { sample_id: group.sample_id, group_id: group.id }
    );

    const now = formatDate();
    const resultId = generateUUID();

    if (existingResult) {
      // Atualiza resultado existente
      update('results', {
        conclusive: conclusive ? 1 : 0,
        has_match: has_match !== null ? (has_match ? 1 : 0) : null,
        matched_image_index,
        compatibility_degree,
        notes,
        submitted_at: now,
      }, { id: existingResult.id });

      logger.info('Resultado atualizado', {
        participant_id: participantId,
        group_id,
        result_id: existingResult.id,
      });
    } else {
      // Insere novo resultado
      insert('results', {
        id: resultId,
        sample_id: group.sample_id,
        group_id: group.id,
        conclusive: conclusive ? 1 : 0,
        has_match: has_match !== null ? (has_match ? 1 : 0) : null,
        matched_image_index,
        compatibility_degree,
        notes,
        submitted_at: now,
      });

      logger.info('Novo resultado criado', {
        participant_id: participantId,
        group_id,
        result_id: resultId,
      });
    }

    // Atualiza status do grupo
    update('groups', { status: 'completed' }, { id: group.id });

    // Verifica se todos os grupos foram completados
    const pendingGroups = queryAll<Group>(
      'SELECT id FROM groups WHERE sample_id = :sample_id AND status = :status',
      { sample_id: group.sample_id, status: 'pending' }
    );

    if (pendingGroups.length === 0) {
      // Todos os grupos foram completados
      await completeSample(participantId, group.sample_id);
    }

    return successResponse(
      { group_id, message: 'Resultado submetido com sucesso' },
      'Resultado registrado'
    );
  } catch (error) {
    logger.error('Erro ao submeter resultado', error as Error);
    throw error;
  }
}

/**
 * Marca amostra como completa
 */
async function completeSample(participantId: string, sampleId: string): Promise<void> {
  try {
    const sample = queryOne<Sample>(
      'SELECT * FROM samples WHERE id = :id AND participant_id = :participant_id',
      { id: sampleId, participant_id: participantId }
    );

    if (!sample) {
      throw new NotFoundError('Amostra');
    }

    // Atualiza status da amostra
    const now = formatDate();
    update('samples', { status: 'completed', updated_at: now }, { id: sampleId });

    // Conta grupos avaliados
    const results = queryAll<Result>(
      'SELECT id FROM results WHERE sample_id = :sample_id',
      { sample_id: sampleId }
    );

    // Busca dados do participante
    const participant = queryOne<any>(
      'SELECT * FROM participants WHERE id = :id',
      { id: participantId }
    );

    if (!participant) {
      throw new NotFoundError('Participante');
    }

    // Gera certificado
    const certificateData = createCertificateData(
      participant.voluntary_name,
      participant.voluntary_code,
      participant.carry_code,
      results.length
    );

    const certificateHTML = generateCertificateHTML(certificateData);
    const certificatePath = `${env.SAMPLES_PATH}/certificates/${participant.carry_code}_certificate.pdf`;

    await generateCertificatePDF(certificateHTML, certificatePath);

    // Insere registro de certificado
    insert('certificates', {
      id: generateUUID(),
      participant_id: participantId,
      sample_id: sampleId,
      certificate_code: certificateData.certificate_id,
      issued_at: now,
      file_path: certificatePath,
    });

    // Envia email com certificado
    try {
      const emailContent = getCertificateEmailTemplate(
        participant.voluntary_name,
        participant.voluntary_code,
        participant.carry_code,
        certificateData.completion_date,
        results.length,
        certificateData.certificate_id
      );

      await sendEmail({
        to: participant.voluntary_email,
        subject: '[PESQUISA EM AMOSTRAS DE DIGITAIS] Certificado de Participação',
        html: emailContent,
        attachments: [
          {
            filename: `certificado_${participant.carry_code}.pdf`,
            path: certificatePath
          }
        ]
      });

      logger.info('Email com certificado enviado', {
        participant_id: participantId,
        email: participant.voluntary_email,
      });
    } catch (emailError) {
      logger.warn('Erro ao enviar email com certificado', {
        participant_id: participantId,
        error: (emailError as Error).message,
      });
    }

    // Atualiza status do participante
    update('participants', { status: 'completed', updated_at: now }, { id: participantId });

    logger.info('Amostra completada', {
      participant_id: participantId,
      sample_id: sampleId,
      groups_evaluated: results.length,
    });
  } catch (error) {
    logger.error('Erro ao completar amostra', error as Error);
    throw error;
  }
}

/**
 * Obtém resultados de uma amostra
 */
export async function getSampleResults(
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

    const results = queryAll<Result>(
      'SELECT * FROM results WHERE sample_id = :sample_id ORDER BY submitted_at DESC',
      { sample_id: sampleId }
    );

    return successResponse(
      { sample, results },
      'Resultados obtidos com sucesso'
    );
  } catch (error) {
    logger.error('Erro ao obter resultados', error as Error);
    throw error;
  }
}

/**
 * Obtém resultado de um grupo específico
 */
export async function getGroupResult(
  participantId: string,
  groupId: string
): Promise<any> {
  try {
    const result = queryOne<Result>(
      `SELECT r.* FROM results r
       JOIN groups g ON r.group_id = g.id
       JOIN samples s ON r.sample_id = s.id
       WHERE g.group_id = :group_id AND s.participant_id = :participant_id`,
      { group_id: groupId, participant_id: participantId }
    );

    if (!result) {
      return successResponse(null, 'Nenhum resultado encontrado');
    }

    return successResponse(result, 'Resultado obtido com sucesso');
  } catch (error) {
    logger.error('Erro ao obter resultado do grupo', error as Error);
    throw error;
  }
}

/**
 * Obtém estatísticas de resultados
 */
export async function getResultsStatistics(participantId: string): Promise<any> {
  try {
    const stats = queryOne<any>(
      `SELECT 
        COUNT(DISTINCT s.id) as total_samples,
        COUNT(DISTINCT g.id) as total_groups,
        COUNT(r.id) as total_results,
        SUM(CASE WHEN r.conclusive = 1 THEN 1 ELSE 0 END) as conclusive_results,
        SUM(CASE WHEN r.has_match = 1 THEN 1 ELSE 0 END) as with_match,
        SUM(CASE WHEN r.has_match = 0 THEN 1 ELSE 0 END) as without_match
      FROM samples s
      LEFT JOIN groups g ON s.id = g.sample_id
      LEFT JOIN results r ON g.id = r.group_id
      WHERE s.participant_id = :participant_id`,
      { participant_id: participantId }
    );

    return successResponse(stats || {}, 'Estatísticas obtidas com sucesso');
  } catch (error) {
    logger.error('Erro ao obter estatísticas', error as Error);
    throw error;
  }
}
