import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n/i18n';
import { samplesAPI } from '../services/api';
import Loading from '../components/Common/Loading';
import type { Sample, Group } from '../types/index';

interface SampleViewProps {
  sampleId: string;
  navigate: (route: string, params?: any) => void;
}

export default function SampleView({ sampleId, navigate }: SampleViewProps) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [sample, setSample] = useState<Sample | null>(null);
  const [progress, setProgress] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSample();
    loadProgress();
  }, [sampleId]);

  const loadSample = async () => {
    if (!token) return;
    
    setIsLoading(true);
    setError(null);

    const result = await samplesAPI.getOne(token, sampleId);
    
    if (result.success && result.data) {
      setSample(result.data as Sample);
    } else {
      setError(result.error || t('errors.load_sample') || 'Erro ao carregar amostra');
    }
    
    setIsLoading(false);
  };

  const loadProgress = async () => {
    if (!token) return;

    const result = await samplesAPI.getProgress(token, sampleId);
    
    if (result.success && result.data) {
      setProgress(result.data);
    }
  };

  if (isLoading) {
    return <Loading message={t('sample.loading') || 'Carregando amostra...'} />;
  }

  if (error || !sample) {
    return (
      <div className="container" style={{ padding: '3rem 0' }}>
        <div className="alert alert-danger">
          {error || t('errors.sample_not_found') || 'Amostra não encontrada'}
        </div>
        <button 
          className="btn btn-secondary"
          onClick={() => navigate('dashboard')}
        >
          {t('common.back') || 'Voltar'}
        </button>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '3rem 0' }}>
      <div className="mb-lg">
        <button 
          className="btn btn-secondary btn-small"
          onClick={() => navigate('dashboard')}
        >
          ← {t('common.back') || 'Voltar'}
        </button>
      </div>

      <div className="card mb-lg">
        <div className="card-header">
          <h2>{t('sample.title') || 'Detalhes da Amostra'}</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-2 mb-lg">
            <div>
              <strong>{t('sample.id') || 'ID'}:</strong>
              <p style={{ fontFamily: 'monospace' }}>{sample.id}</p>
            </div>
            <div>
              <strong>{t('sample.carry_code') || 'Código da Amostra'}:</strong>
              <p style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{sample.carry_code}</p>
            </div>
            <div>
              <strong>{t('sample.status') || 'Status'}:</strong>
              <p>
                <span 
                  className={`badge ${
                    sample.status === 'completed' ? 'badge-success' : 
                    sample.status === 'in_progress' ? 'badge-warning' : 
                    'badge-secondary'
                  }`}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.9rem'
                  }}
                >
                  {t(`status.${sample.status}`) || sample.status}
                </span>
              </p>
            </div>
            <div>
              <strong>{t('sample.created') || 'Criado em'}:</strong>
              <p>{new Date(sample.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {progress && (
            <div className="alert alert-info">
              <strong>{t('sample.progress') || 'Progresso'}:</strong> {progress.completed} / {progress.total} ({progress.percentage}%)
              <div style={{
                width: '100%',
                height: '20px',
                backgroundColor: '#e0e0e0',
                borderRadius: '10px',
                overflow: 'hidden',
                marginTop: '0.5rem'
              }}>
                <div style={{
                  width: `${progress.percentage}%`,
                  height: '100%',
                  backgroundColor: '#3498db',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>{t('sample.groups') || 'Grupos de Imagens'}</h3>
        </div>
        <div className="card-body">
          {!sample.groups || sample.groups.length === 0 ? (
            <div className="alert alert-info">
              {t('sample.no_groups') || 'Nenhum grupo disponível nesta amostra.'}
            </div>
          ) : (
            <div className="grid grid-3">
              {sample.groups.map((group: Group) => (
                <div key={group.id} className="card">
                  <div className="card-body">
                    <div className="flex-between mb-md">
                      <h4>{t('sample.group') || 'Grupo'} {group.group_index + 1}</h4>
                      <span 
                        className={`badge ${
                          group.status === 'completed' ? 'badge-success' : 'badge-secondary'
                        }`}
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '8px',
                          fontSize: '0.75rem'
                        }}
                      >
                        {t(`status.${group.status}`) || group.status}
                      </span>
                    </div>
                    
                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                      ID: {group.group_id}
                    </p>

                    <button
                      className="btn btn-primary btn-small"
                      style={{ width: '100%', marginTop: '0.5rem' }}
                      onClick={() => navigate('group', { groupId: group.group_id })}
                    >
                      {group.status === 'completed' 
                        ? t('sample.view_result') || 'Ver Resultado'
                        : t('sample.evaluate') || 'Avaliar'
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
