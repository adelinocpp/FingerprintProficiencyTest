import nodemailer, { Transporter } from 'nodemailer';
import { env } from '@config/env';
import { logger } from '@middleware/logger';
import { EmailPayload } from '@types/index';

let transporter: Transporter | null = null;

/**
 * Inicializa transporter de email
 */
export function initializeEmailService(): Transporter {
  try {
    transporter = nodemailer.createTransport({
      service: env.EMAIL_SERVICE,
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASSWORD,
      },
    });

    logger.info('Serviço de email inicializado', {
      service: env.EMAIL_SERVICE,
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
      from: env.EMAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text || payload.html.replace(/<[^>]*>/g, ''),
    });

    logger.info('Email enviado com sucesso', {
      to: payload.to,
      subject: payload.subject,
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
 * Template de email de boas-vindas
 */
export function getWelcomeEmailTemplate(
  voluntaryName: string,
  voluntaryCode: string,
  carryCode: string,
  downloadUrl: string,
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
            
            <h3>Seus Códigos de Acesso:</h3>
            
            <div class="code-box">
              <div class="code-label">Código Pessoal (VOLUNTARY_CODE):</div>
              <div class="code-value">${voluntaryCode}</div>
            </div>
            
            <div class="code-box">
              <div class="code-label">Código da Amostra (CARRY_CODE):</div>
              <div class="code-value">${carryCode}</div>
            </div>
            
            <p>Você está recebendo um arquivo compactado com dez grupos de imagens de impressões para avaliação. Em cada grupo há uma imagem questionada e 10 padrões. A avaliação consiste em indicar se existe (ou não) uma impressão padrão que é compatível com a questionada e sua escala de compatibilidade.</p>
            
            <h3>Próximos Passos:</h3>
            <ol>
              <li>Baixe o arquivo de amostras anexado</li>
              <li>Extraia o arquivo em seu computador</li>
              <li>Analise cada grupo de imagens conforme as instruções</li>
              <li>Acesse o sistema para entregar seus resultados</li>
            </ol>
            
            <p style="text-align: center;">
              <a href="${siteUrl}" class="button">Acessar Sistema</a>
            </p>
            
            <p><strong>Informações Importantes:</strong></p>
            <ul>
              <li>Mantenha este email até a entrega da avaliação</li>
              <li>O sistema considera seu tempo de resposta a partir do cadastro</li>
              <li>Caso não responda sua avaliação em até 120 dias, sua amostra será dispensada</li>
              <li>Use seu código pessoal ou código da amostra para acessar o sistema</li>
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
