import nodemailer, { Transporter } from 'nodemailer';
import { env } from '@config/env';
import { logger } from '@middleware/logger';
import { EmailPayload } from '../types/index';

let transporter: Transporter | null = null;

/**
 * Inicializa transporter de email
 */
export function initializeEmailService(): Transporter {
  try {
    // Se SMTP_HOST estiver configurado, usa configuração customizada (Yahoo, etc)
    const transportConfig = env.SMTP_HOST
      ? {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE, // true para porta 465, false para outras
          auth: {
            user: env.EMAIL_USER,
            pass: env.EMAIL_PASSWORD,
          },
        }
      : {
          service: env.EMAIL_SERVICE,
          auth: {
            user: env.EMAIL_USER,
            pass: env.EMAIL_PASSWORD,
          },
        };

    transporter = nodemailer.createTransport(transportConfig);

    logger.info('Serviço de email inicializado', {
      service: env.SMTP_HOST || env.EMAIL_SERVICE,
      host: env.SMTP_HOST || 'default',
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.EMAIL_USER,
    });

    return transporter;
  } catch (error) {
    logger.error('Erro ao inicializar serviço de email', error as Error);
    throw error;
  }
}

/**
 * Obtém transporter de email
 */
export function getEmailTransporter(): Transporter {
  if (!transporter) {
    return initializeEmailService();
  }
  return transporter;
}

/**
 * Envia email
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  try {
    const transport = getEmailTransporter();

    await transport.sendMail({
      from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_EMAIL}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text || payload.html.replace(/<[^>]*>/g, ''),
      attachments: payload.attachments || [],
    });

    logger.info('Email enviado com sucesso', {
      to: payload.to,
      subject: payload.subject,
      attachments: payload.attachments?.length || 0,
    });
  } catch (error) {
    logger.error('Erro ao enviar email', error as Error, {
      to: payload.to,
      subject: payload.subject,
    });
    throw error;
  }
}

/**
 * Template de email de boas-vindas com validação
 */
export function getWelcomeEmailTemplate(
  voluntaryName: string,
  voluntaryCode: string,
  carryCode: string,
  verificationUrl: string,
  siteUrl: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 5px; }
          .content { padding: 20px; background-color: #f9f9f9; border-radius: 5px; margin-top: 20px; }
          .code-box { background-color: #ecf0f1; padding: 15px; border-left: 4px solid #3498db; margin: 15px 0; }
          .code-label { font-weight: bold; color: #2c3e50; }
          .code-value { font-size: 18px; font-family: monospace; color: #e74c3c; }
          .button { display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #7f8c8d; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Bem-vindo ao Teste de Impressões Digitais</h1>
          </div>
          
          <div class="content">
            <p>Caro <strong>${voluntaryName}</strong>,</p>
            
            <p>Primeiramente, gostaria de agradecer por se voluntariar ao projeto de avaliação. Informo que seus dados serão anonimizados e nenhum resultado pessoal será divulgado.</p>
            
            <h3>⚠️ Validação de Email Necessária</h3>
            <p>Para ativar sua conta e acessar o sistema, você precisa validar seu email clicando no botão abaixo:</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" class="button" style="background-color: #27ae60; font-size: 16px; padding: 15px 30px;">✓ Validar Email e Ativar Conta</a>
            </p>
            
            <h3>Seus Códigos de Acesso:</h3>
            
            <div class="code-box">
              <div class="code-label">Código Pessoal (VOLUNTARY_CODE):</div>
              <div class="code-value">${voluntaryCode}</div>
            </div>
            
            <div class="code-box">
              <div class="code-label">Código da Amostra (CARRY_CODE):</div>
              <div class="code-value">${carryCode}</div>
            </div>
            
            <p><strong>Guarde estes códigos!</strong> Você precisará de um deles para fazer login após validar seu email.</p>
            
            <h3>Próximos Passos:</h3>
            <ol>
              <li><strong>Valide seu email</strong> clicando no botão acima</li>
              <li>Faça login no sistema usando um dos seus códigos</li>
              <li>Aguarde o recebimento das amostras para avaliação</li>
              <li>Analise as impressões digitais conforme instruções</li>
              <li>Submeta seus resultados através do sistema</li>
            </ol>
            
            <p><strong>Informações Importantes:</strong></p>
            <ul>
              <li>Você deve validar seu email antes de acessar o sistema</li>
              <li>Mantenha este email até a conclusão da avaliação</li>
              <li>Use seu código pessoal (VOLUNTARY_CODE) ou código da amostra (CARRY_CODE) para fazer login</li>
              <li>O link de validação expira em 7 dias</li>
              <li>Caso não valide seu email, não poderá acessar as amostras</li>
            </ul>
            
            <p>Muito obrigado pela participação!</p>
            
            <p>Atenciosamente,<br>
            <strong>Dr. Adelino Pinheiro Silva</strong></p>
          </div>
          
          <div class="footer">
            <p>Este é um email automático. Por favor, não responda. Se tiver dúvidas, entre em contato através do sistema.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Template de email com certificado
 */
export function getCertificateEmailTemplate(
  voluntaryName: string,
  voluntaryCode: string,
  carryCode: string,
  completionDate: string,
  groupsEvaluated: number,
  certificateCode: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #27ae60; color: white; padding: 20px; text-align: center; border-radius: 5px; }
          .content { padding: 20px; background-color: #f9f9f9; border-radius: 5px; margin-top: 20px; }
          .certificate-info { background-color: #ecf0f1; padding: 15px; border-left: 4px solid #27ae60; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #7f8c8d; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Avaliação Concluída</h1>
          </div>
          
          <div class="content">
            <p>Caro <strong>${voluntaryName}</strong>,</p>
            
            <p>Parabéns! Sua avaliação foi concluída com sucesso. Segue em anexo o certificado de participação.</p>
            
            <div class="certificate-info">
              <p><strong>Resumo da Participação:</strong></p>
              <ul>
                <li><strong>Data de Conclusão:</strong> ${completionDate}</li>
                <li><strong>Grupos Avaliados:</strong> ${groupsEvaluated}</li>
                <li><strong>Código do Certificado:</strong> ${certificateCode}</li>
              </ul>
            </div>
            
            <p>Agradecemos sinceramente sua participação neste projeto de pesquisa. Seus dados foram fundamentais para o desenvolvimento deste sistema de avaliação de impressões digitais.</p>
            
            <p>Atenciosamente,<br>
            <strong>Dr. Adelino Pinheiro Silva</strong></p>
          </div>
          
          <div class="footer">
            <p>Este é um email automático. Por favor, não responda. Se tiver dúvidas, entre em contato através do sistema.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Template de email de lembrete de códigos
 */
export function getReminderEmailTemplate(
  voluntaryName: string,
  voluntaryCode: string,
  carryCode: string,
  siteUrl: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #3498db; color: white; padding: 20px; text-align: center; border-radius: 5px; }
          .content { padding: 20px; background-color: #f9f9f9; border-radius: 5px; margin-top: 20px; }
          .code-box { background-color: #ecf0f1; padding: 15px; border-left: 4px solid #3498db; margin: 15px 0; }
          .code-label { font-weight: bold; color: #2c3e50; }
          .code-value { font-size: 18px; font-family: monospace; color: #e74c3c; }
          .button { display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #7f8c8d; font-size: 12px; }
          .alert { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 Seus Códigos de Acesso</h1>
          </div>
          
          <div class="content">
            <p>Olá <strong>${voluntaryName}</strong>,</p>
            
            <div class="alert">
              <p><strong>ℹ️ Este email já está cadastrado</strong></p>
              <p>Você tentou se cadastrar novamente, mas este email já possui uma conta ativa. Abaixo estão seus códigos de acesso:</p>
            </div>
            
            <h3>Seus Códigos de Acesso:</h3>
            
            <div class="code-box">
              <div class="code-label">Código Pessoal (VOLUNTARY_CODE):</div>
              <div class="code-value">${voluntaryCode}</div>
            </div>
            
            <div class="code-box">
              <div class="code-label">Código da Amostra (CARRY_CODE):</div>
              <div class="code-value">${carryCode}</div>
            </div>
            
            <p><strong>Use qualquer um destes códigos para fazer login no sistema.</strong></p>
            
            <p style="text-align: center;">
              <a href="${siteUrl}/login" class="button" style="color: white;" >Acessar Sistema</a>
            </p>
            
            <p><strong>Informações Importantes:</strong></p>
            <ul>
              <li>Se você validou seu email, já pode fazer login</li>
              <li>Se ainda não validou, verifique seu email de boas-vindas original</li>
              <li>Caso não encontre o email de validação, entre em contato</li>
            </ul>
            
            <p>Se você não solicitou este email, desconsidere esta mensagem.</p>
            
            <p>Atenciosamente,<br>
            <strong>Dr. Adelino Pinheiro Silva</strong></p>
          </div>
          
          <div class="footer">
            <p>Este é um email automático. Por favor, não responda. Se tiver dúvidas, entre em contato através do sistema.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Template de email de notificação
 */
export function getNotificationEmailTemplate(
  subject: string,
  message: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #3498db; color: white; padding: 20px; text-align: center; border-radius: 5px; }
          .content { padding: 20px; background-color: #f9f9f9; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; padding: 20px; color: #7f8c8d; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${subject}</h1>
          </div>
          
          <div class="content">
            ${message}
          </div>
          
          <div class="footer">
            <p>Este é um email automático. Por favor, não responda.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
