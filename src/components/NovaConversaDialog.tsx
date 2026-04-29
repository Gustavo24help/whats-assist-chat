import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, Edit, Phone, User, ArrowRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  applyTemplateVariables,
  formatTemplatePlaceholder,
  getDefaultTemplateField,
  getTemplateVariableLabel,
  normalizeTemplateVariables,
} from "@/lib/whatsappTemplateVariables";

interface Template {
  id: string;
  content_sid: string;
  friendly_name: string;
  body: string;
  variables: string[];
  variable_mapping: { index: number; field: string }[];
}

interface NovaConversaDialogProps {
  onContactCreated?: (cliente: { telefone: string; nome: string }) => void;
}

export const NovaConversaDialog = ({ onContactCreated }: NovaConversaDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"number" | "template">("number");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variableValues, setVariableValues] = useState<Record<number, string>>({});
  const [createdClient, setCreatedClient] = useState<{ telefone: string; nome: string } | null>(null);

  useEffect(() => {
    if (open && step === "template") {
      fetchTemplates();
    }
  }, [open, step]);

  useEffect(() => {
    if (!open) {
      setStep("number");
      setPhoneNumber("");
      setContactName("");
      setSelectedTemplate(null);
      setVariableValues({});
      setCreatedClient(null);
    }
  }, [open]);

  const formatPhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, "");

    if (!cleaned.startsWith("55") && cleaned.length <= 11) {
      cleaned = "55" + cleaned;
    }

    return `whatsapp:+${cleaned}`;
  };

  const getFieldValue = (field: string): string => {
    const [entity, property] = field.split(".");

    if (entity !== "cliente") return "";

    if (property === "nome") {
      return createdClient?.nome || contactName || "";
    }

    if (property === "telefone") {
      return createdClient?.telefone || (phoneNumber ? formatPhoneNumber(phoneNumber) : "");
    }

    return "";
  };

  const handleCreateContact = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Digite um número de telefone");
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const name = contactName.trim() || phoneNumber;

      const { data: existingClient } = await supabase
        .from("clientes")
        .select("telefone, nome")
        .eq("telefone", formattedPhone)
        .single();

      if (existingClient) {
        toast.info("Este contato já existe", {
          description: `${existingClient.nome} (${existingClient.telefone.replace("whatsapp:+", "")})`,
        });
        setCreatedClient(existingClient);
        setStep("template");
        return;
      }

      const { data: newClient, error } = await supabase
        .from("clientes")
        .insert({
          telefone: formattedPhone,
          nome: name,
          status_conversa: "aberta",
          ultima_interacao: new Date().toISOString(),
          tags: [],
          bot_habilitado: false,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Contato criado com sucesso!");
      setCreatedClient({ telefone: newClient.telefone, nome: newClient.nome });
      setStep("template");

      if (onContactCreated) {
        onContactCreated({ telefone: newClient.telefone, nome: newClient.nome });
      }
    } catch (error) {
      console.error("Erro ao criar contato:", error);
      toast.error("Erro ao criar contato");
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("friendly_name", { ascending: true });

      if (error) throw error;

      const mappedTemplates = (data || []).map((template) => ({
        ...template,
        variables: normalizeTemplateVariables(
          Array.isArray(template.variables) ? (template.variables as string[]) : [],
          template.body,
        ),
        variable_mapping: Array.isArray(template.variable_mapping)
          ? (template.variable_mapping as Array<{ index: number; field: string }>)
          : [],
      }));

      setTemplates(mappedTemplates);
    } catch (error) {
      console.error("Erro ao buscar templates:", error);
      toast.error("Erro ao buscar templates");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);

    const initialValues: Record<number, string> = {};
    template.variables.forEach((variableToken, index) => {
      const mapping = template.variable_mapping.find((item) => item.index === index);
      const defaultField = mapping?.field || getDefaultTemplateField(variableToken, index);
      initialValues[index] = defaultField ? getFieldValue(defaultField) : "";
    });

    setVariableValues(initialValues);
  };

  const handleVariableChange = (index: number, value: string) => {
    setVariableValues((prev) => ({
      ...prev,
      [index]: value,
    }));
  };

  const handleSendTemplate = async () => {
    if (!selectedTemplate || !createdClient) return;

    if (selectedTemplate.variables.length > 0) {
      const allFilled = selectedTemplate.variables.every((_, index) => variableValues[index]?.trim());
      if (!allFilled) {
        toast.error("Preencha todas as variáveis antes de enviar");
        return;
      }
    }

    setSending(true);
    try {
      const contentVariables: Record<string, string> = {};
      selectedTemplate.variables.forEach((variable, index) => {
        const key = variable.startsWith('var_') ? variable.replace('var_', '') : variable;
        contentVariables[key] = variableValues[index];
      });

      const templateBody = getTemplatePreview(selectedTemplate);

      const { data, error } = await supabase.functions.invoke("send-template", {
        body: {
          to: createdClient.telefone,
          contentSid: selectedTemplate.content_sid,
          contentVariables,
          templateBody,
        },
      });

      if (error) {
        throw new Error(`Erro ao conectar com o servidor: ${error.message}`);
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Erro ao enviar template");
      }

      toast.success("✅ Template enviado com sucesso!", {
        description: `Enviado para ${createdClient.nome}`,
      });
      setOpen(false);
    } catch (error) {
      console.error("❌ Erro ao enviar template:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao enviar template");
    } finally {
      setSending(false);
    }
  };

  const getTemplatePreview = (template: Template) => {
    if (!template.body || template.body.trim() === "") {
      if (template.variables.length > 0) {
        const varsText = template.variables
          .map((variable, index) => variableValues[index] || formatTemplatePlaceholder(variable))
          .join(" | ");
        return `Template: ${template.friendly_name} - ${varsText}`;
      }
      return `Template: ${template.friendly_name}`;
    }

    return applyTemplateVariables(template.body, template.variables, variableValues);
  };

  const handleSkipTemplate = () => {
    toast.success("Contato adicionado!", {
      description: "Você pode enviar um template depois quando quiser iniciar a conversa.",
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="shadow-sm gap-1.5">
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Nova</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{step === "number" ? "Adicionar Novo Contato" : "Enviar Template"}</DialogTitle>
          <DialogDescription>
            {step === "number"
              ? "Digite o número de telefone do novo contato para iniciar uma conversa via WhatsApp"
              : `Selecione um template para enviar para ${createdClient?.nome}`}
          </DialogDescription>
        </DialogHeader>

        {step === "number" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Número de Telefone *
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Ex: 11999998888 ou +5511999998888"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Digite apenas números. O código do país (55) será adicionado automaticamente se necessário.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Nome do Contato (opcional)
              </Label>
              <Input
                id="name"
                placeholder="Ex: João Silva"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>

            <Button className="w-full" onClick={handleCreateContact} disabled={loading || !phoneNumber.trim()}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}

        {step === "template" && (
          <div className="space-y-4">
            {createdClient && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                <Check className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">{createdClient.nome}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {createdClient.telefone.replace("whatsapp:+", "+")}
                  </p>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando templates...</span>
              </div>
            )}

            {!loading && templates.length > 0 && !selectedTemplate && (
              <ScrollArea className="h-[300px] rounded-md border p-4">
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="p-4 rounded-lg border bg-card hover:bg-accent/10 transition-colors cursor-pointer"
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium">{template.friendly_name}</h4>
                          {template.variables.length > 0 && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                              {template.variables.length} {template.variables.length === 1 ? "variável" : "variáveis"}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{template.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {!loading && selectedTemplate && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{selectedTemplate.friendly_name}</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedTemplate(null);
                      setVariableValues({});
                    }}
                  >
                    Voltar
                  </Button>
                </div>

                {selectedTemplate.variables.length > 0 && (
                  <div className="space-y-3 p-4 rounded-lg border bg-card">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Edit className="h-4 w-4" />
                      <span>Preencher Variáveis</span>
                    </div>
                    {selectedTemplate.variables.map((variable, index) => {
                      const variableLabel = getTemplateVariableLabel(variable, index);
                      return (
                        <div key={`${variable}-${index}`} className="space-y-2">
                          <Label htmlFor={`var-${index}`}>{variableLabel}</Label>
                          <Input
                            id={`var-${index}`}
                            value={variableValues[index] || ""}
                            onChange={(e) => handleVariableChange(index, e.target.value)}
                            placeholder={`Digite o valor para ${variableLabel}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="bg-muted/50 rounded-md p-4 border">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Prévia da mensagem:</p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{getTemplatePreview(selectedTemplate)}</p>
                </div>

                <Button className="w-full" onClick={handleSendTemplate} disabled={sending}>
                  {sending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar Template"
                  )}
                </Button>
              </div>
            )}

            {!loading && templates.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum template cadastrado. Adicione templates na aba Configurações.
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={handleSkipTemplate}>
              Pular e adicionar contato apenas
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
