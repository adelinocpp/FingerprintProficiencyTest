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
  panelZoom?: number;
  children: React.ReactNode;
}

export default function MagnifyingLens({
  imageSrc,
  lensSize = 280,
  zoomLevel = 2.5,
  markings = [],
  showMarkings = true,
  panelZoom = 1,
  children,
}: MagnifyingLensProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [currentZoom, setCurrentZoom] = useState(zoomLevel);

  // Ref estável para o estado ativo (evita stale closures nos listeners globais)
  const isActiveRef = useRef(false);
  const containerRefStable = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    containerRefStable.current = containerRef.current;
  });

  // Verifica se o mouse está dentro do container
  const isInBounds = useCallback((e: MouseEvent): boolean => {
    const container = containerRefStable.current;
    if (!container) return false;
    const rect = container.getBoundingClientRect();
    return (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );
  }, []);

  // Calcula posição relativa ao container
  const getRelativePosition = useCallback((e: MouseEvent) => {
    const container = containerRefStable.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // Listeners globais no document (bypassa z-index do MinutiaeCanvas)
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 2) return; // Só botão direito
      if (!isInBounds(e)) return;
      e.preventDefault();
      isActiveRef.current = true;
      setIsActive(true);
      setPosition(getRelativePosition(e));
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isActiveRef.current) return;
      setPosition(getRelativePosition(e));
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button !== 2) return;
      if (isActiveRef.current) {
        isActiveRef.current = false;
        setIsActive(false);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Previne menu de contexto dentro do container
      if (isInBounds(e)) {
        e.preventDefault();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!isActiveRef.current) return;
      if (!isInBounds(e)) return;
      e.preventDefault();

      const delta = e.deltaY > 0 ? 0.3 : -0.3;
      setCurrentZoom(prev => Math.max(1.5, Math.min(8, prev + delta)));
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [isInBounds, getRelativePosition]);

  const radius = lensSize / 2;
  const containerRect = containerRef.current?.getBoundingClientRect();
  const containerW = containerRect?.width || 1;
  const containerH = containerRect?.height || 1;

  const bgWidth = containerW * currentZoom;
  const bgHeight = containerH * currentZoom;
  const bgX = -(position.x * currentZoom - radius);
  const bgY = -(position.y * currentZoom - radius);

  return (
    <div ref={containerRef} className="relative w-full h-full">
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
          {/* Indicador de zoom */}
          <span
            className="absolute bottom-1 right-2 text-[10px] font-mono text-white/80 bg-black/40 px-1 rounded"
            style={{ pointerEvents: 'none' }}
          >
            {(currentZoom * panelZoom).toFixed(1)}x
          </span>

          {/* Marcações de minúcias no zoom */}
          {showMarkings && markings.map((m, i) => {
            const mx = m.x * containerW;
            const my = m.y * containerH;
            const lensX = radius + (mx - position.x) * currentZoom;
            const lensY = radius + (my - position.y) * currentZoom;

            const dx = lensX - radius;
            const dy = lensY - radius;
            if (Math.sqrt(dx * dx + dy * dy) > radius + 12) return null;

            const markSize = 24 * currentZoom / 2.5;
            return (
              <div
                key={i}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: markSize,
                  height: markSize,
                  left: lensX - markSize / 2,
                  top: lensY - markSize / 2,
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
