import { useState, useEffect } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, ListTodo } from "lucide-react";
import { ConversasResolver } from "@/components/tarefas-op/ConversasResolver";
import { DelegacaoTab } from "@/components/tarefas-op/DelegacaoTab";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const TarefasOperacionais = () => {
  const [activeTab, setActiveTab] = useState("conversas");
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const checkPending = async () => {
      const { data: assignments } = await (supabase as any)
        .from("tarefas_operacionais_atribuidos")
        .select("tarefa_id")
        .eq("user_id", user.id);

      const taskIds = (assignments || []).map((a: any) => a.tarefa_id);
      if (taskIds.length === 0) { setPendingCount(0); return; }

      const { data: tasks } = await (supabase as any)
        .from("tarefas_operacionais")
        .select("id, status, tipo, criado_por")
        .in("id", taskIds)
        .neq("status", "resolvido");

      // Filter out auto-generated system tasks
      const manual = (tasks || []).filter((t: any) =>
        !(t.tipo === "atribuicao_chat" && t.criado_por === user.id)
      );
      setPendingCount(manual.length);
    };

    checkPending();

    const channel = supabase
      .channel("delegacao-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas_operacionais" }, () => checkPending())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return (
    <PageLayout>
      <div className="p-4 md:p-6 space-y-4">
        <h1 className="text-2xl font-bold">Tarefas Operacionais</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="conversas" className="gap-1.5">
              <MessageSquare className="h-4 w-4" />
              Conversas a Resolver
            </TabsTrigger>
            <TabsTrigger
              value="delegacao"
              className={cn(
                "gap-1.5",
                pendingCount > 0 && "bg-orange-500 text-white data-[state=active]:bg-orange-600 data-[state=active]:text-white"
              )}
            >
              <ListTodo className="h-4 w-4" />
              Delegação
              {pendingCount > 0 && (
                <span className="ml-1 text-xs font-bold bg-white text-orange-600 rounded-full px-1.5 py-0.5 leading-none">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversas">
            <ConversasResolver />
          </TabsContent>

          <TabsContent value="delegacao">
            <DelegacaoTab />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
};

export default TarefasOperacionais;
