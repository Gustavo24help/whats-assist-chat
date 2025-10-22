import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NotificationSystemProps {
  onNewMessage: (clienteId: string) => void;
  currentClienteId: string | null;
}

export const NotificationSystem = ({ onNewMessage, currentClienteId }: NotificationSystemProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element for notification sound
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZRQ0PVKbn9adgGAg+ltz0yHYpBSh+zPDglEILEliy6OyrWBUIQ5zj8r1rIgYuhM/z1YU1Bhxqvu7mnEcODlOm5/WnXxgIPpTc9Md0KAUpf8vw4JRCCBJV');
    
    const channel = supabase
      .channel('new-messages-notification')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens',
          filter: 'remetente=eq.cliente'
        },
        (payload: any) => {
          const clienteId = payload.new.cliente_id;
          
          // Only show notification if not viewing this conversation
          if (clienteId !== currentClienteId) {
            // Play notification sound
            if (audioRef.current) {
              audioRef.current.play().catch(e => console.log('Could not play sound:', e));
            }

            // Show toast notification
            const mensagem = payload.new.texto || 'Nova mensagem';
            toast.info(`Nova mensagem de ${clienteId}`, {
              description: mensagem.substring(0, 50) + (mensagem.length > 50 ? '...' : ''),
              duration: 5000,
            });

            // Trigger badge update
            onNewMessage(clienteId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentClienteId, onNewMessage]);

  return null;
};
