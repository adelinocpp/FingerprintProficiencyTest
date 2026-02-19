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
  // Lê a imagem da assinatura e converte para base64
  const signaturePath = path.join(process.cwd(), 'data', 'ass_base.png');
  let signatureBase64 = '';
  try {
    const signatureBuffer = fs.readFileSync(signaturePath);
    signatureBase64 = `data:image/png;base64,${signatureBuffer.toString('base64')}`;
  } catch (error) {
    logger.warn('Não foi possível carregar a imagem da assinatura', error as Error);
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Arial', 'Helvetica', sans-serif;
            background-color: #ffffff;
          }
          .certificate {
            width: 8.5in;
            height: 11in;
            margin: 20px auto;
            padding: 40px;
            background: #ffffff;
            border: 8px solid #1a3a52;
            border-top: 20px solid #1a3a52;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
            position: relative;
            box-sizing: border-box;
          }
          .content {
            position: relative;
            text-align: center;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .header {
            padding-bottom: 10px;
            margin-bottom: 15px;
            border-bottom: 3px solid #1a3a52;
          }
          .header h1 {
            margin: 0 0 5px 0;
            color: #1a3a52;
            font-size: 38px;
            font-weight: 700;
            letter-spacing: 4px;
            text-transform: uppercase;
          }
          .header .subtitle {
            margin: 3px 0;
            color: #2c5f7e;
            font-size: 13px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          .header .certificate-id {
            margin-top: 5px;
            font-size: 9px;
            color: #999999;
            font-family: 'Courier New', monospace;
          }
          .body {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 15px 0;
          }
          .body p {
            margin: 5px 0;
            color: #333333;
            font-size: 13px;
            line-height: 1.5;
          }
          .project-name {
            font-size: 12px;
            font-weight: 600;
            color: #1a3a52;
            margin: 10px 0 5px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .project-stage {
            font-size: 15px;
            font-weight: 700;
            color: #2c5f7e;
            margin: 5px 0 15px 0;
            line-height: 1.3;
          }
          .participant-intro {
            font-size: 13px;
            color: #555555;
            margin: 15px 0 8px 0;
          }
          .name {
            font-size: 24px;
            font-weight: 700;
            color: #1a3a52;
            margin: 10px 0;
            padding-bottom: 4px;
            border-bottom: 2px solid #2c5f7e;
            display: inline-block;
            min-width: 350px;
          }
          .participation-text {
            font-size: 14px;
            font-weight: 600;
            color: #2c5f7e;
            margin: 15px 0;
            line-height: 1.4;
          }
          .details {
            margin: 15px auto;
            padding: 15px;
            background-color: #f8f9fa;
            border-left: 4px solid #2c5f7e;
            max-width: 450px;
            text-align: left;
          }
          .details-row {
            margin: 6px 0;
            font-size: 12px;
            color: #333333;
            display: flex;
            justify-content: space-between;
          }
          .details-row strong {
            color: #1a3a52;
            font-weight: 600;
          }
          .acknowledgment {
            font-size: 12px;
            color: #555555;
            font-style: italic;
            margin-top: 15px;
          }
          .footer {
            border-top: 3px solid #1a3a52;
            padding-top: 20px;
            margin-top: 20px;
            display: flex;
            justify-content: space-around;
            align-items: flex-end;
          }
          .signature {
            width: 220px;
            text-align: center;
            font-size: 12px;
            position: relative;
          }
          .signature-container {
            position: relative;
            padding-top: 30px;
          }
          .signature-image {
            position: absolute;
            top: -15px;
            left: 50%;
            transform: translateX(-50%);
            max-width: 90px;
            height: auto;
            opacity: 0.9;
            z-index: 1;
          }
          .signature-line {
            position: relative;
            z-index: 2;
            border-top: 2px solid #333333;
            margin-top: 0;
            padding-top: 8px;
            font-weight: 600;
            color: #1a3a52;
          }
          .signature-title {
            margin-top: 4px;
            font-size: 11px;
            color: #666666;
          }
          .funding-box {
            margin-top: 15px;
            padding: 10px;
            background-color: #f0f4f8;
            border: 1px solid #2c5f7e;
            border-radius: 4px;
            font-size: 9px;
            color: #1a3a52;
            text-align: center;
          }
          .funding-box p {
            margin: 3px 0;
            font-size: 9px;
          }
          .funding-box .project-code {
            font-family: 'Courier New', monospace;
            font-weight: 700;
            color: #1a3a52;
            font-size: 11px;
          }
          @media print {
            body {
              background-color: white;
            }
            .certificate {
              margin: 0;
              box-shadow: none;
              page-break-after: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="content">
            <div class="header">
              <h1>CERTIFICADO</h1>
              <p class="subtitle">Participação em Pesquisa Científica</p>
              <p class="certificate-id">Certificado ID: ${data.certificate_id}</p>
            </div>

            <div class="body">
              <p class="project-name">Projeto de Pesquisa:</p>
              <p class="project-stage">Avaliação de Métodos de Comparação Forense<br/>de Impressões Digitais</p>

              <p style="font-size: 12px; color: #666; margin: 5px 0;">Etapa:</p>
              <p style="font-size: 14px; font-weight: 600; color: #2c5f7e; margin: 5px 0 25px 0;">Teste de Proficiência em Comparação de Impressões Digitais</p>

              <p class="participant-intro">Certificamos que</p>

              <div class="name">${data.participant_name}</div>

              <p class="participation-text">
                participou com sucesso desta pesquisa científica,<br/>
                contribuindo para o avanço da ciência forense no Brasil
              </p>

              <div class="details">
                <div class="details-row">
                  <span><strong>Data de Conclusão:</strong></span>
                  <span>${data.completion_date}</span>
                </div>
                <div class="details-row">
                  <span><strong>Grupos Avaliados:</strong></span>
                  <span>${data.groups_evaluated}</span>
                </div>
                <div class="details-row">
                  <span><strong>Código de Participação:</strong></span>
                  <span>${data.voluntary_code}</span>
                </div>
              </div>

              <p class="acknowledgment">
                Agradecemos sinceramente sua valiosa contribuição<br/>
                para o desenvolvimento da papiloscopia forense
              </p>
            </div>

            <div class="footer">
              <div class="signature">
                <div class="signature-container">
                  ${signatureBase64 ? `<img src="${signatureBase64}" alt="Assinatura" class="signature-image" />` : ''}
                  <div class="signature-line">Dr. Adelino Pinheiro Silva</div>
                </div>
                <p class="signature-title">Pesquisador Responsável</p>
              </div>
              <div class="signature">
                <div class="signature-line" style="margin-top: 60px;">${new Date().toLocaleDateString('pt-BR')}</div>
                <p class="signature-title">Data de Emissão</p>
              </div>
            </div>

            <div class="funding-box">
              <p style="font-weight: 700; margin-bottom: 6px;">APOIO INSTITUCIONAL</p>
              <p>Este projeto é desenvolvido com apoio da <strong>FAPEMIG</strong></p>
              <p>e <strong>Rede Mineira de Ciências Forenses</strong></p>
              <p class="project-code">RED-00120-23</p>
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
      executablePath: '/usr/bin/google-chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions'
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
