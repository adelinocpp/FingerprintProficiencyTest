import sharp from 'sharp';
import { env } from '@/config/env';
import { logger } from '@middleware/logger';

interface EllipseParams {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  angle: number;
}

/**
 * Gera parâmetros aleatórios para a elipse de degradação
 */
function generateEllipseParams(width: number, height: number): EllipseParams {
  const imageArea = width * height;
  
  // Área da elipse: 10% a 25% da área da imagem
  const areaPercent = env.DEGRADATION_MIN_AREA_PERCENT + 
    Math.random() * (env.DEGRADATION_MAX_AREA_PERCENT - env.DEGRADATION_MIN_AREA_PERCENT);
  const ellipseArea = (imageArea * areaPercent) / 100;
  
  // Excentricidade entre 0.1 e 0.5
  const eccentricity = env.DEGRADATION_MIN_ECCENTRICITY + 
    Math.random() * (env.DEGRADATION_MAX_ECCENTRICITY - env.DEGRADATION_MIN_ECCENTRICITY);
  
  // Calcula raios baseado na área e excentricidade
  // Área elipse = π * a * b, onde a > b
  // Excentricidade e = sqrt(1 - (b²/a²))
  // Resolvendo: b = a * sqrt(1 - e²)
  const radiusX = Math.sqrt(ellipseArea / (Math.PI * Math.sqrt(1 - eccentricity * eccentricity)));
  const radiusY = radiusX * Math.sqrt(1 - eccentricity * eccentricity);
  
  // Centro dentro da área da imagem (respeitando os raios)
  const centerX = radiusX + Math.random() * (width - 2 * radiusX);
  const centerY = radiusY + Math.random() * (height - 2 * radiusY);
  
  // Ângulo de rotação aleatório (0 a 360 graus)
  const angle = Math.random() * 360;
  
  return {
    centerX: Math.round(centerX),
    centerY: Math.round(centerY),
    radiusX: Math.round(radiusX),
    radiusY: Math.round(radiusY),
    angle: Math.round(angle),
  };
}

/**
 * Cria máscara elíptica para aplicar blur
 */
async function createEllipseMask(
  width: number, 
  height: number, 
  params: EllipseParams
): Promise<Buffer> {
  // Cria SVG com elipse branca em fundo preto
  const svg = `
    <svg width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="black"/>
      <ellipse 
        cx="${params.centerX}" 
        cy="${params.centerY}" 
        rx="${params.radiusX}" 
        ry="${params.radiusY}" 
        transform="rotate(${params.angle} ${params.centerX} ${params.centerY})"
        fill="white"/>
    </svg>
  `;
  
  return Buffer.from(svg);
}

/**
 * Aplica degradação de blur elíptico (motion blur) em uma imagem
 */
export async function applyEllipticalBlur(
  inputPath: string,
  outputPath: string
): Promise<void> {
  try {
    logger.info('Iniciando degradação de imagem', { input: inputPath, output: outputPath });
    
    // Carrega imagem original
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    const width = metadata.width || env.IMAGE_WIDTH;
    const height = metadata.height || env.IMAGE_HEIGHT;
    
    // Gera parâmetros da elipse
    const ellipseParams = generateEllipseParams(width, height);
    
    logger.info('Parâmetros da elipse gerados', ellipseParams);
    
    // Cria máscara elíptica
    const maskBuffer = await createEllipseMask(width, height, ellipseParams);
    const mask = await sharp(maskBuffer).png().toBuffer();
    
    // Aplica blur na imagem original
    const blurredImage = await sharp(inputPath)
      .blur(10) // Intensidade do blur (motion blur simulado)
      .toBuffer();
    
    // Combina imagem original com área borrada usando a máscara
    // Onde a máscara é branca (elipse), usa a imagem borrada
    // Onde a máscara é preta (resto), usa a imagem original
    await sharp(inputPath)
      .composite([
        {
          input: blurredImage,
          blend: 'over',
        },
        {
          input: mask,
          blend: 'dest-in',
        },
      ])
      .toFile(outputPath);
    
    logger.info('Degradação aplicada com sucesso', { 
      input: inputPath, 
      output: outputPath,
      ellipse: ellipseParams 
    });
  } catch (error) {
    logger.error('Erro ao aplicar degradação', error as Error);
    throw error;
  }
}

/**
 * Testa a degradação gerando uma imagem de exemplo
 */
export async function testDegradation(
  inputPath: string,
  outputDir: string
): Promise<string[]> {
  const outputs: string[] = [];
  
  for (let i = 0; i < 3; i++) {
    const outputPath = `${outputDir}/degraded_sample_${i + 1}.png`;
    await applyEllipticalBlur(inputPath, outputPath);
    outputs.push(outputPath);
  }
  
  return outputs;
}
