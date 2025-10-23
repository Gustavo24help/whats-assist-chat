import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Prestador {
  cpf: string;
  nome: string;
  telefone: string;
  categoria: string | null;
  especialidade: string | null;
  id_crm: string | null;
  id_azure: string | null;
  cnpj: string | null;
}

export const PrestadorManagement = () => {
  const { toast } = useToast();
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrestador, setEditingPrestador] = useState<Prestador | null>(null);
  
  const [formData, setFormData] = useState<Prestador>({
    cpf: "",
    nome: "",
    telefone: "",
    categoria: "",
    especialidade: "",
    id_crm: "",
    id_azure: "",
    cnpj: "",
  });

  useEffect(() => {
    fetchPrestadores();
  }, []);

  const fetchPrestadores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("prestadores")
        .select("*")
        .order("nome");

      if (error) throw error;
      setPrestadores(data || []);
    } catch (error) {
      console.error("Erro ao carregar prestadores:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar prestadores",
        description: "Não foi possível carregar a lista de prestadores.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (prestador?: Prestador) => {
    if (prestador) {
      setEditingPrestador(prestador);
      setFormData(prestador);
    } else {
      setEditingPrestador(null);
      setFormData({
        cpf: "",
        nome: "",
        telefone: "",
        categoria: "",
        especialidade: "",
        id_crm: "",
        id_azure: "",
        cnpj: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPrestador(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.cpf || !formData.nome || !formData.telefone) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "CPF, Nome e Telefone são obrigatórios.",
      });
      return;
    }

    try {
      if (editingPrestador) {
        // Atualizar prestador existente usando CPF como identificador
        const { error } = await supabase
          .from("prestadores")
          .update({
            nome: formData.nome,
            telefone: formData.telefone,
            categoria: formData.categoria || null,
            especialidade: formData.especialidade || null,
            id_crm: formData.id_crm || null,
            id_azure: formData.id_azure || null,
            cnpj: formData.cnpj || null,
          })
          .eq("cpf", editingPrestador.cpf);

        if (error) throw error;

        toast({
          title: "Prestador atualizado",
          description: "Os dados foram atualizados com sucesso.",
        });
      } else {
        // Inserir novo prestador
        const { error } = await supabase.from("prestadores").insert({
          cpf: formData.cpf,
          nome: formData.nome,
          telefone: formData.telefone,
          categoria: formData.categoria || null,
          especialidade: formData.especialidade || null,
          id_crm: formData.id_crm || null,
          id_azure: formData.id_azure || null,
          cnpj: formData.cnpj || null,
        });

        if (error) throw error;

        toast({
          title: "Prestador adicionado",
          description: "O prestador foi cadastrado com sucesso.",
        });
      }

      handleCloseDialog();
      fetchPrestadores();
    } catch (error: any) {
      console.error("Erro ao salvar prestador:", error);
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar o prestador.",
      });
    }
  };

  const handleDelete = async (cpf: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o prestador ${nome}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("prestadores")
        .delete()
        .eq("cpf", cpf);

      if (error) throw error;

      toast({
        title: "Prestador excluído",
        description: "O prestador foi removido com sucesso.",
      });

      fetchPrestadores();
    } catch (error: any) {
      console.error("Erro ao excluir prestador:", error);
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir o prestador.",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gerenciamento de Prestadores</CardTitle>
            <CardDescription>
              Adicione, edite ou remova prestadores do sistema
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Prestador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingPrestador ? "Editar Prestador" : "Novo Prestador"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingPrestador
                      ? "Atualize os dados do prestador"
                      : "Preencha os dados do novo prestador"}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cpf">CPF *</Label>
                      <Input
                        id="cpf"
                        placeholder="000.000.000-00"
                        value={formData.cpf}
                        onChange={(e) =>
                          setFormData({ ...formData, cpf: e.target.value })
                        }
                        disabled={!!editingPrestador}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome *</Label>
                      <Input
                        id="nome"
                        placeholder="Nome completo"
                        value={formData.nome}
                        onChange={(e) =>
                          setFormData({ ...formData, nome: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone *</Label>
                      <Input
                        id="telefone"
                        placeholder="+55 11 99999-9999"
                        value={formData.telefone}
                        onChange={(e) =>
                          setFormData({ ...formData, telefone: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input
                        id="cnpj"
                        placeholder="00.000.000/0000-00"
                        value={formData.cnpj || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, cnpj: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="categoria">Categoria</Label>
                      <Input
                        id="categoria"
                        placeholder="Ex: Encanador, Eletricista"
                        value={formData.categoria || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, categoria: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="especialidade">Especialidade</Label>
                      <Input
                        id="especialidade"
                        placeholder="Especialidade do prestador"
                        value={formData.especialidade || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            especialidade: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="id_crm">ID CRM</Label>
                      <Input
                        id="id_crm"
                        placeholder="ID do CRM"
                        value={formData.id_crm || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, id_crm: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="id_azure">ID Azure</Label>
                      <Input
                        id="id_azure"
                        placeholder="ID do Azure"
                        value={formData.id_azure || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, id_azure: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingPrestador ? "Atualizar" : "Adicionar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : prestadores.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum prestador cadastrado ainda.
          </p>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>ID CRM</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prestadores.map((prestador) => (
                  <TableRow key={prestador.cpf}>
                    <TableCell className="font-medium">{prestador.nome}</TableCell>
                    <TableCell>{prestador.cpf}</TableCell>
                    <TableCell>{prestador.telefone}</TableCell>
                    <TableCell>{prestador.categoria || "-"}</TableCell>
                    <TableCell>{prestador.id_crm || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(prestador)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(prestador.cpf, prestador.nome)}
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
    </Card>
  );
};
