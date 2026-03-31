import { useNavigate } from "react-router-dom";

import { AccountInfo } from "@/components/AccountInfo";
import { PasswordChange } from "@/components/PasswordChange";
import { UserManagement } from "@/components/UserManagement";
import { FerramentasManutencao } from "@/components/FerramentasManutencao";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLayout } from "@/components/PageLayout";

const Manutencao = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();

  return (
    <PageLayout>
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manutenção</h1>
            <p className="text-sm text-muted-foreground">Gerencie conta, usuários e ferramentas administrativas.</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6">
        {loading ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Carregando...</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="account" className="w-full">
            <TabsList>
              <TabsTrigger value="account">Minha Conta</TabsTrigger>
              {isAdmin && <TabsTrigger value="users">Gerenciar Usuários</TabsTrigger>}
              {isAdmin && <TabsTrigger value="tools">Ferramentas</TabsTrigger>}
            </TabsList>

            <TabsContent value="account" className="space-y-4">
              <AccountInfo />
              <PasswordChange />
            </TabsContent>

            {isAdmin && (
              <TabsContent value="users" className="space-y-4">
                <UserManagement />
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="tools" className="space-y-4">
                <FerramentasManutencao />
              </TabsContent>
            )}
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default Manutencao;
