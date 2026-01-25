import { generateUniqueVoluntaryCode, generateUniqueCarryCode } from '@services/codeGenerator';
import { sendEmail, getWelcomeEmailTemplate, getReminderEmailTemplate } from '@services/emailService';
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
      'SELECT * FROM participants WHERE voluntary_email = :email',
      { email: voluntary_email.toLowerCase().trim() }
    );

    if (existingParticipant) {
      // Reenviar códigos para email já cadastrado
      logger.info('Email já cadastrado, reenviando códigos', {
        email: voluntary_email,
        participant_id: existingParticipant.id,
        email_verified: existingParticipant.email_verified
      });

      let responseMessage = 'Este email já está cadastrado. Reenviamos seus códigos de acesso por email.';

      try {
        let emailContent: string;
        let emailSubject: string;

        // Se email NÃO foi validado, gera novo token e reenvia email de boas-vindas
        if (existingParticipant.email_verified === 0) {
          const new_verification_token = generateUUID();
          const now = formatDate();
          // Token expira em 48 horas
          const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
          
          // Atualiza token no banco
          update('participants', 
            { 
              email_verification_token: new_verification_token,
              token_expires_at: expiresAt,
              updated_at: now
            }, 
            { id: existingParticipant.id }
          );

          const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${new_verification_token}`;
          
          emailContent = getWelcomeEmailTemplate(
            existingParticipant.voluntary_name,
            existingParticipant.voluntary_code,
            existingParticipant.carry_code,
            verificationUrl,
            env.FRONTEND_URL
          );
          
          emailSubject = '[PESQUISA EM AMOSTRAS DE DIGITAIS] Bem-vindo ao Sistema';
          responseMessage = 'Este email já está cadastrado mas não foi validado. Reenviamos o email de validação.';
          
          logger.info('Novo token de validação gerado', { 
            participant_id: existingParticipant.id,
            new_token: new_verification_token
          });
        } else {
          // Email já validado, envia lembrete
          emailContent = getReminderEmailTemplate(
            existingParticipant.voluntary_name,
            existingParticipant.voluntary_code,
            existingParticipant.carry_code,
            env.FRONTEND_URL
          );
          
          emailSubject = '[PESQUISA EM AMOSTRAS DE DIGITAIS] Seus Códigos de Acesso';
          responseMessage = 'Este email já está cadastrado e validado. Reenviamos seus códigos de acesso por email.';
        }

        await sendEmail({
          to: voluntary_email,
          subject: emailSubject,
          html: emailContent,
        });

        logger.info('Email reenviado com sucesso', { 
          email: voluntary_email,
          email_verified: existingParticipant.email_verified 
        });
      } catch (emailError) {
        logger.warn('Erro ao reenviar email', { email: voluntary_email });
      }

      return successResponse(
        {
          already_registered: true,
          participant_id: existingParticipant.id,
          voluntary_code: existingParticipant.voluntary_code,
          carry_code: existingParticipant.carry_code,
          email_verified: existingParticipant.email_verified === 1,
          message: responseMessage || 'Este email já está cadastrado. Reenviamos seus códigos de acesso por email.',
        },
        'Email reenviado'
      );
    }

    // Gera códigos únicos
    const voluntary_code = await generateUniqueVoluntaryCode();
    const carry_code = await generateUniqueCarryCode();
    const participant_id = generateUUID();
    const email_verification_token = generateUUID();
    const now = formatDate();
    // Token expira em 48 horas
    const token_expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    // Prepara dados para inserção
    const insertData = {
      id: participant_id,
      voluntary_email: voluntary_email.toLowerCase().trim(),
      voluntary_code,
      voluntary_name: voluntary_name.trim(),
      carry_code,
      email_verified: 0,
      email_verification_token,
      token_expires_at,
      email_verified_at: null,
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

    // Envia email de boas-vindas com link de verificação
    try {
      const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${email_verification_token}`;
      const emailContent = getWelcomeEmailTemplate(
        voluntary_name,
        voluntary_code,
        carry_code,
        verificationUrl,
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
        message: 'Cadastro realizado com sucesso. Verifique seu email para validar sua conta.',
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

    // Verifica se email foi validado
    if (participant.email_verified === 0) {
      // Reenvia email de validação
      try {
        const new_verification_token = generateUUID();
        const now = formatDate();
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        
        update('participants', 
          { 
            email_verification_token: new_verification_token,
            token_expires_at: expiresAt,
            updated_at: now
          }, 
          { id: participant.id }
        );

        const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${new_verification_token}`;
        
        const emailContent = getWelcomeEmailTemplate(
          participant.voluntary_name,
          participant.voluntary_code,
          participant.carry_code,
          verificationUrl,
          env.FRONTEND_URL
        );
        
        await sendEmail({
          to: participant.voluntary_email,
          subject: '[PESQUISA EM AMOSTRAS DE DIGITAIS] Bem-vindo ao Sistema',
          html: emailContent,
        });

        logger.info('Email de validação reenviado (login sem validação)', { 
          participant_id: participant.id,
          email: participant.voluntary_email
        });
      } catch (emailError) {
        logger.warn('Erro ao reenviar email de validação no login', { 
          participant_id: participant.id 
        });
      }
      
      throw new AuthenticationError('Você precisa validar seu email antes de fazer login. Reenviamos o email de validação para você.');
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

/**
 * Recupera código enviando email
 */
export async function forgotCode(body: any): Promise<any> {
  try {
    const { email } = body;
    
    if (!email || typeof email !== 'string') {
      throw new ValidationError('Email é obrigatório');
    }

    const voluntary_email = email.toLowerCase().trim();

    // Busca participante por email
    const participant = queryOne<Participant>(
      'SELECT * FROM participants WHERE voluntary_email = $email',
      { email: voluntary_email }
    );

    if (!participant) {
      // Não revela se email existe ou não (segurança)
      return successResponse(
        { 
          email_sent: true,
          registered: false,
          message: 'Se este email estiver cadastrado, você receberá um email com seus códigos de acesso.' 
        },
        'Verificação de email'
      );
    }

    logger.info('Recuperação de código solicitada', {
      email: voluntary_email,
      participant_id: participant.id,
      email_verified: participant.email_verified
    });

    try {
      let emailContent: string;
      let emailSubject: string;

      // Se email NÃO foi validado, gera novo token e reenvia email de boas-vindas
      if (participant.email_verified === 0) {
        const new_verification_token = generateUUID();
        const now = formatDate();
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        
        // Atualiza token no banco
        update('participants', 
          { 
            email_verification_token: new_verification_token,
            token_expires_at: expiresAt,
            updated_at: now
          }, 
          { id: participant.id }
        );

        const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${new_verification_token}`;
        
        emailContent = getWelcomeEmailTemplate(
          participant.voluntary_name,
          participant.voluntary_code,
          participant.carry_code,
          verificationUrl,
          env.FRONTEND_URL
        );
        
        emailSubject = '[PESQUISA EM AMOSTRAS DE DIGITAIS] Bem-vindo ao Sistema';
        
        logger.info('Novo token de validação gerado (forgot code)', { 
          participant_id: participant.id,
          new_token: new_verification_token
        });
      } else {
        // Email já validado, envia lembrete
        emailContent = getReminderEmailTemplate(
          participant.voluntary_name,
          participant.voluntary_code,
          participant.carry_code,
          env.FRONTEND_URL
        );
        
        emailSubject = '[PESQUISA EM AMOSTRAS DE DIGITAIS] Seus Códigos de Acesso';
      }

      await sendEmail({
        to: voluntary_email,
        subject: emailSubject,
        html: emailContent,
      });

      logger.info('Email de recuperação enviado', { 
        email: voluntary_email,
        email_verified: participant.email_verified 
      });
    } catch (emailError) {
      logger.warn('Erro ao enviar email de recuperação', { email: voluntary_email });
    }

    return successResponse(
      {
        email_sent: true,
        registered: true,
        email_verified: participant.email_verified === 1,
        message: 'Email enviado com seus códigos de acesso.'
      },
      'Email enviado'
    );
  } catch (error) {
    logger.error('Erro ao recuperar código', error as Error);
    throw error;
  }
}

/**
 * Valida email através do token
 */
export async function verifyEmail(token: string): Promise<any> {
  try {
    if (!token || token.trim().length === 0) {
      throw new ValidationError('Token de verificação inválido');
    }

    const participant = queryOne<Participant>(
      'SELECT * FROM participants WHERE email_verification_token = $token',
      { token: token.trim() }
    );

    if (!participant) {
      throw new NotFoundError('Token de verificação inválido ou expirado');
    }

    // Verifica se token expirou (48 horas)
    if (participant.token_expires_at) {
      const expiresAt = new Date(participant.token_expires_at);
      const now = new Date();
      
      if (now > expiresAt) {
        logger.warn('Token expirado', {
          participant_id: participant.id,
          expires_at: participant.token_expires_at,
          current_time: now.toISOString()
        });
        throw new ValidationError('Token de verificação expirado. Solicite um novo cadastro.');
      }
    }

    if (participant.email_verified === 1) {
      return successResponse(
        { 
          already_verified: true,
          message: 'Email já foi validado anteriormente' 
        },
        'Email já validado'
      );
    }

    const now = formatDate();
    
    update('participants', 
      { 
        email_verified: 1,
        email_verified_at: now,
        email_verification_token: null,
        token_expires_at: null,
        updated_at: now
      }, 
      { id: participant.id }
    );

    logger.info('Email verificado com sucesso', {
      participant_id: participant.id,
      email: participant.voluntary_email
    });

    return successResponse(
      {
        verified: true,
        participant_id: participant.id,
        voluntary_name: participant.voluntary_name,
        message: 'Email validado com sucesso! Você já pode fazer login.'
      },
      'Email validado com sucesso'
    );
  } catch (error) {
    logger.error('Erro ao validar email', error as Error);
    throw error;
  }
}
