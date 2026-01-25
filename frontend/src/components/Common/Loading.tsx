interface LoadingProps {
  message?: string;
}

export default function Loading({ message }: LoadingProps) {
  return (
    <div className="flex-center" style={{ padding: '3rem 0' }}>
      <div className="flex-column gap-md" style={{ alignItems: 'center' }}>
        <div className="spinner" style={{
          width: '40px',
          height: '40px',
          border: '4px solid rgba(0,0,0,0.1)',
          borderTopColor: '#3498db',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }}></div>
        {message && <p className="text-muted">{message}</p>}
      </div>
    </div>
  );
}
