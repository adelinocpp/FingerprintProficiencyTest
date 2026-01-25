import { useI18n } from '../../i18n/i18n';

export default function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer style={{
      backgroundColor: '#34495e',
      color: 'white',
      padding: '2rem 0',
      marginTop: '3rem',
      textAlign: 'center'
    }}>
      <div className="container">
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          © {year} {t('app.footer') || 'Sistema de Teste de Proficiência em Impressões Digitais'}
        </p>
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', opacity: 0.8 }}>
          {t('app.version') || 'Versão 1.0.0'}
        </p>
      </div>
    </footer>
  );
}
