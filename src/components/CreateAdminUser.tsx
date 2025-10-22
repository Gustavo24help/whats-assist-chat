import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle } from "lucide-react";

export const CreateAdminUser = () => {
  const [created, setCreated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userExists, setUserExists] = useState(false);

  const createOrUpdateAdmin = async () => {
    setLoading(true);
    try {
      // Tentar criar o usuário
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create',
          email: 'leonardo@24help.com.br',
          password: 'Leo@2025',
          fullName: 'Leonardo Karam',
          role: 'admin'
        }
      });

      if (error) {
        // Se o erro for "email já existe", buscar o usuário e adicionar role
        if (error.message?.includes('email address has already been registered') || 
            error.message?.includes('email_exists')) {
          console.log('Usuário já existe, adicionando role de admin...');
          
          // Buscar o user_id do usuário existente
          const { data: { user } } = await supabase.auth.signInWithPassword({
            email: 'leonardo@24help.com.br',
            password: 'Leo@2025'
          });

          if (user) {
            // Adicionar role de admin usando update_role
            const { data: roleData, error: roleError } = await supabase.functions.invoke('manage-users', {
              body: {
                action: 'update_role',
                userId: user.id,
                role: 'admin'
              }
            });

            if (roleError) throw roleError;

            // Fazer logout do usuário temporário
            await supabase.auth.signOut();

            toast.success('Role de administrador adicionada com sucesso!');
            setUserExists(true);
            setCreated(true);
            return;
          }
        }
        throw error;
      }

      if (data?.success) {
        toast.success('Usuário administrador criado com sucesso!');
        setCreated(true);
      } else {
        throw new Error(data?.error || 'Erro ao criar usuário');
      }
    } catch (error: any) {
      console.error('Erro ao criar/atualizar admin:', error);
      toast.error(error.message || 'Erro ao processar usuário administrador');
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return (
      <Card className="border-green-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            {userExists ? 'Role de Admin Adicionada!' : 'Administrador Criado!'}
          </CardTitle>
          <CardDescription>
            Leonardo Karam agora tem permissões de administrador
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Email:</strong> leonardo@24help.com.br</p>
            <p><strong>Senha:</strong> Leo@2025</p>
            <p><strong>Role:</strong> Administrador</p>
            <p className="text-muted-foreground mt-4">
              ✅ Você pode fazer login com essas credenciais.
            </p>
            <p className="text-muted-foreground">
              ⚠️ Depois de confirmar que está funcionando, remova o componente CreateAdminUser de src/pages/Auth.tsx
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Configurar Administrador
        </CardTitle>
        <CardDescription>
          Garantir que Leonardo Karam tenha permissões de administrador
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <p><strong>Nome:</strong> Leonardo Karam</p>
            <p><strong>Email:</strong> leonardo@24help.com.br</p>
            <p><strong>Permissão:</strong> Administrador</p>
            <p className="text-xs text-muted-foreground mt-2">
              * Se o usuário já existir, apenas a role será atualizada
            </p>
          </div>
          <Button 
            onClick={createOrUpdateAdmin} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Processando...' : 'Configurar Administrador'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
