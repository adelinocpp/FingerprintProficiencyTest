import { useRef, useEffect, useState, useCallback } from 'react';

export interface Marking {
  id: string;
  x: number;
  y: number;
}

interface MinutiaeCanvasProps {
  groupId: string;
  imageType: 'questionada' | 'padrao';
  imageIndex: number | null;
  visible?: boolean;
  onMarkingsChange?: (markings: Marking[]) => void;
}

const CIRCLE_RADIUS = 12;
const REMOVE_TOLERANCE = 18;
const DBLCLICK_DELAY = 250;

export default function MinutiaeCanvas({
  groupId,
  imageType,
  imageIndex,
  visible = true,
  onMarkingsChange,
}: MinutiaeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [markings, setMarkings] = useState<Marking[]>([]);
  const markingsRef = useRef<Marking[]>([]);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingClickRef = useRef<{ nx: number; ny: number } | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  // Sincroniza ref com state e notifica pai
  useEffect(() => {
    markingsRef.current = markings;
    onMarkingsChange?.(markings);
  }, [markings, onMarkingsChange]);

  // Carrega marcações do servidor
  const loadMarkings = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const idx = imageIndex !== null ? imageIndex : 'null';
      const response = await fetch(
        `${API_URL}/minutiae/${groupId}/${imageType}/${idx}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success && data.data?.markings) {
        setMarkings(data.data.markings);
      }
    } catch (e) {
      console.error('Erro ao carregar minúcias:', e);
    }
  }, [API_URL, groupId, imageType, imageIndex]);

  useEffect(() => {
    loadMarkings();
  }, [loadMarkings]);

  // Redimensiona canvas para acompanhar o container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }, []);

  // Redesenha marcações
  const drawMarkings = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!visible) return;

    for (const m of markingsRef.current) {
      const px = m.x * canvas.width;
      const py = m.y * canvas.height;

      ctx.beginPath();
      ctx.arc(px, py, CIRCLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 50, 50, 0.25)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 50, 50, 0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [visible]);

  useEffect(() => {
    drawMarkings();
  }, [markings, drawMarkings, visible]);

  // Resize observer
  useEffect(() => {
    resizeCanvas();
    drawMarkings();
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      resizeCanvas();
      drawMarkings();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [resizeCanvas, drawMarkings]);

  // Adiciona marcação ao servidor
  const addMarking = useCallback(async (nx: number, ny: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_URL}/minutiae`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          group_id: groupId,
          image_type: imageType,
          image_index: imageIndex,
          x: nx,
          y: ny,
        }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        setMarkings(prev => [...prev, { id: data.data.id, x: nx, y: ny }]);
      }
    } catch (e) {
      console.error('Erro ao adicionar minúcia:', e);
    }
  }, [API_URL, groupId, imageType, imageIndex]);

  // Remove marcação do servidor
  const removeMarking = useCallback(async (nx: number, ny: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    let closestId: string | null = null;
    let closestDist = Infinity;

    for (const m of markingsRef.current) {
      const dx = (m.x - nx) * rect.width;
      const dy = (m.y - ny) * rect.height;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < REMOVE_TOLERANCE && dist < closestDist) {
        closestDist = dist;
        closestId = m.id;
      }
    }

    if (!closestId) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_URL}/minutiae/${closestId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setMarkings(prev => prev.filter(m => m.id !== closestId));
      }
    } catch (e) {
      console.error('Erro ao remover minúcia:', e);
    }
  }, [API_URL]);

  // Clique com delay para distinguir single de double-click
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;

    // Guarda coordenadas e agenda o add com delay
    pendingClickRef.current = { nx, ny };

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    clickTimerRef.current = setTimeout(() => {
      if (pendingClickRef.current) {
        addMarking(pendingClickRef.current.nx, pendingClickRef.current.ny);
        pendingClickRef.current = null;
      }
    }, DBLCLICK_DELAY);
  }, [addMarking]);

  // Double-click cancela o click pendente e remove
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    // Cancela o click pendente
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    pendingClickRef.current = null;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    removeMarking(nx, ny);
  }, [removeMarking]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10"
      style={{ pointerEvents: 'auto' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseDown={(e) => {
          // Botão direito: desativa pointer-events para a lupa funcionar
          if (e.button === 2) {
            const container = containerRef.current;
            if (container) {
              container.style.pointerEvents = 'none';
              setTimeout(() => {
                if (container) container.style.pointerEvents = 'auto';
              }, 50);
            }
          }
        }}
        onMouseUp={(e) => {
          if (e.button === 2) {
            const container = containerRef.current;
            if (container) {
              container.style.pointerEvents = 'auto';
            }
          }
        }}
        style={{ cursor: 'crosshair' }}
      />
    </div>
  );
}
