import { Loader2, CheckCircle2, AlertCircle, Cloud } from 'lucide-react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  completedCount?: number;
  totalCount?: number;
}

export default function SaveStatusIndicator({ status, completedCount, totalCount }: SaveStatusIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {status === 'idle' && (
        <><Cloud className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-400">Auto-save</span></>
      )}
      {status === 'saving' && (
        <><Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" /><span className="text-blue-500">Salvando...</span></>
      )}
      {status === 'saved' && (
        <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /><span className="text-green-500">Salvo</span></>
      )}
      {status === 'error' && (
        <><AlertCircle className="w-3.5 h-3.5 text-red-500" /><span className="text-red-500">Erro ao salvar</span></>
      )}
      {completedCount !== undefined && totalCount !== undefined && (
        <span className="text-gray-400 ml-1">({completedCount}/{totalCount})</span>
      )}
    </div>
  );
}
