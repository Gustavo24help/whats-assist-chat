import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface NotificationSystemProps {
  onNewMessage: (clienteId: string) => void;
  currentClienteId: string | null;
}

export const NotificationSystem = ({ onNewMessage, currentClienteId }: NotificationSystemProps) => {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZRQ0PVKbn9adgGAg+ltz0yHYpBSh+zPDglEILEliy6OyrWBUIQ5zj8r1rIgYuhM/z1YU1Bhxqvu7mnEcODlOm5/WnXxgIPpTc9Md0KAUpf8vw4JRCCBJV');
    
    const channel = supabase
      .channel('new-messages-notification')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens',
        },
        async (payload: any) => {
          const clienteId = payload.new.cliente_id;
          const remetente = payload.new.remetente;
          
          // Ignorar mensagens da 24help (atendente/bot)
          const NUMERO_24HELP = 'whatsapp:+554138911555';
          if (remetente === NUMERO_24HELP || remetente === 'atendente' || remetente === 'bot') return;
          
          if (clienteId !== currentClienteId) {
            // Verificar se o bot já foi desligado alguma vez para este cliente + buscar nome
            const { data: cliente } = await supabase
              .from('clientes')
              .select('nome, bot_ja_desligado_alguma_vez')
              .eq('telefone', clienteId)
              .maybeSingle();

            // Só tocar som se o bot já foi desligado alguma vez
            const deveTocarSom = cliente?.bot_ja_desligado_alguma_vez === true;

            if (deveTocarSom && audioRef.current) {
              audioRef.current.play().catch(e => console.log('Could not play sound:', e));
            }

            const mensagem = payload.new.texto || 'Nova mensagem';
            const nomeCliente = cliente?.nome || clienteId.replace('whatsapp:', '');
            const preview = mensagem.length > 60 ? mensagem.substring(0, 60) + '...' : mensagem;

            console.log('[NotificationSystem] 🔔 Disparando toast para:', nomeCliente);

            toast.info(`💬 ${nomeCliente}`, {
              description: preview,
              duration: 6000,
              action: {
                label: 'Abrir',
                onClick: () => onNewMessage(clienteId),
              },
            });

            onNewMessage(clienteId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentClienteId, onNewMessage, user?.id]);

  return null;
};
