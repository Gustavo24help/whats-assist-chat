import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ConversationTimerState {
  dentroJanela: boolean;
  horasRestantes: number;
  minutosRestantes: number;
}

export const useConversationTimer = (telefoneCliente: string) => {
  const [state, setState] = useState<ConversationTimerState>({
    dentroJanela: false,
    horasRestantes: 0,
    minutosRestantes: 0,
  });

  useEffect(() => {
    const verificarJanela = async () => {
      try {
        // Buscar a última mensagem RECEBIDA do cliente (remetente = 'cliente')
        const { data: ultimaMensagem } = await supabase
          .from('mensagens')
          .select('data_hora')
          .eq('cliente_id', telefoneCliente)
          .neq('remetente', 'whatsapp:+554138911555')
          .order('data_hora', { ascending: false })
          .limit(1)
          .single();

        if (!ultimaMensagem?.data_hora) {
          setState({
            dentroJanela: false,
            horasRestantes: 0,
            minutosRestantes: 0,
          });
          return;
        }

        const now = new Date();
        const ultimaInteracao = new Date(ultimaMensagem.data_hora);
        const diferencaMs = now.getTime() - ultimaInteracao.getTime();
        const diferencaHoras = diferencaMs / (1000 * 60 * 60);
        
        const dentroJanela = diferencaHoras < 24;
        const restanteMs = Math.max(0, (24 * 60 * 60 * 1000) - diferencaMs);
        const horasRestantes = Math.floor(restanteMs / (1000 * 60 * 60));
        const minutosRestantes = Math.floor((restanteMs % (1000 * 60 * 60)) / (1000 * 60));

        setState({
          dentroJanela,
          horasRestantes,
          minutosRestantes,
        });
      } catch (error) {
        console.error("Erro ao verificar janela de 24h:", error);
      }
    };

    verificarJanela();
    
    // Atualizar a cada minuto
    const interval = setInterval(verificarJanela, 60000);

    // Escutar por novas mensagens do cliente para atualizar em tempo real
    const channel = supabase
      .channel('mensagens_timer')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens',
          filter: `cliente_id=eq.${telefoneCliente}`,
        },
        (payload: any) => {
          if (payload.new?.remetente === 'cliente') {
            verificarJanela();
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, [telefoneCliente]);

  return state;
};
