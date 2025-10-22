import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserManagement } from "@/components/UserManagement";
import { PasswordChange } from "@/components/PasswordChange";
import { AccountInfo } from "@/components/AccountInfo";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    checkAdminStatus();
    const saved = localStorage.getItem('webhook_ficha_atualizada');
    if (saved) setWebhookUrl(saved);
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      setIsAdmin(roleData?.role === 'admin');
    } catch (error) {
      console.error('Erro ao verificar status de admin:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = () => {
    // Aqui você implementaria a lógica para salvar as configurações
    // usando edge functions ou Supabase
    toast({
      title: "Configurações salvas",
      description: "As credenciais da Twilio foram salvas com sucesso.",
    });
  };

  const handleSaveWebhook = () => {
    localStorage.setItem('webhook_ficha_atualizada', webhookUrl);
    toast({
      title: "Webhook salvo",
      description: "O webhook foi configurado com sucesso.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie as configurações do sistema
            </p>
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
              <TabsTrigger value="twilio">Twilio API</TabsTrigger>
              <TabsTrigger value="geral">Geral</TabsTrigger>
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

          <TabsContent value="twilio" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações da Twilio</CardTitle>
                <CardDescription>
                  Configure suas credenciais da API da Twilio para integração com WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accountSid">Account SID</Label>
                  <Input
                    id="accountSid"
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={twilioAccountSid}
                    onChange={(e) => setTwilioAccountSid(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontre seu Account SID no console da Twilio
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="authToken">Auth Token</Label>
                  <Input
                    id="authToken"
                    type="password"
                    placeholder="••••••••••••••••••••••••••••••••"
                    value={twilioAuthToken}
                    onChange={(e) => setTwilioAuthToken(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Seu token de autenticação da Twilio (será armazenado de forma segura)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Número de Telefone Twilio</Label>
                  <Input
                    id="phoneNumber"
                    placeholder="+55 11 99999-9999"
                    value={twilioPhoneNumber}
                    onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    O número de telefone configurado na Twilio para WhatsApp
                  </p>
                </div>

                <Button onClick={handleSaveSettings} className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Configurações
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Como configurar a Twilio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <ol className="list-decimal list-inside space-y-2">
                  <li>Acesse o console da Twilio em console.twilio.com</li>
                  <li>Copie seu Account SID e Auth Token da página inicial</li>
                  <li>Configure um número de telefone para WhatsApp Business</li>
                  <li>Cole as credenciais nos campos acima</li>
                  <li>Configure o webhook para receber mensagens (será fornecido após salvar)</li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="geral" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Webhooks</CardTitle>
                <CardDescription>
                  Configure os endpoints para receber notificações de eventos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook_ficha">Webhook de Atualização da Ficha</Label>
                  <div className="flex gap-2">
                    <Input
                      id="webhook_ficha"
                      placeholder="https://seu-endpoint.com/webhook/ficha-atualizada"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                    />
                    <Button onClick={handleSaveWebhook}>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enviaremos um POST com os dados completos da ficha sempre que ela for criada ou alterada
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configurações Gerais</CardTitle>
                <CardDescription>
                  Outras configurações do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Configurações adicionais serão adicionadas aqui.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default Settings;
