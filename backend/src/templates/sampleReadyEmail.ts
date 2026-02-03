import { env } from '@/config/env';

export function getSampleReadyEmailTemplate(
  participantName: string,
  voluntaryCode: string,
  carryCode: string,
  totalGroups: number,
  frontendUrl: string
): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Amostra Pronta - Teste de Proficiência</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🔍 Teste de Proficiência em Impressões Digitais</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px;">Olá, <strong>${participantName}</strong>!</p>
    
    <p>Sua amostra de teste está pronta! 🎉</p>
    
    <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0;">
      <h2 style="margin-top: 0; color: #667eea;">Seus Dados de Acesso</h2>
      <p style="margin: 10px 0;"><strong>Código Voluntário:</strong> <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 4px; font-size: 18px;">${voluntaryCode}</code></p>
      <p style="margin: 10px 0;"><strong>Código da Amostra:</strong> <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 4px; font-size: 18px;">${carryCode}</code></p>
      <p style="margin: 10px 0;"><strong>Total de Grupos:</strong> ${totalGroups}</p>
    </div>
    
    <div style="background: #fffbea; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #f59e0b;">📦 Amostra Anexada</h3>
      <p>A amostra completa com todas as imagens está <strong>anexada neste email</strong> como arquivo ZIP.</p>
      <p style="margin: 5px 0;">📁 Nome do arquivo: <code>${carryCode}.zip</code></p>
    </div>
    
    <h3 style="color: #667eea;">📋 Instruções</h3>
    <ol style="padding-left: 20px;">
      <li><strong>Baixe o arquivo ZIP anexo</strong> e extraia seu conteúdo</li>
      <li>Você encontrará <strong>${totalGroups} diretórios</strong>, um para cada grupo de imagens</li>
      <li>Cada grupo contém:
        <ul>
          <li><code>QUESTIONADA.png</code> - Impressão questionada</li>
          <li><code>PADRAO_00.png</code> até <code>PADRAO_09.png</code> - 10 impressões padrão</li>
        </ul>
      </li>
      <li><strong>Analise cada grupo</strong> e identifique se a impressão questionada corresponde a alguma das padrões</li>
      <li><strong>Acesse o sistema</strong> para entregar seus resultados:
        <div style="text-align: center; margin: 20px 0;">
          <a href="${frontendUrl}/login" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Acessar Sistema</a>
        </div>
      </li>
    </ol>
    
    <div style="background: #e0f2fe; padding: 15px; border-left: 4px solid #0ea5e9; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #0ea5e9;">ℹ️ Importante</h3>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>Use seu <strong>Código Voluntário</strong> ou <strong>Código da Amostra</strong> para fazer login</li>
        <li>Você pode avaliar os grupos em qualquer ordem</li>
        <li>Seus resultados ficarão salvos a cada grupo enviado</li>
        <li>Após completar todos os grupos, você receberá um certificado de participação</li>
      </ul>
    </div>
    
    <div style="background: #fef2f2; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #ef4444;">⚠️ Atenção</h3>
      <p style="margin: 5px 0;">Este é um teste cego. <strong>NÃO compartilhe</strong> as imagens ou resultados com outros participantes.</p>
    </div>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <p style="font-size: 14px; color: #666;">
      Se tiver dúvidas, entre em contato conosco.<br>
      Boa sorte! 🍀
    </p>
    
    <p style="font-size: 12px; color: #999; text-align: center; margin-top: 30px;">
      © ${new Date().getFullYear()} Teste de Proficiência em Impressões Digitais<br>
      Este é um email automático, por favor não responda.
    </p>
  </div>
</body>
</html>
  `.trim();
}
