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
  const [serviceSid, setServiceSid] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    if (open && serviceSid) {
      fetchTemplates();
    }
  }, [open, serviceSid]);

  const fetchTemplates = async () => {
    if (!serviceSid.trim()) {
      toast.error("Por favor, insira o Service SID");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-twilio-templates", {
        body: { serviceSid: serviceSid.trim() },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Erro ao buscar templates");
      }

      setTemplates(data.templates || []);
      
      if (data.templates.length === 0) {
        toast.info("Nenhum template encontrado");
      }
    } catch (error) {
      console.error("Erro ao buscar templates:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao buscar templates");
    } finally {
      setLoading(false);
    }
  };

  const handleSendTemplate = async (template: Template) => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-template", {
        body: {
          to: clienteTelefone,
          contentSid: template.sid,
          contentVariables: {
            nome: clienteNome,
          },
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Erro ao enviar template");
      }

      toast.success("Template enviado com sucesso!");
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
            Selecione um template aprovado da Twilio para iniciar a conversa com {clienteNome}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="serviceSid">Service SID da Twilio</Label>
            <div className="flex gap-2">
              <Input
                id="serviceSid"
                placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={serviceSid}
                onChange={(e) => setServiceSid(e.target.value)}
              />
              <Button onClick={fetchTemplates} disabled={loading || !serviceSid.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
              </Button>
            </div>
          </div>

          {templates.length > 0 && (
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
