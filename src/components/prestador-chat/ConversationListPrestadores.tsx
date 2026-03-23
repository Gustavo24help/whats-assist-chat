import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PrestadorChat {
  telefone: string;
  nome: string;
  cpf: string | null;
  status_conversa: "aberta" | "fechada";
  ultima_interacao: string | null;
  tags: string[];
  arquivado: boolean;
  marcado_nao_lido: boolean;
  numero_twilio: string | null;
}

interface ConversationListPrestadoresProps {
  selectedTelefone: string | null;
  onSelectPrestador: (prestador: PrestadorChat) => void;
}

export const ConversationListPrestadores = ({
  selectedTelefone,
  onSelectPrestador,
}: ConversationListPrestadoresProps) => {
  const [prestadores, setPrestadores] = useState<PrestadorChat[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({});

  const fetchPrestadores = useCallback(async () => {
    const { data, error } = await supabase
      .from("prestadores_chat")
      .select("*")
      .eq("arquivado", showArchived)
      .order("ultima_interacao", { ascending: false });

    if (error) {
      console.error("Erro ao buscar prestadores_chat:", error);
      return;
    }

    setPrestadores((data as PrestadorChat[]) || []);
    setLoading(false);

    // Fetch last messages for each prestador
    if (data && data.length > 0) {
      const phones = data.map((p: any) => p.telefone);
      const { data: msgs } = await supabase
        .from("mensagens_prestadores")
        .select("prestador_telefone, texto, tipo, data_hora")
        .in("prestador_telefone", phones)
        .order("data_hora", { ascending: false });

      if (msgs) {
        const lastMsgs: Record<string, string> = {};
        for (const msg of msgs) {
          if (!lastMsgs[msg.prestador_telefone]) {
            if (msg.tipo === "audio") lastMsgs[msg.prestador_telefone] = "🎵 Áudio";
            else if (msg.tipo === "imagem") lastMsgs[msg.prestador_telefone] = "📷 Imagem";
            else if (msg.tipo === "video") lastMsgs[msg.prestador_telefone] = "🎬 Vídeo";
            else if (msg.tipo === "arquivo") lastMsgs[msg.prestador_telefone] = "📎 Arquivo";
            else lastMsgs[msg.prestador_telefone] = msg.texto || "";
          }
        }
        setLastMessages(lastMsgs);
      }
    }
  }, [showArchived]);

  useEffect(() => {
    fetchPrestadores();
  }, [fetchPrestadores]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("prestadores_chat_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prestadores_chat" },
        () => fetchPrestadores()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens_prestadores" },
        () => fetchPrestadores()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPrestadores]);

  const filtered = useMemo(() => {
    if (!searchTerm) return prestadores;
    const lower = searchTerm.toLowerCase();
    return prestadores.filter(
      (p) =>
        p.nome.toLowerCase().includes(lower) ||
        p.telefone.includes(lower) ||
        (p.cpf && p.cpf.includes(lower))
    );
  }, [prestadores, searchTerm]);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, "HH:mm");
    if (isYesterday(date)) return "Ontem";
    return format(date, "dd/MM", { locale: ptBR });
  };

  const formatPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    // Remove country code 55
    const local = digits.startsWith("55") ? digits.slice(2) : digits;
    if (local.length === 11) {
      return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
    }
    if (local.length === 10) {
      return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
    }
    return phone.replace("whatsapp:", "").replace("+", "");
  };

  const getPrestadorDisplayName = (nome: string) => {
    const trimmedName = nome.trim();

    if (!trimmedName) return "Prestador";
    if (trimmedName.startsWith("whatsapp:")) return null;
    if (/^[0-9()+\-\s]+$/.test(trimmedName)) return null;

    return trimmedName;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar prestador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={showArchived ? "outline" : "default"}
            size="sm"
            className="flex-1"
            onClick={() => setShowArchived(false)}
          >
            Ativas
          </Button>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setShowArchived(true)}
          >
            <Archive className="h-3 w-3 mr-1" />
            Arquivadas
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            {searchTerm ? "Nenhum prestador encontrado" : "Nenhuma conversa"}
          </div>
        ) : (
          filtered.map((prestador) => (
            <button
              key={prestador.telefone}
              onClick={() => onSelectPrestador(prestador)}
              className={cn(
                "w-full text-left p-3 border-b hover:bg-accent/50 transition-colors",
                selectedTelefone === prestador.telefone && "bg-accent",
                prestador.marcado_nao_lido && "bg-primary/5 border-l-2 border-l-primary"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm truncate flex-1">
                  {getPrestadorDisplayName(prestador.nome) || formatPhoneNumber(prestador.telefone)}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  {formatTime(prestador.ultima_interacao)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {prestador.telefone.replace("whatsapp:+", "+")}
              </div>
              {prestador.cpf && (
                <div className="text-xs text-muted-foreground mb-1">CPF: {prestador.cpf}</div>
              )}
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground truncate flex-1">
                  {lastMessages[prestador.telefone] || "Sem mensagens"}
                </p>
                {prestador.status_conversa === "fechada" && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">Fechada</Badge>
                )}
              </div>
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  );
};
