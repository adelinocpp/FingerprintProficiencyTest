import { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div 
        className="card"
        style={{
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="card-header flex-between">
            <h3 style={{ margin: 0 }}>{title}</h3>
            <button 
              onClick={onClose}
              className="btn btn-secondary btn-small"
              style={{ marginLeft: 'auto' }}
            >
              ✕
            </button>
          </div>
        )}
        <div className="card-body">
          {children}
        </div>
      </div>
    </div>
  );
}
