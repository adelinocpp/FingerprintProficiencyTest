import { useState, useRef, useCallback, useEffect } from 'react';

interface LensMarking {
  x: number;
  y: number;
}

interface MagnifyingLensProps {
  imageSrc: string;
  lensSize?: number;
  zoomLevel?: number;
  markings?: LensMarking[];
  showMarkings?: boolean;
  children: React.ReactNode;
}

export default function MagnifyingLens({
  imageSrc,
  lensSize = 280,
  zoomLevel = 2.5,
  markings = [],
  showMarkings = true,
  children,
}: MagnifyingLensProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const updatePosition = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsActive(true);
    updatePosition(e);
  }, [updatePosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isActive) return;
    updatePosition(e);
  }, [isActive, updatePosition]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      setIsActive(false);
    }
  }, []);

  // Previne o menu de contexto global enquanto a lupa está ativa
  useEffect(() => {
    const preventContext = (e: Event) => {
      if (isActive) e.preventDefault();
    };
    document.addEventListener('contextmenu', preventContext);
    return () => document.removeEventListener('contextmenu', preventContext);
  }, [isActive]);

  const radius = lensSize / 2;
  const containerRect = containerRef.current?.getBoundingClientRect();
  const containerW = containerRect?.width || 1;
  const containerH = containerRect?.height || 1;

  const bgWidth = containerW * zoomLevel;
  const bgHeight = containerH * zoomLevel;
  const bgX = -(position.x * zoomLevel - radius);
  const bgY = -(position.y * zoomLevel - radius);

  return (
    <div
      ref={containerRef}
      className="relative"
      onContextMenu={handleContextMenu}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsActive(false)}
    >
      {children}

      {isActive && (
        <div
          className="absolute pointer-events-none border-2 border-white shadow-2xl rounded-full z-50 overflow-hidden"
          style={{
            width: lensSize,
            height: lensSize,
            left: position.x - radius,
            top: position.y - radius,
            backgroundImage: `url(${imageSrc})`,
            backgroundSize: `${bgWidth}px ${bgHeight}px`,
            backgroundPosition: `${bgX}px ${bgY}px`,
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Marcações de minúcias no zoom */}
          {showMarkings && markings.map((m, i) => {
            // Posição da marcação no espaço do container
            const mx = m.x * containerW;
            const my = m.y * containerH;
            // Posição no espaço da lupa
            const lensX = radius + (mx - position.x) * zoomLevel;
            const lensY = radius + (my - position.y) * zoomLevel;

            // Só renderiza se estiver dentro do círculo da lupa
            const dx = lensX - radius;
            const dy = lensY - radius;
            if (Math.sqrt(dx * dx + dy * dy) > radius + 12) return null;

            return (
              <div
                key={i}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 24 * zoomLevel / 2.5,
                  height: 24 * zoomLevel / 2.5,
                  left: lensX - (12 * zoomLevel / 2.5),
                  top: lensY - (12 * zoomLevel / 2.5),
                  border: '2px solid rgba(255, 50, 50, 0.85)',
                  backgroundColor: 'rgba(255, 50, 50, 0.25)',
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
