import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import GroupViewer, { GroupResult } from "@/components/GroupViewer";

export default function SampleEvaluation() {
  const [_, setLocation] = useLocation();
  const [match, params] = useRoute("/samples/:id/evaluate");
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [sample, setSample] = useState<any>(null);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedGroups, setCompletedGroups] = useState<Set<string>>(new Set());
  const [partialGroups, setPartialGroups] = useState<Set<string>>(new Set());
  const [partialEvaluations, setPartialEvaluations] = useState<Map<string, any>>(new Map());
  const [currentEvaluation, setCurrentEvaluation] = useState<any>({});

  useEffect(() => {
    if (!match) return;
    loadGroups();
  }, [match, params?.id]);

  // Carrega avaliação ao mudar de grupo
  useEffect(() => {
    if (groups.length > 0 && currentGroupIndex >= 0 && currentGroupIndex < groups.length) {
      const currentGroup = groups[currentGroupIndex];
      const savedEvaluation = partialEvaluations.get(currentGroup.id);
      setCurrentEvaluation(savedEvaluation || {});
    }
  }, [currentGroupIndex, groups]);

  const loadGroups = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      
      if (!token) {
        setLocation("/login");
        return;
      }

      // Primeiro carrega dados da amostra
      const sampleResponse = await fetch(`/api/samples/${params?.id}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      const sampleResult = await sampleResponse.json();
      
      console.log('Sample loaded:', sampleResult);
      
      if (sampleResult.success) {
        console.log('Setting sample with carry_code:', sampleResult.data?.carry_code);
        setSample(sampleResult.data);
      } else {
        console.error('Failed to load sample:', sampleResult);
      }

      // Depois tenta carregar grupos existentes
      const response = await fetch(`/api/samples/${params?.id}/groups`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (result.success && result.data.groups.length > 0) {
        // Parse dos padrões
        const parsedGroups = result.data.groups.map((group: any) => ({
          ...group,
          padroes_filenames: typeof group.padroes_filenames === 'string' 
            ? JSON.parse(group.padroes_filenames) 
            : group.padroes_filenames,
        }));
        setGroups(parsedGroups);

        // Inicializa status dos grupos baseado no backend
        console.log('=== NOVO CÓDIGO EXECUTANDO ===');
        console.log('Total de grupos carregados:', parsedGroups.length);
        
        const completed = new Set<string>();
        const partial = new Set<string>();
        
        parsedGroups.forEach((group: any) => {
          console.log(`Grupo ${group.group_id}: status = ${group.status}`);
          if (group.status === 'completed') {
            completed.add(group.group_id);
          } else if (group.status === 'partial') {
            partial.add(group.group_id);
          }
        });
        
        setCompletedGroups(completed);
        setPartialGroups(partial);
        
        console.log('=== STATUS FINAL INICIALIZADO ===');
        console.log('Completados:', Array.from(completed));
        console.log('Parciais:', Array.from(partial));
        console.log('Total completos:', completed.size);
      } else {
        // Se não existem grupos, cria novos
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
      
      const response = await fetch(`/api/samples/${params?.id}/groups`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        // Parse dos padrões
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
      console.error("Erro ao criar grupos:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar os grupos",
        variant: "destructive",
      });
    }
  };

  const handleSubmitAllResults = async () => {
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem("token");
      
      console.log('=== ENVIANDO TODOS OS RESULTADOS ===');
      console.log('Total de grupos:', groups.length);
      console.log('Grupos completos:', completedGroups.size);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Envia cada grupo completo
      for (const group of groups) {
        if (!completedGroups.has(group.group_id)) {
          console.log(`Grupo ${group.group_id} não está completo, pulando...`);
          continue;
        }
        
        const evaluation = partialEvaluations.get(group.group_id);
        if (!evaluation) {
          console.log(`Grupo ${group.group_id} não tem avaliação salva, pulando...`);
          continue;
        }
        
        const result: GroupResult = {
          group_id: group.group_id,
          conclusive: evaluation.conclusive,
          has_match: evaluation.conclusive ? evaluation.has_match : null,
          matched_image_index: evaluation.has_match ? evaluation.matched_image_index : null,
          compatibility_degree: evaluation.has_match ? evaluation.compatibility_degree : null,
          notes: evaluation.notes?.trim() || null,
        };
        
        console.log(`Enviando grupo ${group.group_id}:`, result);
        
        try {
          const response = await fetch("http://localhost:3000/api/results", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(result),
          });
          
          const data = await response.json();
          
          if (data.success) {
            successCount++;
            console.log(`✓ Grupo ${group.group_id} enviado com sucesso`);
          } else {
            errorCount++;
            console.error(`✗ Erro ao enviar grupo ${group.group_id}:`, data.error);
          }
        } catch (error) {
          errorCount++;
          console.error(`✗ Erro ao enviar grupo ${group.group_id}:`, error);
        }
      }
      
      console.log(`=== RESUMO: ${successCount} enviados, ${errorCount} erros ===`);
      
      if (successCount > 0) {
        toast({
          title: "Avaliação completa enviada! 🎉",
          description: `${successCount} de ${groups.length} grupos enviados com sucesso`,
        });
        
        // Aguarda 2 segundos e redireciona
        setTimeout(() => {
          setLocation("/dashboard");
        }, 2000);
      } else {
        throw new Error("Nenhum resultado foi enviado com sucesso");
      }
    } catch (error: any) {
      console.error("Erro ao enviar resultados:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível enviar os resultados",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitResult = async (result: GroupResult) => {
    // Função mantida por compatibilidade, mas não é mais usada
    console.warn('handleSubmitResult não deve ser chamado - use handleSubmitAllResults');
  };

  const handlePrevious = () => {
    if (currentGroupIndex === 0) {
      // No primeiro grupo, apenas salva
      handleSavePartial();
    } else {
      goToGroup(currentGroupIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentGroupIndex === groups.length - 1) {
      // No último grupo, apenas salva
      handleSavePartial();
    } else {
      goToGroup(currentGroupIndex + 1);
    }
  };

  const goToGroup = (index: number) => {
    if (index >= 0 && index < groups.length) {
      // Auto-save: Salva estado atual antes de trocar
      if (currentGroup && Object.keys(currentEvaluation).length > 0) {
        const newPartialEvaluations = new Map(partialEvaluations);
        newPartialEvaluations.set(currentGroup.group_id, currentEvaluation);
        setPartialEvaluations(newPartialEvaluations);
        
        // Verifica se está completo e atualiza status visual
        const isComplete = (
          currentEvaluation.conclusive !== null && currentEvaluation.conclusive !== undefined &&
          (
            currentEvaluation.conclusive === false || // Inconclusivo é completo
            (
              currentEvaluation.has_match !== null &&
              (
                currentEvaluation.has_match === false || // Exclusão é completo
                (
                  currentEvaluation.matched_image_index !== null &&
                  currentEvaluation.compatibility_degree !== null
                )
              )
            )
          )
        );
        
        if (isComplete) {
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
        } else {
          if (!completedGroups.has(currentGroup.group_id)) {
            setPartialGroups(prev => {
              const newSet = new Set(prev);
              newSet.add(currentGroup.group_id);
              return newSet;
            });
          }
        }
      }
      
      setCurrentGroupIndex(index);
      
      // Carrega avaliação salva do novo grupo (ou reseta para vazio)
      const nextGroup = groups[index];
      const savedEvaluation = partialEvaluations.get(nextGroup.group_id);
      setCurrentEvaluation(savedEvaluation || {});
    }
  };

  const handleSavePartial = () => {
    // Atualiza mapa de avaliações parciais
    const newPartialEvaluations = new Map(partialEvaluations);
    newPartialEvaluations.set(currentGroup.group_id, currentEvaluation);
    setPartialEvaluations(newPartialEvaluations);
    
    // Verifica se está completo (todos campos obrigatórios preenchidos)
    const isComplete = (
      currentEvaluation.conclusive !== null && currentEvaluation.conclusive !== undefined &&
      (
        currentEvaluation.conclusive === false || // Inconclusivo é completo
        (
          currentEvaluation.has_match !== null &&
          (
            currentEvaluation.has_match === false || // Exclusão é completo
            (
              currentEvaluation.matched_image_index !== null &&
              currentEvaluation.compatibility_degree !== null
            )
          )
        )
      )
    );
    
    if (isComplete) {
      // Marca como completo (verde)
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
      toast({
        title: "Avaliação completa! ✅",
        description: "Todos os campos obrigatórios foram preenchidos",
      });
    } else {
      // Marca como parcial (amarelo)
      if (!completedGroups.has(currentGroup.group_id)) {
        setPartialGroups(prev => {
          const newSet = new Set(prev);
          newSet.add(currentGroup.group_id);
          return newSet;
        });
      }
      toast({
        title: "Progresso salvo! 💾",
        description: "Você pode continuar esta avaliação depois",
      });
    }
  };

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
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">Avaliação de Amostras</h1>
              <p className="text-sm text-muted-foreground">
                Grupo {currentGroupIndex + 1} de {groups.length}
              </p>
            </div>
            <Button variant="outline" onClick={() => setLocation("/dashboard")}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </div>
          
          {/* Menu Numérico de Grupos */}
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">Navegação Rápida:</p>
            <div className="flex flex-wrap gap-2">
              {groups.map((group, index) => {
                const status = getGroupStatus(group.group_id);
                const isCurrent = index === currentGroupIndex;
                
                let bgColor = 'bg-red-100 border-red-300 text-red-700'; // Não avaliado
                if (status === 'completed') {
                  bgColor = 'bg-green-100 border-green-300 text-green-700'; // Completo
                } else if (status === 'partial') {
                  bgColor = 'bg-yellow-100 border-yellow-300 text-yellow-700'; // Parcial
                }
                
                return (
                  <button
                    key={group.id}
                    onClick={() => goToGroup(index)}
                    className={`w-10 h-10 rounded-md border-2 font-bold text-sm transition-all ${
                      isCurrent 
                        ? 'ring-2 ring-primary ring-offset-2 scale-110' 
                        : 'hover:scale-105'
                    } ${bgColor}`}
                    title={`Grupo ${index + 1} - ${group.group_id} (${status === 'completed' ? 'Completo' : status === 'partial' ? 'Parcial' : 'Pendente'})`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-4 mt-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500"></div>
                <span>Completo</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-yellow-500"></div>
                <span>Parcial</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-500"></div>
                <span>Pendente</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {currentGroup && sample ? (
            <GroupViewer
              group={currentGroup}
              carryCode={sample.carry_code || ''}
              onSubmit={handleSubmitResult}
              onSavePartial={handleSavePartial}
              evaluation={currentEvaluation}
              onEvaluationChange={setCurrentEvaluation}
              isLoading={isSubmitting}
              allGroupsCompleted={completedGroups.size === groups.length}
            />
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                {!sample ? 'Carregando dados da amostra...' : 'Carregando grupo...'}
              </p>
              {!sample && <p className="text-xs text-red-500 mt-2">Sample não carregado</p>}
            </div>
          )}

          {/* Navegação */}
          <div className="flex justify-center gap-4 mt-8">
            <Button
              variant="outline"
              onClick={handlePrevious}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>
            <Button
              variant="outline"
              onClick={handleNext}
            >
              Próximo
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Botão Enviar Avaliação Completa - sempre visível */}
          <div className="flex justify-center mt-8">
            <Button
              size="lg"
              onClick={handleSubmitAllResults}
              disabled={completedGroups.size !== groups.length || isSubmitting}
              className="px-12 py-6 text-lg"
            >
              {isSubmitting ? "Enviando..." : `🎯 Enviar Avaliação Completa (${completedGroups.size}/${groups.length})`}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
