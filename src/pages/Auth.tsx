import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  // Redirecionar se já estiver logado
  useEffect(() => {
    if (user) {
      console.log('✅ Auth - Usuário já logado, redirecionando');
      navigate("/");
    }
  }, [user, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('🔐 Auth - Iniciando login para:', email);
      console.log('🔐 Auth - Lembrar login:', rememberMe);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      console.log('✅ Auth - Login bem-sucedido:', {
        userId: data.user?.id,
        userEmail: data.user?.email
      });

      // Buscar role DIRETAMENTE DO BANCO - FONTE DE VERDADE
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user?.id)
        .maybeSingle();

      console.log('📊 Auth - Role carregado do banco:', {
        userId: data.user?.id,
        roleRaw: roleData?.role,
        roleType: typeof roleData?.role,
        roleNormalized: roleData?.role?.toLowerCase(),
        error: roleError
      });

      const normalizedRole = roleData?.role?.toLowerCase();
      const isUserAdmin = normalizedRole === 'admin';

      console.log('✅ Auth - Análise final do role:', {
        roleOriginal: roleData?.role,
        roleNormalized: normalizedRole,
        isAdmin: isUserAdmin
      });

      // Mensagem personalizada
      if (isUserAdmin) {
        toast.success(`Bem-vindo, Administrador!`);
      } else {
        toast.success("Login realizado com sucesso!");
      }

      // AuthContext vai recarregar automaticamente o perfil
      navigate("/");
    } catch (error: any) {
      console.error('❌ Auth - Erro no login:', error);
      toast.error(error.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="w-full max-w-md">
        <Card className="w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Central de Atendimento</CardTitle>
            <CardDescription>
              Faça login para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <label
                  htmlFor="remember"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Lembrar usuário
                </label>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Carregando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
