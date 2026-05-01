import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Trash2, Plus, MapPin } from "lucide-react";
import { VariableMappingDialog } from "./VariableMappingDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { normalizeTemplateVariables } from "@/lib/whatsappTemplateVariables";

interface Template {
  id: string;
  content_sid: string;
  friendly_name: string;
  body: string;
  variables: string[];
  variable_mapping: { index: number; field: string }[];
  desliga_bot: boolean | null;
  disable_bot_on_send: boolean;
  created_at: string;
}

export const TemplateManagement = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newSid, setNewSid] = useState("");
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

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
      setTemplates(
        (data || []).map((template) => {
          const raw = template as typeof template & {
            disable_bot_on_send?: boolean | null;
            desliga_bot?: boolean | null;
          };
          return {
            ...template,
            variables: normalizeTemplateVariables(
              Array.isArray(template.variables) ? (template.variables as string[]) : [],
              template.body,
            ),
            variable_mapping: Array.isArray(template.variable_mapping)
              ? (template.variable_mapping as Array<{ index: number; field: string }>)
              : [],
            desliga_bot: raw.desliga_bot ?? null,
            // Default seguro: false. Templates antigos foram migrados explicitamente.
            disable_bot_on_send: raw.disable_bot_on_send ?? false,
          };
        }),
      );
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
      const { data, error } = await supabase.functions.invoke("get-twilio-templates", {
        body: { contentSid: newSid.trim() },
      });

      if (error || !data.success) {
        throw new Error(data?.error || "Erro ao buscar template");
      }

      const template = data.template;
      const normalizedVariables = normalizeTemplateVariables(template.variables, template.body);

      const { error: insertError } = await supabase
        .from("whatsapp_templates")
        .insert({
          content_sid: template.sid,
          friendly_name: template.friendly_name,
          body: template.body,
          variables: normalizedVariables,
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
      const { error } = await supabase.from("whatsapp_templates").delete().eq("id", id);

      if (error) throw error;

      toast.success("Template removido com sucesso!");
      fetchTemplates();
    } catch (error) {
      console.error("Erro ao remover template:", error);
      toast.error("Erro ao remover template");
    }
  };

  const handleOpenMapping = (template: Template) => {
    setSelectedTemplate(template);
    setMappingDialogOpen(true);
  };

  const handleToggleDisableBotOnSend = async (template: Template, novoValor: boolean) => {
    // Atualização otimista
    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, disable_bot_on_send: novoValor } : t)),
    );
    try {
      const { error } = await supabase
        .from("whatsapp_templates")
        .update({ disable_bot_on_send: novoValor })
        .eq("id", template.id);
      if (error) throw error;
      toast.success(
        novoValor
          ? "Template passará a desligar o bot ao ser enviado"
          : "Template não desligará mais o bot ao ser enviado",
      );
    } catch (error) {
      console.error("Erro ao atualizar disable_bot_on_send:", error);
      toast.error("Erro ao atualizar configuração");
      // Reverte
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, disable_bot_on_send: !novoValor } : t)),
      );
    }
  };

  const handleSaveMapping = async (mapping: { index: number; field: string }[]) => {
    if (!selectedTemplate) return;

    try {
      const { error } = await supabase
        .from("whatsapp_templates")
        .update({ variable_mapping: mapping })
        .eq("id", selectedTemplate.id);

      if (error) throw error;

      toast.success("Mapeamento salvo com sucesso!");
      fetchTemplates();
    } catch (error) {
      console.error("Erro ao salvar mapeamento:", error);
      toast.error("Erro ao salvar mapeamento");
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
          <div className="text-center py-8 text-muted-foreground">Nenhum template cadastrado ainda</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Content SID</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Variáveis</TableHead>
                <TableHead className="w-[260px]">Desligar bot ao enviar este template</TableHead>
                <TableHead className="w-[150px]">Ações</TableHead>
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
                  <TableCell className="text-sm">
                    {template.variables.length > 0 ? (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        {template.variables.length} {template.variables.length === 1 ? "variável" : "variáveis"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Nenhuma</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={template.disable_bot_on_send}
                        onCheckedChange={(v) => handleToggleDisableBotOnSend(template, v)}
                        aria-label="Desligar bot ao enviar este template"
                      />
                      <span
                        className="text-xs text-muted-foreground"
                        title="Quando marcado, o bot será desligado automaticamente na conversa após o envio deste template."
                      >
                        {template.disable_bot_on_send ? "Sim" : "Não"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {template.variables.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenMapping(template)}
                          title="Mapear variáveis"
                        >
                          <MapPin className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id)}
                        title="Remover template"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {selectedTemplate && (
        <VariableMappingDialog
          open={mappingDialogOpen}
          onOpenChange={setMappingDialogOpen}
          variables={selectedTemplate.variables}
          currentMapping={selectedTemplate.variable_mapping}
          onSave={handleSaveMapping}
        />
      )}
    </div>
  );
};
