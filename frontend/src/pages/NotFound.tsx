import { useI18n } from '../i18n/i18n';

interface NotFoundProps {
  navigate: (route: string) => void;
}

export default function NotFound({ navigate }: NotFoundProps) {
  const { t } = useI18n();

  return (
    <div className="container text-center" style={{ padding: '5rem 0' }}>
      <h1 style={{ fontSize: '4rem', margin: 0 }}>404</h1>
      <h2>{t('errors.not_found') || 'Página não encontrada'}</h2>
      <p className="text-muted" style={{ marginBottom: '2rem' }}>
        {t('errors.not_found_desc') || 'A página que você está procurando não existe.'}
      </p>
      <button 
        className="btn btn-primary"
        onClick={() => navigate('home')}
      >
        {t('nav.home') || 'Voltar para Início'}
      </button>
    </div>
  );
}
