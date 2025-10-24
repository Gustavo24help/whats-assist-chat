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
import { MessageSquare, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Template {
  id: string;
  content_sid: string;
  friendly_name: string;
  body: string;
  variables: string[];
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

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

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
        variables: Array.isArray(t.variables) ? (t.variables as string[]) : []
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

  const handleSendTemplate = async (template: Template) => {
    setSending(true);
    try {
      console.log("📤 Enviando template:", {
        to: clienteTelefone,
        contentSid: template.content_sid,
        templateName: template.friendly_name,
        variables: { nome: clienteNome }
      });

      // Garantir formato correto do número
      let phoneNumber = clienteTelefone;
      if (!phoneNumber.startsWith('whatsapp:')) {
        phoneNumber = phoneNumber.startsWith('+') 
          ? `whatsapp:${phoneNumber}` 
          : `whatsapp:+${phoneNumber}`;
      }

      const { data, error } = await supabase.functions.invoke("send-template", {
        body: {
          to: phoneNumber,
          contentSid: template.content_sid,
          contentVariables: {
            nome: clienteNome,
          },
        },
      });

      console.log("📥 Resposta da edge function:", { data, error });

      if (error) {
        console.error("❌ Erro na invocação:", error);
        throw new Error(`Erro ao conectar com o servidor: ${error.message}`);
      }

      if (!data || !data.success) {
        console.error("❌ Resposta com erro:", data);
        throw new Error(data?.error || "Erro ao enviar template");
      }

      // Salvar mensagem no banco para aparecer no chat
      const mensagemTexto = getTemplatePreview(template);
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
    } catch (error) {
      console.error("❌ Erro ao enviar template:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao enviar template", {
        description: "Verifique os logs do console para mais detalhes"
      });
    } finally {
      setSending(false);
    }
  };

  const getTemplatePreview = (template: Template) => {
    let preview = template.body;
    // Substituir variáveis do tipo {{1}}, {{2}}, etc
    template.variables.forEach((_, index) => {
      preview = preview.replace(`{{${index + 1}}}`, clienteNome);
    });
    return preview;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shadow-md">
          <MessageSquare className="mr-2 h-4 w-4" />
          Abrir Conversa
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

          {!loading && templates.length > 0 && (
            <ScrollArea className="h-[400px] rounded-md border p-4">
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 rounded-lg border bg-card hover:bg-accent/10 transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium">{template.friendly_name}</h4>
                        <Button
                          size="sm"
                          onClick={() => handleSendTemplate(template)}
                          disabled={sending}
                        >
                          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Enviar"}
                        </Button>
                      </div>
                      
                      <div className="bg-muted/50 rounded-md p-3 border">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Prévia da mensagem:</p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {getTemplatePreview(template)}
                        </p>
                      </div>

                      {template.variables.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Variáveis usadas: <span className="font-medium">{clienteNome}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
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
