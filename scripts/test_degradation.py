#!/usr/bin/env python3
"""
Script para testar degradação de imagens com blur elíptico (motion blur)
Simula deslocamento de câmera com forma elíptica e motion blur radial
"""

import sys
import cv2
import numpy as np
import argparse
from pathlib import Path


def create_motion_blur_kernel(size, angle):
    """
    Cria kernel de motion blur linear

    Args:
        size: Tamanho do kernel (deve ser ímpar)
        angle: Ângulo em graus (0 = horizontal direita, 90 = vertical para cima)

    Returns:
        Kernel normalizado para motion blur
    """
    kernel = np.zeros((size, size), dtype=np.float32)
    center = size // 2

    # Converte ângulo para radianos
    angle_rad = np.deg2rad(angle)

    # Calcula direção do motion blur
    dx = np.cos(angle_rad)
    dy = -np.sin(angle_rad)  # Negativo porque y cresce para baixo

    # Desenha linha no kernel
    for i in range(size):
        offset = i - center
        x = int(center + offset * dx)
        y = int(center + offset * dy)

        if 0 <= x < size and 0 <= y < size:
            kernel[y, x] = 1.0

    # Normaliza
    if kernel.sum() > 0:
        kernel = kernel / kernel.sum()

    return kernel


def smoothstep(x):
    """
    Função de suavização Hermite (smoothstep)
    Retorna transição suave de 0 a 1 para x em [0, 1]
    """
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def create_gradient_mask(h, w, center_x, center_y, a, b, angle):
    """
    Cria máscara composta: radial da imagem × inversa da elipse

    - Blur mais forte nas bordas da IMAGEM
    - Blur mais suave nas bordas da ELIPSE (com smoothstep)
    - Combinação por multiplicação + normalização

    Args:
        h, w: Dimensões da imagem
        center_x, center_y: Centro da elipse
        a, b: Raios da elipse
        angle: Ângulo de rotação em graus

    Returns:
        Tuple: (gradient, mask_radial, mask_ellipse)
        - gradient: Máscara combinada final
        - mask_radial: Máscara radial da imagem
        - mask_ellipse: Máscara da elipse (antes de inverter)
    """
    # Cria máscara elíptica base
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.ellipse(mask, (center_x, center_y), (a, b), angle, 0, 360, 255, -1)

    # Centro da imagem
    img_center_x = w // 2
    img_center_y = h // 2

    # Cria grid de coordenadas
    y_coords, x_coords = np.mgrid[0:h, 0:w]

    # === MÁSCARA 1: Radial da IMAGEM (0 no centro → 1 nas bordas) ===
    dist_from_img_center = np.sqrt(
        (x_coords - img_center_x) ** 2 +
        (y_coords - img_center_y) ** 2
    )

    # === MÁSCARA 2: Distância normalizada da ELIPSE (0 no centro → 1 nas bordas) ===
    # Converte ângulo para radianos
    angle_rad = np.deg2rad(angle)

    # Translada coordenadas para o centro da elipse
    x_shifted = x_coords - center_x
    y_shifted = y_coords - center_y

    # Rotaciona coordenadas (rotação inversa)
    x_rot = x_shifted * np.cos(-angle_rad) - y_shifted * np.sin(-angle_rad)
    y_rot = x_shifted * np.sin(-angle_rad) + y_shifted * np.cos(-angle_rad)

    # Calcula distância normalizada da elipse
    # Pontos na borda da elipse têm dist_ellipse = 1.0
    # Evita divisão por zero
    a_safe = max(a, 1)
    b_safe = max(b, 1)
    dist_from_ellipse_center = np.sqrt((x_rot / a_safe) ** 2 + (y_rot / b_safe) ** 2)

    # === Máscara radial da imagem inteira (0 no centro → 1 nas bordas) ===
    max_dist = np.sqrt(img_center_x ** 2 + img_center_y ** 2)
    if max_dist > 0:
        mask_radial_full = 0.5*dist_from_img_center / max_dist
    else:
        mask_radial_full = np.zeros((h, w), dtype=np.float32)

    # Aplica apenas dentro da máscara elíptica para o gradiente e elipse
    gradient = np.zeros((h, w), dtype=np.float32)
    mask_ellipse_full = np.zeros((h, w), dtype=np.float32)
    ellipse_region = mask > 0

    if ellipse_region.any():
        # Normaliza distâncias da imagem dentro da elipse
        dist_img_in_ellipse = dist_from_img_center[ellipse_region]
        min_img = dist_img_in_ellipse.min()
        max_img = dist_img_in_ellipse.max()

        if max_img > min_img:
            mask_radial_img = (dist_img_in_ellipse - min_img) / (max_img - min_img)
        else:
            mask_radial_img = np.ones_like(dist_img_in_ellipse) * 0.5

        # Normaliza distâncias da elipse
        dist_ellipse_in_region = dist_from_ellipse_center[ellipse_region]
        min_ellipse = dist_ellipse_in_region.min()
        max_ellipse = dist_ellipse_in_region.max()

        if max_ellipse > min_ellipse:
            mask_ellipse_dist = (dist_ellipse_in_region - min_ellipse) / (max_ellipse - min_ellipse)
        else:
            mask_ellipse_dist = np.zeros_like(dist_ellipse_in_region)

        # Aplica smoothstep para suavizar o gradiente da elipse
        mask_ellipse_smooth = smoothstep(mask_ellipse_dist)

        # Salva máscara da elipse para debug
        mask_ellipse_full[ellipse_region] = mask_ellipse_smooth

        # Combina as máscaras por multiplicação:
        # mask_radial_img: 0 no centro da imagem → 1 nas bordas
        # (1 - mask_ellipse_smooth): 1 no centro da elipse → 0 nas bordas
        # Resultado: blur forte no centro da elipse, suave nas bordas
        combined = mask_radial_img * (1 - mask_ellipse_smooth)

        # Normaliza para garantir range [0, 1]
        if combined.max() > 0:
            combined = combined / combined.max()

        gradient[ellipse_region] = combined

        # Garante valor mínimo de 0.05 para ter algum blur em toda a região
        gradient[ellipse_region] = np.clip(gradient[ellipse_region], 0.05, 1.0)

    return gradient, mask_radial_full, mask_ellipse_full


def add_noise(image, noise_type='mixed', intensity=0.5):
    """
    Adiciona ruído à imagem para simular degradação

    Args:
        image: Imagem de entrada
        noise_type: Tipo de ruído ('gaussian', 'salt_pepper', 'mixed')
        intensity: Intensidade do ruído (0.0 a 1.0)

    Returns:
        Imagem com ruído adicionado
    """
    noisy = image.copy().astype(np.float32)

    if noise_type in ['gaussian', 'mixed']:
        # Ruído gaussiano (simula granulação do sensor/papel)
        sigma = 5 + intensity * 5  # 5 a 15
        gaussian_noise = np.random.normal(0, sigma, image.shape).astype(np.float32)
        noisy = noisy + gaussian_noise

    if noise_type in ['salt_pepper', 'mixed']:
        # Salt-and-pepper (simula pixels com/sem tinta)
        amount = 0.005 * intensity  # 0.5% a 1%

        # Salt (pixels brancos)
        num_salt = int(amount * image.size)
        coords_salt = [np.random.randint(0, i, num_salt) for i in image.shape[:2]]
        if len(image.shape) == 3:
            noisy[coords_salt[0], coords_salt[1], :] = 255
        else:
            noisy[coords_salt[0], coords_salt[1]] = 255

        # Pepper (pixels pretos)
        num_pepper = int(amount * image.size)
        coords_pepper = [np.random.randint(0, i, num_pepper) for i in image.shape[:2]]
        if len(image.shape) == 3:
            noisy[coords_pepper[0], coords_pepper[1], :] = 0
        else:
            noisy[coords_pepper[0], coords_pepper[1]] = 0

    # Garante valores válidos
    noisy = np.clip(noisy, 0, 255).astype(np.uint8)

    return noisy


def apply_elliptical_blur(image, area_percent=0.15, eccentricity=0.3, angle=None, add_noise_flag=True, noise_intensity=0.5):
    """
    Aplica motion blur elíptico com gradiente radial + ruído

    Args:
        image: Imagem de entrada (numpy array)
        area_percent: Percentual da área da imagem para aplicar blur (0.1 a 0.25)
        eccentricity: Excentricidade da elipse (0.1 a 0.5)
        angle: Ângulo de rotação da elipse (None para aleatório)
        add_noise_flag: Se True, adiciona ruído à imagem
        noise_intensity: Intensidade do ruído (0.0 a 1.0)

    Returns:
        Imagem com blur aplicado, máscara, parâmetros
    """
    h, w = image.shape[:2]
    image_area = h * w

    # Centro da imagem
    img_center_x = w // 2
    img_center_y = h // 2

    # Calcula área da elipse
    ellipse_area = image_area * area_percent

    # Calcula raios da elipse
    # Área = pi * a * b
    a = int(np.sqrt(ellipse_area / (np.pi * np.sqrt(1 - eccentricity ** 2))))
    b = int(a * np.sqrt(1 - eccentricity ** 2))

    # Posiciona a elipse: borda mais próxima a pelo menos 80px do centro da imagem
    # Como o eixo maior será tangencial, o semi-eixo menor (b) aponta na direção radial
    # Distância mínima do centro da elipse ao centro da imagem: 80 + b
    min_dist_from_center = 80 + b

    # Distância máxima: a elipse precisa caber na imagem
    # Usa a margem do semi-eixo maior para não cortar a elipse
    margin = max(a, b)

    # Escolhe ângulo radial aleatório (direção do centro da imagem → centro da elipse)
    radial_angle = np.random.uniform(0, 2 * np.pi)

    # Calcula distância máxima possível nesta direção radial
    # A elipse precisa caber na imagem: centro ± margin dentro dos limites
    cos_r = np.cos(radial_angle)
    sin_r = np.sin(radial_angle)

    # Limites em x e y para o centro da elipse
    if cos_r > 0:
        max_dist_x = (w - margin - img_center_x) / cos_r if cos_r > 1e-6 else float('inf')
    elif cos_r < 0:
        max_dist_x = (margin - img_center_x) / cos_r if cos_r < -1e-6 else float('inf')
    else:
        max_dist_x = float('inf')

    if sin_r > 0:
        max_dist_y = (h - margin - img_center_y) / sin_r if sin_r > 1e-6 else float('inf')
    elif sin_r < 0:
        max_dist_y = (margin - img_center_y) / sin_r if sin_r < -1e-6 else float('inf')
    else:
        max_dist_y = float('inf')

    max_dist_from_center = min(abs(max_dist_x), abs(max_dist_y))

    # Garante que o range é válido
    if max_dist_from_center < min_dist_from_center:
        # Se não cabe, usa a distância máxima possível
        dist = max_dist_from_center
    else:
        dist = np.random.uniform(min_dist_from_center, max_dist_from_center)

    center_x = int(img_center_x + dist * cos_r)
    center_y = int(img_center_y + dist * sin_r)

    # Garante que o centro fica dentro da imagem
    center_x = np.clip(center_x, margin, w - margin)
    center_y = np.clip(center_y, margin, h - margin)

    # Ângulo da elipse: eixo maior tangencial à direção radial (±25°)
    # Direção radial em graus (do centro da imagem → centro da elipse)
    radial_angle_deg = np.degrees(radial_angle)
    # Tangente = perpendicular à direção radial (+90°)
    tangent_angle = radial_angle_deg + 90
    # Adiciona variação aleatória de ±25°
    if angle is None:
        angle = tangent_angle + np.random.uniform(-25, 25)

    # Calcula ângulo do motion blur (do centro da imagem até centro da elipse)
    dx = center_x - img_center_x
    dy = center_y - img_center_y
    motion_angle = np.degrees(np.arctan2(-dy, dx))  # -dy porque Y cresce para baixo

    # Cria máscara com gradiente radial (do centro da imagem para fora)
    gradient_mask, mask_radial, mask_ellipse = create_gradient_mask(h, w, center_x, center_y, a, b, angle)

    # Aplica motion blur com intensidade variável
    result = image.copy().astype(np.float32)

    # Adiciona ruído se solicitado
    if add_noise_flag:
        result = add_noise(result, noise_type='mixed', intensity=noise_intensity)

    # Define níveis de blur (do mais fraco ao mais forte)
    blur_levels = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]  # Tamanhos de kernel

    # Aplica blur progressivo baseado na máscara gradiente
    for i, kernel_size in enumerate(blur_levels):
        # Normaliza gradiente para este nível
        level_min = i / len(blur_levels)
        level_max = (i + 1) / len(blur_levels)

        # Cria máscara para este nível
        level_mask = np.clip((gradient_mask - level_min) / (level_max - level_min), 0, 1)

        # Aplica motion blur
        kernel = create_motion_blur_kernel(kernel_size, motion_angle)
        blurred = cv2.filter2D(image.astype(np.float32), -1, kernel)

        # Combina com resultado
        level_mask_3ch = np.stack([level_mask] * 3, axis=-1)
        result = result * (1 - level_mask_3ch) + blurred * level_mask_3ch

    result = result.astype(np.uint8)

    # Cria máscaras visuais (para debug)
    mask_combined = (gradient_mask * 255).astype(np.uint8)
    mask_radial_visual = (mask_radial * 255).astype(np.uint8)
    # Inverte a máscara da elipse para mostrar como é usada na combinação
    # (1 - mask_ellipse): 1 no centro → 0 nas bordas = branco no centro, preto nas bordas
    mask_ellipse_inverted = np.zeros_like(mask_ellipse)
    ellipse_region = mask_ellipse > 0
    mask_ellipse_inverted[ellipse_region] = 1.0 - mask_ellipse[ellipse_region]
    mask_ellipse_visual = (mask_ellipse_inverted * 255).astype(np.uint8)

    return result, mask_combined, mask_radial_visual, mask_ellipse_visual, (center_x, center_y, a, b, angle, motion_angle)


def main():
    parser = argparse.ArgumentParser(description='Testa degradação de imagem com blur elíptico')
    parser.add_argument('input', type=str, help='Caminho da imagem de entrada')
    parser.add_argument('--output-dir', '-o', type=str, default='./degradation_tests',
                        help='Diretório de saída (padrão: ./degradation_tests)')
    parser.add_argument('--samples', '-n', type=int, default=5,
                        help='Número de amostras a gerar (padrão: 5)')
    parser.add_argument('--area-min', type=float, default=0.25,
                        help='Área mínima da elipse (padrão: 0.10)')
    parser.add_argument('--area-max', type=float, default=0.5,
                        help='Área máxima da elipse (padrão: 0.25)')
    parser.add_argument('--ecc-min', type=float, default=0.7,
                        help='Excentricidade mínima (padrão: 0.7)')
    parser.add_argument('--ecc-max', type=float, default=0.95,
                        help='Excentricidade máxima (padrão: 0.95)')
    parser.add_argument('--noise', action='store_true',
                        help='Adiciona ruído à imagem (padrão: desabilitado)')
    parser.add_argument('--noise-intensity', type=float, default=0.25,
                        help='Intensidade do ruído 0.0 a 1.0 (padrão: 0.5)')
    parser.add_argument('--single-output', type=str, default=None,
                        help='Modo produção: processa 1 imagem e salva no caminho especificado')

    args = parser.parse_args()

    # Carrega imagem
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Erro: Arquivo não encontrado: {input_path}", file=sys.stderr)
        sys.exit(1)

    image = cv2.imread(str(input_path))
    if image is None:
        print(f"Erro: Não foi possível carregar a imagem: {input_path}", file=sys.stderr)
        sys.exit(1)

    # === Modo single-output (produção) ===
    if args.single_output:
        import json

        area_percent = np.random.uniform(args.area_min, args.area_max)
        eccentricity = np.random.uniform(args.ecc_min, args.ecc_max)

        degraded, _, _, _, params = apply_elliptical_blur(
            image,
            area_percent,
            eccentricity,
            add_noise_flag=args.noise,
            noise_intensity=args.noise_intensity
        )
        center_x, center_y, a, b, angle, motion_angle = params

        output_path = Path(args.single_output)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Salva no formato adequado (jpg com qualidade ou png)
        ext = output_path.suffix.lower()
        if ext in ['.jpg', '.jpeg']:
            cv2.imwrite(str(output_path), degraded, [cv2.IMWRITE_JPEG_QUALITY, 95])
        else:
            cv2.imwrite(str(output_path), degraded)

        # Imprime JSON com parâmetros para o chamador (stdout)
        result = {
            "status": "ok",
            "input": str(input_path),
            "output": str(output_path),
            "area_percent": round(area_percent * 100, 1),
            "eccentricity": round(eccentricity, 3),
            "center": [int(center_x), int(center_y)],
            "radii": [int(a), int(b)],
            "ellipse_angle": round(float(angle), 1),
            "motion_angle": round(float(motion_angle), 1)
        }
        print(json.dumps(result))
        sys.exit(0)

    # === Modo batch (teste/desenvolvimento) ===
    print(f"Imagem carregada: {input_path}")
    print(f"Dimensões: {image.shape[1]}x{image.shape[0]}")

    # Cria diretório de saída
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Salva imagem original
    original_path = output_dir / "00_original.png"
    cv2.imwrite(str(original_path), image)
    print(f"\n✓ Original salva: {original_path}")

    # Gera amostras com degradação
    print(f"\nGerando {args.samples} amostras degradadas...")
    print("-" * 70)

    for i in range(args.samples):
        # Parâmetros aleatórios
        area_percent = np.random.uniform(args.area_min, args.area_max)
        eccentricity = np.random.uniform(args.ecc_min, args.ecc_max)

        # Aplica degradação
        degraded, mask_combined, mask_radial, mask_ellipse, params = apply_elliptical_blur(
            image,
            area_percent,
            eccentricity,
            add_noise_flag=args.noise,
            noise_intensity=args.noise_intensity
        )
        center_x, center_y, a, b, angle, motion_angle = params

        # Salva imagem degradada
        output_path = output_dir / f"{i+1:02d}_degraded.png"
        cv2.imwrite(str(output_path), degraded)

        # Salva máscaras separadas
        mask_combined_path = output_dir / f"{i+1:02d}_mask_combined.png"
        cv2.imwrite(str(mask_combined_path), mask_combined)

        mask_radial_path = output_dir / f"{i+1:02d}_mask_radial.png"
        cv2.imwrite(str(mask_radial_path), mask_radial)

        mask_ellipse_path = output_dir / f"{i+1:02d}_mask_ellipse.png"
        cv2.imwrite(str(mask_ellipse_path), mask_ellipse)

        print(f"Amostra {i+1}:")
        print(f"  - Arquivo: {output_path.name}")
        print(f"  - Área: {area_percent*100:.1f}% da imagem")
        print(f"  - Excentricidade: {eccentricity:.2f}")
        print(f"  - Centro elipse: ({center_x}, {center_y})")
        print(f"  - Raios elipse: a={a}px, b={b}px")
        print(f"  - Ângulo elipse: {angle:.1f}°")
        print(f"  - Ângulo motion blur: {motion_angle:.1f}°")
        print()

    print("-" * 70)
    print(f"\n✓ {args.samples} amostras geradas em: {output_dir}")
    print("\nPara visualizar, abra as imagens no diretório de saída.")


if __name__ == '__main__':
    main()
