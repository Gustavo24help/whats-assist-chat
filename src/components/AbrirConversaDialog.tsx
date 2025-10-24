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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Template {
  sid: string;
  friendly_name: string;
  types: {
    [key: string]: {
      body: string;
    };
  };
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
      console.log("Buscando templates...");
      
      const { data, error } = await supabase.functions.invoke("get-twilio-templates", {
        body: {},
      });

      console.log("Resposta da função:", data, error);

      if (error) {
        console.error("Erro ao invocar função:", error);
        throw new Error("Erro ao conectar com o servidor");
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Erro ao buscar templates");
      }

      const templateList = data.templates || [];
      setTemplates(templateList);
      
      console.log(`${templateList.length} templates carregados`);
      
      if (templateList.length === 0) {
        toast.info("Nenhum template aprovado encontrado. Configure templates no Twilio Console.");
      } else {
        toast.success(`${templateList.length} template(s) encontrado(s)`);
      }
    } catch (error) {
      console.error("Erro ao buscar templates:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao buscar templates");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTemplate = async (template: Template) => {
    setSending(true);
    try {
      console.log("Enviando template:", template.sid, "para:", clienteTelefone);
      
      const { data, error } = await supabase.functions.invoke("send-template", {
        body: {
          to: clienteTelefone,
          contentSid: template.sid,
          contentVariables: {
            nome: clienteNome,
          },
        },
      });

      console.log("Resposta do envio:", data, error);

      if (error) {
        console.error("Erro ao invocar função:", error);
        throw new Error("Erro ao conectar com o servidor");
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Erro ao enviar template");
      }

      toast.success(`Template enviado! ID: ${data.messageSid}`);
      setOpen(false);
    } catch (error) {
      console.error("Erro ao enviar template:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao enviar template");
    } finally {
      setSending(false);
    }
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
            <div className="space-y-2">
              <Label>Templates Disponíveis</Label>
              <ScrollArea className="h-[300px] rounded-md border p-4">
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.sid}
                      className="p-3 rounded-lg border bg-card hover:bg-accent/10 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm mb-1">{template.friendly_name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {template.types?.['twilio/text']?.body || 'Sem preview disponível'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSendTemplate(template)}
                          disabled={sending}
                        >
                          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Enviar"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {!loading && templates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum template aprovado encontrado. Configure templates no console da Twilio.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
