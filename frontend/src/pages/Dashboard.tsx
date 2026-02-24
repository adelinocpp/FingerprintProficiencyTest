import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useI18n } from '@/i18n/i18n';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Clock, ArrowRight, FileText, AlertCircle, Download, LogOut, Award, Plus, Trash2, X, UserX, HelpCircle, Globe } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function Dashboard() {
  const { t, language, setLanguage } = useI18n();
  const [_, setLocation] = useLocation();
  const [samples, setSamples] = useState<any[]>([]);
  const [participant, setParticipant] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRequestingSample, setIsRequestingSample] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    loadSamples();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('participant');
    setLocation('/login');
  };

  const handleRequestNewSample = async () => {
    try {
      setIsRequestingSample(true);
      const token = localStorage.getItem('token');
      if (!token) { setLocation('/login'); return; }

      const response = await fetch(`${API_URL}/samples/request`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const result = await response.json();

      if (result.success) {
        await loadSamples();
      } else {
        alert(t('dp.error_new_sample'));
      }
    } catch {
      alert(t('dp.error_new_sample'));
    } finally {
      setIsRequestingSample(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeletingAccount(true);
      const token = localStorage.getItem('token');
      if (!token) { setLocation('/login'); return; }

      const response = await fetch(`${API_URL}/account`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const result = await response.json();

      if (result.success) {
        localStorage.removeItem('token');
        localStorage.removeItem('participant');
        setLocation('/');
      } else {
        alert(result.error || t('dp.error_delete'));
      }
    } catch {
      alert(t('dp.error_delete'));
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteAccount(false);
    }
  };

  const handleRejectSample = async (sampleId: string, carryCode: string) => {
    if (!confirm(t('dp.abandon_confirm', { code: carryCode }))) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_URL}/samples/${sampleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const result = await response.json();

      if (result.success) {
        await loadSamples();
      } else {
        alert(result.error || t('dp.error_reject'));
      }
    } catch {
      alert(t('dp.error_reject'));
    }
  };

  const loadSamples = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const participantData = localStorage.getItem('participant');

      if (!token) { setLocation('/login'); return; }

      if (participantData) {
        try { setParticipant(JSON.parse(participantData)); } catch {}
      }

      const response = await fetch(`${API_URL}/samples`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const result = await response.json();

      if (result.success) {
        setSamples(result.data || []);
      } else {
        setError(t('dp.load_error'));
      }
    } catch {
      setError(t('dp.load_error'));
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">{t('dp.load_error')}</h2>
          <p className="text-muted-foreground">{t('dp.login_again')}</p>
          <Link href="/login">
            <Button variant="outline">{t('dp.back_to_login')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/10 pb-20">
      <PageHeader
        title={t('dp.title')}
        subtitle={t('dp.subtitle')}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline-block">
              {participant
                ? t('dp.logged_as', { name: participant.voluntary_name })
                : t('dp.logged_as_participant')}
            </span>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
              {participant?.voluntary_name?.substring(0, 2).toUpperCase() || 'ME'}
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="px-2 py-1.5 rounded-md border border-border bg-background text-xs"
            >
              <option value="pt-BR">PT</option>
              <option value="en">EN</option>
              <option value="es">ES</option>
            </select>
            <Button variant="outline" size="sm" onClick={() => setShowHelp(true)} title={t('eval.instructions')}>
              <HelpCircle className="w-4 h-4" />
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleRequestNewSample}
              disabled={isRequestingSample}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">
                {isRequestingSample ? t('dp.generating') : t('dp.new_sample')}
              </span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t('dp.logout')}</span>
            </Button>
          </div>
        }
      />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-2">{t('dp.my_samples')}</h2>
          <p className="text-muted-foreground">{t('dp.my_samples_desc')}</p>
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
            <h3 className="text-lg font-medium">{t('dp.no_samples')}</h3>
            <p className="text-muted-foreground">{t('dp.no_samples_contact')}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {samples?.map((sample) => (
              <AssignmentCard key={sample.id} assignment={sample} onReject={handleRejectSample} t={t} />
            ))}
          </div>
        )}

        {/* Danger zone */}
        <div className="mt-16 border-t pt-8">
          <h3 className="text-lg font-semibold text-destructive mb-2">{t('dp.danger_zone')}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t('dp.danger_zone_desc')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteAccount(true)}
            className="gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <UserX className="w-4 h-4" />
            {t('dp.delete_account')}
          </Button>
        </div>
      </main>

      {/* Help modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowHelp(false)}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-lg">
              <h2 className="text-lg font-bold">{t('dp.help_title')}</h2>
              <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm text-gray-700 leading-relaxed">
              <section>
                <h3 className="font-semibold text-base text-gray-900 mb-1">{t('dp.help_overview')}</h3>
                <p>{t('dp.help_overview_text')}</p>
              </section>
              <section>
                <h3 className="font-semibold text-base text-gray-900 mb-1">{t('dp.help_samples')}</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>{t('dp.help_sample_1')}</li>
                  <li>{t('dp.help_sample_2')}</li>
                  <li>{t('dp.help_sample_3')}</li>
                </ul>
              </section>
              <section>
                <h3 className="font-semibold text-base text-gray-900 mb-1">{t('dp.help_actions')}</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>{t('dp.help_action_1')}</li>
                  <li>{t('dp.help_action_2')}</li>
                  <li>{t('dp.help_action_3')}</li>
                  <li>{t('dp.help_action_4')}</li>
                </ul>
              </section>
              <section>
                <h3 className="font-semibold text-base text-gray-900 mb-1">{t('dp.help_status')}</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li><span className="text-amber-600 font-medium">{t('dp.pending')}</span> - {t('dp.help_pending_desc')}</li>
                  <li><span className="text-green-600 font-medium">{t('dp.completed')}</span> - {t('dp.help_completed_desc')}</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Delete account modal */}
      {showDeleteAccount && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-destructive">{t('dp.delete_account_title')}</h3>
              <button onClick={() => setShowDeleteAccount(false)} className="p-1 hover:bg-muted rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{t('dp.delete_warning')}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t('dp.delete_personal_data')}</li>
                <li>{t('dp.delete_certificates')}</li>
                <li>{t('dp.delete_sample_files')}</li>
                <li>{t('dp.keep_results')}</li>
              </ul>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowDeleteAccount(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {isDeletingAccount ? t('dp.deleting') : t('dp.confirm_delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssignmentCard({ assignment, onReject, t }: { assignment: any; onReject: (id: string, code: string) => void; t: (key: string, params?: Record<string, string>) => string }) {
  const isCompleted = assignment.status === "completed";
  const groupCode = assignment.carry_code || assignment.id.substring(0, 8).toUpperCase();
  const totalGroups = assignment.groups?.length || 10;

  const handleDownloadCertificate = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_URL}/certificate/download?sample_id=${assignment.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `certificado_${groupCode}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert(t('dp.cert_unavailable'));
      }
    } catch {
      alert(t('dp.cert_error'));
    }
  };

  return (
    <Card className={`group transition-all duration-300 hover:shadow-lg ${isCompleted ? 'bg-muted/30 border-muted' : 'border-primary/20 bg-white'}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <span className="font-mono text-xs font-medium text-muted-foreground uppercase tracking-widest">
          {t('dp.test_group')}
        </span>
        {isCompleted ? (
          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 gap-1">
            <CheckCircle2 className="w-3 h-3" /> {t('dp.completed')}
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 gap-1">
            <Clock className="w-3 h-3" /> {t('dp.pending')}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="pt-4">
        <CardTitle className="text-2xl font-bold font-mono mb-4 text-foreground">
          {groupCode}
        </CardTitle>

        <div className="flex justify-between items-end">
          <div className="text-sm text-muted-foreground">
            <p>{t('dp.questioned_print')}</p>
            <p>{t('dp.standard_prints', { n: String(totalGroups) })}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Link href={`/samples/${assignment.id}/evaluate`}>
              <Button
                disabled={isCompleted}
                className={`shadow-md transition-all ${isCompleted ? 'opacity-50' : 'hover:translate-x-1'}`}
              >
                {isCompleted ? t('dp.view_result') : t('dp.start_analysis')}
                {!isCompleted && <ArrowRight className="ml-2 w-4 h-4" />}
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const token = localStorage.getItem('token');
                window.open(`${API_URL}/samples/${assignment.id}/download?token=${token}`, '_blank');
              }}
              className="gap-1"
            >
              <Download className="w-3 h-3" /> {t('dp.download_zip')}
            </Button>
            {isCompleted && (
              <Button
                variant="default"
                size="sm"
                onClick={handleDownloadCertificate}
                className="gap-1 bg-green-600 hover:bg-green-700"
              >
                <Award className="w-3 h-3" /> {t('dp.certificate')}
              </Button>
            )}
            {!isCompleted && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReject(assignment.id, groupCode)}
                className="gap-1 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="w-3 h-3" /> {t('dp.abandon')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
