import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DelegacaoFormDialog } from "./DelegacaoFormDialog";
import { useNavigate } from "react-router-dom";

interface TarefaOp {
  id: string;
  titulo: string;
  descricao: string | null;
  urgencia: string;
  status: string;
  prazo: string | null;
  ficha_id: string | null;
  cliente_telefone: string | null;
  criado_por: string | null;
  criador_nome?: string;
  atribuidos_nomes?: string[];
  created_at: string;
  resolvido_em: string | null;
  resolvido_nota: string | null;
}

const urgenciaColors: Record<string, string> = {
  baixa: "bg-gray-100 text-gray-700",
  media: "bg-blue-100 text-blue-700",
  alta: "bg-orange-100 text-orange-700",
  critica: "bg-red-100 text-red-700",
};

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800",
  em_andamento: "bg-blue-100 text-blue-800",
  resolvido: "bg-green-100 text-green-800",
};

export const DelegacaoTab = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tarefas, setTarefas] = useState<TarefaOp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"pendente" | "em_andamento" | "resolvido" | "all">("pendente");

  const loadTarefas = async () => {
    if (!user) return;
    setLoading(true);

    // First get task IDs assigned to this user
    const { data: myAssignments } = await (supabase as any)
      .from("tarefas_operacionais_atribuidos")
      .select("tarefa_id")
      .eq("user_id", user.id);

    const myTaskIds = (myAssignments || []).map((a: any) => a.tarefa_id);

    if (myTaskIds.length === 0) {
      setTarefas([]);
      setLoading(false);
      return;
    }

    const { data, error } = await (supabase as any)
      .from("tarefas_operacionais")
      .select("*")
      .in("id", myTaskIds)
      .order("created_at", { ascending: false });

    if (error || !data) {
      setLoading(false);
      return;
    }

    // Get creator names
    const criadorIds = [...new Set(data.filter((t: any) => t.criado_por).map((t: any) => t.criado_por))];
    const profileMap: Record<string, string> = {};
    if (criadorIds.length > 0) {
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, full_name")
        .in("id", criadorIds);
      profiles?.forEach((p: any) => { profileMap[p.id] = p.full_name || "Usuário"; });
    }

    // Get atribuidos for these tasks
    const tarefaIds = data.map((t: any) => t.id);
    const { data: atribuidos } = await (supabase as any)
      .from("tarefas_operacionais_atribuidos")
      .select("tarefa_id, user_id")
      .in("tarefa_id", tarefaIds);

    const atribUserIds = [...new Set((atribuidos || []).map((a: any) => a.user_id))];
    if (atribUserIds.length > 0) {
      const { data: atribProfiles } = await (supabase as any)
        .from("profiles")
        .select("id, full_name")
        .in("id", atribUserIds);
      atribProfiles?.forEach((p: any) => { profileMap[p.id] = p.full_name || "Usuário"; });
    }

    const atribByTarefa: Record<string, string[]> = {};
    (atribuidos || []).forEach((a: any) => {
      if (!atribByTarefa[a.tarefa_id]) atribByTarefa[a.tarefa_id] = [];
      atribByTarefa[a.tarefa_id].push(profileMap[a.user_id] || "Usuário");
    });

    // Para tarefas com ficha mas sem telefone, buscar da ficha
    const tarefasSemTelefone = data.filter((t: any) => t.ficha_id && !t.cliente_telefone);
    const fichaIdsSemTel = tarefasSemTelefone.map((t: any) => t.ficha_id);
    const fichasTelMap: Record<string, string> = {};
    if (fichaIdsSemTel.length > 0) {
      const { data: fichasData } = await (supabase as any)
        .from("fichas_de_servico")
        .select("id, telefone_cliente")
        .in("id", fichaIdsSemTel);
      fichasData?.forEach((f: any) => { fichasTelMap[f.id] = f.telefone_cliente; });
    }

    setTarefas(data.map((t: any) => ({
      ...t,
      criador_nome: profileMap[t.criado_por] || "—",
      atribuidos_nomes: atribByTarefa[t.id] || [],
      cliente_telefone: t.cliente_telefone || fichasTelMap[t.ficha_id] || null,
    })));

    setLoading(false);
  };

  useEffect(() => {
    loadTarefas();

    const channel = supabase
      .channel("tarefas-op-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas_operacionais" }, () => {
        loadTarefas();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const markResolved = async (tarefa: TarefaOp) => {
    const nota = prompt("Nota de resolução (opcional):");
    
    const { error } = await (supabase as any)
      .from("tarefas_operacionais")
      .update({
        status: "resolvido",
        resolvido_em: new Date().toISOString(),
        resolvido_nota: nota || null,
      })
      .eq("id", tarefa.id);

    if (error) {
      toast.error("Erro ao marcar como resolvido");
    } else {
      toast.success("Tarefa resolvida!");
      loadTarefas();
    }
  };

  const markInProgress = async (tarefaId: string) => {
    await (supabase as any)
      .from("tarefas_operacionais")
      .update({ status: "em_andamento" })
      .eq("id", tarefaId);
    loadTarefas();
  };

  const filtered = statusFilter === "all"
    ? tarefas
    : tarefas.filter(t => t.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(["pendente", "em_andamento", "resolvido", "all"] as const).map(s => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "Todas" : s === "pendente" ? "Pendentes" : s === "em_andamento" ? "Em andamento" : "Resolvidas"}
            </Button>
          ))}
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-1">
          <Plus className="h-4 w-4" />
          Nova Tarefa
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="space-y-2">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma tarefa</p>
          ) : (
            filtered.map(t => (
              <div key={t.id} className="p-4 rounded-lg border bg-background space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{t.titulo}</span>
                      {(t as any).tipo === "atribuicao_chat" && (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-[10px]">
                          Chat
                        </Badge>
                      )}
                      <Badge variant="secondary" className={urgenciaColors[t.urgencia] || ""}>
                        {t.urgencia}
                      </Badge>
                      <Badge variant="secondary" className={statusColors[t.status] || ""}>
                        {t.status === "em_andamento" ? "Em andamento" : t.status}
                      </Badge>
                    </div>
                    {t.descricao && (
                      <DescricaoColapsavel texto={t.descricao} />
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Por: {t.criador_nome}</span>
                      {t.atribuidos_nomes && t.atribuidos_nomes.length > 0 && (
                        <span>Para: {t.atribuidos_nomes.join(", ")}</span>
                      )}
                      {t.prazo && (
                        <span>Prazo: {format(new Date(t.prazo), "dd/MM HH:mm")}</span>
                      )}
                      {t.ficha_id && (
                        <span>Ficha: {t.ficha_id}</span>
                      )}
                    </div>
                    {t.resolvido_nota && (
                      <p className="text-xs text-green-700 mt-1">✅ {t.resolvido_nota}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {t.cliente_telefone && (
                      <Button variant="outline" size="sm" onClick={() => navigate(`/chat?telefone=${encodeURIComponent(t.cliente_telefone!)}`)} className="gap-1">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {t.status === "pendente" && (
                      <Button variant="outline" size="sm" onClick={() => markInProgress(t.id)}>
                        Iniciar
                      </Button>
                    )}
                    {t.status !== "resolvido" && (
                      <Button variant="default" size="sm" onClick={() => markResolved(t)} className="gap-1">
                        <Check className="h-3.5 w-3.5" />
                        Resolver
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <DelegacaoFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onCreated={loadTarefas}
      />
    </div>
  );
};
