import { useState, useCallback, useRef, useEffect } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import MagnifyingLens from "@/components/MagnifyingLens";
import MinutiaeCanvas, { type Marking } from "@/components/MinutiaeCanvas";

const ZOOM_MIN = 1;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.25;

interface GroupViewerProps {
  group: {
    id: string;
    group_id: string;
    group_index: number;
    questionada_filename: string;
    padroes_filenames: string[];
    has_same_source: boolean;
    status: string;
  };
  carryCode: string;
  evaluation: any;
  onEvaluationChange: (evaluation: any) => void;
}

export interface GroupResult {
  group_id: string;
  conclusive: boolean;
  has_match: boolean | null;
  matched_image_index: number | null;
  compatibility_degree: 1 | 2 | 3 | 4 | null;
  notes: string | null;
}

function ZoomControls({ zoom, onZoomIn, onZoomOut, onReset }: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={onZoomOut}
        disabled={zoom <= ZOOM_MIN}
        className="p-0.5 rounded hover:bg-black/10 disabled:opacity-30 transition-colors"
        title="Zoom out"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>
      <span className="text-[10px] font-mono w-8 text-center select-none">{Math.round(zoom * 100)}%</span>
      <button
        onClick={onZoomIn}
        disabled={zoom >= ZOOM_MAX}
        className="p-0.5 rounded hover:bg-black/10 disabled:opacity-30 transition-colors"
        title="Zoom in"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onReset}
        disabled={zoom === 1}
        className="p-0.5 rounded hover:bg-black/10 disabled:opacity-30 transition-colors"
        title="Reset zoom"
      >
        <RotateCcw className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function GroupViewer({ group, carryCode, evaluation, onEvaluationChange }: GroupViewerProps) {
  const API_BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

  // Estado controlado - vem do pai via props
  const conclusive = evaluation.conclusive ?? null;
  const hasMatch = evaluation.has_match ?? null;
  const matchedIndex = evaluation.matched_image_index ?? null;
  const compatibilityDegree = evaluation.compatibility_degree ?? null;
  const notes = evaluation.notes || "";
  const selectedForComparison = evaluation.selected_for_comparison ?? null;

  // Estado local para marcações de minúcias e visibilidade
  const [showMinutiae, setShowMinutiae] = useState(true);
  const [questionadaMarkings, setQuestionadaMarkings] = useState<Marking[]>([]);
  const [padraoMarkings, setPadraoMarkings] = useState<Marking[]>([]);

  // Zoom state
  const [questionadaZoom, setQuestionadaZoom] = useState(1);
  const [padraoZoom, setPadraoZoom] = useState(1);

  // Refs for scroll containers (native wheel events)
  const questionadaScrollRef = useRef<HTMLDivElement>(null);
  const padraoScrollRef = useRef<HTMLDivElement>(null);

  const handleQuestionadaMarkings = useCallback((m: Marking[]) => setQuestionadaMarkings(m), []);
  const handlePadraoMarkings = useCallback((m: Marking[]) => setPadraoMarkings(m), []);

  // Wheel zoom handlers (native events with passive: false)
  useEffect(() => {
    const qEl = questionadaScrollRef.current;
    const pEl = padraoScrollRef.current;

    const makeHandler = (
      setZoom: React.Dispatch<React.SetStateAction<number>>,
      scrollEl: HTMLDivElement
    ) => (e: WheelEvent) => {
      // Skip when right mouse button is held (MagnifyingLens handles it)
      if (e.buttons & 2) return;

      e.preventDefault();

      // Cursor position relative to scroll viewport
      const rect = scrollEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Content coordinate under cursor
      const contentX = scrollEl.scrollLeft + mouseX;
      const contentY = scrollEl.scrollTop + mouseY;

      const delta = e.deltaY > 0 ? ZOOM_STEP : -ZOOM_STEP;
      setZoom(prev => {
        const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((prev + delta) * 100) / 100));
        if (newZoom === prev) return prev;

        const scale = newZoom / prev;
        // Adjust scroll after DOM update to keep cursor point stable
        requestAnimationFrame(() => {
          scrollEl.scrollLeft = contentX * scale - mouseX;
          scrollEl.scrollTop = contentY * scale - mouseY;
        });

        return newZoom;
      });
    };

    const qHandler = qEl ? makeHandler(setQuestionadaZoom, qEl) : null;
    const pHandler = pEl ? makeHandler(setPadraoZoom, pEl) : null;

    if (qEl && qHandler) qEl.addEventListener('wheel', qHandler, { passive: false });
    if (pEl && pHandler) pEl.addEventListener('wheel', pHandler, { passive: false });

    return () => {
      if (qEl && qHandler) qEl.removeEventListener('wheel', qHandler);
      if (pEl && pHandler) pEl.removeEventListener('wheel', pHandler);
    };
  }, []);

  // Reset zoom when group changes
  useEffect(() => {
    setQuestionadaZoom(1);
    setPadraoZoom(1);
  }, [group.group_id]);

  const updateEvaluation = (updates: any) => {
    onEvaluationChange({ ...evaluation, ...updates });
  };

  const setConclusive = (value: boolean | null) => updateEvaluation({ conclusive: value });

  const setHasMatch = (value: boolean | null) => {
    if (value === true && selectedForComparison !== null && matchedIndex === null) {
      updateEvaluation({ has_match: value, matched_image_index: selectedForComparison });
    } else if (value === false) {
      updateEvaluation({ has_match: value, matched_image_index: null, compatibility_degree: null });
    } else {
      updateEvaluation({ has_match: value });
    }
  };

  const setMatchedIndex = (value: number | null) => updateEvaluation({ matched_image_index: value });
  const setCompatibilityDegree = (value: 1 | 2 | 3 | 4 | null) => updateEvaluation({ compatibility_degree: value });
  const setNotes = (value: string) => updateEvaluation({ notes: value });
  const setSelectedForComparison = (value: number | null) => updateEvaluation({ selected_for_comparison: value });

  // Funções de reset em cascata
  const resetQ1 = () => updateEvaluation({
    conclusive: null, has_match: null, matched_image_index: null,
    compatibility_degree: null,
  });
  const resetQ2 = () => updateEvaluation({
    has_match: null, matched_image_index: null, compatibility_degree: null,
  });
  const resetQ3 = () => updateEvaluation({ compatibility_degree: null });

  const questionadaUrl = `${API_BASE_URL}/api/sample-images/${carryCode}/${group.group_id}/QUESTIONADA.jpg`;
  const getStandardUrl = (index: number) =>
    `${API_BASE_URL}/api/sample-images/${carryCode}/${group.group_id}/PADRAO_${String(index).padStart(2, '0')}.jpg`;

  return (
    <div className="flex flex-col gap-3">
      {/* Título do grupo */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-semibold text-muted-foreground">
          Grupo {group.group_index + 1} - {group.group_id}
        </span>
        <span className="text-xs text-muted-foreground">
          Compare a imagem questionada com os padrões e indique se há correspondência
        </span>
      </div>

      {/* Área de imagens - 3 painéis horizontais */}
      <div className="flex gap-3" style={{ height: 'calc(100vh - 240px)', minHeight: '500px' }}>
        {/* Painel 1: Questionada (fixa, esquerda) */}
        <div className="flex-1 flex flex-col border-2 border-blue-500 rounded-lg overflow-hidden min-w-0">
          <div className="bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 border-b shrink-0 flex items-center justify-between">
            <span>Impressão Questionada</span>
            <div className="flex items-center gap-2">
              <ZoomControls
                zoom={questionadaZoom}
                onZoomIn={() => setQuestionadaZoom(z => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100))}
                onZoomOut={() => setQuestionadaZoom(z => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100))}
                onReset={() => setQuestionadaZoom(1)}
              />
              <label className="flex items-center gap-1 cursor-pointer text-xs font-normal">
                <input
                  type="checkbox"
                  checked={showMinutiae}
                  onChange={(e) => setShowMinutiae(e.target.checked)}
                  className="w-3 h-3"
                />
                Minúcias
              </label>
            </div>
          </div>
          <div
            ref={questionadaScrollRef}
            className="flex-1 relative overflow-auto"
          >
            <div
              className="relative"
              style={{
                width: `${questionadaZoom * 100}%`,
                height: `${questionadaZoom * 100}%`,
              }}
            >
              <MagnifyingLens
                imageSrc={questionadaUrl}
                markings={questionadaMarkings}
                showMarkings={showMinutiae}
                panelZoom={questionadaZoom}
              >
                <img
                  src={questionadaUrl}
                  alt="Impressão Questionada"
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </MagnifyingLens>
              <MinutiaeCanvas
                groupId={group.group_id}
                imageType="questionada"
                imageIndex={null}
                visible={showMinutiae}
                onMarkingsChange={handleQuestionadaMarkings}
                zoom={questionadaZoom}
              />
            </div>
          </div>
        </div>

        {/* Painel 2: Padrão selecionado (centro) */}
        <div className={`flex-1 flex flex-col border-2 rounded-lg overflow-hidden min-w-0 ${
          selectedForComparison !== null ? 'border-green-500' : 'border-dashed border-gray-300'
        }`}>
          <div className={`px-3 py-1 text-sm font-medium border-b shrink-0 flex items-center justify-between ${
            selectedForComparison !== null ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
          }`}>
            <span>{selectedForComparison !== null ? `Padrão #${selectedForComparison}` : 'Selecione um padrão'}</span>
            {selectedForComparison !== null && (
              <div className="flex items-center gap-2">
                <ZoomControls
                  zoom={padraoZoom}
                  onZoomIn={() => setPadraoZoom(z => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100))}
                  onZoomOut={() => setPadraoZoom(z => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100))}
                  onReset={() => setPadraoZoom(1)}
                />
                <label className="flex items-center gap-1 cursor-pointer text-xs font-normal">
                  <input
                    type="checkbox"
                    checked={showMinutiae}
                    onChange={(e) => setShowMinutiae(e.target.checked)}
                    className="w-3 h-3"
                  />
                  Minúcias
                </label>
              </div>
            )}
          </div>
          <div
            ref={padraoScrollRef}
            className="flex-1 relative overflow-auto"
          >
            {selectedForComparison !== null ? (
              <div
                className="relative"
                style={{
                  width: `${padraoZoom * 100}%`,
                  height: `${padraoZoom * 100}%`,
                }}
              >
                <MagnifyingLens
                  imageSrc={getStandardUrl(selectedForComparison)}
                  markings={padraoMarkings}
                  showMarkings={showMinutiae}
                  panelZoom={padraoZoom}
                >
                  <img
                    src={getStandardUrl(selectedForComparison)}
                    alt={`Padrão ${selectedForComparison}`}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </MagnifyingLens>
                <MinutiaeCanvas
                  groupId={group.group_id}
                  imageType="padrao"
                  imageIndex={selectedForComparison}
                  visible={showMinutiae}
                  onMarkingsChange={handlePadraoMarkings}
                  zoom={padraoZoom}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground text-center px-4">
                  Clique em uma miniatura ao lado para comparar
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Painel 3: Miniaturas (2 colunas x 5 linhas, direita) */}
        <div className="w-56 flex flex-col border rounded-lg overflow-hidden shrink-0">
          <div className="bg-gray-50 px-3 py-1 text-sm font-medium text-gray-700 text-center border-b shrink-0">
            Padrões (10)
          </div>
          <div className="flex-1 grid grid-cols-2 gap-1 p-1.5 overflow-y-auto auto-rows-fr">
            {group.padroes_filenames.map((_filename: string, index: number) => {
              const isSelected = selectedForComparison === index;
              const isMatched = matchedIndex === index;
              return (
                <div
                  key={index}
                  onClick={() => {
                    setSelectedForComparison(index);
                    if (hasMatch) setMatchedIndex(index);
                  }}
                  className={`relative border rounded cursor-pointer transition-all overflow-hidden ${
                    isMatched ? 'ring-2 ring-primary bg-primary/10' : 'hover:border-primary'
                  } ${isSelected ? 'border-green-500 border-2' : ''}`}
                >
                  <img
                    src={getStandardUrl(index)}
                    alt={`Padrão ${index}`}
                    className={`w-full h-full object-cover transition-all ${
                      isSelected ? 'blur-sm brightness-150 opacity-60' : ''
                    }`}
                    loading="lazy"
                  />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] text-center py-0.5 font-mono">
                    #{index}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Formulário - perguntas lado a lado */}
      <div className="border rounded-lg p-3 bg-white shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Q1: Conclusiva? */}
          <div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">A análise é conclusiva?</Label>
              {conclusive !== null && (
                <button onClick={resetQ1} className="text-red-400 hover:text-red-600 transition-colors" title="Limpar resposta">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <RadioGroup
              value={conclusive === null ? "" : conclusive.toString()}
              onValueChange={(v) => setConclusive(v === "true")}
              className="mt-1.5 flex gap-4"
            >
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="true" id="conclusive-yes" />
                <Label htmlFor="conclusive-yes" className="text-sm">Sim, conclusiva</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="false" id="conclusive-no" />
                <Label htmlFor="conclusive-no" className="text-sm">Não, inconclusiva</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Q2: Correspondência? (condicional) */}
          {conclusive && (
            <div>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Há correspondência?</Label>
                {hasMatch !== null && (
                  <button onClick={resetQ2} className="text-red-400 hover:text-red-600 transition-colors" title="Limpar resposta">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <RadioGroup
                value={hasMatch === null ? "" : hasMatch.toString()}
                onValueChange={(v) => setHasMatch(v === "true")}
                className="mt-1.5 flex gap-4"
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="true" id="match-yes" />
                  <Label htmlFor="match-yes" className="text-sm">Sim, identificado</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="false" id="match-no" />
                  <Label htmlFor="match-no" className="text-sm">Não, exclusão</Label>
                </div>
              </RadioGroup>
              {/* Miniatura do padrão selecionado como match */}
              {hasMatch && matchedIndex !== null && (
                <div className="flex items-center gap-2 mt-2 p-1.5 bg-green-50 rounded border border-green-200">
                  <img
                    src={getStandardUrl(matchedIndex)}
                    alt={`Padrão ${matchedIndex}`}
                    className="w-10 h-10 rounded border object-cover"
                  />
                  <span className="text-xs text-green-700 font-medium">Padrão #{matchedIndex}</span>
                </div>
              )}
            </div>
          )}

          {/* Q3: Grau de compatibilidade (condicional) */}
          {conclusive && hasMatch && (
            <div>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Grau de Compatibilidade</Label>
                {compatibilityDegree !== null && (
                  <button onClick={resetQ3} className="text-red-400 hover:text-red-600 transition-colors" title="Limpar resposta">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <RadioGroup
                value={compatibilityDegree?.toString() || ""}
                onValueChange={(v) => setCompatibilityDegree(parseInt(v) as 1 | 2 | 3 | 4)}
                className="mt-1.5 flex gap-2"
              >
                {[4, 3, 2, 1].map(deg => (
                  <div key={deg} className="flex items-center gap-1">
                    <RadioGroupItem value={deg.toString()} id={`degree-${deg}`} />
                    <Label htmlFor={`degree-${deg}`} className="text-xs">+{deg}</Label>
                  </div>
                ))}
              </RadioGroup>
              <div className="text-[10px] text-muted-foreground mt-1">
                Padrão selecionado: {matchedIndex !== null ? `#${matchedIndex}` : 'Nenhum (clique na miniatura)'}
              </div>
            </div>
          )}
        </div>

        {/* Observações - full width abaixo */}
        <div className="mt-3">
          <Label htmlFor="notes" className="text-sm font-semibold">Observações (opcional)</Label>
          <Textarea
            id="notes"
            placeholder="Adicione observações sobre esta avaliação..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1"
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}
