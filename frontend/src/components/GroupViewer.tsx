import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

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
  onSubmit: (result: GroupResult) => void;
  onSavePartial?: () => void;
  evaluation: any;
  onEvaluationChange: (evaluation: any) => void;
  isLoading?: boolean;
  allGroupsCompleted?: boolean;
}

export interface GroupResult {
  group_id: string;
  conclusive: boolean;
  has_match: boolean | null;
  matched_image_index: number | null;
  compatibility_degree: 1 | 2 | 3 | 4 | null;
  notes: string | null;
}

export default function GroupViewer({ group, carryCode, onSubmit, onSavePartial, evaluation, onEvaluationChange, isLoading, allGroupsCompleted = false }: GroupViewerProps) {
  // Estado controlado - vem do pai via props
  const conclusive = evaluation.conclusive ?? null;
  const hasMatch = evaluation.has_match ?? null;
  const matchedIndex = evaluation.matched_image_index ?? null;
  const compatibilityDegree = evaluation.compatibility_degree ?? null;
  const notes = evaluation.notes || "";
  const selectedForComparison = evaluation.selected_for_comparison ?? null;

  // Funções para atualizar estado no pai
  const updateEvaluation = (updates: any) => {
    onEvaluationChange({ ...evaluation, ...updates });
  };
  
  const setConclusive = (value: boolean | null) => updateEvaluation({ conclusive: value });
  
  const setHasMatch = (value: boolean | null) => {
    // Auto-seleciona a imagem clicada quando marca "Sim, identificado"
    if (value === true && selectedForComparison !== null && matchedIndex === null) {
      updateEvaluation({ 
        has_match: value,
        matched_image_index: selectedForComparison 
      });
    } else if (value === false) {
      // Limpa seleção quando marca "Não"
      updateEvaluation({ 
        has_match: value,
        matched_image_index: null,
        compatibility_degree: null
      });
    } else {
      updateEvaluation({ has_match: value });
    }
  };
  
  const setMatchedIndex = (value: number | null) => updateEvaluation({ matched_image_index: value });
  const setCompatibilityDegree = (value: 1 | 2 | 3 | 4 | null) => updateEvaluation({ compatibility_degree: value });
  const setNotes = (value: string) => updateEvaluation({ notes: value });
  const setSelectedForComparison = (value: number | null) => {
    updateEvaluation({ selected_for_comparison: value });
  };

  const handleSubmit = () => {
    if (conclusive === null) {
      return;
    }

    const result: GroupResult = {
      group_id: group.group_id,  // Código do grupo (ex: ABCD12345), não UUID
      conclusive,
      has_match: conclusive ? hasMatch : null,
      matched_image_index: hasMatch ? matchedIndex : null,
      compatibility_degree: hasMatch ? compatibilityDegree : null,
      notes: notes.trim() || null,
    };

    console.log('Enviando resultado:', result);
    console.log('group.group_id:', group.group_id);
    console.log('group completo:', group);

    onSubmit(result);
  };

  const canSubmit = () => {
    if (conclusive === null) return false;
    if (!conclusive) return true; // Inconclusivo pode submeter direto
    if (hasMatch === null) return false;
    if (hasMatch && matchedIndex === null) return false;
    if (hasMatch && compatibilityDegree === null) return false;
    return true;
  };

  const handleSavePartial = () => {
    if (!onSavePartial) return;
    onSavePartial();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Grupo {group.group_index + 1} - {group.group_id}</CardTitle>
          <CardDescription>
            Compare a imagem questionada com os padrões e indique se há correspondência
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Área de Comparação - Questionada e Padrão Selecionado */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Área de Comparação</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Imagem Questionada */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2 text-center">Impressão Questionada</p>
                <div className="border-2 border-blue-500 rounded-lg p-4 bg-blue-50/30">
                  <img
                    src={`/api/sample-images/${carryCode}/${group.group_id}/QUESTIONADA.jpg`}
                    alt="Impressão Questionada"
                    className="w-full max-w-md mx-auto rounded"
                    loading="lazy"
                  />
                </div>
              </div>
              
              {/* Imagem Padrão Selecionada */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2 text-center">
                  {selectedForComparison !== null ? `Impressão Padrão #${selectedForComparison}` : 'Clique em uma impressão padrão para comparar'}
                </p>
                <div className={`border-2 rounded-lg p-4 min-h-[300px] flex items-center justify-center ${
                  selectedForComparison !== null 
                    ? 'border-green-500 bg-green-50/30' 
                    : 'border-dashed border-gray-300 bg-gray-50'
                }`}>
                  {selectedForComparison !== null ? (
                    <img
                      src={`/api/sample-images/${carryCode}/${group.group_id}/PADRAO_${String(selectedForComparison).padStart(2, '0')}.jpg`}
                      alt={`Padrão ${selectedForComparison}`}
                      className="w-full max-w-md mx-auto rounded"
                      loading="lazy"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground text-center px-4">
                      Selecione uma impressão padrão abaixo para visualizar lado a lado com a questionada
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Imagens Padrão */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Impressões Padrão</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {group.padroes_filenames.map((filename, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-2 cursor-pointer transition-all ${
                    matchedIndex === index
                      ? "ring-2 ring-primary bg-primary/10"
                      : "hover:border-primary"
                  }`}
                  onClick={() => {
                    setSelectedForComparison(index);
                    if (hasMatch) setMatchedIndex(index);
                  }}
                >
                  <img
                    src={`/api/sample-images/${carryCode}/${group.group_id}/PADRAO_${String(index).padStart(2, '0')}.jpg`}
                    alt={`Padrão ${index}`}
                    className="w-full rounded"
                    loading="lazy"
                  />
                  <p className="text-xs text-center mt-1 font-mono font-bold">
                    {selectedForComparison === index && '👁️ '}
                    Padrão #{index}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Formulário de Avaliação */}
          <div className="space-y-6 border-t pt-6">
            <div>
              <Label className="text-base font-semibold">A análise é conclusiva?</Label>
              <RadioGroup
                value={conclusive === null ? "" : conclusive.toString()}
                onValueChange={(value) => setConclusive(value === "true")}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true" id="conclusive-yes" />
                  <Label htmlFor="conclusive-yes">Sim, é conclusiva</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="false" id="conclusive-no" />
                  <Label htmlFor="conclusive-no">Não, é inconclusiva</Label>
                </div>
              </RadioGroup>
            </div>

            {conclusive && (
              <>
                <div>
                  <Label className="text-base font-semibold">Há correspondência?</Label>
                  <RadioGroup
                    value={hasMatch === null ? "" : hasMatch.toString()}
                    onValueChange={(value) => setHasMatch(value === "true")}
                    className="mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id="match-yes" />
                      <Label htmlFor="match-yes">Sim, identificado</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id="match-no" />
                      <Label htmlFor="match-no">Não, exclusão</Label>
                    </div>
                  </RadioGroup>
                </div>

                {hasMatch && (
                  <>
                    <Alert>
                      <AlertDescription>
                        Clique na imagem padrão correspondente acima. Selecionada: {matchedIndex !== null ? `#${matchedIndex}` : "Nenhuma"}
                      </AlertDescription>
                    </Alert>

                    <div>
                      <Label className="text-base font-semibold">Grau de Compatibilidade</Label>
                      <RadioGroup
                        value={compatibilityDegree?.toString() || ""}
                        onValueChange={(value) => setCompatibilityDegree(parseInt(value) as 1 | 2 | 3 | 4)}
                        className="mt-2"
                      >
                         <div className="flex items-center space-x-2">
                          <RadioGroupItem value="4" id="degree-4" />
                          <Label htmlFor="degree-4">+4 - Identificação Certa (muito fortemente compatível)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="3" id="degree-3" />
                          <Label htmlFor="degree-3">+3 - Identificação Certa (fortemente compatível)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="2" id="degree-2" />
                          <Label htmlFor="degree-2">+2 - Identificação Provável (moderadamente compatível)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="1" id="degree-1" />
                          <Label htmlFor="degree-1">+1 - Identificação Possível (levemente compatível)</Label>
                        </div>
                       
                      </RadioGroup>
                    </div>
                  </>
                )}
              </>
            )}

            <div>
              <Label htmlFor="notes" className="text-base font-semibold">
                Observações (opcional)
              </Label>
              <Textarea
                id="notes"
                placeholder="Adicione observações sobre esta avaliação..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-2"
                rows={4}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
