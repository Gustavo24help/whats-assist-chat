import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

export const AccountInfo = () => {
  const { userProfile, loading } = useAuth();

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
          <p className="text-base">{userProfile?.fullName}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Email</p>
          <p className="text-base">{userProfile?.email}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Tipo de Usuário</p>
          <Badge variant={userProfile?.role === 'admin' ? 'default' : 'secondary'}>
            {userProfile?.role === 'admin' ? 'Administrador' : 'Usuário Comum'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
