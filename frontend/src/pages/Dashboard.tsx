import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { useI18n } from '@/i18n/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Fingerprint, Package, LogOut, FileText } from 'lucide-react';

export default function Dashboard() {
  const [_, setLocation] = useLocation();
  const { t } = useI18n();
  const [participant, setParticipant] = useState<any>(null);
  const [samples, setSamples] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const participantData = localStorage.getItem('participant');
    
    if (!token || !participantData) {
      setLocation('/login');
      return;
    }
    
    try {
      setParticipant(JSON.parse(participantData));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setLocation('/login');
    }
  }, [setLocation]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('participant');
    setLocation('/');
  };

  if (!participant) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground p-2 rounded-lg">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{t('app.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            {t('nav.logout')}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('dashboard.welcome')}, {participant.voluntary_name}!</CardTitle>
            <CardDescription>
              <div className="flex gap-4 mt-2">
                <span className="text-sm">
                  <strong>{t('register.voluntary_code')}:</strong> {participant.voluntary_code}
                </span>
                <span className="text-sm">
                  <strong>{t('register.carry_code')}:</strong> {participant.carry_code}
                </span>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {t('dashboard.instructions') || 'Bem-vindo ao sistema de teste de proficiência em impressões digitais.'}
            </p>
          </CardContent>
        </Card>

        {/* Samples Section */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* No samples yet - placeholder */}
          <Card className="border-dashed">
            <CardHeader>
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-muted mb-4">
                <Package className="w-6 h-6 text-muted-foreground" />
              </div>
              <CardTitle className="text-lg">{t('dashboard.no_samples')}</CardTitle>
              <CardDescription>
                {t('dashboard.no_samples_desc') || 'Aguarde a geração das suas amostras de teste.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('dashboard.instructions_email') || 'Você receberá um email com instruções assim que suas amostras estiverem prontas.'}
              </p>
            </CardContent>
          </Card>

          {/* Documentation Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-4">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-lg">{t('dashboard.documentation')}</CardTitle>
              <CardDescription>
                {t('dashboard.documentation_desc') || 'Instruções e guias'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" disabled>
                {t('common.view_details')}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info Alert */}
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">
            {t('dashboard.info_title') || 'Próximos Passos'}
          </h3>
          <ul className="list-disc list-inside text-blue-800 space-y-1 text-sm">
            <li>{t('dashboard.step1') || 'Aguarde o email com suas amostras de teste'}</li>
            <li>{t('dashboard.step2') || 'Baixe e analise as impressões digitais'}</li>
            <li>{t('dashboard.step3') || 'Retorne a este portal para submeter seus resultados'}</li>
            <li>{t('dashboard.step4') || 'Receba seu certificado de participação'}</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
