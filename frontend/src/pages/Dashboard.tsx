import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Clock, ArrowRight, FileText, AlertCircle, Download, LogOut } from 'lucide-react';

export default function Dashboard() {
  const [_, setLocation] = useLocation();
  const [samples, setSamples] = useState<any[]>([]);
  const [participant, setParticipant] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSamples();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('participant');
    setLocation('/login');
  };

  const loadSamples = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const participantData = localStorage.getItem('participant');
      
      if (!token) {
        setLocation('/login');
        return;
      }

      if (participantData) {
        try {
          setParticipant(JSON.parse(participantData));
        } catch (e) {
          console.error('Erro ao parsear dados do participante:', e);
        }
      }

      const response = await fetch('/api/samples', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        setSamples(result.data || []);
      } else {
        setError('Falha ao carregar amostras');
      }
    } catch (error) {
      console.error('Erro ao carregar amostras:', error);
      setError('Falha ao carregar amostras');
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">Falha ao carregar amostras</h2>
          <p className="text-muted-foreground">Por favor, faça login novamente.</p>
          <Link href="/login">
            <Button variant="outline">Voltar ao Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/10 pb-20">
      <PageHeader 
        title="Dashboard" 
        subtitle="Gerencie suas amostras de teste de proficiência"
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline-block">
              {participant ? `Logado como ${participant.voluntary_name}` : 'Logado como Participante'}
            </span>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
              {participant?.voluntary_name?.substring(0, 2).toUpperCase() || 'ME'}
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        }
      />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Minhas Amostras</h2>
          <p className="text-muted-foreground">
            Complete os testes de comparação a seguir. Os resultados são salvos automaticamente após o envio.
          </p>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-48 flex flex-col justify-between p-6">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-3/4" />
                </div>
                <Skeleton className="h-10 w-full rounded-lg" />
              </Card>
            ))}
          </div>
        ) : samples?.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed">
            <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium">Nenhuma amostra encontrada</h3>
            <p className="text-muted-foreground">Entre em contato com o administrador se isso for um erro.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {samples?.map((sample) => (
              <AssignmentCard key={sample.id} assignment={sample} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function AssignmentCard({ assignment }: { assignment: any }) {
  const isCompleted = assignment.status === "completed";
  const groupCode = assignment.carry_code || assignment.id.substring(0, 8).toUpperCase();
  const totalGroups = assignment.groups?.length || 10;

  return (
    <Card className={`group transition-all duration-300 hover:shadow-lg ${isCompleted ? 'bg-muted/30 border-muted' : 'border-primary/20 bg-white'}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <span className="font-mono text-xs font-medium text-muted-foreground uppercase tracking-widest">
          Grupo de Teste
        </span>
        {isCompleted ? (
          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 gap-1">
            <CheckCircle2 className="w-3 h-3" /> Concluído
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 gap-1">
            <Clock className="w-3 h-3" /> Pendente
          </Badge>
        )}
      </CardHeader>
      
      <CardContent className="pt-4">
        <CardTitle className="text-2xl font-bold font-mono mb-4 text-foreground">
          {groupCode}
        </CardTitle>
        
        <div className="flex justify-between items-end">
          <div className="text-sm text-muted-foreground">
            <p>1 Impressão Questionada</p>
            <p>{totalGroups} Impressões Padrão</p>
          </div>
          
          <div className="flex flex-col gap-2">
            <Link href={`/samples/${assignment.id}/evaluate`}>
              <Button 
                disabled={isCompleted}
                className={`shadow-md transition-all ${isCompleted ? 'opacity-50' : 'hover:translate-x-1'}`}
              >
                {isCompleted ? "Ver Resultado" : "Iniciar Análise"}
                {!isCompleted && <ArrowRight className="ml-2 w-4 h-4" />}
              </Button>
            </Link>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => window.open(`/api/samples/${assignment.id}/download`, '_blank')}
              className="gap-1"
            >
              <Download className="w-3 h-3" /> Baixar ZIP
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
