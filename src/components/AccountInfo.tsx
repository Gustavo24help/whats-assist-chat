import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const AccountInfo = () => {
  const [userInfo, setUserInfo] = useState<{
    email: string;
    fullName: string;
    role: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Buscar perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      // Buscar role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      setUserInfo({
        email: user.email || '',
        fullName: profile?.full_name || 'Sem nome',
        role: roleData?.role || 'user'
      });
    } catch (error) {
      console.error('Erro ao carregar informações do usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Minha Conta
        </CardTitle>
        <CardDescription>
          Informações da sua conta no sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Nome</p>
          <p className="text-base">{userInfo?.fullName}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Email</p>
          <p className="text-base">{userInfo?.email}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Tipo de Usuário</p>
          <Badge variant={userInfo?.role === 'admin' ? 'default' : 'secondary'}>
            {userInfo?.role === 'admin' ? 'Administrador' : 'Usuário Comum'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
