import { useI18n } from '../i18n/i18n';

interface HomeProps {
  navigate: (route: string) => void;
}

export default function Home({ navigate }: HomeProps) {
  const { t } = useI18n();

  return (
    <div className="container" style={{ padding: '2rem 0' }}>
      <div className="text-center mb-xl">
        <h3 style={{ fontSize: '1.0rem', marginBottom: '1rem' }}>
          {t('home.title') || 'Sistema de Teste de Proficiência em Impressões Digitais'}
        </h3>
        <p className="text-muted" style={{ fontSize: '1.0rem' }}>
          {t('home.subtitle') || 'Participe do estudo de comparação de impressões digitais'}
        </p>
      </div>

      <div className="grid grid-2" style={{ marginTop: '3rem' }}>
        <div className="card">
          <h3>{t('home.new_participant') || 'Novo Participante'}</h3>
          <p className="text-muted">
            {t('home.new_participant_desc') || 'Cadastre-se para participar do teste de proficiência'}
          </p>
          <button 
            className="btn btn-primary btn-large" 
            style={{ width: '100%', marginTop: '1rem' }}
            onClick={() => navigate('register')}
          >
            {t('home.register') || 'Cadastrar'}
          </button>
        </div>

        <div className="card">
          <h3>{t('home.returning') || 'Já Participante'}</h3>
          <p className="text-muted">
            {t('home.returning_desc') || 'Faça login com seu código de acesso'}
          </p>
          <button 
            className="btn btn-secondary btn-large" 
            style={{ width: '100%', marginTop: '1rem' }}
            onClick={() => navigate('login')}
          >
            {t('home.login') || 'Entrar'}
          </button>
        </div>
      </div>

      <div className="card mt-xl">
        <h3>{t('home.about') || 'Sobre o Estudo'}</h3>
        <p>
          {t('home.about_desc') || 'Este sistema permite que peritos criminais participem de um teste cego de proficiência em comparação de impressões digitais. O objetivo é avaliar a acurácia e confiabilidade dos exames periciais.'}
        </p>
        <ul style={{ marginTop: '1rem' }}>
          <li>{t('home.feature1') || 'Teste cego e controlado'}</li>
          <li>{t('home.feature2') || 'Múltiplas amostras de impressões digitais'}</li>
          <li>{t('home.feature3') || 'Certificado de participação'}</li>
          <li>{t('home.feature4') || 'Contribuição para pesquisa científica'}</li>
        </ul>
      </div>
    </div>
  );
}
