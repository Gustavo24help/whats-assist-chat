import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { VariaveisMensagemDropdown } from "./VariaveisMensagemDropdown";

interface MensagemPadronizada {
  id: string;
  titulo: string;
  mensagem: string;
  tag: string | null;
  ordem: number;
}

export const MensagensPadronizadas = () => {
  const [mensagens, setMensagens] = useState<MensagemPadronizada[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMensagem, setEditingMensagem] = useState<MensagemPadronizada | null>(null);
  const [formData, setFormData] = useState({
    titulo: "",
    mensagem: "",
    tag: "",
    ordem: 0,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchMensagens();
  }, []);

  const fetchMensagens = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("mensagens_padronizadas")
        .select("*")
        .order("ordem", { ascending: true });

      if (error) throw error;
      setMensagens(data || []);
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
      toast.error("Erro ao carregar mensagens padronizadas");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (mensagem?: MensagemPadronizada) => {
    if (mensagem) {
      setEditingMensagem(mensagem);
      setFormData({
        titulo: mensagem.titulo,
        mensagem: mensagem.mensagem,
        tag: mensagem.tag || "",
        ordem: mensagem.ordem,
      });
    } else {
      setEditingMensagem(null);
      setFormData({
        titulo: "",
        mensagem: "",
        tag: "",
        ordem: mensagens.length,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingMensagem(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.titulo || !formData.mensagem) {
      toast.error("Título e mensagem são obrigatórios");
      return;
    }

    try {
      if (editingMensagem) {
        const { error } = await supabase
          .from("mensagens_padronizadas")
          .update({
            titulo: formData.titulo,
            mensagem: formData.mensagem,
            tag: formData.tag || null,
            ordem: formData.ordem,
          })
          .eq("id", editingMensagem.id);

        if (error) throw error;
        toast.success("Mensagem atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("mensagens_padronizadas")
          .insert({
            titulo: formData.titulo,
            mensagem: formData.mensagem,
            tag: formData.tag || null,
            ordem: formData.ordem,
          });

        if (error) throw error;
        toast.success("Mensagem criada com sucesso!");
      }

      handleCloseDialog();
      fetchMensagens();
    } catch (error: any) {
      console.error("Erro ao salvar mensagem:", error);
      toast.error(error.message || "Erro ao salvar mensagem");
    }
  };

  const handleDelete = async (id: string, titulo: string) => {
    if (!confirm(`Tem certeza que deseja excluir a mensagem "${titulo}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("mensagens_padronizadas")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Mensagem excluída com sucesso!");
      fetchMensagens();
    } catch (error: any) {
      console.error("Erro ao excluir mensagem:", error);
      toast.error(error.message || "Erro ao excluir mensagem");
    }
  };

  const handleInsertVariavel = (variavel: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const text = formData.mensagem;
      const newText = text.substring(0, start) + variavel + text.substring(end);
      
      setFormData({ ...formData, mensagem: newText });
      
      // Focar novamente no textarea após inserir
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + variavel.length;
        }
      }, 0);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Mensagens Padronizadas</CardTitle>
            <CardDescription>
              Crie mensagens com variáveis: [nome_cliente], [telefone_cliente], [nome_ficha], [status_ficha], [valor_total], [prestador_nome]
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Mensagem
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : mensagens.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma mensagem padronizada cadastrada ainda.
          </p>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Ordem</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mensagens.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    </TableCell>
                    <TableCell>{msg.ordem}</TableCell>
                    <TableCell className="font-medium">{msg.titulo}</TableCell>
                    <TableCell>
                      {msg.tag && (
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                          {msg.tag}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {msg.mensagem}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(msg)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(msg.id, msg.titulo)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingMensagem ? "Editar Mensagem" : "Nova Mensagem"}
              </DialogTitle>
              <DialogDescription>
                Use variáveis como [nome_cliente], [telefone_cliente], [nome_ficha], etc.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="titulo">Título *</Label>
                  <Input
                    id="titulo"
                    placeholder="Ex: Boas-vindas"
                    value={formData.titulo}
                    onChange={(e) =>
                      setFormData({ ...formData, titulo: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tag">Tag</Label>
                  <Input
                    id="tag"
                    placeholder="Ex: Saudação"
                    value={formData.tag}
                    onChange={(e) =>
                      setFormData({ ...formData, tag: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ordem">Ordem</Label>
                <Input
                  id="ordem"
                  type="number"
                  value={formData.ordem}
                  onChange={(e) =>
                    setFormData({ ...formData, ordem: parseInt(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mensagem">Mensagem *</Label>
                  <VariaveisMensagemDropdown onSelectVariavel={handleInsertVariavel} />
                </div>
                <Textarea
                  ref={textareaRef}
                  id="mensagem"
                  rows={8}
                  placeholder="Digite a mensagem com variáveis como [nome_cliente]"
                  value={formData.mensagem}
                  onChange={(e) =>
                    setFormData({ ...formData, mensagem: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Clique em "Inserir Variável" para adicionar campos dinâmicos à mensagem
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingMensagem ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
