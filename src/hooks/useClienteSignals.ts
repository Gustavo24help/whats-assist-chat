import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PALAVRAS_URGENCIA, DADOS_CONVERSAO } from '@/lib/vendas-skill-data';
import type { ClienteSignals, CoachingSuggestion } from '@/types/chat-beta';

interface MensagemSimples {
  remetente: string;
  texto: string | null;
  data_hora: string | null;
}

/**
 * Detecta sinais do cliente em tempo real baseado nas mensagens da conversa.
 */
export function useClienteSignals(clienteTelefone: string) {
  const [mensagens, setMensagens] = useState<MensagemSimples[]>([]);
  const [signals, setSignals] = useState<ClienteSignals | null>(null);
  const [coaching, setCoaching] = useState<CoachingSuggestion | null>(null);
  const [loading, setLoading] = useState(true);

  // Buscar mensagens do cliente
  useEffect(() => {
    if (!clienteTelefone) {
      setLoading(false);
      return;
    }

    const fetchMensagens = async () => {
      const { data } = await supabase
        .from('mensagens')
        .select('remetente, texto, data_hora')
        .eq('cliente_id', clienteTelefone)
        .order('data_hora', { ascending: true })
        .limit(200);

      setMensagens(data || []);
      setLoading(false);
    };

    fetchMensagens();
  }, [clienteTelefone]);

  // Detectar sinais
  const detectarSignais = useMemo(() => {
    return (msgs: MensagemSimples[]): ClienteSignals | null => {
      if (!msgs || msgs.length === 0) return null;

      const clientMsgs = msgs.filter((m) => m.remetente === 'cliente');
      if (clientMsgs.length === 0) return null;

      const textoCompleto = clientMsgs
        .map((m) => m.texto || '')
        .join(' ')
        .toLowerCase();

      // 1. Urgência
      const urgencia = PALAVRAS_URGENCIA.some((p) => textoCompleto.includes(p));

      // 2. Perguntas técnicas
      const perguntasTecnicas = clientMsgs.filter(
        (m) => (m.texto || '').includes('?') && (m.texto || '').length > 10
      ).length;

      // 3. Tempo sem resposta
      const ultimaMsgCliente = clientMsgs[clientMsgs.length - 1];
      const tempoSemResposta = ultimaMsgCliente?.data_hora
        ? Math.floor((Date.now() - new Date(ultimaMsgCliente.data_hora).getTime()) / 60000)
        : 0;

      // 4. Perfil do cliente
      let profileCliente: ClienteSignals['profileCliente'] = 'normal';
      if (urgencia) {
        profileCliente = 'urgente';
      } else if (perguntasTecnicas >= 6) {
        profileCliente = 'decidido';
      } else if (perguntasTecnicas >= 3) {
        profileCliente = 'explorador';
      } else if (textoCompleto.includes('preço') || textoCompleto.includes('quanto')) {
        profileCliente = 'sensivel_preco';
      } else if (
        textoCompleto.includes('garantia') ||
        textoCompleto.includes('já tive') ||
        textoCompleto.includes('referência')
      ) {
        profileCliente = 'desconfiado';
      }

      // 5. Sinais textuais
      const sinais: string[] = [];
      if (urgencia) sinais.push('urgência');
      if (perguntasTecnicas > 0) sinais.push(`${perguntasTecnicas} perguntas`);
      if (textoCompleto.includes('fotos')) sinais.push('enviou fotos');
      if (textoCompleto.includes('vídeo')) sinais.push('enviou vídeo');

      return { urgencia, perguntasTecnicas, tempoSemResposta, profileCliente, sinais };
    };
  }, []);

  // Gerar coaching
  const gerarCoaching = useMemo(() => {
    return (sig: ClienteSignals): CoachingSuggestion => {
      let sugestaoMensagem = '';
      let proximoPassoLabel = '';
      let metaConversao = 0.27;

      if (sig.urgencia && sig.perguntasTecnicas >= 1) {
        proximoPassoLabel = 'Orçamento <30min (urgente + engajado)';
        sugestaoMensagem =
          'Entendo! Vou procurar prestador disponível HOJE mesmo. Que hora você pode atender? Entre 14h e 18h tem alguém.';
        metaConversao = 0.7;
      } else if (sig.urgencia) {
        proximoPassoLabel = 'Confirmar urgência + coletar 2-3 orçamentos';
        sugestaoMensagem =
          'Entendo sua urgência. Vou verificar disponibilidade imediata. Qual horário você prefere?';
        metaConversao = 0.44;
      } else if (sig.perguntasTecnicas >= 6) {
        proximoPassoLabel = 'Assumptive close';
        sugestaoMensagem =
          'Ótimo! Vou agendar para [data/hora] e já vou passar para nosso prestador. Pode ser?';
        metaConversao = 0.7;
      } else if (sig.perguntasTecnicas >= 3) {
        proximoPassoLabel = 'Coletar 2-3 orçamentos';
        sugestaoMensagem =
          'Perfeito! Deixa eu montar o orçamento com base no que você descreveu. Qualquer dúvida, me pergunta!';
        metaConversao = 0.47;
      } else if (sig.profileCliente === 'sensivel_preco') {
        proximoPassoLabel = 'Ancorar valor + oferecer parcelamento';
        sugestaoMensagem =
          'Entendo sua preocupação com o preço. Temos opções de parcelamento até 3x. Quer que eu monte as alternativas?';
        metaConversao = 0.27;
      } else if (sig.profileCliente === 'desconfiado') {
        proximoPassoLabel = 'Destacar garantia + prova social';
        sugestaoMensagem =
          'Entendo sua preocupação. Nossos prestadores têm avaliação média de 4.8★ e oferecem garantia de satisfação. Quer conhecer?';
        metaConversao = 0.27;
      } else {
        proximoPassoLabel = 'Qualificar mais';
        sugestaoMensagem = 'Entendi! Me conta um pouco mais sobre o que você precisa exatamente?';
        metaConversao = 0.26;
      }

      return {
        perfil: sig.profileCliente,
        conversaoBase: DADOS_CONVERSAO[sig.profileCliente]?.conversao || 0.27,
        conversaoMeta: metaConversao,
        proximoPassoLabel,
        sugestaoMensagem,
        checklist: {
          tpr: 0,
          multiplosOrcamentos: 0,
          ratioClienteOp: sig.perguntasTecnicas > 0 ? 1 : 0.5,
          ultimaMsgDoCliente: true,
        },
        prioridade: sig.urgencia ? 'maxima' : 'normal',
      };
    };
  }, []);

  // Executar detecção quando mensagens mudam
  useEffect(() => {
    if (!loading && mensagens.length > 0) {
      const novoSignals = detectarSignais(mensagens);
      if (novoSignals) {
        setSignals(novoSignals);
        setCoaching(gerarCoaching(novoSignals));
      }
    }
  }, [loading, mensagens, detectarSignais, gerarCoaching]);

  return { signals, coaching, loading };
}
