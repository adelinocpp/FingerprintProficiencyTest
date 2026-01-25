import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n/i18n';
import { groupsAPI, resultsAPI } from '../services/api';
import Loading from '../components/Common/Loading';
import Modal from '../components/Common/Modal';
import type { Group, GroupImage, ResultFormData } from '../types/index';

interface GroupViewProps {
  groupId: string;
  navigate: (route: string, params?: any) => void;
}

export default function GroupView({ groupId, navigate }: GroupViewProps) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GroupImage | null>(null);
  
  const [formData, setFormData] = useState<ResultFormData>({
    conclusive: false,
    has_match: null,
    matched_image_index: null,
    compatibility_degree: null,
    notes: null
  });

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  const loadGroup = async () => {
    if (!token) return;
    
    setIsLoading(true);
    setError(null);

    const result = await groupsAPI.getOne(token, groupId);
    
    if (result.success && result.data) {
      setGroup(result.data as Group);
      if ((result.data as any).result) {
        const res = (result.data as any).result;
        setFormData({
          conclusive: res.conclusive,
          has_match: res.has_match,
          matched_image_index: res.matched_image_index,
          compatibility_degree: res.compatibility_degree,
          notes: res.notes
        });
      }
    } else {
      setError(result.error || t('errors.load_group') || 'Erro ao carregar grupo');
    }
    
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token || !group) return;

    if (formData.conclusive && formData.has_match === null) {
      alert(t('group.select_match') || 'Indique se há correspondência');
      return;
    }

    if (formData.conclusive && formData.has_match && formData.matched_image_index === null) {
      alert(t('group.select_image') || 'Selecione qual imagem corresponde');
      return;
    }

    if (formData.conclusive && formData.has_match && !formData.compatibility_degree) {
      alert(t('group.select_degree') || 'Selecione o grau de compatibilidade');
      return;
    }

    setIsSubmitting(true);

    const result = await resultsAPI.submit(token, {
      group_id: group.group_id,
      ...formData
    });

    setIsSubmitting(false);

    if (result.success) {
      alert(t('group.success') || 'Resultado submetido com sucesso!');
      navigate('dashboard');
    } else {
      alert(result.error || t('errors.submit') || 'Erro ao submeter resultado');
    }
  };

  if (isLoading) {
    return <Loading message={t('group.loading') || 'Carregando grupo...'} />;
  }

  if (error || !group) {
    return (
      <div className="container" style={{ padding: '3rem 0' }}>
        <div className="alert alert-danger">
          {error || t('errors.group_not_found') || 'Grupo não encontrado'}
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

  const questionImage = group.images?.find(img => img.image_type === 'questionada');
  const standardImages = group.images?.filter(img => img.image_type === 'padrao') || [];

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
          <h2>{t('group.title') || 'Avaliação de Grupo'}</h2>
        </div>
        <div className="card-body">
          <p className="text-muted">
            {t('group.instruction') || 'Compare a impressão questionada com as impressões padrão e registre sua conclusão.'}
          </p>
        </div>
      </div>

      <div className="grid grid-2 gap-lg mb-lg">
        <div className="card">
          <div className="card-header">
            <h3>{t('group.questioned') || 'Impressão Questionada'}</h3>
          </div>
          <div className="card-body">
            {questionImage ? (
              <div 
                style={{
                  border: '2px solid #3498db',
                  borderRadius: '8px',
                  padding: '0.5rem',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setSelectedImage(questionImage);
                  setShowModal(true);
                }}
              >
                <img 
                  src={questionImage.file_path} 
                  alt="Questionada"
                  style={{ width: '100%', display: 'block' }}
                />
                <p className="text-center text-muted mt-sm" style={{ fontSize: '0.85rem' }}>
                  {t('group.click_enlarge') || 'Clique para ampliar'}
                </p>
              </div>
            ) : (
              <p className="text-muted">{t('group.no_image') || 'Nenhuma imagem disponível'}</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>{t('group.standards') || 'Impressões Padrão'}</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-2 gap-sm">
              {standardImages.map((img, idx) => (
                <div 
                  key={img.id}
                  style={{
                    border: formData.matched_image_index === idx ? '3px solid #27ae60' : '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                  onClick={() => {
                    setSelectedImage(img);
                    setShowModal(true);
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: '0.5rem',
                    left: '0.5rem',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}>
                    {idx + 1}
                  </div>
                  <img 
                    src={img.file_path} 
                    alt={`Padrão ${idx + 1}`}
                    style={{ width: '100%', display: 'block' }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-header">
            <h3>{t('group.result') || 'Registrar Resultado'}</h3>
          </div>
          <div className="card-body">
            <div className="mb-lg">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.conclusive}
                  onChange={(e) => setFormData({
                    ...formData, 
                    conclusive: e.target.checked,
                    has_match: e.target.checked ? formData.has_match : null
                  })}
                />
                <span><strong>{t('group.conclusive') || 'Resultado Conclusivo'}</strong></span>
              </label>
            </div>

            {formData.conclusive && (
              <>
                <div className="mb-lg">
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                    {t('group.has_match') || 'Há correspondência?'} *
                  </label>
                  <div className="flex gap-md">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="has_match"
                        checked={formData.has_match === true}
                        onChange={() => setFormData({...formData, has_match: true})}
                      />
                      <span>{t('common.yes') || 'Sim'}</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="has_match"
                        checked={formData.has_match === false}
                        onChange={() => setFormData({...formData, has_match: false, matched_image_index: null, compatibility_degree: null})}
                      />
                      <span>{t('common.no') || 'Não'}</span>
                    </label>
                  </div>
                </div>

                {formData.has_match && (
                  <>
                    <div className="mb-lg">
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                        {t('group.which_image') || 'Qual imagem corresponde?'} *
                      </label>
                      <select
                        value={formData.matched_image_index ?? ''}
                        onChange={(e) => setFormData({...formData, matched_image_index: parseInt(e.target.value)})}
                        style={{ width: '100%' }}
                      >
                        <option value="">{t('group.select') || 'Selecione...'}</option>
                        {standardImages.map((_, idx) => (
                          <option key={idx} value={idx}>
                            {t('group.image') || 'Imagem'} {idx + 1}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-lg">
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                        {t('group.compatibility') || 'Grau de Compatibilidade'} *
                      </label>
                      <div className="flex gap-md">
                        {[1, 2, 3, 4].map(degree => (
                          <label key={degree} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="compatibility"
                              checked={formData.compatibility_degree === degree}
                              onChange={() => setFormData({...formData, compatibility_degree: degree as 1|2|3|4})}
                            />
                            <span>{degree}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="mb-lg">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                {t('group.notes') || 'Observações (opcional)'}
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder={t('group.notes_placeholder') || 'Adicione observações sobre sua avaliação...'}
                style={{ width: '100%', minHeight: '100px' }}
              />
            </div>
          </div>

          <div className="card-footer flex gap-md">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('dashboard')}
              disabled={isSubmitting}
            >
              {t('common.cancel') || 'Cancelar'}
            </button>
            <button
              type="submit"
              className="btn btn-success"
              disabled={isSubmitting}
              style={{ marginLeft: 'auto' }}
            >
              {isSubmitting ? t('group.submitting') || 'Submetendo...' : t('group.submit') || 'Submeter Resultado'}
            </button>
          </div>
        </div>
      </form>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={selectedImage?.image_type === 'questionada' ? t('group.questioned') : `${t('group.standard') || 'Padrão'} ${(selectedImage?.index || 0) + 1}`}
      >
        {selectedImage && (
          <img 
            src={selectedImage.file_path} 
            alt="Ampliada"
            style={{ width: '100%', display: 'block' }}
          />
        )}
      </Modal>
    </div>
  );
}
