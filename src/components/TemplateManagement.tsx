import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Trash2, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Template {
  id: string;
  content_sid: string;
  friendly_name: string;
  body: string;
  variables: string[];
  created_at: string;
}

export const TemplateManagement = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newSid, setNewSid] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates((data || []).map(t => ({
        ...t,
        variables: Array.isArray(t.variables) ? (t.variables as string[]) : []
      })));
    } catch (error) {
      console.error("Erro ao buscar templates:", error);
      toast.error("Erro ao buscar templates");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTemplate = async () => {
    if (!newSid.trim()) {
      toast.error("Digite o Content SID do template");
      return;
    }

    setAdding(true);
    try {
      // Buscar informações do template na Twilio
      const { data, error } = await supabase.functions.invoke("get-twilio-templates", {
        body: { contentSid: newSid.trim() },
      });

      if (error || !data.success) {
        throw new Error(data?.error || "Erro ao buscar template");
      }

      const template = data.template;

      // Salvar no banco
      const { error: insertError } = await supabase
        .from("whatsapp_templates")
        .insert({
          content_sid: template.sid,
          friendly_name: template.friendly_name,
          body: template.body,
          variables: template.variables,
        });

      if (insertError) {
        if (insertError.code === "23505") {
          throw new Error("Este template já está cadastrado");
        }
        throw insertError;
      }

      toast.success("Template adicionado com sucesso!");
      setNewSid("");
      fetchTemplates();
    } catch (error) {
      console.error("Erro ao adicionar template:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar template");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from("whatsapp_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Template removido com sucesso!");
      fetchTemplates();
    } catch (error) {
      console.error("Erro ao remover template:", error);
      toast.error("Erro ao remover template");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Adicionar Template do WhatsApp</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Adicione o Content SID de um template aprovado na Twilio para usar nas conversas
            </p>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="contentSid">Content SID do Template</Label>
              <Input
                id="contentSid"
                value={newSid}
                onChange={(e) => setNewSid(e.target.value)}
                placeholder="Ex: HXxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                disabled={adding}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddTemplate} disabled={adding}>
                {adding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Templates Cadastrados</h3>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum template cadastrado ainda
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Content SID</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.friendly_name}</TableCell>
                  <TableCell className="text-xs font-mono">{template.content_sid}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                    {template.body}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTemplate(template.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};
