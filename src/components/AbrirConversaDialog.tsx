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
import { MessageSquare, Loader2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Template {
  id: string;
  content_sid: string;
  friendly_name: string;
  body: string;
  variables: string[];
  variable_mapping: { index: number; field: string }[];
}

interface AbrirConversaDialogProps {
  clienteTelefone: string;
  clienteNome: string;
}

export const AbrirConversaDialog = ({ clienteTelefone, clienteNome }: AbrirConversaDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variableValues, setVariableValues] = useState<Record<number, string>>({});
  const [fichaAtiva, setFichaAtiva] = useState<any>(null);

  useEffect(() => {
    if (open) {
      fetchTemplates();
      fetchFichaAtiva();
    }
  }, [open]);

  const fetchFichaAtiva = async () => {
    try {
      // Buscar cliente com ficha ativa
      const { data: clienteData } = await supabase
        .from("clientes")
        .select("ficha_ativa_id")
        .eq("telefone", clienteTelefone)
        .single();

      if (clienteData?.ficha_ativa_id) {
        // Buscar dados da ficha ativa
        const { data: fichaData } = await supabase
          .from("fichas_de_servico")
          .select("*")
          .eq("id", clienteData.ficha_ativa_id)
          .single();

        setFichaAtiva(fichaData);
      }
    } catch (error) {
      console.error("Erro ao buscar ficha ativa:", error);
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

      const mappedTemplates = (data || []).map(t => ({
        ...t,
        variables: Array.isArray(t.variables) ? (t.variables as string[]) : [],
        variable_mapping: Array.isArray(t.variable_mapping)
          ? (t.variable_mapping as Array<{ index: number; field: string }>)
          : []
      }));
      
      setTemplates(mappedTemplates);
      
      // Mover toast para fora do setState para evitar warning
      if (mappedTemplates.length === 0) {
        setTimeout(() => {
          toast.info("Nenhum template cadastrado. Configure templates nas Configurações.");
        }, 0);
      }
    } catch (error) {
      console.error("Erro ao buscar templates:", error);
      setTemplates([]);
      setTimeout(() => {
        toast.error("Erro ao buscar templates");
      }, 0);
    } finally {
      setLoading(false);
    }
  };

  const getFieldValue = (field: string): string => {
    const [entity, property] = field.split('.');
    
    if (entity === 'cliente') {
      if (property === 'nome') return clienteNome;
      if (property === 'telefone') return clienteTelefone;
    }
    
    if (entity === 'ficha' && fichaAtiva) {
      if (property === 'id') return fichaAtiva.id || '';
      if (property === 'nome_ficha') return fichaAtiva.nome_ficha || '';
      if (property === 'descricao') return fichaAtiva.descricao || '';
      if (property === 'categoria') return fichaAtiva.categoria_id?.toString() || '';
      if (property === 'status') return fichaAtiva.status || '';
      if (property === 'endereco') return fichaAtiva.endereco || '';
      if (property === 'cpf') return fichaAtiva.cpf || '';
      if (property === 'horario_agendamento') {
        return fichaAtiva.horario_agendamento 
          ? new Date(fichaAtiva.horario_agendamento).toLocaleString('pt-BR')
          : '';
      }
      if (property === 'prestador_id') return fichaAtiva.prestador_id || '';
    }
    
    return '';
  };

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    // Preencher automaticamente com base no mapeamento
    const initialValues: Record<number, string> = {};
    template.variables.forEach((_, index) => {
      const mapping = template.variable_mapping.find(m => m.index === index);
      if (mapping) {
        initialValues[index] = getFieldValue(mapping.field);
      } else {
        // Fallback: primeira variável = nome do cliente
        initialValues[index] = index === 0 ? clienteNome : '';
      }
    });
    setVariableValues(initialValues);
  };

  const handleVariableChange = (index: number, value: string) => {
    setVariableValues(prev => ({
      ...prev,
      [index]: value
    }));
  };

  const handleSendTemplate = async () => {
    if (!selectedTemplate) return;

    // Validar se todas as variáveis estão preenchidas
    if (selectedTemplate.variables.length > 0) {
      const allFilled = selectedTemplate.variables.every((_, index) => variableValues[index]?.trim());
      if (!allFilled) {
        toast.error("Preencha todas as variáveis antes de enviar");
        return;
      }
    }

    setSending(true);
    try {
      // Garantir formato correto do número
      let phoneNumber = clienteTelefone;
      if (!phoneNumber.startsWith('whatsapp:')) {
        phoneNumber = phoneNumber.startsWith('+') 
          ? `whatsapp:${phoneNumber}` 
          : `whatsapp:+${phoneNumber}`;
      }

      // Preparar variáveis para envio (formato que a Twilio espera)
      const contentVariables: Record<string, string> = {};
      selectedTemplate.variables.forEach((_, index) => {
        contentVariables[(index + 1).toString()] = variableValues[index];
      });

      const { data, error } = await supabase.functions.invoke("send-template", {
        body: {
          to: phoneNumber,
          contentSid: selectedTemplate.content_sid,
          contentVariables,
        },
      });

      if (error) {
        throw new Error(`Erro ao conectar com o servidor: ${error.message}`);
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Erro ao enviar template");
      }

      // Salvar mensagem no banco para aparecer no chat
      const mensagemTexto = getTemplatePreview(selectedTemplate);
      await supabase.from('mensagens').insert({
        cliente_id: clienteTelefone,
        texto: mensagemTexto,
        tipo: 'texto',
        remetente: 'atendente',
        status: 'enviado',
        data_hora: new Date().toISOString()
      });

      toast.success("✅ Template enviado com sucesso!", {
        description: `Enviado para ${clienteNome}`
      });
      setOpen(false);
      setSelectedTemplate(null);
      setVariableValues({});
    } catch (error) {
      console.error("❌ Erro ao enviar template:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao enviar template");
    } finally {
      setSending(false);
    }
  };

  const getTemplatePreview = (template: Template) => {
    let preview = template.body;
    // Substituir variáveis do tipo {{1}}, {{2}}, etc
    template.variables.forEach((_, index) => {
      const value = variableValues[index] || `{{${index + 1}}}`;
      preview = preview.replace(`{{${index + 1}}}`, value);
    });
    return preview;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shadow-sm whitespace-nowrap">
          <MessageSquare className="h-3.5 w-3.5 md:mr-1.5" />
          <span className="hidden md:inline">Abrir</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Abrir Conversa com Template</DialogTitle>
          <DialogDescription>
            Selecione um template aprovado do WhatsApp para iniciar a conversa com {clienteNome}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Carregando templates...</span>
            </div>
          )}

          {!loading && templates.length > 0 && !selectedTemplate && (
            <ScrollArea className="h-[400px] rounded-md border p-4">
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
                            {template.variables.length} {template.variables.length === 1 ? 'variável' : 'variáveis'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.body}
                      </p>
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
                  {selectedTemplate.variables.map((_, index) => (
                    <div key={index} className="space-y-2">
                      <Label htmlFor={`var-${index}`}>
                        Variável {index + 1}
                      </Label>
                      <Input
                        id={`var-${index}`}
                        value={variableValues[index] || ''}
                        onChange={(e) => handleVariableChange(index, e.target.value)}
                        placeholder={`Digite o valor para {{${index + 1}}}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-muted/50 rounded-md p-4 border">
                <p className="text-xs font-medium text-muted-foreground mb-3">Prévia da mensagem:</p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {getTemplatePreview(selectedTemplate)}
                </p>
              </div>

              <Button
                className="w-full"
                onClick={handleSendTemplate}
                disabled={sending}
              >
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
