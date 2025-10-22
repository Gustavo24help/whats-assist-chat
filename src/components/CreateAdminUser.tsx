import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle } from "lucide-react";

export const CreateAdminUser = () => {
  const [created, setCreated] = useState(false);
  const [loading, setLoading] = useState(false);

  const createAdmin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create',
          email: 'leonardo@24help.com.br',
          password: 'Leo@2025',
          fullName: 'Leonardo Karam',
          role: 'admin'
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Usuário administrador criado com sucesso!');
        setCreated(true);
      } else {
        throw new Error(data?.error || 'Erro ao criar usuário');
      }
    } catch (error: any) {
      console.error('Erro ao criar admin:', error);
      toast.error(error.message || 'Erro ao criar usuário administrador');
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
            Administrador Criado!
          </CardTitle>
          <CardDescription>
            Leonardo Karam foi criado com sucesso como administrador
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Email:</strong> leonardo@24help.com.br</p>
            <p><strong>Senha:</strong> Leo@2025</p>
            <p><strong>Role:</strong> Administrador</p>
            <p className="text-muted-foreground mt-4">
              Você pode fazer login com essas credenciais e depois remover este componente do código.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Criar Usuário Administrador
        </CardTitle>
        <CardDescription>
          Criar Leonardo Karam como administrador do sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <p><strong>Nome:</strong> Leonardo Karam</p>
            <p><strong>Email:</strong> leonardo@24help.com.br</p>
            <p><strong>Senha:</strong> Leo@2025</p>
            <p><strong>Permissão:</strong> Administrador</p>
          </div>
          <Button 
            onClick={createAdmin} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Criando...' : 'Criar Administrador'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
