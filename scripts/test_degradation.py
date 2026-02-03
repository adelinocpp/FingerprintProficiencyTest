#!/usr/bin/env python3
"""
Script para testar degradação de imagens com blur elíptico (motion blur)
Simula deslocamento de câmera com forma elíptica
"""

import cv2
import numpy as np
import argparse
from pathlib import Path


def create_ellipse_kernel(size, eccentricity, angle):
    """
    Cria kernel de blur elíptico
    
    Args:
        size: Tamanho do kernel (largura, altura)
        eccentricity: Excentricidade da elipse (0.1 a 0.5)
        angle: Ângulo de rotação em graus
    
    Returns:
        Kernel normalizado para convolução
    """
    kernel = np.zeros(size, dtype=np.float32)
    center = (size[1] // 2, size[0] // 2)
    
    # Calcula raios baseado na excentricidade
    # Excentricidade e = sqrt(1 - (b²/a²))
    # Então b = a * sqrt(1 - e²)
    a = max(size) // 4  # raio maior
    b = int(a * np.sqrt(1 - eccentricity ** 2))  # raio menor
    
    # Cria máscara elíptica
    cv2.ellipse(kernel, center, (a, b), angle, 0, 360, 1, -1)
    
    # Normaliza
    kernel = kernel / kernel.sum()
    
    return kernel


def apply_elliptical_blur(image, area_percent=0.15, eccentricity=0.3, angle=None):
    """
    Aplica blur elíptico em uma região da imagem
    
    Args:
        image: Imagem de entrada (numpy array)
        area_percent: Percentual da área da imagem para aplicar blur (0.1 a 0.25)
        eccentricity: Excentricidade da elipse (0.1 a 0.5)
        angle: Ângulo de rotação (None para aleatório)
    
    Returns:
        Imagem com blur aplicado
    """
    h, w = image.shape[:2]
    image_area = h * w
    
    # Calcula área da elipse
    ellipse_area = image_area * area_percent
    
    # Calcula raios da elipse
    # Área = π * a * b
    a = int(np.sqrt(ellipse_area / (np.pi * np.sqrt(1 - eccentricity ** 2))))
    b = int(a * np.sqrt(1 - eccentricity ** 2))
    
    # Centro aleatório dentro da imagem (respeitando os raios)
    center_x = np.random.randint(a, w - a)
    center_y = np.random.randint(b, h - b)
    
    # Ângulo aleatório se não especificado
    if angle is None:
        angle = np.random.randint(0, 360)
    
    # Cria máscara elíptica
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.ellipse(mask, (center_x, center_y), (a, b), angle, 0, 360, 255, -1)
    
    # Aplica blur
    kernel_size = max(15, min(a, b) // 2)
    if kernel_size % 2 == 0:
        kernel_size += 1
    
    blurred = cv2.GaussianBlur(image, (kernel_size, kernel_size), 0)
    
    # Combina imagem original com blur usando máscara
    mask_3ch = cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR) / 255.0
    result = (image * (1 - mask_3ch) + blurred * mask_3ch).astype(np.uint8)
    
    return result, mask, (center_x, center_y, a, b, angle)


def main():
    parser = argparse.ArgumentParser(description='Testa degradação de imagem com blur elíptico')
    parser.add_argument('input', type=str, help='Caminho da imagem de entrada')
    parser.add_argument('--output-dir', '-o', type=str, default='./degradation_tests',
                        help='Diretório de saída (padrão: ./degradation_tests)')
    parser.add_argument('--samples', '-n', type=int, default=5,
                        help='Número de amostras a gerar (padrão: 5)')
    parser.add_argument('--area-min', type=float, default=0.10,
                        help='Área mínima da elipse (padrão: 0.10)')
    parser.add_argument('--area-max', type=float, default=0.25,
                        help='Área máxima da elipse (padrão: 0.25)')
    parser.add_argument('--ecc-min', type=float, default=0.1,
                        help='Excentricidade mínima (padrão: 0.1)')
    parser.add_argument('--ecc-max', type=float, default=0.5,
                        help='Excentricidade máxima (padrão: 0.5)')
    
    args = parser.parse_args()
    
    # Carrega imagem
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Erro: Arquivo não encontrado: {input_path}")
        return
    
    image = cv2.imread(str(input_path))
    if image is None:
        print(f"Erro: Não foi possível carregar a imagem: {input_path}")
        return
    
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
        degraded, mask, params = apply_elliptical_blur(image, area_percent, eccentricity)
        center_x, center_y, a, b, angle = params
        
        # Salva imagem degradada
        output_path = output_dir / f"{i+1:02d}_degraded.png"
        cv2.imwrite(str(output_path), degraded)
        
        # Salva máscara
        mask_path = output_dir / f"{i+1:02d}_mask.png"
        cv2.imwrite(str(mask_path), mask)
        
        print(f"Amostra {i+1}:")
        print(f"  - Arquivo: {output_path.name}")
        print(f"  - Área: {area_percent*100:.1f}% da imagem")
        print(f"  - Excentricidade: {eccentricity:.2f}")
        print(f"  - Centro: ({center_x}, {center_y})")
        print(f"  - Raios: a={a}px, b={b}px")
        print(f"  - Ângulo: {angle}°")
        print()
    
    print("-" * 70)
    print(f"\n✓ {args.samples} amostras geradas em: {output_dir}")
    print("\nPara visualizar, abra as imagens no diretório de saída.")


if __name__ == '__main__':
    main()
