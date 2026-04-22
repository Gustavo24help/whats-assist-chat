import { ConversationTimelineTV } from '@/components/dashboard/ConversationTimelineTV';

/**
 * Página dedicada do Acompanhamento de Conversas para TV.
 * Tela cheia, sem sistema freeform (não pode redimensionar/mover).
 * Layout fixo: 2 colunas de cards, com rolagem vertical.
 */
export default function DashboardTVConversas() {
  return (
    <div className="fixed inset-0 bg-[#0B1220] overflow-hidden">
      <ConversationTimelineTV />
    </div>
  );
}
