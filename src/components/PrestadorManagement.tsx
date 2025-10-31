import { useState, useEffect, useRef } from "react";
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Upload, HelpCircle } from "lucide-react";
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
  const [showCsvHelp, setShowCsvHelp] = useState(false);
  const [selectedPrestadores, setSelectedPrestadores] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
      // Verificar se há fichas vinculadas
      const { data: fichas, error: fichasError } = await supabase
        .from("fichas_de_servico")
        .select("id")
        .eq("prestador_id", cpf)
        .limit(1);

      if (fichasError) throw fichasError;

      if (fichas && fichas.length > 0) {
        toast({
          variant: "destructive",
          title: "Não é possível excluir",
          description: `O prestador ${nome} possui fichas de serviço vinculadas. Remova ou transfira as fichas antes de excluir o prestador.`,
        });
        return;
      }

      const { error } = await supabase
        .from("prestadores")
        .delete()
        .eq("cpf", cpf);

      if (error) {
        console.error("Erro ao deletar:", error);
        throw error;
      }

      toast({
        title: "Prestador excluído",
        description: "O prestador foi removido com sucesso.",
      });

      fetchPrestadores();
    } catch (error: any) {
      console.error("Erro ao excluir prestador:", error);
      
      // Mensagem específica para erro de foreign key
      if (error.code === "23503") {
        toast({
          variant: "destructive",
          title: "Não é possível excluir",
          description: "Este prestador possui fichas de serviço vinculadas. Remova as fichas primeiro.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao excluir",
          description: error.message || "Não foi possível excluir o prestador.",
        });
      }
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedPrestadores.length === 0) return;
    
    if (!confirm(`Tem certeza que deseja excluir ${selectedPrestadores.length} prestador(es)?`)) {
      return;
    }

    try {
      // Verificar quais prestadores têm fichas vinculadas
      const { data: fichas, error: fichasError } = await supabase
        .from("fichas_de_servico")
        .select("prestador_id")
        .in("prestador_id", selectedPrestadores);

      if (fichasError) throw fichasError;

      const prestadoresComFichas = fichas?.map(f => f.prestador_id) || [];
      const prestadoresSemFichas = selectedPrestadores.filter(
        cpf => !prestadoresComFichas.includes(cpf)
      );

      if (prestadoresSemFichas.length === 0) {
        toast({
          variant: "destructive",
          title: "Não é possível excluir",
          description: "Todos os prestadores selecionados possuem fichas de serviço vinculadas.",
        });
        return;
      }

      if (prestadoresComFichas.length > 0) {
        const continuar = confirm(
          `${prestadoresComFichas.length} prestador(es) possui(em) fichas vinculadas e não pode(m) ser excluído(s). Deseja excluir os ${prestadoresSemFichas.length} restantes?`
        );
        if (!continuar) return;
      }

      const { error } = await supabase
        .from("prestadores")
        .delete()
        .in("cpf", prestadoresSemFichas);

      if (error) throw error;

      toast({
        title: "Prestadores excluídos",
        description: `${prestadoresSemFichas.length} prestador(es) foram removidos com sucesso.${
          prestadoresComFichas.length > 0 
            ? ` ${prestadoresComFichas.length} não puderam ser excluídos por terem fichas vinculadas.` 
            : ''
        }`,
      });

      setSelectedPrestadores([]);
      fetchPrestadores();
    } catch (error: any) {
      console.error("Erro ao excluir prestadores:", error);
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir os prestadores.",
      });
    }
  };

  const toggleSelectAll = () => {
    if (selectedPrestadores.length === prestadores.length) {
      setSelectedPrestadores([]);
    } else {
      setSelectedPrestadores(prestadores.map(p => p.cpf));
    }
  };

  const toggleSelect = (cpf: string) => {
    setSelectedPrestadores(prev =>
      prev.includes(cpf) ? prev.filter(c => c !== cpf) : [...prev, cpf]
    );
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          variant: "destructive",
          title: "Arquivo inválido",
          description: "O arquivo CSV está vazio ou não contém dados.",
        });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const prestadores = [];
      const cpfsVistos = new Set<string>();
      let linhasDuplicadas = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const prestador: any = {};

        headers.forEach((header, index) => {
          prestador[header] = values[index] || null;
        });

        if (!prestador.cpf || !prestador.nome || !prestador.telefone) {
          toast({
            variant: "destructive",
            title: "Erro na linha " + (i + 1),
            description: "CPF, Nome e Telefone são obrigatórios.",
          });
          return;
        }

        // Verificar duplicatas no próprio CSV
        if (cpfsVistos.has(prestador.cpf)) {
          linhasDuplicadas++;
          continue;
        }

        cpfsVistos.add(prestador.cpf);
        prestadores.push(prestador);
      }

      if (prestadores.length === 0) {
        toast({
          variant: "destructive",
          title: "Nenhum prestador válido",
          description: "O arquivo não contém prestadores válidos para importar.",
        });
        return;
      }

      const { error } = await supabase
        .from("prestadores")
        .upsert(prestadores, { onConflict: 'cpf' });

      if (error) throw error;

      toast({
        title: "Importação concluída",
        description: `${prestadores.length} prestador(es) importado(s).${
          linhasDuplicadas > 0 
            ? ` ${linhasDuplicadas} linha(s) ignorada(s) por CPF duplicado no arquivo.` 
            : ''
        }`,
      });
      
      fetchPrestadores();
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error("Erro ao importar CSV:", error);
      toast({
        variant: "destructive",
        title: "Erro ao importar",
        description: error.message || "Não foi possível importar o arquivo CSV.",
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
          <div className="flex gap-2">
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
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              className="hidden"
            />
            
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Importar CSV
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCsvHelp(true)}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {selectedPrestadores.length > 0 && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">
              {selectedPrestadores.length} selecionado(s)
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir Selecionados
            </Button>
          </div>
        )}

        <AlertDialog open={showCsvHelp} onOpenChange={setShowCsvHelp}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Formato do Arquivo CSV</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  <p>O arquivo CSV deve seguir este formato exato:</p>
                  
                  <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <div className="text-primary font-semibold">cpf,nome,telefone,categoria,especialidade,id_crm,id_azure,cnpj</div>
                    <div className="text-muted-foreground">12345678900,João Silva,41999999999,Elétrica,Instalações,CRM001,AZ123,12345678000100</div>
                    <div className="text-muted-foreground">98765432100,Maria Santos,41988888888,Hidráulica,Reparos,CRM002,AZ124,98765432000100</div>
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold">Campos obrigatórios:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li><span className="font-mono">cpf</span> - CPF do prestador (somente números)</li>
                      <li><span className="font-mono">nome</span> - Nome completo do prestador</li>
                      <li><span className="font-mono">telefone</span> - Telefone do prestador (somente números)</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold">Campos opcionais:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li><span className="font-mono">categoria</span> - Categoria do serviço</li>
                      <li><span className="font-mono">especialidade</span> - Especialidade do prestador</li>
                      <li><span className="font-mono">id_crm</span> - ID no sistema CRM</li>
                      <li><span className="font-mono">id_azure</span> - ID no Azure</li>
                      <li><span className="font-mono">cnpj</span> - CNPJ (se aplicável)</li>
                    </ul>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg">
                    <p className="text-sm">
                      <strong>⚠️ Importante:</strong> A primeira linha deve conter exatamente os nomes dos campos separados por vírgula, e as linhas seguintes devem conter os dados dos prestadores.
                    </p>
                  </div>

                  <Button onClick={() => setShowCsvHelp(false)} className="w-full">
                    Entendi
                  </Button>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
          </AlertDialogContent>
        </AlertDialog>
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
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedPrestadores.length === prestadores.length && prestadores.length > 0}
                      onChange={toggleSelectAll}
                      className="cursor-pointer"
                    />
                  </TableHead>
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
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedPrestadores.includes(prestador.cpf)}
                        onChange={() => toggleSelect(prestador.cpf)}
                        className="cursor-pointer"
                      />
                    </TableCell>
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