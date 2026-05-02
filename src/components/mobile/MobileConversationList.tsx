import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, LogOut, Settings, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Cliente {
  telefone: string;
  nome: string;
  status_conversa: "aberta" | "fechada";
  ultima_interacao: string;
  status_ficha?: string | null;
  bot_habilitado?: boolean | null;
  ficha_id_real?: string | null;
}

interface ReadRow {
  cliente_telefone: string;
  last_read_at: string | null;
  manual_unread: boolean | null;
}

interface MobileConversationListProps {
  onSelectCliente: (c: Cliente) => void;
  onLogout: () => void;
  onOpenSettings: () => void;
}

type Filter = "todas" | "nao_lidas" | "minhas" | "ativas";

const STATUS_INATIVOS = new Set(["Finalizado", "Perdido", "Não foi adiante"]);

export function MobileConversationList({ onSelectCliente, onLogout, onOpenSettings }: MobileConversationListProps) {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");
  const [reads, setReads] = useState<Map<string, ReadRow>>(new Map());
  const [lastClienteMsg, setLastClienteMsg] = useState<Map<string, string>>(new Map());
  const [lastTextSnippet, setLastTextSnippet] = useState<Map<string, { texto: string; from_cliente: boolean }>>(new Map());
  const [meusTickets, setMeusTickets] = useState<Set<string>>(new Set());

  const fetchClientes = useCallback(async () => {
    // Buscar últimos 200 clientes (suficiente p/ mobile)
    const { data } = await supabase
      .from("clientes")
      .select("telefone, nome, status_conversa, ultima_interacao, bot_habilitado")
      .order("ultima_interacao", { ascending: false })
      .limit(200);

    if (!data) return;

    const telefones = data.map((c) => c.telefone);

    // Buscar últimas fichas ativas
    const { data: fichas } = await supabase
      .from("fichas_de_servico")
      .select("id, telefone_cliente, status, atendente_id")
      .in("telefone_cliente", telefones)
      .order("created_at", { ascending: false });

    const fichaPorTelefone = new Map<string, any>();
    (fichas || []).forEach((f) => {
      if (!fichaPorTelefone.has(f.telefone_cliente)) {
        fichaPorTelefone.set(f.telefone_cliente, f);
      }
    });

    // Identificar "meus tickets"
    const meus = new Set<string>();
    if (user?.id) {
      (fichas || []).forEach((f) => {
        if (f.atendente_id === user.id) meus.add(f.telefone_cliente);
      });
    }
    setMeusTickets(meus);

    setClientes(
      data.map((c) => {
        const ficha = fichaPorTelefone.get(c.telefone);
        return {
          ...c,
          status_ficha: ficha?.status || null,
          ficha_id_real: ficha?.id || null,
        };
      }),
    );
    setLoading(false);
  }, [user?.id]);

  // Buscar leituras do operador
  const fetchReads = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await (supabase as any)
      .from("mensagem_leitura_operador")
      .select("cliente_telefone, last_read_at, manual_unread")
      .eq("user_id", user.id);
    if (data) {
      const map = new Map<string, ReadRow>();
      data.forEach((r: ReadRow) => map.set(r.cliente_telefone, r));
      setReads(map);
    }
  }, [user?.id]);

  // Buscar última mensagem do cliente p/ cada conversa
  const fetchLastClientMessages = useCallback(async (telefones: string[]) => {
    if (!telefones.length) return;
    // Em chunks p/ não estourar query
    const chunks: string[][] = [];
    for (let i = 0; i < telefones.length; i += 50) chunks.push(telefones.slice(i, i + 50));
    const map = new Map<string, string>();
    const snippets = new Map<string, { texto: string; from_cliente: boolean }>();
    for (const chunk of chunks) {
      const { data } = await supabase
        .from("mensagens")
        .select("cliente_id, data_hora, texto, remetente, tipo")
        .in("cliente_id", chunk)
        .order("data_hora", { ascending: false })
        .limit(chunk.length * 5);
      (data || []).forEach((m: any) => {
        const isAtendente = m.remetente?.includes("whatsapp:+") || m.remetente === "atendente" || m.remetente === "bot";
        if (!isAtendente && !map.has(m.cliente_id)) {
          map.set(m.cliente_id, m.data_hora);
        }
        if (!snippets.has(m.cliente_id)) {
          let snippet = m.texto || "";
          if (m.tipo === "imagem") snippet = "📷 Imagem";
          else if (m.tipo === "audio") snippet = "🎵 Áudio";
          else if (m.tipo === "video") snippet = "🎬 Vídeo";
          else if (m.tipo === "arquivo") snippet = "📎 Arquivo";
          snippets.set(m.cliente_id, { texto: snippet, from_cliente: !isAtendente });
        }
      });
    }
    setLastClienteMsg(map);
    setLastTextSnippet(snippets);
  }, []);

  useEffect(() => {
    fetchClientes();
    fetchReads();
  }, [fetchClientes, fetchReads]);

  useEffect(() => {
    if (clientes.length) {
      fetchLastClientMessages(clientes.map((c) => c.telefone));
    }
  }, [clientes, fetchLastClientMessages]);

  // Realtime: refresh ao chegar mensagem ou mudar leitura
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel("mobile-chat-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens" }, () => {
        fetchClientes();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mensagem_leitura_operador", filter: `user_id=eq.${user.id}` },
        () => fetchReads(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, fetchClientes, fetchReads]);

  const isUnread = useCallback(
    (telefone: string): boolean => {
      const r = reads.get(telefone);
      if (r?.manual_unread) return true;
      const lastMsg = lastClienteMsg.get(telefone);
      if (!lastMsg) return false;
      const lastReadAt = r?.last_read_at;
      if (!lastReadAt) return true;
      return new Date(lastMsg).getTime() > new Date(lastReadAt).getTime();
    },
    [reads, lastClienteMsg],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clientes.filter((c) => {
      if (term) {
        const hay = `${c.nome || ""} ${c.telefone}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      switch (filter) {
        case "nao_lidas":
          return isUnread(c.telefone);
        case "minhas":
          return meusTickets.has(c.telefone);
        case "ativas":
          return !c.status_ficha || !STATUS_INATIVOS.has(c.status_ficha);
        default:
          return true;
      }
    });
  }, [clientes, search, filter, isUnread, meusTickets]);

  const unreadCount = useMemo(() => clientes.filter((c) => isUnread(c.telefone)).length, [clientes, isUnread]);

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header */}
      <header className="shrink-0 bg-brand-coral text-white px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">24help</h1>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSettings}
              className="h-9 w-9 text-white hover:bg-white/20"
              aria-label="Configurações"
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              className="h-9 w-9 text-white hover:bg-white/20"
              aria-label="Sair"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversa ou número..."
            className="pl-9 h-10 bg-white/15 border-white/30 text-white placeholder:text-white/70 focus-visible:ring-white/50"
          />
        </div>
      </header>

      {/* Tabs */}
      <div className="shrink-0 flex border-b border-border bg-card overflow-x-auto">
        {([
          { k: "todas", label: "Todas" },
          { k: "nao_lidas", label: `Não lidas${unreadCount ? ` (${unreadCount})` : ""}` },
          { k: "minhas", label: "Minhas" },
          { k: "ativas", label: "Ativas" },
        ] as { k: Filter; label: string }[]).map((tab) => (
          <button
            key={tab.k}
            onClick={() => setFilter(tab.k)}
            className={cn(
              "flex-1 min-w-[80px] py-3 text-sm font-medium whitespace-nowrap transition-colors",
              filter === tab.k
                ? "text-brand-coral border-b-2 border-brand-coral"
                : "text-muted-foreground border-b-2 border-transparent",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma conversa</div>
        ) : (
          filtered.map((c) => {
            const unread = isUnread(c.telefone);
            const snippet = lastTextSnippet.get(c.telefone);
            const tempo = c.ultima_interacao
              ? formatDistanceToNowStrict(new Date(c.ultima_interacao), { locale: ptBR, addSuffix: false })
              : "";
            return (
              <button
                key={c.telefone}
                onClick={() => onSelectCliente(c)}
                className="w-full text-left px-4 py-3 border-b border-border/60 active:bg-muted/50 transition-colors flex gap-3"
              >
                <div className="w-12 h-12 rounded-full bg-brand-coral/15 flex items-center justify-center shrink-0 text-brand-coral font-semibold">
                  {(c.nome || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm", unread ? "font-bold text-foreground" : "font-medium text-foreground")}>
                      {c.nome || c.telefone}
                    </span>
                    <span className={cn("text-xs shrink-0", unread ? "text-brand-coral font-semibold" : "text-muted-foreground")}>
                      {tempo}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span
                      className={cn(
                        "truncate text-xs",
                        unread ? "text-foreground font-medium" : "text-muted-foreground",
                      )}
                    >
                      {snippet?.from_cliente ? "" : "Você: "}
                      {snippet?.texto || "—"}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {c.bot_habilitado === false && (
                        <Bot className="h-3.5 w-3.5 text-amber-500" aria-label="Bot desligado" />
                      )}
                      {unread && <span className="w-2.5 h-2.5 rounded-full bg-brand-coral" />}
                    </div>
                  </div>
                  {c.status_ficha && (
                    <div className="mt-1 inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {c.status_ficha}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
