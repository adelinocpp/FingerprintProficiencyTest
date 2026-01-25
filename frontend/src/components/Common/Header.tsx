import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n/i18n';

export default function Header() {
  const { isAuthenticated, logout, participant } = useAuth();
  const { t, language, setLanguage } = useI18n();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as any);
  };

  return (
    <header style={{
      backgroundColor: '#2c3e50',
      color: 'white',
      padding: '1rem 0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div className="container">
        <div className="flex-between">
          <div>
            <h1 style={{ fontSize: '1.5rem', margin: 0 }}>
              {t('app.title') || 'Sistema de Teste de Proficiência'}
            </h1>
          </div>
          
          <div className="flex gap-md" style={{ alignItems: 'center' }}>
            <select 
              value={language} 
              onChange={handleLanguageChange}
              style={{
                padding: '0.5rem',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: '#34495e',
                color: 'white'
              }}
            >
              <option value="pt-BR">🇧🇷 PT</option>
              <option value="en">🇺🇸 EN</option>
              <option value="es">🇪🇸 ES</option>
            </select>

            {isAuthenticated && (
              <>
                <span style={{ fontSize: '0.9rem' }}>
                  {participant?.voluntary_name || 'Usuário'}
                </span>
                <button 
                  onClick={logout}
                  className="btn btn-secondary btn-small"
                >
                  {t('auth.logout') || 'Sair'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
