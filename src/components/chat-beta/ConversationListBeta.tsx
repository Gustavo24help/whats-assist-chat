import { useState } from "react";
import { Search } from "lucide-react";
import { useConversationsComLeitura } from "@/hooks/useConversationsComLeitura";
import { UnreadBadge } from "./UnreadBadge";
import type { ConversaComLeitura } from "@/types/chat-beta";
import { cn } from "@/lib/utils";

export interface ConversationListBetaProps {
  onSelectConversa: (clienteTelefone: string) => void;
  conversaSelecionada?: string;
}

export function ConversationListBeta({
  onSelectConversa,
  conversaSelecionada,
}: ConversationListBetaProps) {
  const { conversas, loading } = useConversationsComLeitura();
  const [searchTerm, setSearchTerm] = useState("");

  const conversasFiltradas = conversas.filter((c) =>
    c.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.clienteTelefone.includes(searchTerm)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar conversa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Carregando conversas...
          </div>
        ) : conversasFiltradas.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhuma conversa encontrada
          </div>
        ) : (
          <div className="divide-y">
            {conversasFiltradas.map((conversa) => (
              <ConversationItemBeta
                key={conversa.clienteTelefone}
                conversa={conversa}
                isSelected={conversaSelecionada === conversa.clienteTelefone}
                onSelect={() => onSelectConversa(conversa.clienteTelefone)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationItemBeta({
  conversa,
  isSelected,
  onSelect,
}: {
  conversa: ConversaComLeitura;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-3 py-3 hover:bg-accent/50 transition-colors",
        isSelected && "bg-accent"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium truncate text-foreground">
          {conversa.clienteNome}
        </span>
        {conversa.naoLidosPorEsteOp > 0 && (
          <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold">
            {conversa.naoLidosPorEsteOp}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground truncate max-w-[70%]">
          {conversa.clienteTelefone.replace("whatsapp:", "")}
        </span>
        <UnreadBadge
          count={0}
          operadorNome={conversa.outroOpLeuNome}
          tempoHa={conversa.outroOpLeuEm ? "recente" : null}
        />
      </div>
    </button>
  );
}
