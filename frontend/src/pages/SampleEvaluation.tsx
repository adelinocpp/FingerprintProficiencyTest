import { useState, useEffect, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, Loader2, Save, SendHorizontal } from "lucide-react";
import GroupViewer from "@/components/GroupViewer";
import SaveStatusIndicator, { type SaveStatus } from "@/components/SaveStatusIndicator";

// Verifica se uma avaliação está completa (todos campos obrigatórios preenchidos)
function isEvaluationComplete(ev: any): boolean {
  if (ev.conclusive === null || ev.conclusive === undefined) return false;
  if (ev.conclusive === false) return true;
  if (ev.has_match === null || ev.has_match === undefined) return false;
  if (ev.has_match === false) return true;
  return ev.matched_image_index !== null && ev.matched_image_index !== undefined
    && ev.compatibility_degree !== null && ev.compatibility_degree !== undefined;
}

export default function SampleEvaluation() {
  const [_, setLocation] = useLocation();
  const [match, params] = useRoute("/samples/:id/evaluate");
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [sample, setSample] = useState<any>(null);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [completedGroups, setCompletedGroups] = useState<Set<string>>(new Set());
  const [partialGroups, setPartialGroups] = useState<Set<string>>(new Set());
  const [partialEvaluations, setPartialEvaluations] = useState<Map<string, any>>(new Map());
  const [currentEvaluation, setCurrentEvaluation] = useState<any>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  useEffect(() => {
    if (!match) return;
    loadGroups();
  }, [match, params?.id]);

  // Carrega avaliação ao mudar de grupo
  useEffect(() => {
    if (groups.length > 0 && currentGroupIndex >= 0 && currentGroupIndex < groups.length) {
      const currentGroup = groups[currentGroupIndex];
      const savedEvaluation = partialEvaluations.get(currentGroup.group_id);
      setCurrentEvaluation(savedEvaluation || {});
    }
  }, [currentGroupIndex, groups]);

  // Aviso antes de fechar com dados não salvos
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentEvaluation && Object.keys(currentEvaluation).length > 0 &&
          currentEvaluation.conclusive !== undefined) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentEvaluation]);

  const loadGroups = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      if (!token) { setLocation("/login"); return; }

      // Carrega amostra
      const sampleResponse = await fetch(`${API_URL}/samples/${params?.id}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const sampleResult = await sampleResponse.json();
      if (sampleResult.success) {
        setSample(sampleResult.data);
      }

      // Carrega grupos
      const response = await fetch(`${API_URL}/samples/${params?.id}/groups`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const result = await response.json();

      if (result.success && result.data.groups.length > 0) {
        const parsedGroups = result.data.groups.map((group: any) => ({
          ...group,
          padroes_filenames: typeof group.padroes_filenames === 'string'
            ? JSON.parse(group.padroes_filenames)
            : group.padroes_filenames,
        }));
        setGroups(parsedGroups);

        // Carrega resultados já salvos no servidor
        const resultsResponse = await fetch(`${API_URL}/results/sample/${params?.id}`, {
          headers: { "Authorization": `Bearer ${token}` },
        });
        const resultsData = await resultsResponse.json();

        const completed = new Set<string>();
        const restoredEvaluations = new Map<string, any>();

        if (resultsData.success && resultsData.data?.results) {
          for (const r of resultsData.data.results) {
            const groupCode = r.group_code;
            restoredEvaluations.set(groupCode, {
              conclusive: r.conclusive,
              has_match: r.has_match,
              matched_image_index: r.matched_image_index,
              compatibility_degree: r.compatibility_degree,
              notes: r.notes || '',
              selected_for_comparison: r.matched_image_index,
            });
            completed.add(groupCode);
          }
        }

        // Também marca grupos com status 'completed' no backend
        parsedGroups.forEach((group: any) => {
          if (group.status === 'completed') {
            completed.add(group.group_id);
          }
        });

        setCompletedGroups(completed);
        setPartialEvaluations(restoredEvaluations);

        // Posiciona no primeiro grupo não completo
        const firstIncomplete = parsedGroups.findIndex(
          (g: any) => !completed.has(g.group_id)
        );
        if (firstIncomplete >= 0) {
          setCurrentGroupIndex(firstIncomplete);
        }
      } else {
        await createGroups();
      }
    } catch (error) {
      console.error("Erro ao carregar grupos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os grupos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createGroups = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/samples/${params?.id}/groups`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      const result = await response.json();
      if (result.success) {
        const parsedGroups = result.data.groups.map((group: any) => ({
          ...group,
          padroes_filenames: typeof group.padroes_filenames === 'string'
            ? JSON.parse(group.padroes_filenames)
            : group.padroes_filenames,
        }));
        setGroups(parsedGroups);
        toast({
          title: "Grupos criados!",
          description: `${result.data.total} grupos foram gerados para avaliação`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar os grupos",
        variant: "destructive",
      });
    }
  };

  // Salva resultado de um grupo no servidor
  const saveGroupToServer = useCallback(async (groupId: string, evaluation: any): Promise<boolean> => {
    if (!isEvaluationComplete(evaluation)) return false;

    const token = localStorage.getItem("token");
    if (!token) return false;

    setSaveStatus('saving');

    try {
      const payload = {
        group_id: groupId,
        conclusive: evaluation.conclusive,
        has_match: evaluation.conclusive ? evaluation.has_match : null,
        matched_image_index: evaluation.has_match ? evaluation.matched_image_index : null,
        compatibility_degree: evaluation.has_match ? evaluation.compatibility_degree : null,
        notes: evaluation.notes?.trim() || null,
      };

      const response = await fetch(`${API_URL}/results`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        setSaveStatus('saved');
        return true;
      } else {
        setSaveStatus('error');
        return false;
      }
    } catch {
      setSaveStatus('error');
      return false;
    }
  }, [API_URL]);

  // Navega para um grupo, salvando o atual se completo
  const goToGroup = useCallback(async (index: number) => {
    if (index < 0 || index >= groups.length) return;

    const currentGroup = groups[currentGroupIndex];

    // Salva estado atual em memória
    if (currentGroup && Object.keys(currentEvaluation).length > 0) {
      const newMap = new Map(partialEvaluations);
      newMap.set(currentGroup.group_id, currentEvaluation);
      setPartialEvaluations(newMap);

      const complete = isEvaluationComplete(currentEvaluation);

      if (complete) {
        // Auto-save no servidor
        const saved = await saveGroupToServer(currentGroup.group_id, currentEvaluation);

        setCompletedGroups(prev => {
          const newSet = new Set(prev);
          newSet.add(currentGroup.group_id);
          return newSet;
        });
        setPartialGroups(prev => {
          const newSet = new Set(prev);
          newSet.delete(currentGroup.group_id);
          return newSet;
        });

        // Verifica se era o último grupo
        const newCompletedCount = completedGroups.size +
          (completedGroups.has(currentGroup.group_id) ? 0 : 1);
        if (saved && newCompletedCount === groups.length) {
          toast({
            title: "Avaliação completa!",
            description: "Todos os grupos foram avaliados. Certificado sendo gerado...",
          });
          setTimeout(() => setLocation("/dashboard"), 3000);
          return;
        }
      } else {
        if (!completedGroups.has(currentGroup.group_id)) {
          setPartialGroups(prev => new Set([...prev, currentGroup.group_id]));
        }
      }
    }

    setCurrentGroupIndex(index);
    const nextGroup = groups[index];
    const savedEvaluation = partialEvaluations.get(nextGroup.group_id);
    setCurrentEvaluation(savedEvaluation || {});
  }, [groups, currentGroupIndex, currentEvaluation, partialEvaluations, completedGroups, saveGroupToServer, setLocation, toast]);

  const getGroupStatus = (groupId: string) => {
    if (completedGroups.has(groupId)) return 'completed';
    if (partialGroups.has(groupId)) return 'partial';
    return 'pending';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Carregando grupos de avaliação...</p>
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Nenhum grupo disponível</CardTitle>
            <CardDescription>
              Não foi possível carregar ou criar grupos para esta amostra.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const currentGroup = groups[currentGroupIndex];

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Header compacto com navegação */}
      <header className="bg-white border-b shrink-0">
        <div className="px-4 py-2 flex items-center gap-4">
          <h1 className="text-lg font-bold whitespace-nowrap">Avaliação de Amostras</h1>

          {/* Navegação numérica dos grupos */}
          <div className="flex-1 flex items-center justify-center gap-1.5 flex-wrap">
            {groups.map((group, index) => {
              const status = getGroupStatus(group.group_id);
              const isCurrent = index === currentGroupIndex;

              let bgColor = 'bg-red-100 border-red-300 text-red-700';
              if (status === 'completed') bgColor = 'bg-green-100 border-green-300 text-green-700';
              else if (status === 'partial') bgColor = 'bg-yellow-100 border-yellow-300 text-yellow-700';

              return (
                <button
                  key={group.id}
                  onClick={() => goToGroup(index)}
                  className={`w-9 h-9 rounded-md border-2 font-bold text-xs transition-all ${
                    isCurrent ? 'ring-2 ring-primary ring-offset-1 scale-110' : 'hover:scale-105'
                  } ${bgColor}`}
                  title={`Grupo ${index + 1} - ${group.group_id}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          {/* Status save + botão voltar */}
          <div className="flex items-center gap-3">
            <SaveStatusIndicator
              status={saveStatus}
              completedCount={completedGroups.size}
              totalCount={groups.length}
            />
            <Button variant="outline" size="sm" onClick={() => goToGroup(currentGroupIndex).then(() => setLocation("/dashboard"))}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo principal - scroll vertical livre */}
      <main className="flex-1 px-4 py-3">
        {currentGroup && sample ? (
          <GroupViewer
            group={currentGroup}
            carryCode={sample.carry_code || ''}
            evaluation={currentEvaluation}
            onEvaluationChange={setCurrentEvaluation}
          />
        ) : (
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              {!sample ? 'Carregando dados da amostra...' : 'Carregando grupo...'}
            </p>
          </div>
        )}

        {/* Botões Salvar e Finalizar */}
        {currentGroup && sample && (
          <div className="flex justify-center gap-4 py-4">
            <Button
              variant="outline"
              onClick={() => {
                if (isEvaluationComplete(currentEvaluation)) {
                  saveGroupToServer(currentGroup.group_id, currentEvaluation).then(saved => {
                    if (saved) {
                      setCompletedGroups(prev => new Set([...prev, currentGroup.group_id]));
                      setPartialGroups(prev => { const s = new Set(prev); s.delete(currentGroup.group_id); return s; });
                      toast({ title: "Grupo salvo!", description: `Grupo ${currentGroupIndex + 1} salvo no servidor.` });
                    }
                  });
                } else {
                  // Salva em memória como parcial
                  const newMap = new Map(partialEvaluations);
                  newMap.set(currentGroup.group_id, currentEvaluation);
                  setPartialEvaluations(newMap);
                  setPartialGroups(prev => new Set([...prev, currentGroup.group_id]));
                  toast({ title: "Progresso salvo", description: "Complete todos os campos para salvar no servidor." });
                }
              }}
            >
              <Save className="w-4 h-4 mr-2" />
              Salvar Grupo {currentGroupIndex + 1}
            </Button>

            <Button
              disabled={completedGroups.size < groups.length}
              onClick={async () => {
                // Salva o grupo atual se completo
                if (isEvaluationComplete(currentEvaluation) && !completedGroups.has(currentGroup.group_id)) {
                  const saved = await saveGroupToServer(currentGroup.group_id, currentEvaluation);
                  if (saved) {
                    setCompletedGroups(prev => new Set([...prev, currentGroup.group_id]));
                  }
                }
                // Verifica se todos estão completos
                const allDone = completedGroups.size >= groups.length ||
                  (completedGroups.size === groups.length - 1 && isEvaluationComplete(currentEvaluation));
                if (allDone) {
                  toast({ title: "Avaliação finalizada!", description: "Certificado sendo gerado..." });
                  setTimeout(() => setLocation("/dashboard"), 3000);
                } else {
                  toast({
                    title: "Grupos incompletos",
                    description: `${groups.length - completedGroups.size} grupo(s) ainda precisam ser avaliados.`,
                    variant: "destructive",
                  });
                }
              }}
            >
              <SendHorizontal className="w-4 h-4 mr-2" />
              Finalizar Avaliação ({completedGroups.size}/{groups.length})
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
