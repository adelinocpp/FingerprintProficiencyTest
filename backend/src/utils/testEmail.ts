import { initializeEmailService, sendEmail } from '../services/emailService';
import { logger } from '../middleware/logger';
import { env } from '../config/env';

/**
 * Script de teste para envio de email
 * Execute com: bun src/utils/testEmail.ts
 */
async function testEmailService() {
  try {
    console.log('\n🔧 Testando Serviço de Email...\n');
    console.log('📋 Configurações:');
    console.log(`   - Service: ${env.EMAIL_SERVICE}`);
    console.log(`   - SMTP Host: ${env.SMTP_HOST || 'default'}`);
    console.log(`   - SMTP Port: ${env.SMTP_PORT}`);
    console.log(`   - SMTP Secure: ${env.SMTP_SECURE}`);
    console.log(`   - User: ${env.EMAIL_USER}`);
    console.log(`   - From: "${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_EMAIL}>`);
    console.log('');

    // Inicializa serviço
    console.log('🔌 Inicializando transporter...');
    initializeEmailService();
    console.log('✅ Transporter inicializado com sucesso!\n');

    // Envia email de teste
    console.log('📧 Enviando email de teste...');
    await sendEmail({
      to: env.EMAIL_USER, // Envia para o próprio email configurado
      subject: '✅ Teste de Configuração - Sistema de Impressões Digitais',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: #f8f9fa;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .success-icon {
              font-size: 48px;
              margin-bottom: 10px;
            }
            .info-box {
              background: white;
              border-left: 4px solid #10b981;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="success-icon">✅</div>
            <h1>Configuração de Email Bem-Sucedida!</h1>
          </div>
          <div class="content">
            <h2>🎉 Parabéns!</h2>
            <p>Seu sistema de email está configurado corretamente e funcionando perfeitamente!</p>
            
            <div class="info-box">
              <strong>📋 Detalhes da Configuração:</strong>
              <ul>
                <li><strong>Serviço:</strong> ${env.EMAIL_SERVICE.toUpperCase()}</li>
                <li><strong>SMTP Host:</strong> ${env.SMTP_HOST}</li>
                <li><strong>Porta:</strong> ${env.SMTP_PORT}</li>
                <li><strong>Seguro:</strong> ${env.SMTP_SECURE ? 'Sim (SSL/TLS)' : 'Não'}</li>
                <li><strong>Remetente:</strong> ${env.EMAIL_FROM_NAME}</li>
              </ul>
            </div>

            <h3>✨ Próximos Passos:</h3>
            <ol>
              <li>O sistema já está pronto para enviar emails de boas-vindas aos participantes</li>
              <li>Os certificados de participação serão enviados automaticamente</li>
              <li>Notificações importantes chegarão diretamente aos usuários</li>
            </ol>

            <p><strong>Dica:</strong> Mantenha sua senha de aplicativo em segurança e nunca a compartilhe!</p>
          </div>
          <div class="footer">
            <p>Sistema de Teste de Proficiência em Impressões Digitais</p>
            <p>Este é um email automático de teste. Não responda a esta mensagem.</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log('✅ Email enviado com sucesso!\n');
    console.log('📬 Verifique sua caixa de entrada em:', env.EMAIL_USER);
    console.log('');
    console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE DE EMAIL:\n');
    logger.error('Erro no teste de email', error as Error);
    console.error(error);
    console.log('\n');
    console.log('💡 Dicas para resolver:');
    console.log('   1. Verifique se a senha de aplicativo está correta (16 caracteres)');
    console.log('   2. Confirme que a autenticação de dois fatores está habilitada');
    console.log('   3. Verifique se EMAIL_USER e EMAIL_PASSWORD estão no .env');
    console.log('   4. Para Yahoo: SMTP_HOST=smtp.mail.yahoo.com, SMTP_PORT=465, SMTP_SECURE=true');
    console.log('');
    process.exit(1);
  }
}

// Executa teste
testEmailService();
