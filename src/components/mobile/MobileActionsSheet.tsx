import { useEffect, useState, useCallback } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  ExternalLink,
  Copy,
  BellOff,
  Bell,
  Bot,
  BotOff,
  Sparkles,
  History,
  FileText,
  ArrowRightLeft,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  markConversationRead,
  markConversationUnread,
} from "@/lib/chatBetaUnread";
import { BotHistoricoDialog } from "@/components/BotHistoricoDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Cliente {
  telefone: string;
  nome: string;
  status_conversa?: "aberta" | "fechada";
  ficha_id_real?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente: Cliente;
  initialTab?: TabKey;
  onMarkedUnread?: () => void;
}

type TabKey = "ficha" | "historico" | "resumo" | "bot";

export function MobileActionsSheet({
  open,
  onOpenChange,
  cliente,
  initialTab = "ficha",
  onMarkedUnread,
}: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [ficha, setFicha] = useState<any>(null);
  const [fichaLoading, setFichaLoading] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);
  const [resumoLoading, setResumoLoading] = useState(false);
  const [botStatus, setBotStatus] = useState<boolean | null>(null);
  const [botLoading, setBotLoading] = useState(false);
  const [botHistoricoOpen, setBotHistoricoOpen] = useState(false);
  const [atendenteAtual, setAtendenteAtual] = useState<{ id: string; nome: string } | null>(null);
  const [unreadFlag, setUnreadFlag] = useState(false);
  const [confirmLigarBotOpen, setConfirmLigarBotOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setTab(initialTab);
    } else {
      setResumo(null);
      setConfirmText("");
    }
  }, [open, initialTab]);

  // Carregar ficha + cliente status (bot, atendente)
  const loadAll = useCallback(async () => {
    setFichaLoading(true);
    let q = supabase.from("fichas_de_servico").select("*").eq("telefone_cliente", cliente.telefone);
    if (cliente.ficha_id_real) q = q.eq("id", cliente.ficha_id_real);
    const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
    setFicha(data);
    setFichaLoading(false);

    const { data: cl } = await supabase
      .from("clientes")
      .select("bot_habilitado, atendente_id, atendente:profiles!atendente_id(full_name)")
      .eq("telefone", cliente.telefone)
      .maybeSingle();
    setBotStatus((cl as any)?.bot_habilitado ?? null);
    if ((cl as any)?.atendente_id && (cl as any)?.atendente) {
      setAtendenteAtual({
        id: (cl as any).atendente_id,
        nome: (cl as any).atendente.full_name || "Operador",
      });
    } else {
      setAtendenteAtual(null);
    }

    if (user?.id) {
      const { data: read } = await (supabase as any)
        .from("mensagem_leitura_operador")
        .select("manual_unread")
        .eq("user_id", user.id)
        .eq("cliente_telefone", cliente.telefone)
        .maybeSingle();
      setUnreadFlag(!!read?.manual_unread);
    }
  }, [cliente.telefone, cliente.ficha_id_real, user?.id]);

  useEffect(() => {
    if (open) loadAll();
  }, [open, loadAll]);

  // Histórico de fichas
  useEffect(() => {
    if (!open || tab !== "historico") return;
    setHistoricoLoading(true);
    supabase
      .from("fichas_de_servico")
      .select("id, numero_os, status, created_at, equipamento, valor_total")
      .eq("telefone_cliente", cliente.telefone)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setHistorico(data || []);
        setHistoricoLoading(false);
      });
  }, [open, tab, cliente.telefone]);

  // Ações
  const handleMarkUnread = async () => {
    if (!user?.id) return;
    await markConversationUnread(cliente.telefone, user.id);
    toast.success("Marcada como não lida");
    onOpenChange(false);
    onMarkedUnread?.();
  };

  const handleMarkRead = async () => {
    if (!user?.id) return;
    await markConversationRead(cliente.telefone, user.id);
    setUnreadFlag(false);
    toast.success("Marcada como lida");
  };

  const handleToggleBot = async () => {
    // Se vai LIGAR (estava desligado), exigir confirmação
    if (botStatus === false) {
      setConfirmLigarBotOpen(true);
      return;
    }
    await doToggleBot();
  };

  const doToggleBot = async () => {
    setBotLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("toggle-bot-status", {
        body: {
          telefone: cliente.telefone,
          enable: !botStatus,
          userId: user?.id,
        },
      });
      if (error) throw error;
      setBotStatus(!botStatus);
      toast.success(!botStatus ? "Bot ligado" : "Bot desligado");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao alternar bot");
    } finally {
      setBotLoading(false);
    }
  };

  const confirmLigarBot = async () => {
    if (confirmText.trim().toUpperCase() !== "LIGAR") {
      toast.error("Digite LIGAR para confirmar");
      return;
    }
    setConfirmLigarBotOpen(false);
    setConfirmText("");
    await doToggleBot();
  };

  const handleResumo = async () => {
    setResumoLoading(true);
    setResumo(null);
    try {
      const { data, error } = await supabase.functions.invoke("summarize-conversation", {
        body: { telefone: cliente.telefone, fichaId: cliente.ficha_id_real || ficha?.id || null },
      });
      if (error) throw error;
      setResumo(data?.summary || data?.resumo || "Sem resumo disponível");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar resumo");
    } finally {
      setResumoLoading(false);
    }
  };

  const handleTakeover = async () => {
    if (!user?.id || !atendenteAtual) return;
    try {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      const meuNome = profile?.full_name || "Operador";
      const { error } = await supabase.from("takeover_requests").insert({
        telefone_cliente: cliente.telefone,
        solicitante_id: user.id,
        solicitante_nome: meuNome,
        operador_atual_id: atendenteAtual.id,
        status: "pending",
      });
      if (error) throw error;
      const ch = supabase.channel(`takeover-${cliente.telefone}`);
      await ch.subscribe();
      await ch.send({
        type: "broadcast",
        event: "takeover_request",
        payload: { solicitante_id: user.id, solicitante_nome: meuNome, operador_atual_id: atendenteAtual.id },
      });
      toast.success(`Solicitação enviada para ${atendenteAtual.nome}`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao solicitar takeover");
    }
  };

  const handleCopyTel = () => {
    navigator.clipboard.writeText(cliente.telefone);
    toast.success("Telefone copiado");
  };

  const handleOpenFicha = () => {
    const id = ficha?.id || cliente.ficha_id_real;
    if (!id) {
      toast.error("Sem ficha vinculada");
      return;
    }
    window.open(`/fichas/${id}`, "_blank");
  };

  const isOutroOperador = !!atendenteAtual && atendenteAtual.id !== user?.id;

  const tabs: { k: TabKey; label: string; icon: any }[] = [
    { k: "ficha", label: "Ficha", icon: FileText },
    { k: "historico", label: "Histórico", icon: History },
    { k: "resumo", label: "Resumo IA", icon: Sparkles },
    { k: "bot", label: "Bot", icon: Bot },
  ];

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh] flex flex-col">
          <DrawerHeader className="pb-2 shrink-0">
            <DrawerTitle className="text-base">{cliente.nome || cliente.telefone}</DrawerTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{cliente.telefone}</span>
              {cliente.status_conversa && (
                <Badge variant={cliente.status_conversa === "aberta" ? "default" : "secondary"} className="text-[10px] h-4">
                  {cliente.status_conversa === "aberta" ? "Ativa" : "Fechada"}
                </Badge>
              )}
              {ficha?.status && (
                <Badge variant="outline" className="text-[10px] h-4">{ficha.status}</Badge>
              )}
              {botStatus === false && (
                <Badge variant="outline" className="text-[10px] h-4 border-amber-500 text-amber-600">
                  Bot OFF
                </Badge>
              )}
              {isOutroOperador && (
                <Badge variant="outline" className="text-[10px] h-4">👤 {atendenteAtual?.nome}</Badge>
              )}
            </div>
          </DrawerHeader>

          {/* Tabs */}
          <div className="shrink-0 flex border-b border-border overflow-x-auto px-2">
            {tabs.map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors",
                  tab === t.k
                    ? "border-brand-coral text-brand-coral font-medium"
                    : "border-transparent text-muted-foreground",
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Conteúdo abas */}
          <ScrollArea className="flex-1 px-4 py-3">
            {tab === "ficha" && (
              <>
                {fichaLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !ficha ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">Sem ficha vinculada</div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <Field label="OS" value={ficha.numero_os || ficha.id?.slice(0, 8)} />
                    <Field label="Status" value={ficha.status} />
                    <Field label="Cliente" value={ficha.nome_cliente} />
                    <Field label="Telefone" value={ficha.telefone_cliente} />
                    <Field label="Endereço" value={ficha.endereco} />
                    <Field label="Bairro" value={ficha.bairro} />
                    <Field label="Cidade" value={ficha.cidade} />
                    <Field label="Equipamento" value={ficha.equipamento} />
                    <Field label="Defeito" value={ficha.defeito} />
                    <Field label="Prestador" value={ficha.prestador_nome} />
                    <Field label="Valor total" value={ficha.valor_total ? `R$ ${ficha.valor_total}` : null} />
                    <Field
                      label="Visita técnica"
                      value={
                        ficha.data_visita_tecnica
                          ? new Date(ficha.data_visita_tecnica).toLocaleString("pt-BR")
                          : ficha.horario_visita_tecnica
                          ? new Date(ficha.horario_visita_tecnica).toLocaleString("pt-BR")
                          : null
                      }
                    />
                  </div>
                )}
              </>
            )}

            {tab === "historico" && (
              <>
                {historicoLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : historico.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">Nenhuma ficha anterior</div>
                ) : (
                  <div className="space-y-2">
                    {historico.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => window.open(`/fichas/${f.id}`, "_blank")}
                        className="w-full text-left rounded-lg border border-border p-3 active:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">
                            #{f.numero_os || f.id?.slice(0, 6)} — {f.equipamento || "—"}
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] h-4">{f.status}</Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(f.created_at), "dd/MM/yy", { locale: ptBR })}
                          </span>
                        </div>
                        {f.valor_total && (
                          <div className="text-xs text-muted-foreground mt-1">R$ {f.valor_total}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "resumo" && (
              <div className="space-y-3">
                <Button
                  onClick={handleResumo}
                  disabled={resumoLoading}
                  className="w-full bg-brand-coral hover:bg-brand-coral/90 text-white"
                >
                  {resumoLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando resumo...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" /> {resumo ? "Gerar novamente" : "Gerar resumo IA"}
                    </>
                  )}
                </Button>
                {resumo && (
                  <div className="text-sm whitespace-pre-wrap rounded-lg border border-border p-3 bg-muted/30">
                    {resumo}
                  </div>
                )}
              </div>
            )}

            {tab === "bot" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-border p-4">
                  <div className="text-xs uppercase text-muted-foreground tracking-wide mb-1">Status atual</div>
                  <div className="flex items-center gap-2">
                    {botStatus === true ? (
                      <>
                        <Bot className="h-4 w-4 text-emerald-600" />
                        <span className="font-medium text-emerald-700">Bot ligado</span>
                      </>
                    ) : botStatus === false ? (
                      <>
                        <BotOff className="h-4 w-4 text-amber-600" />
                        <span className="font-medium text-amber-700">Bot desligado</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </div>
                </div>
                <Button
                  onClick={handleToggleBot}
                  disabled={botLoading || botStatus === null}
                  variant={botStatus ? "destructive" : "default"}
                  className="w-full"
                >
                  {botLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : botStatus ? (
                    <BotOff className="h-4 w-4 mr-2" />
                  ) : (
                    <Bot className="h-4 w-4 mr-2" />
                  )}
                  {botStatus ? "Desligar bot" : "Ligar bot"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setBotHistoricoOpen(true)}
                >
                  <History className="h-4 w-4 mr-2" /> Histórico do bot
                </Button>
              </div>
            )}
          </ScrollArea>

          {/* Rodapé fixo: ações rápidas */}
          <div className="shrink-0 border-t border-border p-3 grid grid-cols-2 gap-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            {unreadFlag ? (
              <Button variant="outline" size="sm" onClick={handleMarkRead} className="h-10">
                <Bell className="h-4 w-4 mr-2" /> Marcar lida
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleMarkUnread} className="h-10">
                <BellOff className="h-4 w-4 mr-2" /> Marcar não lida
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleOpenFicha} className="h-10">
              <ExternalLink className="h-4 w-4 mr-2" /> Abrir ficha
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyTel} className="h-10">
              <Copy className="h-4 w-4 mr-2" /> Copiar tel
            </Button>
            {isOutroOperador && cliente.status_conversa === "aberta" ? (
              <Button variant="outline" size="sm" onClick={handleTakeover} className="h-10">
                <ArrowRightLeft className="h-4 w-4 mr-2" /> Takeover
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setBotHistoricoOpen(true)} className="h-10">
                <History className="h-4 w-4 mr-2" /> Hist. bot
              </Button>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <BotHistoricoDialog
        open={botHistoricoOpen}
        onOpenChange={setBotHistoricoOpen}
        telefoneCliente={cliente.telefone}
        nomeCliente={cliente.nome || cliente.telefone}
      />

      <AlertDialog open={confirmLigarBotOpen} onOpenChange={setConfirmLigarBotOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Ligar bot manualmente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Para confirmar, digite <b>LIGAR</b> abaixo. Esta ação será registrada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="LIGAR"
            className="my-2"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLigarBot}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="border-b border-border/60 pb-2">
      <div className="text-[11px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="text-foreground mt-0.5 break-words">{String(value)}</div>
    </div>
  );
}
