import { generateUniqueVoluntaryCode, generateUniqueCarryCode } from '@services/codeGenerator';
import { sendEmail, getWelcomeEmailTemplate } from '@services/emailService';
import { sanitizeString, isValidEmail, isValidName, generateToken, generateSHA256 } from '@utils/security';
import { generateUUID, formatDate } from '@utils/helpers';
import { insert, queryOne, update, queryAll } from '@database/db';
import { validateWithZod } from '@middleware/validation';
import { RegisterSchema, LoginSchema } from '@utils/validators';
import { ValidationError, AuthenticationError, ConflictError, NotFoundError, successResponse, errorResponse } from '@middleware/errorHandler';
import { Participant, LoginResponse, Sample } from '../types/index';
import { env } from '@config/env';
import { logger } from '@middleware/logger';

/**
 * Registra novo participante
 */
export async function registerParticipant(body: any): Promise<any> {
  try {
    // Valida entrada
    const validation = validateWithZod(RegisterSchema, body);
    if (!validation.success) {
      throw new ValidationError('Dados de entrada inválidos', validation.errors);
    }

    const { voluntary_email, voluntary_name, terms_accepted } = validation.data;

    // Debug: verificar dados recebidos
    logger.info('Dados de registro recebidos', {
      voluntary_email,
      voluntary_name,
      terms_accepted,
      emailType: typeof voluntary_email,
      emailLength: voluntary_email?.length
    });

    // Verifica se email já existe
    const existingParticipant = queryOne<Participant>(
      'SELECT id FROM participants WHERE voluntary_email = :email',
      { email: voluntary_email }
    );

    if (existingParticipant) {
      throw new ConflictError('Este email já está cadastrado');
    }

    // Gera códigos únicos
    const voluntary_code = await generateUniqueVoluntaryCode();
    const carry_code = await generateUniqueCarryCode();
    const participant_id = generateUUID();
    const now = formatDate();

    // Prepara dados para inserção
    const insertData = {
      id: participant_id,
      voluntary_email: voluntary_email.toLowerCase().trim(),
      voluntary_code,
      voluntary_name: voluntary_name.trim(),
      carry_code,
      created_at: now,
      updated_at: now,
      status: 'active',
    };

    // Debug: verificar dados antes de inserir
    logger.info('Dados a serem inseridos no banco', {
      insertData,
      emailValue: insertData.voluntary_email,
      emailType: typeof insertData.voluntary_email
    });

    // Insere participante
    insert('participants', insertData);

    logger.info('Novo participante registrado', {
      participant_id,
      email: voluntary_email,
      voluntary_code,
    });

    // Envia email de boas-vindas
    try {
      const emailContent = getWelcomeEmailTemplate(
        voluntary_name,
        voluntary_code,
        carry_code,
        `${env.FRONTEND_URL}/download`,
        env.FRONTEND_URL
      );

      await sendEmail({
        to: voluntary_email,
        subject: '[PESQUISA EM AMOSTRAS DE DIGITAIS] Bem-vindo ao Sistema',
        html: emailContent,
      });

      logger.info('Email de boas-vindas enviado', { email: voluntary_email });
    } catch (emailError) {
      logger.warn('Erro ao enviar email de boas-vindas', { email: voluntary_email });
      // Continua mesmo se email falhar
    }

    return successResponse(
      {
        participant_id,
        voluntary_code,
        carry_code,
        message: 'Cadastro realizado com sucesso. Verifique seu email.',
      },
      'Participante registrado com sucesso'
    );
  } catch (error) {
    logger.error('Erro ao registrar participante', error as Error);
    throw error;
  }
}

/**
 * Faz login do participante
 */
export async function loginParticipant(body: any): Promise<any> {
  try {
    // Valida entrada
    const validation = validateWithZod(LoginSchema, body);
    if (!validation.success) {
      throw new ValidationError('Dados de entrada inválidos', validation.errors);
    }

    const { code } = validation.data;
    const upperCode = code.toUpperCase();

    // Busca participante por VOLUNTARY_CODE ou CARRY_CODE
    let participant = queryOne<Participant>(
      'SELECT * FROM participants WHERE voluntary_code = $code OR carry_code = $code',
      { code: upperCode }
    );

    if (!participant) {
      throw new AuthenticationError('Código inválido');
    }

    if (participant.status === 'expired') {
      throw new AuthenticationError('Sua amostra expirou');
    }

    // Atualiza último acesso
    const now = formatDate();
    update('participants', { last_access: now, updated_at: now }, { id: participant.id });

    // Gera token
    const token = generateToken({
      participant_id: participant.id,
      voluntary_code: participant.voluntary_code,
    });

    // Busca amostras do participante
    const samples = queryAll<Sample>(
      'SELECT * FROM samples WHERE participant_id = $participant_id ORDER BY created_at DESC',
      { participant_id: participant.id }
    );

    logger.info('Participante fez login', {
      participant_id: participant.id,
      voluntary_code: participant.voluntary_code,
    });

    return successResponse<LoginResponse>(
      {
        token,
        participant,
        samples,
      },
      'Login realizado com sucesso'
    );
  } catch (error) {
    logger.error('Erro ao fazer login', error as Error);
    throw error;
  }
}

/**
 * Obtém dados do participante
 */
export async function getParticipant(participantId: string): Promise<any> {
  try {
    const participant = queryOne<Participant>(
      'SELECT * FROM participants WHERE id = :id',
      { id: participantId }
    );

    if (!participant) {
      throw new NotFoundError('Participante');
    }

    return successResponse(participant, 'Participante encontrado');
  } catch (error) {
    logger.error('Erro ao obter participante', error as Error);
    throw error;
  }
}

/**
 * Atualiza dados do participante
 */
export async function updateParticipant(
  participantId: string,
  body: any
): Promise<any> {
  try {
    const participant = queryOne<Participant>(
      'SELECT * FROM participants WHERE id = :id',
      { id: participantId }
    );

    if (!participant) {
      throw new NotFoundError('Participante');
    }

    const updates: any = {};
    const now = formatDate();

    if (body.voluntary_name) {
      if (!isValidName(body.voluntary_name)) {
        throw new ValidationError('Nome inválido');
      }
      updates.voluntary_name = body.voluntary_name.trim();
    }

    if (Object.keys(updates).length === 0) {
      return successResponse(participant, 'Nenhuma alteração realizada');
    }

    updates.updated_at = now;

    update('participants', updates, { id: participantId });

    logger.info('Participante atualizado', { participant_id: participantId });

    const updatedParticipant = queryOne<Participant>(
      'SELECT * FROM participants WHERE id = :id',
      { id: participantId }
    );

    return successResponse(updatedParticipant, 'Participante atualizado com sucesso');
  } catch (error) {
    logger.error('Erro ao atualizar participante', error as Error);
    throw error;
  }
}

/**
 * Verifica se email existe
 */
export async function checkEmailExists(email: string): Promise<any> {
  try {
    if (!isValidEmail(email)) {
      throw new ValidationError('Email inválido');
    }

    const participant = queryOne<Participant>(
      'SELECT id FROM participants WHERE voluntary_email = :email',
      { email: email.toLowerCase() }
    );

    return successResponse(
      { exists: !!participant },
      'Verificação concluída'
    );
  } catch (error) {
    logger.error('Erro ao verificar email', error as Error);
    throw error;
  }
}

/**
 * Verifica se código existe
 */
export async function checkCodeExists(code: string): Promise<any> {
  try {
    const upperCode = code.toUpperCase();

    const participant = queryOne<Participant>(
      'SELECT id FROM participants WHERE voluntary_code = :code OR carry_code = :code',
      { code: upperCode }
    );

    return successResponse(
      { exists: !!participant },
      'Verificação concluída'
    );
  } catch (error) {
    logger.error('Erro ao verificar código', error as Error);
    throw error;
  }
}
