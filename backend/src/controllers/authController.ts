import { generateUniqueVoluntaryCode, generateUniqueCarryCode } from '@services/codeGenerator';
import { sendEmail, getWelcomeEmailTemplate, getReminderEmailTemplate } from '@services/emailService';
import { sanitizeString, isValidEmail, isValidName, generateToken, generateSHA256, generateRefreshToken } from '@utils/security';
import { generateUUID, formatDate } from '@utils/helpers';
import { insert, queryOne, update, queryAll, execute } from '@database/db';
import { validateWithZod } from '@middleware/validation';
import { RegisterSchema, LoginSchema } from '@utils/validators';
import { ValidationError, AuthenticationError, ConflictError, NotFoundError, successResponse, errorResponse } from '@middleware/errorHandler';
import { recordAccountFailure, clearAccountFailures, isAccountLocked } from '@middleware/auth';
import { Participant, LoginResponse, Sample } from '../types/index';
import { env } from '@config/env';
import { logger, logSecurityEvent } from '@middleware/logger';

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

          // Armazena hash do token no banco (segurança)
          update('participants',
            {
              email_verification_token: generateSHA256(new_verification_token),
              token_expires_at: expiresAt,
              updated_at: now
            },
            { id: existingParticipant.id }
          );

          // Envia token em texto plano no email
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

    // Prepara dados para inserção (armazena hash do token)
    const insertData = {
      id: participant_id,
      voluntary_email: voluntary_email.toLowerCase().trim(),
      voluntary_code,
      voluntary_name: sanitizeString(voluntary_name.trim()),
      carry_code,
      email_verified: 0,
      email_verification_token: generateSHA256(email_verification_token),
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

    // Verifica lockout por conta (M - proteção contra brute force)
    if (isAccountLocked(upperCode)) {
      logSecurityEvent('ACCOUNT_LOCKED', null, null, { code: upperCode });
      throw new AuthenticationError('Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em 30 minutos.');
    }

    // Busca participante por VOLUNTARY_CODE ou CARRY_CODE
    let participant = queryOne<Participant>(
      'SELECT * FROM participants WHERE voluntary_code = $code OR carry_code = $code',
      { code: upperCode }
    );

    if (!participant) {
      recordAccountFailure(upperCode);
      logSecurityEvent('AUTH_FAILURE', null, null, { code: upperCode, reason: 'code_not_found' });
      throw new AuthenticationError('Código inválido');
    }

    if (participant.status === 'expired') {
      throw new AuthenticationError('Sua amostra expirou');
    }

    // Verifica se email foi validado
    if (participant.email_verified === 0) {
      logSecurityEvent('AUTH_UNVERIFIED', null, participant.id, { code: upperCode });
      // Reenvia email de validação
      try {
        const new_verification_token = generateUUID();
        const now = formatDate();
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

        // Armazena hash do token no banco (segurança)
        update('participants',
          {
            email_verification_token: generateSHA256(new_verification_token),
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

    // Login bem-sucedido - limpa contador de falhas
    clearAccountFailures(upperCode);

    // Atualiza último acesso
    const now = formatDate();
    update('participants', { last_access: now, updated_at: now }, { id: participant.id });

    // Gera access token (curta duração, definido em JWT_EXPIRATION)
    const token = generateToken({
      participant_id: participant.id,
      voluntary_code: participant.voluntary_code,
    });

    // Gera refresh token (longa duração, armazenado no DB)
    const refreshTokenPlain = generateRefreshToken();
    const refreshTokenHash = generateSHA256(refreshTokenPlain);
    const refreshExpiresAt = new Date(
      Date.now() + env.REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    // Remove refresh tokens antigos deste participante (máximo 5 sessões ativas)
    const existingTokens = queryAll<{ id: string }>(
      'SELECT id FROM refresh_tokens WHERE participant_id = $participant_id ORDER BY created_at ASC',
      { participant_id: participant.id }
    );
    if (existingTokens.length >= 5) {
      const toDelete = existingTokens.slice(0, existingTokens.length - 4);
      for (const t of toDelete) {
        execute('DELETE FROM refresh_tokens WHERE id = :id', { id: t.id });
      }
    }

    // Armazena hash do refresh token
    insert('refresh_tokens', {
      id: generateUUID(),
      participant_id: participant.id,
      token_hash: refreshTokenHash,
      expires_at: refreshExpiresAt,
      created_at: now,
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

    return successResponse(
      {
        token,
        refresh_token: refreshTokenPlain,
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
      updates.voluntary_name = sanitizeString(body.voluntary_name.trim());
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

        // Armazena hash do token no banco (segurança)
        update('participants',
          {
            email_verification_token: generateSHA256(new_verification_token),
            token_expires_at: expiresAt,
            updated_at: now
          },
          { id: participant.id }
        );

        // Envia token em texto plano no email
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
//TODO_VALIDAR EMAIL - Função principal de validação de email
export async function verifyEmail(token: string): Promise<any> {
  try {
    //TODO_VALIDAR EMAIL - Valida se token foi fornecido
    if (!token || token.trim().length === 0) {
      throw new ValidationError('Token de verificação inválido');
    }

    //TODO_VALIDAR EMAIL - Busca participante pelo hash do token
    const tokenHash = generateSHA256(token.trim());
    let participant = queryOne<Participant>(
      'SELECT * FROM participants WHERE email_verification_token = $token',
      { token: tokenHash }
    );

    //TODO_VALIDAR EMAIL - Se não encontrou, token pode estar expirado ou já validado
    if (!participant) {
      throw new NotFoundError('Token de verificação inválido ou expirado. Se você já validou anteriormente, faça login diretamente.');
    }

    //TODO_VALIDAR EMAIL - Verifica se email já foi validado anteriormente
    if (participant.email_verified === 1) {
      // Limpa o token se ainda estiver presente
      if (participant.email_verification_token) {
        const now = formatDate();
        update('participants', 
          { 
            email_verification_token: null,
            token_expires_at: null,
            updated_at: now
          }, 
          { id: participant.id }
        );
      }
      
      return successResponse(
        { 
          already_verified: true,
          participant_id: participant.id,
          voluntary_name: participant.voluntary_name,
          message: 'Email já foi validado anteriormente. Você pode fazer login.' 
        },
        'Email já validado'
      );
    }

    //TODO_VALIDAR EMAIL - Verifica expiração do token (48 horas)
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

    //TODO_VALIDAR EMAIL - Atualiza participante como verificado
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

    // Cria amostra automaticamente após validação
    try {
      const { createSampleForParticipant } = await import('./sampleController');
      const sampleResult = await createSampleForParticipant(participant.id, participant.carry_code);
      
      logger.info('Amostra criada automaticamente após validação', {
        participant_id: participant.id,
        carry_code: participant.carry_code
      });

      //TODO_VALIDAR EMAIL - Envia notificação por email (sem anexo)
      if (sampleResult.success && sampleResult.data?.zip_path) {
        logger.info('Amostra pronta para download no dashboard', {
          participant_id: participant.id,
          carry_code: participant.carry_code,
          zip_path: sampleResult.data.zip_path
        });
        
        // Envia email SEM anexo (apenas link para download)
        try {
          const { sendEmail } = await import('@/services/emailService');
          
          const downloadUrl = `${env.FRONTEND_URL}/dashboard`;
          const emailContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
                .content { background: #f9fafb; padding: 30px; }
                .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .info-box { background: white; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>✅ Sua Amostra Está Pronta!</h1>
                </div>
                <div class="content">
                  <p>Olá, <strong>${participant.voluntary_name}</strong>!</p>
                  
                  <p>Sua amostra de teste foi gerada com sucesso e está disponível para download no dashboard.</p>
                  
                  <div class="info-box">
                    <p><strong>📋 Informações da Amostra:</strong></p>
                    <ul>
                      <li><strong>Código do Participante:</strong> ${participant.voluntary_code}</li>
                      <li><strong>Código da Amostra:</strong> ${participant.carry_code}</li>
                      <li><strong>Total de Grupos:</strong> ${sampleResult.data.total_groups || 10}</li>
                    </ul>
                  </div>
                  
                  <p><strong>📦 Como fazer o download:</strong></p>
                  <ol>
                    <li>Acesse o dashboard usando o link abaixo</li>
                    <li>Faça login com seu código: <strong>${participant.voluntary_code}</strong></li>
                    <li>Clique no botão "Baixar Amostra (ZIP)"</li>
                  </ol>
                  
                  <div style="text-align: center;">
                    <a href="${downloadUrl}" class="button" style="color: white;">🔗 Acessar Dashboard</a>
                  </div>
                  
                  <p><em>Nota: O arquivo ZIP contém todas as imagens organizadas por grupo. Tamanho aproximado: 20-30 MB.</em></p>
                </div>
                <div class="footer">
                  <p>Pesquisa em Amostras de Digitais - Teste de Proficiência</p>
                  <p>Este é um email automático, não responda.</p>
                </div>
              </div>
            </body>
            </html>
          `;
          
          await sendEmail({
            to: participant.voluntary_email,
            subject: `[PESQUISA EM AMOSTRAS DE DIGITAIS - ${participant.carry_code}] Sua Amostra Está Pronta para Download`,
            html: emailContent,
          });

          logger.info('Email de notificação enviado', {
            participant_id: participant.id,
            carry_code: participant.carry_code,
          });
        } catch (emailError) {
          logger.error('Erro ao enviar email de notificação', emailError as Error);
          // Não falha se email não for enviado
        }
      }
    } catch (sampleError) {
      logger.error('Erro ao criar/enviar amostra após validação', sampleError as Error);
      // Não falha a validação se houver erro na criação da amostra
    }

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

/**
 * Renova access token usando refresh token
 */
export async function refreshAccessToken(body: any): Promise<any> {
  try {
    const { refresh_token } = body;

    if (!refresh_token || typeof refresh_token !== 'string') {
      throw new AuthenticationError('Refresh token é obrigatório');
    }

    const tokenHash = generateSHA256(refresh_token);

    // Busca refresh token no banco
    const storedToken = queryOne<{
      id: string;
      participant_id: string;
      token_hash: string;
      expires_at: string;
    }>(
      'SELECT * FROM refresh_tokens WHERE token_hash = $hash',
      { hash: tokenHash }
    );

    if (!storedToken) {
      logSecurityEvent('REFRESH_TOKEN_REUSE', null, null, { reason: 'token_not_found' });
      throw new AuthenticationError('Refresh token inválido');
    }

    // Verifica expiração
    if (new Date(storedToken.expires_at) < new Date()) {
      execute('DELETE FROM refresh_tokens WHERE id = :id', { id: storedToken.id });
      throw new AuthenticationError('Refresh token expirado. Faça login novamente.');
    }

    // Busca participante
    const participant = queryOne<Participant>(
      'SELECT * FROM participants WHERE id = $id',
      { id: storedToken.participant_id }
    );

    if (!participant || participant.status === 'expired') {
      execute('DELETE FROM refresh_tokens WHERE id = :id', { id: storedToken.id });
      throw new AuthenticationError('Conta não encontrada ou expirada');
    }

    // Gera novo access token
    const newAccessToken = generateToken({
      participant_id: participant.id,
      voluntary_code: participant.voluntary_code,
    });

    // Rotação: gera novo refresh token e invalida o anterior
    const newRefreshTokenPlain = generateRefreshToken();
    const newRefreshTokenHash = generateSHA256(newRefreshTokenPlain);
    const newExpiresAt = new Date(
      Date.now() + env.REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    // Remove o token antigo
    execute('DELETE FROM refresh_tokens WHERE id = :id', { id: storedToken.id });

    // Insere o novo
    insert('refresh_tokens', {
      id: generateUUID(),
      participant_id: participant.id,
      token_hash: newRefreshTokenHash,
      expires_at: newExpiresAt,
      created_at: formatDate(),
    });

    logger.info('Token renovado', { participant_id: participant.id });

    return successResponse({
      token: newAccessToken,
      refresh_token: newRefreshTokenPlain,
    }, 'Token renovado com sucesso');
  } catch (error) {
    logger.error('Erro ao renovar token', error as Error);
    throw error;
  }
}

/**
 * Logout - invalida refresh token
 */
export async function logoutParticipant(body: any): Promise<any> {
  try {
    const { refresh_token } = body;

    if (refresh_token && typeof refresh_token === 'string') {
      const tokenHash = generateSHA256(refresh_token);
      execute('DELETE FROM refresh_tokens WHERE token_hash = :hash', { hash: tokenHash });
    }

    return successResponse(null, 'Logout realizado com sucesso');
  } catch (error) {
    logger.error('Erro ao fazer logout', error as Error);
    throw error;
  }
}

/**
 * Exclui conta do participante (anonimiza dados pessoais, mantém resultados)
 */
export async function deleteAccount(params: { token: string }): Promise<any> {
  try {
    const { verifyToken } = await import('@/utils/security');
    const decoded = verifyToken(params.token);
    if (!decoded) throw new Error('Token inválido');

    const participantId = decoded.participant_id;

    const participant = queryOne<Participant>(
      'SELECT * FROM participants WHERE id = $id',
      { id: participantId }
    );

    if (!participant) {
      throw new NotFoundError('Participante');
    }

    // Deleta arquivos físicos de todas as amostras
    const samples = queryAll<any>(
      'SELECT * FROM samples WHERE participant_id = $participant_id',
      { participant_id: participantId }
    );

    try {
      const { cleanupSample } = await import('@/services/samplePreparationService');
      for (const sample of samples) {
        try {
          await cleanupSample(sample.carry_code);
        } catch (e) {
          logger.warn('Erro ao limpar arquivos da amostra', { carry_code: sample.carry_code });
        }
      }
    } catch (e) {
      logger.warn('Erro ao importar samplePreparationService para cleanup');
    }

    // Deleta arquivos de certificados
    const certificates = queryAll<any>(
      'SELECT * FROM certificates WHERE participant_id = $participant_id',
      { participant_id: participantId }
    );
    const fs = await import('fs');
    for (const cert of certificates) {
      if (cert.file_path) {
        try { fs.unlinkSync(cert.file_path); } catch (_) {}
      }
    }

    // Deleta dados não-essenciais (mantém samples/groups/results para pesquisa)
    execute('DELETE FROM certificates WHERE participant_id = :participant_id', { participant_id: participantId });
    execute('DELETE FROM minutiae_markings WHERE participant_id = :participant_id', { participant_id: participantId });
    execute('DELETE FROM file_tracking WHERE participant_id = :participant_id', { participant_id: participantId });
    execute('DELETE FROM csrf_tokens WHERE participant_id = :participant_id', { participant_id: participantId });
    execute('DELETE FROM refresh_tokens WHERE participant_id = :participant_id', { participant_id: participantId });

    // Anonimiza participante (mantém códigos como identificadores para pesquisa)
    const anonymizedEmail = `deleted_${generateUUID().substring(0, 8)}@removed.local`;
    update('participants', {
      voluntary_name: '[Removido]',
      voluntary_email: anonymizedEmail,
      status: 'expired',
      email_verification_token: null,
      token_expires_at: null,
      updated_at: formatDate(),
    }, { id: participantId });

    // Invalida todos os tokens JWT existentes deste participante
    const { invalidateTokensForParticipant } = await import('@/utils/security');
    invalidateTokensForParticipant(participantId);

    logSecurityEvent('ACCOUNT_DELETED', null, participantId, { voluntary_code: participant.voluntary_code });
    logger.info('Conta excluída (anonimizada)', { participant_id: participantId });

    return successResponse(null, 'Conta removida com sucesso. Seus dados pessoais foram apagados.');
  } catch (error) {
    logger.error('Erro ao excluir conta', error as Error);
    throw error;
  }
}
