import { useState, useEffect, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { useI18n } from "@/i18n/i18n";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Loader2, Save, SendHorizontal, HelpCircle, X } from "lucide-react";
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
  const { t } = useI18n();
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
  const [showHelp, setShowHelp] = useState(false);

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

      const sampleResponse = await fetch(`${API_URL}/samples/${params?.id}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const sampleResult = await sampleResponse.json();
      if (sampleResult.success) {
        setSample(sampleResult.data);
      }

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

        parsedGroups.forEach((group: any) => {
          if (group.status === 'completed') {
            completed.add(group.group_id);
          }
        });

        setCompletedGroups(completed);
        setPartialEvaluations(restoredEvaluations);

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
        title: t('common.error'),
        description: t('eval.error_load'),
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
          title: t('eval.groups_created'),
          description: t('eval.groups_created_desc', { n: String(result.data.total) }),
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('eval.error_create'),
        variant: "destructive",
      });
    }
  };

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

  const saveCurrentGroup = useCallback(async (): Promise<boolean> => {
    const currentGroup = groups[currentGroupIndex];
    if (!currentGroup || Object.keys(currentEvaluation).length === 0) return false;

    const newMap = new Map(partialEvaluations);
    newMap.set(currentGroup.group_id, currentEvaluation);
    setPartialEvaluations(newMap);

    const complete = isEvaluationComplete(currentEvaluation);

    if (complete) {
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
      return saved;
    } else {
      if (!completedGroups.has(currentGroup.group_id)) {
        setPartialGroups(prev => new Set([...prev, currentGroup.group_id]));
      }
      return false;
    }
  }, [groups, currentGroupIndex, currentEvaluation, partialEvaluations, completedGroups, saveGroupToServer]);

  const goToGroup = useCallback(async (index: number) => {
    if (index < 0 || index >= groups.length) return;

    const currentGroup = groups[currentGroupIndex];

    if (currentGroup && Object.keys(currentEvaluation).length > 0) {
      const newMap = new Map(partialEvaluations);
      newMap.set(currentGroup.group_id, currentEvaluation);
      setPartialEvaluations(newMap);

      const complete = isEvaluationComplete(currentEvaluation);

      if (complete) {
        await saveGroupToServer(currentGroup.group_id, currentEvaluation);
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
          setPartialGroups(prev => new Set([...prev, currentGroup.group_id]));
        }
      }
    }

    setCurrentGroupIndex(index);
    const nextGroup = groups[index];
    const savedEvaluation = partialEvaluations.get(nextGroup.group_id);
    setCurrentEvaluation(savedEvaluation || {});
  }, [groups, currentGroupIndex, currentEvaluation, partialEvaluations, completedGroups, saveGroupToServer]);

  const getGroupStatus = (groupId: string) => {
    if (completedGroups.has(groupId)) return 'completed';
    if (partialGroups.has(groupId)) return 'partial';
    return 'pending';
  };

  const goToPrevGroup = useCallback(async () => {
    if (currentGroupIndex > 0) await goToGroup(currentGroupIndex - 1);
  }, [currentGroupIndex, goToGroup]);

  const goToNextGroup = useCallback(async () => {
    if (currentGroupIndex < groups.length - 1) await goToGroup(currentGroupIndex + 1);
  }, [currentGroupIndex, groups.length, goToGroup]);

  const handleFinish = useCallback(async () => {
    const currentGroup = groups[currentGroupIndex];
    if (isEvaluationComplete(currentEvaluation) && !completedGroups.has(currentGroup?.group_id)) {
      const saved = await saveGroupToServer(currentGroup.group_id, currentEvaluation);
      if (saved) {
        setCompletedGroups(prev => new Set([...prev, currentGroup.group_id]));
      }
    }
    const allDone = completedGroups.size >= groups.length ||
      (completedGroups.size === groups.length - 1 && isEvaluationComplete(currentEvaluation));
    if (allDone) {
      toast({ title: t('eval.finished'), description: t('eval.cert_generating') });
      setTimeout(() => setLocation("/dashboard"), 3000);
    } else {
      const remaining = groups.length - completedGroups.size;
      toast({
        title: t('eval.incomplete_groups'),
        description: t('eval.incomplete_desc', { n: String(remaining) }),
        variant: "destructive",
      });
    }
  }, [groups, currentGroupIndex, currentEvaluation, completedGroups, saveGroupToServer, toast, setLocation, t]);

  const handleSaveGroup = useCallback(async () => {
    const currentGroup = groups[currentGroupIndex];
    if (!currentGroup) return;

    if (isEvaluationComplete(currentEvaluation)) {
      const saved = await saveGroupToServer(currentGroup.group_id, currentEvaluation);
      if (saved) {
        setCompletedGroups(prev => new Set([...prev, currentGroup.group_id]));
        setPartialGroups(prev => { const s = new Set(prev); s.delete(currentGroup.group_id); return s; });
        toast({ title: t('eval.group_saved'), description: t('eval.group_saved_desc', { n: String(currentGroupIndex + 1) }) });
      }
    } else {
      const newMap = new Map(partialEvaluations);
      newMap.set(currentGroup.group_id, currentEvaluation);
      setPartialEvaluations(newMap);
      setPartialGroups(prev => new Set([...prev, currentGroup.group_id]));
      toast({ title: t('eval.progress_saved'), description: t('eval.progress_saved_desc') });
    }
  }, [groups, currentGroupIndex, currentEvaluation, saveGroupToServer, partialEvaluations, toast, t]);

  const GroupNavButtons = () => (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
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
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>{t('eval.loading')}</p>
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{t('eval.no_groups')}</CardTitle>
            <CardDescription>{t('eval.no_groups_desc')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const currentGroup = groups[currentGroupIndex];

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Header */}
      <header className="bg-white border-b shrink-0">
        <div className="px-4 py-2 flex items-center gap-4">
          <h1 className="text-lg font-bold whitespace-nowrap">
            {t('eval.title')} {sample?.carry_code || ''}
          </h1>

          <div className="flex-1">
            <GroupNavButtons />
          </div>

          <div className="flex items-center gap-2">
            <SaveStatusIndicator
              status={saveStatus}
              completedCount={completedGroups.size}
              totalCount={groups.length}
            />
            <Button variant="outline" size="sm" onClick={() => setShowHelp(true)} title={t('eval.instructions')}>
              <HelpCircle className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => goToGroup(currentGroupIndex).then(() => setLocation("/dashboard"))}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('eval.dashboard')}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
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
              {!sample ? t('eval.loading_sample') : t('eval.loading_group')}
            </p>
          </div>
        )}

        {/* Bottom navigation */}
        {currentGroup && sample && (
          <div className="border rounded-lg bg-white p-3 mt-3 shrink-0">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" disabled={currentGroupIndex === 0} onClick={goToPrevGroup}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                {t('eval.previous')}
              </Button>

              <div className="flex-1">
                <GroupNavButtons />
              </div>

              <Button variant="outline" size="sm" disabled={currentGroupIndex === groups.length - 1} onClick={goToNextGroup}>
                {t('eval.next')}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>

              <div className="w-px h-8 bg-gray-200" />

              <Button variant="outline" size="sm" onClick={handleSaveGroup}>
                <Save className="w-4 h-4 mr-1" />
                {t('eval.save_group')} {currentGroupIndex + 1}
              </Button>

              <Button size="sm" disabled={completedGroups.size < groups.length} onClick={handleFinish}>
                <SendHorizontal className="w-4 h-4 mr-1" />
                {t('eval.finish')} ({completedGroups.size}/{groups.length})
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Help modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowHelp(false)}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-lg">
              <h2 className="text-lg font-bold">{t('eval.help_title')}</h2>
              <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm text-gray-700 leading-relaxed">
              <section>
                <h3 className="font-semibold text-base text-gray-900 mb-1">{t('eval.help_objective')}</h3>
                <p>{t('eval.help_objective_text')}</p>
              </section>

              <section>
                <h3 className="font-semibold text-base text-gray-900 mb-1">{t('eval.help_navigation')}</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>{t('eval.help_nav_1')}</li>
                  <li>{t('eval.help_nav_2')}</li>
                  <li>{t('eval.help_nav_3')}</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base text-gray-900 mb-1">{t('eval.help_zoom')}</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>{t('eval.help_zoom_1')}</li>
                  <li>{t('eval.help_zoom_2')}</li>
                  <li>{t('eval.help_zoom_3')}</li>
                  <li>{t('eval.help_zoom_4')}</li>
                  <li>{t('eval.help_zoom_5')}</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base text-gray-900 mb-1">{t('eval.help_minutiae')}</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>{t('eval.help_min_1')}</li>
                  <li>{t('eval.help_min_2')}</li>
                  <li>{t('eval.help_min_3')}</li>
                  <li>{t('eval.help_min_4')}</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base text-gray-900 mb-1">{t('eval.help_form')}</h3>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>{t('eval.help_form_1')}</li>
                  <li>{t('eval.help_form_2')}</li>
                  <li>{t('eval.help_form_3')}</li>
                </ol>
                <p className="mt-1">{t('eval.help_form_reset')}</p>
              </section>

              <section>
                <h3 className="font-semibold text-base text-gray-900 mb-1">{t('eval.help_save')}</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>{t('eval.help_save_1')}</li>
                  <li>{t('eval.help_save_2')}</li>
                  <li>{t('eval.help_save_3')} <span className="text-green-600 font-medium">{t('eval.help_status_complete')}</span>,
                    <span className="text-yellow-600 font-medium"> {t('eval.help_status_partial')}</span>,
                    <span className="text-red-600 font-medium"> {t('eval.help_status_pending')}</span>.
                  </li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
