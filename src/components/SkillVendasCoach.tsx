import React, { useState } from 'react';
import { Copy, X } from 'lucide-react';

interface CoachingSuggestion {
  perfil: string;
  conversaoMeta: number;
  proximoPassoLabel: string;
  sugestaoMensagem: string;
  prioridade: 'maxima' | 'normal';
}

export function SkillVendasCoach({
  coaching,
  onCopiar,
  onDescartar
}: {
  coaching: CoachingSuggestion;
  onCopiar?: (texto: string) => void;
  onDescartar?: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(coaching.sugestaoMensagem);
      setCopiado(true);
      onCopiar?.(coaching.sugestaoMensagem);
      setTimeout(() => setCopiado(false), 2000);
    } catch (err) {
      console.error('Erro:', err);
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mx-3 mt-2 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-yellow-800">💡 {coaching.perfil}</p>
          <p className="text-xs text-yellow-600">Meta: {(coaching.conversaoMeta * 100).toFixed(0)}%</p>
        </div>
        <button onClick={() => onDescartar?.()} className="p-1 hover:bg-yellow-200 rounded">
          <X className="h-3.5 w-3.5 text-yellow-600" />
        </button>
      </div>
      
      <div className="mb-2">
        <p className="text-xs font-medium text-yellow-700">🎯 Próximo:</p>
        <p className="text-xs text-yellow-800">{coaching.proximoPassoLabel}</p>
      </div>
      
      <div className="bg-white/60 rounded p-2 mb-2">
        <p className="text-xs text-yellow-900 italic">"{coaching.sugestaoMensagem}"</p>
      </div>

      {coaching.prioridade === 'maxima' && (
        <div className="mb-2">
          <span className="text-xs font-bold text-red-600">🔴 PRIORIDADE MÁXIMA</span>
        </div>
      )}
      
      <div className="flex gap-2">
        <button
          onClick={copiar}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs font-medium transition-colors"
        >
          <Copy className="h-3 w-3" />
          {copiado ? 'Copiado!' : 'Copiar'}
        </button>
        <button
          onClick={() => onDescartar?.()}
          className="flex-1 px-2 py-1.5 bg-white text-yellow-700 border border-yellow-300 rounded hover:bg-yellow-50 text-xs font-medium transition-colors"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}
