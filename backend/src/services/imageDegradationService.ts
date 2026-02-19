import { env } from '@/config/env';
import { logger } from '@middleware/logger';

interface DegradationResult {
  status: string;
  input: string;
  output: string;
  area_percent: number;
  eccentricity: number;
  center: [number, number];
  radii: [number, number];
  ellipse_angle: number;
  motion_angle: number;
}

// ─── Funções auxiliares ───────────────────────────────────────────────

/** Random uniforme entre min e max */
function randomUniform(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Smoothstep de Hermite: transição suave 0→1 */
function smoothstep(x: number): number {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
}

// ─── Motion Blur Kernel ───────────────────────────────────────────────

/**
 * Cria kernel de motion blur linear (row-major)
 * @param size Tamanho do kernel (lado do quadrado)
 * @param angle Ângulo em graus (0 = horizontal direita, 90 = vertical cima)
 */
function createMotionBlurKernel(size: number, angle: number): number[] {
  const kernel = new Array<number>(size * size).fill(0);
  const center = Math.floor(size / 2);
  const angleRad = (angle * Math.PI) / 180;
  const dx = Math.cos(angleRad);
  const dy = -Math.sin(angleRad); // Y cresce para baixo

  let sum = 0;
  for (let i = 0; i < size; i++) {
    const offset = i - center;
    const x = Math.round(center + offset * dx);
    const y = Math.round(center + offset * dy);
    if (x >= 0 && x < size && y >= 0 && y < size) {
      kernel[y * size + x] = 1.0;
      sum += 1.0;
    }
  }

  if (sum > 0) {
    for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  }

  return kernel;
}

// ─── Gradient Mask ────────────────────────────────────────────────────

/**
 * Cria máscara composta: radial da imagem × inversa da elipse
 * - Blur mais forte nas bordas da IMAGEM
 * - Blur mais suave nas bordas da ELIPSE (smoothstep)
 * - Combinação: radial * (1 - smoothstep(ellipse))
 */
function createGradientMask(
  h: number, w: number,
  centerX: number, centerY: number,
  a: number, b: number,
  angle: number,
): Float32Array {
  const mask = new Float32Array(h * w);
  const imgCenterX = Math.floor(w / 2);
  const imgCenterY = Math.floor(h / 2);
  const angleRad = (angle * Math.PI) / 180;
  const cosA = Math.cos(-angleRad);
  const sinA = Math.sin(-angleRad);
  const aSafe = Math.max(a, 1);
  const bSafe = Math.max(b, 1);

  // Primeira passada: coleta pixels dentro da elipse
  const imgDists: number[] = [];
  const ellipseDists: number[] = [];
  const pixelIndices: number[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const xShifted = x - centerX;
      const yShifted = y - centerY;
      const xRot = xShifted * cosA - yShifted * sinA;
      const yRot = xShifted * sinA + yShifted * cosA;
      const ellipseDist = Math.sqrt((xRot / aSafe) ** 2 + (yRot / bSafe) ** 2);

      if (ellipseDist <= 1.0) {
        const imgDist = Math.sqrt((x - imgCenterX) ** 2 + (y - imgCenterY) ** 2);
        imgDists.push(imgDist);
        ellipseDists.push(ellipseDist);
        pixelIndices.push(y * w + x);
      }
    }
  }

  if (pixelIndices.length === 0) return mask;

  // Normaliza distâncias dentro da elipse
  let minImg = Infinity, maxImg = -Infinity;
  let minEllipse = Infinity, maxEllipse = -Infinity;

  for (let i = 0; i < pixelIndices.length; i++) {
    if (imgDists[i] < minImg) minImg = imgDists[i];
    if (imgDists[i] > maxImg) maxImg = imgDists[i];
    if (ellipseDists[i] < minEllipse) minEllipse = ellipseDists[i];
    if (ellipseDists[i] > maxEllipse) maxEllipse = ellipseDists[i];
  }

  const imgRange = maxImg - minImg;
  const ellipseRange = maxEllipse - minEllipse;

  // Calcula máscara combinada
  for (let i = 0; i < pixelIndices.length; i++) {
    const maskRadialImg = imgRange > 0
      ? (imgDists[i] - minImg) / imgRange
      : 0.5;
    const maskEllipseDist = ellipseRange > 0
      ? (ellipseDists[i] - minEllipse) / ellipseRange
      : 0;
    const maskEllipseSmooth = smoothstep(maskEllipseDist);

    // radial × (1 - ellipse): blur forte no centro da elipse, suave nas bordas
    mask[pixelIndices[i]] = maskRadialImg * (1 - maskEllipseSmooth);
  }

  // Normaliza para [0, 1]
  let maxVal = 0;
  for (let i = 0; i < pixelIndices.length; i++) {
    if (mask[pixelIndices[i]] > maxVal) maxVal = mask[pixelIndices[i]];
  }
  if (maxVal > 0) {
    for (let i = 0; i < pixelIndices.length; i++) {
      mask[pixelIndices[i]] /= maxVal;
    }
  }

  // Clamp para [0.05, 1.0] - garante blur mínimo em toda a região
  for (let i = 0; i < pixelIndices.length; i++) {
    mask[pixelIndices[i]] = Math.max(0.05, Math.min(1.0, mask[pixelIndices[i]]));
  }

  return mask;
}

// ─── Noise ────────────────────────────────────────────────────────────

/**
 * Adiciona ruído gaussiano + salt-and-pepper (modifica in-place)
 */
function addNoise(
  data: Float32Array,
  totalPixels: number,
  channels: number,
  intensity: number,
): void {
  // Ruído gaussiano (sigma = 5 a 10 conforme intensidade)
  const sigma = 5 + intensity * 5;

  for (let i = 0; i < data.length; i++) {
    // Box-Muller para gerar gaussiana
    const u1 = Math.random() || 1e-10;
    const u2 = Math.random();
    const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    data[i] += gaussian * sigma;
  }

  // Salt-and-pepper
  const amount = 0.005 * intensity;
  const numSalt = Math.floor(amount * totalPixels * channels);
  const numPepper = Math.floor(amount * totalPixels * channels);

  for (let i = 0; i < numSalt; i++) {
    const px = Math.floor(Math.random() * totalPixels);
    for (let c = 0; c < channels; c++) {
      data[px * channels + c] = 255;
    }
  }

  for (let i = 0; i < numPepper; i++) {
    const px = Math.floor(Math.random() * totalPixels);
    for (let c = 0; c < channels; c++) {
      data[px * channels + c] = 0;
    }
  }
}

// ─── Função principal ─────────────────────────────────────────────────

/**
 * Aplica degradação de blur elíptico (motion blur) em uma imagem
 * Implementação nativa em TypeScript/Sharp (sem dependência de Python/OpenCV)
 *
 * Algoritmo:
 * 1. Posiciona elipse aleatória (≥80px do centro da imagem)
 * 2. Cria máscara gradiente: radial × inversa da elipse
 * 3. Aplica 12 níveis progressivos de motion blur (kernel 3→36)
 * 4. Combina via blending usando a máscara gradiente
 */
//TODO_DEG - Aplica degradação elíptica (motion blur) na imagem questionada
export async function applyEllipticalBlur(
  inputPath: string,
  outputPath: string,
): Promise<DegradationResult> {
  const sharp = (await import('sharp')).default;

  logger.info('Iniciando degradação de imagem (TypeScript/Sharp)', {
    input: inputPath,
    output: outputPath,
  });

  // Lê imagem como buffer raw 3-canais (RGB)
  const { data, info } = await sharp(inputPath)
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels } = info;
  const totalPixels = w * h;

  // ── Parâmetros aleatórios da degradação ──
  //TODO_DEG - Parâmetros de degradação (area, excentricidade) vindos do env
  const areaPercent = randomUniform(
    env.DEGRADATION_MIN_AREA_PERCENT / 100,
    env.DEGRADATION_MAX_AREA_PERCENT / 100,
  );
  const eccentricity = randomUniform(
    env.DEGRADATION_MIN_ECCENTRICITY,
    env.DEGRADATION_MAX_ECCENTRICITY,
  );

  // ── Dimensões da elipse ──
  // Área = π·a·b  →  a = √(area / (π · √(1-e²)))  →  b = a · √(1-e²)
  const ellipseArea = w * h * areaPercent;
  const aRadius = Math.floor(
    Math.sqrt(ellipseArea / (Math.PI * Math.sqrt(1 - eccentricity ** 2))),
  );
  const bRadius = Math.floor(aRadius * Math.sqrt(1 - eccentricity ** 2));

  // ── Posicionamento da elipse ──
  const imgCenterX = Math.floor(w / 2);
  const imgCenterY = Math.floor(h / 2);

  // Borda da elipse a pelo menos 80px do centro da imagem
  const minDistFromCenter = 80 + bRadius;
  const margin = Math.max(aRadius, bRadius);

  // Ângulo radial aleatório (direção centro-imagem → centro-elipse)
  const radialAngle = Math.random() * 2 * Math.PI;
  const cosR = Math.cos(radialAngle);
  const sinR = Math.sin(radialAngle);

  // Distância máxima nesta direção para a elipse caber na imagem
  let maxDistX: number;
  if (cosR > 1e-6) maxDistX = (w - margin - imgCenterX) / cosR;
  else if (cosR < -1e-6) maxDistX = (margin - imgCenterX) / cosR;
  else maxDistX = Infinity;

  let maxDistY: number;
  if (sinR > 1e-6) maxDistY = (h - margin - imgCenterY) / sinR;
  else if (sinR < -1e-6) maxDistY = (margin - imgCenterY) / sinR;
  else maxDistY = Infinity;

  const maxDistFromCenter = Math.min(Math.abs(maxDistX), Math.abs(maxDistY));

  const dist = maxDistFromCenter < minDistFromCenter
    ? maxDistFromCenter
    : randomUniform(minDistFromCenter, maxDistFromCenter);

  let centerX = Math.round(imgCenterX + dist * cosR);
  let centerY = Math.round(imgCenterY + dist * sinR);

  // Garante que o centro fica dentro dos limites
  centerX = Math.max(margin, Math.min(w - margin, centerX));
  centerY = Math.max(margin, Math.min(h - margin, centerY));

  // ── Ângulo da elipse: tangencial à direção radial ±25° ──
  const radialAngleDeg = (radialAngle * 180) / Math.PI;
  const tangentAngle = radialAngleDeg + 90;
  const ellipseAngle = tangentAngle + randomUniform(-25, 25);

  // Ângulo do motion blur (do centro da imagem até centro da elipse)
  const dxMotion = centerX - imgCenterX;
  const dyMotion = centerY - imgCenterY;
  const motionAngle = (Math.atan2(-dyMotion, dxMotion) * 180) / Math.PI;

  logger.info('Parâmetros de degradação', {
    areaPercent: `${(areaPercent * 100).toFixed(1)}%`,
    eccentricity: eccentricity.toFixed(3),
    center: [centerX, centerY],
    radii: [aRadius, bRadius],
    ellipseAngle: ellipseAngle.toFixed(1),
    motionAngle: motionAngle.toFixed(1),
  });

  // ── Máscara gradiente ──
  const gradientMask = createGradientMask(
    h, w, centerX, centerY, aRadius, bRadius, ellipseAngle,
  );

  // ── Resultado inicializado com pixels originais (float32) ──
  const result = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) result[i] = data[i];

  // ── Ruído (opcional) ──
  //TODO_DEG - Ruído gaussiano + salt-and-pepper (configurável via env)
  if (env.DEGRADATION_NOISE) {
    addNoise(result, totalPixels, channels, env.DEGRADATION_NOISE_INTENSITY);
  }

  // ── Blur progressivo com 12 níveis ──
  //TODO_DEG - Kernels de motion blur de tamanho 3 a 36
  const blurLevels = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];

  // Pré-computa versões borradas usando sharp.convolve() (nativo C/libvips)
  const blurredBuffers: Buffer[] = [];
  for (const kernelSize of blurLevels) {
    const kernel = createMotionBlurKernel(kernelSize, motionAngle);
    const blurred = await sharp(Buffer.from(data), {
      raw: { width: w, height: h, channels },
    })
      .convolve({
        width: kernelSize,
        height: kernelSize,
        kernel,
        scale: 1,
      })
      .raw()
      .toBuffer();
    blurredBuffers.push(blurred);
  }

  // ── Blending progressivo ──
  // Para cada pixel, aplica o nível de blur proporcional ao gradientMask
  const numLevels = blurLevels.length;
  for (let pixel = 0; pixel < totalPixels; pixel++) {
    const maskVal = gradientMask[pixel];
    if (maskVal <= 0) continue;

    for (let level = 0; level < numLevels; level++) {
      const levelMin = level / numLevels;
      const levelMax = (level + 1) / numLevels;
      const levelMask = Math.max(0, Math.min(1,
        (maskVal - levelMin) / (levelMax - levelMin),
      ));
      if (levelMask <= 0) continue;

      for (let c = 0; c < channels; c++) {
        const idx = pixel * channels + c;
        result[idx] = result[idx] * (1 - levelMask) + blurredBuffers[level][idx] * levelMask;
      }
    }
  }

  // ── Converte para uint8 e salva ──
  const outputData = Buffer.alloc(result.length);
  for (let i = 0; i < result.length; i++) {
    outputData[i] = Math.max(0, Math.min(255, Math.round(result[i])));
  }

  const ext = outputPath.toLowerCase().split('.').pop();
  const sharpOutput = sharp(outputData, { raw: { width: w, height: h, channels } });
  if (ext === 'jpg' || ext === 'jpeg') {
    await sharpOutput.jpeg({ quality: 95 }).toFile(outputPath);
  } else {
    await sharpOutput.png().toFile(outputPath);
  }

  const degradationResult: DegradationResult = {
    status: 'ok',
    input: inputPath,
    output: outputPath,
    area_percent: Math.round(areaPercent * 1000) / 10,
    eccentricity: Math.round(eccentricity * 1000) / 1000,
    center: [centerX, centerY],
    radii: [aRadius, bRadius],
    ellipse_angle: Math.round(ellipseAngle * 10) / 10,
    motion_angle: Math.round(motionAngle * 10) / 10,
  };

  logger.info('Degradação aplicada com sucesso', degradationResult);
  return degradationResult;
}
