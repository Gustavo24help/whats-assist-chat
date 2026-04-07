import { useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, ListTodo } from "lucide-react";
import { ConversasResolver } from "@/components/tarefas-op/ConversasResolver";
import { DelegacaoTab } from "@/components/tarefas-op/DelegacaoTab";

const TarefasOperacionais = () => {
  const [activeTab, setActiveTab] = useState("conversas");

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
            <TabsTrigger value="delegacao" className="gap-1.5">
              <ListTodo className="h-4 w-4" />
              Delegação
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
