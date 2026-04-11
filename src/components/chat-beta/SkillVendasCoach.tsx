import { Copy, X } from "lucide-react";
import type { CoachingSuggestion } from "@/types/chat-beta";
import { toast } from "sonner";

export interface SkillVendasCoachProps {
  coaching: CoachingSuggestion;
  onCopiar?: (texto: string) => void;
  onDescartar?: () => void;
}

export function SkillVendasCoach({ coaching, onCopiar, onDescartar }: SkillVendasCoachProps) {
  const copiarParaClipboard = async () => {
    try {
      await navigator.clipboard.writeText(coaching.sugestaoMensagem);
      toast.success("Sugestão copiada!");
      onCopiar?.(coaching.sugestaoMensagem);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 shadow-sm mx-2 mb-2">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">💡</span>
          <div>
            <p className="text-xs font-semibold text-yellow-800">
              Estágio: {coaching.perfil}
            </p>
            <p className="text-[10px] text-yellow-600">
              Conversão meta: {(coaching.conversaoMeta * 100).toFixed(0)}%
            </p>
          </div>
        </div>
        <button
          onClick={() => onDescartar?.()}
          className="p-1 hover:bg-yellow-200 rounded text-yellow-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* O que fez bem */}
      <div className="mb-2">
        <p className="text-[10px] font-semibold text-yellow-700 mb-0.5">✓ O que fez bem:</p>
        <div className="text-[10px] text-yellow-600 space-y-0.5">
          <p>• Cliente {coaching.perfil === "decidido" ? "muito engajado" : "engajado"}</p>
          <p>• Tempo resposta correto para o tipo</p>
        </div>
      </div>

      {/* Próximo passo */}
      <div className="mb-2">
        <p className="text-[10px] font-semibold text-yellow-700">🎯 Próximo passo:</p>
        <p className="text-xs text-yellow-800 font-medium">{coaching.proximoPassoLabel}</p>
      </div>

      {/* Sugestão */}
      <div className="bg-white/60 rounded-lg p-2 mb-2 border border-yellow-100">
        <p className="text-xs text-yellow-900 italic">"{coaching.sugestaoMensagem}"</p>
      </div>

      {/* Checklist */}
      <div className="flex gap-3 mb-2 text-[10px]">
        <div>
          <p className="text-yellow-600">TPR</p>
          <p className="font-semibold text-yellow-800">{coaching.checklist.tpr}/30 min</p>
        </div>
        <div>
          <p className="text-yellow-600">Orçamentos</p>
          <p className="font-semibold text-yellow-800">{coaching.checklist.multiplosOrcamentos}/2-3</p>
        </div>
      </div>

      {/* Prioridade */}
      {coaching.prioridade === "maxima" && (
        <div className="text-[10px] font-bold text-red-600 bg-red-50 rounded px-2 py-1 mb-2 text-center">
          🔴 PRIORIDADE MÁXIMA
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2">
        <button
          onClick={copiarParaClipboard}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-yellow-600 text-white rounded hover:bg-yellow-700 font-medium text-xs"
        >
          <Copy className="h-3 w-3" /> Copiar
        </button>
        <button
          onClick={() => onDescartar?.()}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-white text-yellow-700 border border-yellow-300 rounded hover:bg-yellow-50 font-medium text-xs"
        >
          <X className="h-3 w-3" /> Descartar
        </button>
      </div>
    </div>
  );
}
