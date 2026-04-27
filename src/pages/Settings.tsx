import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Copy, ExternalLink } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { UserManagement } from "@/components/UserManagement";
import { PasswordChange } from "@/components/PasswordChange";
import { AccountInfo } from "@/components/AccountInfo";
import { PrestadorManagement } from "@/components/PrestadorManagement";
import { MensagensPadronizadas } from "@/components/MensagensPadronizadas";
import { TemplateManagement } from "@/components/TemplateManagement";
import { FerramentasManutencao } from "@/components/FerramentasManutencao";
import { DailyGoalsManager } from "@/components/DailyGoalsManager";
import { StatusAlertSettings } from "@/components/StatusAlertSettings";
import { getSameTabPreference, setSameTabPreference } from "@/hooks/useOpenInNewTab";
import { PageLayout } from "@/components/PageLayout";
import { SystemLogsViewer } from "@/components/SystemLogsViewer";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isAdminTI, loading } = useAuth();
  const [sameTab, setSameTabLocal] = useState(getSameTabPreference);
  const canToggle = isAdminTI;
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookCriarFicha, setWebhookCriarFicha] = useState("");
  const [webhookOrcamento, setWebhookOrcamento] = useState("");

  useEffect(() => {
    fetchConfiguracoes();
  }, []);

  const fetchConfiguracoes = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", [
        "twilio_account_sid",
        "twilio_auth_token",
        "twilio_phone_number",
        "webhook_criar_ficha",
        "webhook_ficha_atualizada",
        "webhook_orcamento"
      ]);

    if (data) {
      data.forEach((config) => {
        switch (config.chave) {
          case "twilio_account_sid":
            setTwilioAccountSid(config.valor || "");
            break;
          case "twilio_auth_token":
            setTwilioAuthToken(config.valor || "");
            break;
          case "twilio_phone_number":
            setTwilioPhoneNumber(config.valor || "");
            break;
          case "webhook_criar_ficha":
            setWebhookCriarFicha(config.valor || "");
            break;
          case "webhook_ficha_atualizada":
            setWebhookUrl(config.valor || "");
            break;
          case "webhook_orcamento":
            setWebhookOrcamento(config.valor || "");
            break;
        }
      });
    }
  };

  const handleSaveSettings = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const configs = [
      { chave: "twilio_account_sid", valor: twilioAccountSid, descricao: "Twilio Account SID" },
      { chave: "twilio_auth_token", valor: twilioAuthToken, descricao: "Twilio Auth Token" },
      { chave: "twilio_phone_number", valor: twilioPhoneNumber, descricao: "Twilio Phone Number" }
    ];

    const { error } = await supabase
      .from("configuracoes")
      .upsert(configs, { onConflict: "chave" });

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações da API Twilio",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Configurações salvas",
      description: "As credenciais da Twilio foram salvas com sucesso.",
    });
  };

  const handleSaveWebhook = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase
      .from("configuracoes")
      .upsert({
        chave: "webhook_ficha_atualizada",
        valor: webhookUrl,
        descricao: "Webhook de atualização de ficha"
      }, { onConflict: "chave" });

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar webhook",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Webhook salvo",
      description: "O webhook foi configurado com sucesso.",
    });
  };

  const handleSaveWebhookCriarFicha = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase
      .from("configuracoes")
      .upsert({
        chave: "webhook_criar_ficha",
        valor: webhookCriarFicha,
        descricao: "Webhook de criação de ficha"
      }, { onConflict: "chave" });

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar webhook de criação de fichas",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Webhook salvo",
        description: "O webhook de criação de fichas foi configurado com sucesso.",
      });
    }
  };

  const handleSaveWebhookOrcamento = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase
      .from("configuracoes")
      .upsert({
        chave: "webhook_orcamento",
        valor: webhookOrcamento,
        descricao: "Webhook de envio de orçamento"
      }, { onConflict: "chave" });

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar webhook de orçamento",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Webhook salvo",
        description: "O webhook de orçamento foi configurado com sucesso.",
      });
    }
  };

  const copiarLinkOrcamento = (fichaId: string) => {
    const link = `https://chat.24help.com.br/orcamento/${encodeURIComponent(fichaId)}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "O link do formulário de orçamento foi copiado.",
    });
  };

  return (
    <PageLayout>
      <header className="border-b border-border bg-card px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as configurações do sistema
          </p>
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
              <TabsTrigger value="prestadores">Prestadores</TabsTrigger>
              <TabsTrigger value="mensagens">Mensagens Padronizadas</TabsTrigger>
              <TabsTrigger value="templates">Templates WhatsApp</TabsTrigger>
              <TabsTrigger value="twilio">Twilio API</TabsTrigger>
              <TabsTrigger value="geral">Geral</TabsTrigger>
              {isAdmin && <TabsTrigger value="alertas">Alertas de Status</TabsTrigger>}
              {isAdmin && <TabsTrigger value="metas">Metas Diárias</TabsTrigger>}
              {isAdmin && <TabsTrigger value="ferramentas">Ferramentas</TabsTrigger>}
              {isAdmin && <TabsTrigger value="logs">Logs do Sistema</TabsTrigger>}
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

            <TabsContent value="prestadores" className="space-y-4">
              <PrestadorManagement />
            </TabsContent>

            <TabsContent value="mensagens" className="space-y-4">
              <MensagensPadronizadas />
            </TabsContent>

            <TabsContent value="templates" className="space-y-4">
              <TemplateManagement />
            </TabsContent>

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
                  <Label htmlFor="webhook_criar_ficha">Webhook de Criação de Ficha</Label>
                  <div className="flex gap-2">
                    <Input
                      id="webhook_criar_ficha"
                      placeholder="https://seu-endpoint.com/webhook/criar-ficha"
                      value={webhookCriarFicha}
                      onChange={(e) => setWebhookCriarFicha(e.target.value)}
                    />
                    <Button onClick={handleSaveWebhookCriarFicha}>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enviaremos um POST para este endpoint ao criar uma nova ficha via interface
                  </p>
                </div>

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

                <div className="space-y-2">
                  <Label htmlFor="webhook_orcamento">Webhook de Orçamento (Make/Zapier)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="webhook_orcamento"
                      placeholder="https://hook.integromat.com/..."
                      value={webhookOrcamento}
                      onChange={(e) => setWebhookOrcamento(e.target.value)}
                    />
                    <Button onClick={handleSaveWebhookOrcamento}>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Webhook do Make para receber orçamentos enviados pelos prestadores
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Links de Orçamento para Prestadores</CardTitle>
                <CardDescription>
                  Gere links exclusivos para cada ficha e envie aos prestadores
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="ficha_id">ID da Ficha</Label>
                  <div className="flex gap-2">
                    <Input
                      id="ficha_id"
                      placeholder="Ex: FGM1@251124"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.currentTarget as HTMLInputElement;
                          if (input.value.trim()) {
                            copiarLinkOrcamento(input.value.trim());
                          }
                        }
                      }}
                    />
                    <Button
                      onClick={(e) => {
                        const input = document.getElementById('ficha_id') as HTMLInputElement;
                        if (input?.value.trim()) {
                          copiarLinkOrcamento(input.value.trim());
                        }
                      }}
                      variant="outline"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar Link
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Digite o ID da ficha e clique em "Copiar Link" para gerar o link único
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs font-mono break-all text-muted-foreground">
                    https://chat.24help.com.br/orcamento/[ID_DA_FICHA]
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
              <CardContent className="space-y-4">
                {canToggle && (
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Abrir módulos na mesma aba</Label>
                      <p className="text-xs text-muted-foreground">
                        Por padrão, os módulos abrem em nova aba. Ative para navegar na mesma janela.
                      </p>
                    </div>
                    <Switch
                      checked={sameTab}
                      onCheckedChange={(v) => { setSameTabLocal(v); setSameTabPreference(v); }}
                    />
                  </div>
                )}
                {!canToggle && (
                  <p className="text-sm text-muted-foreground">
                    Configurações adicionais serão adicionadas aqui.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="alertas" className="space-y-4">
              <StatusAlertSettings />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="metas" className="space-y-4">
              <DailyGoalsManager />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="ferramentas" className="space-y-4">
              <FerramentasManutencao />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="logs" className="space-y-4">
              <SystemLogsViewer />
            </TabsContent>
          )}
          </Tabs>
        )}
      </main>
    </PageLayout>
  );
};

export default Settings;
