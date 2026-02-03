import { CertificateData } from '../types/index';
import { generateUUID, formatDateReadable } from '@utils/helpers';
import { logger } from '@middleware/logger';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

/**
 * Gera certificado em HTML
 */
export function generateCertificateHTML(data: CertificateData): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Georgia', serif;
            background-color: #f5f5f5;
          }
          .certificate {
            width: 8.5in;
            height: 11in;
            margin: 20px auto;
            padding: 40px;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            border: 3px solid #2c3e50;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            position: relative;
            overflow: hidden;
          }
          .certificate::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: 
              repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.1) 10px, rgba(255,255,255,.1) 20px);
            pointer-events: none;
          }
          .content {
            position: relative;
            z-index: 1;
            text-align: center;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-around;
          }
          .header {
            border-bottom: 2px solid #2c3e50;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            color: #2c3e50;
            font-size: 48px;
            font-weight: bold;
          }
          .header p {
            margin: 5px 0;
            color: #34495e;
            font-size: 16px;
          }
          .body {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 20px 0;
          }
          .body p {
            margin: 10px 0;
            color: #2c3e50;
            font-size: 14px;
          }
          .recognition {
            font-size: 18px;
            font-weight: bold;
            color: #e74c3c;
            margin: 20px 0;
          }
          .name {
            font-size: 28px;
            font-weight: bold;
            color: #2c3e50;
            margin: 15px 0;
            text-decoration: underline;
          }
          .details {
            margin: 20px 0;
            font-size: 12px;
            color: #34495e;
          }
          .details-row {
            margin: 5px 0;
          }
          .footer {
            border-top: 2px solid #2c3e50;
            padding-top: 20px;
            margin-top: 20px;
            display: flex;
            justify-content: space-around;
            align-items: flex-end;
          }
          .signature {
            width: 200px;
            text-align: center;
            font-size: 12px;
          }
          .signature-line {
            border-top: 1px solid #2c3e50;
            margin-top: 50px;
            padding-top: 5px;
          }
          .certificate-code {
            position: absolute;
            bottom: 10px;
            right: 20px;
            font-size: 10px;
            color: #7f8c8d;
          }
          @media print {
            body { background-color: white; }
            .certificate { margin: 0; box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="content">
            <div class="header">
              <h1>CERTIFICADO</h1>
              <p>de Participação em Pesquisa</p>
            </div>
            
            <div class="body">
              <p>Certificamos que</p>
              
              <div class="name">${data.participant_name}</div>
              
              <div class="recognition">
                participou com sucesso do Projeto de Pesquisa
              </div>
              
              <p><strong>Teste de Proficiência em Comparação de Impressões Digitais</strong></p>
              
              <div class="details">
                <div class="details-row">
                  <strong>Data de Conclusão:</strong> ${data.completion_date}
                </div>
                <div class="details-row">
                  <strong>Grupos Avaliados:</strong> ${data.groups_evaluated}
                </div>
                <div class="details-row">
                  <strong>Código de Participação:</strong> ${data.voluntary_code}
                </div>
              </div>
              
              <p>Agradecemos sinceramente sua contribuição para o avanço da ciência forense.</p>
            </div>
            
            <div class="footer">
              <div class="signature">
                <div class="signature-line">Dr. Adelino Pinheiro Silva</div>
                <p>Pesquisador Responsável</p>
              </div>
              <div class="signature">
                <div class="signature-line">${new Date().toLocaleDateString('pt-BR')}</div>
                <p>Data de Emissão</p>
              </div>
            </div>

            <div style="margin-top: 30px; padding: 15px; background-color: rgba(255,255,255,0.2); border-radius: 5px; font-size: 10px; color: #2c3e50; text-align: center;">
              <p style="margin: 0;"><strong>Apoio:</strong></p>
              <p style="margin: 5px 0;">Projeto desenvolvido com apoio da FAPEMIG e Rede Mineira de Ciências Forenses</p>
              <p style="margin: 5px 0; font-family: monospace;"><strong>RED-00120-23</strong></p>
            </div>

            <div class="certificate-code">
              ID: ${data.certificate_id}
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Salva certificado em arquivo
 */
export async function saveCertificate(
  certificateHTML: string,
  outputPath: string
): Promise<void> {
  try {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, certificateHTML, 'utf-8');
    logger.info('Certificado salvo', { path: outputPath });
  } catch (error) {
    logger.error('Erro ao salvar certificado', error as Error, { path: outputPath });
    throw error;
  }
}

/**
 * Gera certificado em PDF usando Puppeteer
 */
export async function generateCertificatePDF(
  certificateHTML: string,
  outputPath: string
): Promise<void> {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(certificateHTML, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true
    });

    await browser.close();
    logger.info('Certificado PDF gerado com sucesso', { path: outputPath });
  } catch (error) {
    logger.error('Erro ao gerar certificado PDF', error as Error);
    throw error;
  }
}

/**
 * Cria dados do certificado
 */
export function createCertificateData(
  participantName: string,
  voluntaryCode: string,
  carryCode: string,
  groupsEvaluated: number
): CertificateData {
  return {
    participant_name: participantName,
    voluntary_code: voluntaryCode,
    carry_code: carryCode,
    completion_date: formatDateReadable(new Date()),
    groups_evaluated: groupsEvaluated,
    certificate_id: generateUUID(),
  };
}
