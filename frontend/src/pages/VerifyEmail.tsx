import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useI18n } from '@/i18n/i18n';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export default function VerifyEmail() {
  const [_, setLocation] = useLocation();
  const { t } = useI18n();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already_verified'>('loading');
  const [message, setMessage] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [hasVerified, setHasVerified] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Token de validação não fornecido.');
      setTimeout(() => {
        setLocation(`/register?error=${encodeURIComponent('Token de validação não fornecido')}`);
      }, 2000);
      return;
    }

    if (!hasVerified) {
      setHasVerified(true);
      verifyEmail(token);
    }
  }, [hasVerified]);

  const verifyEmail = async (token: string) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${API_URL}/auth/verify-email/${token}`);
      const result = await response.json();

      if (result.success) {
        if (result.data.already_verified) {
          setStatus('already_verified');
          setMessage(result.data.message || 'Email já foi validado anteriormente.');
          setTimeout(() => {
            setLocation('/login');
          }, 2500);
        } else {
          setStatus('success');
          setMessage(result.data.message || 'Email validado com sucesso!');
          setParticipantName(result.data.voluntary_name || '');
          setTimeout(() => {
            setLocation('/login');
          }, 2500);
        }
      } else {
        setStatus('error');
        setMessage(result.error || 'Token inválido ou expirado.');
        const errorMsg = result.error || '';
        const alreadyValidated = errorMsg.includes('já validou') || errorMsg.includes('já foi validado');

        setTimeout(() => {
          if (alreadyValidated) {
            setLocation('/login');
          } else {
            setLocation(`/register?error=${encodeURIComponent(result.error || 'Token inválido ou expirado')}`);
          }
        }, 2500);
      }
    } catch (error) {
      setStatus('error');
      setMessage('Erro ao conectar com o servidor.');
      setTimeout(() => {
        setLocation(`/register?error=${encodeURIComponent('Erro ao conectar com o servidor')}`);
      }, 2500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === 'loading' && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <CardTitle>{t('verify.validating') || 'Validando Email...'}</CardTitle>
              <CardDescription>
                {t('verify.please_wait') || 'Por favor, aguarde enquanto validamos seu email.'}
              </CardDescription>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-green-700">
                {t('verify.success') || 'Email Validado!'}
              </CardTitle>
              <CardDescription>
                {participantName && (
                  <p className="mb-2">Bem-vindo, <strong>{participantName}</strong>!</p>
                )}
                {message}
              </CardDescription>
            </>
          )}

          {status === 'already_verified' && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-amber-600" />
              </div>
              <CardTitle className="text-amber-700">
                {t('verify.already_verified') || 'Já Validado'}
              </CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-red-700">
                {t('verify.error') || 'Erro na Validação'}
              </CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent>
          {(status === 'success' || status === 'already_verified') && (
            <div className="space-y-3">
              <Link href="/login">
                <Button className="w-full" size="lg">
                  {t('verify.go_to_login') || 'Fazer Login'}
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="w-full">
                  {t('verify.go_to_home') || 'Voltar para Home'}
                </Button>
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <Link href="/register">
                <Button className="w-full" size="lg">
                  {t('verify.register_again') || 'Cadastrar Novamente'}
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="w-full">
                  {t('verify.go_to_home') || 'Voltar para Home'}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
