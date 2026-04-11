import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CoachingSuggestion {
  perfil: string;
  conversaoMeta: number;
  proximoPassoLabel: string;
  sugestaoMensagem: string;
  prioridade: 'maxima' | 'normal';
}

const PALAVRAS_URGENCIA = [
  'urgente', 'hoje', 'agora', 'já', 'preciso',
  'sem luz', 'sem água', 'queimado', 'vazamento'
];

export function useClienteSignalsBeta(clienteTelefone: string) {
  const [coaching, setCoaching] = useState<CoachingSuggestion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSignals = async () => {
      const { data: msgs } = await supabase
        .from('mensagens')
        .select('texto, remetente')
        .eq('cliente_id', clienteTelefone)
        .eq('remetente', 'cliente')
        .order('data_hora', { ascending: false })
        .limit(50);

      if (!msgs?.length) {
        setCoaching(null);
        setLoading(false);
        return;
      }

      const texto = msgs.map(m => m.texto || '').join(' ').toLowerCase();
      const urgencia = PALAVRAS_URGENCIA.some(p => texto.includes(p));
      const perguntas = msgs.filter(m => (m.texto || '').includes('?') && (m.texto || '').length > 10).length;

      let perfil = 'normal';
      let meta = 0.27;
      let proximo = 'Qualificar mais';
      let sugestao = 'Entendi! Me conta um pouco mais sobre o que você precisa?';
      let prioridade: 'maxima' | 'normal' = 'normal';

      if (urgencia && perguntas >= 1) {
        perfil = 'Urgente + Engajado';
        meta = 0.70;
        proximo = 'Orçamento <30min';
        sugestao = 'Entendo! Vou procurar prestador disponível HOJE mesmo. Que hora você prefere?';
        prioridade = 'maxima';
      } else if (urgencia) {
        perfil = 'Urgente';
        meta = 0.44;
        proximo = 'Confirmar urgência + cotar';
        sugestao = 'Sua urgência é importante. Qual horário você prefere?';
        prioridade = 'maxima';
      } else if (perguntas >= 6) {
        perfil = 'Decidido';
        meta = 0.70;
        proximo = 'Assumptive close';
        sugestao = 'Ótimo! Vou agendar para você agora mesmo!';
      } else if (perguntas >= 3) {
        perfil = 'Explorador';
        meta = 0.47;
        proximo = 'Coletar orçamentos';
        sugestao = 'Perfeito! Deixa eu montar o orçamento.';
      }

      setCoaching({
        perfil,
        conversaoMeta: meta,
        proximoPassoLabel: proximo,
        sugestaoMensagem: sugestao,
        prioridade
      });
      setLoading(false);
    };

    fetchSignals();
  }, [clienteTelefone]);

  return { coaching, loading };
}
