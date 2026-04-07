import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface DelegacaoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface UserOption {
  id: string;
  full_name: string;
}

export const DelegacaoFormDialog = ({ open, onOpenChange, onCreated }: DelegacaoFormDialogProps) => {
  const { user } = useAuth();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [urgencia, setUrgencia] = useState("media");
  const [fichaId, setFichaId] = useState("");
  const [prazo, setPrazo] = useState("");
  const [tolerancia, setTolerancia] = useState("0");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<UserOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const loadUsers = async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      setUsers(data?.filter((u: any) => u.full_name) || []);
    };
    loadUsers();
  }, [open]);

  const handleSave = async () => {
    if (!titulo.trim() || !user) {
      toast.error("Título é obrigatório");
      return;
    }
    if (selectedUsers.size === 0) {
      toast.error("Selecione pelo menos um responsável");
      return;
    }

    setSaving(true);
    try {
      const tarefaId = crypto.randomUUID();
      // Buscar telefone do cliente se ficha foi informada
      let clienteTelefone: string | null = null;
      if (fichaId.trim()) {
        const { data: fichaData } = await (supabase as any)
          .from("fichas_de_servico")
          .select("telefone_cliente")
          .eq("id", fichaId.trim())
          .maybeSingle();
        clienteTelefone = fichaData?.telefone_cliente || null;
      }

      const { error } = await (supabase as any)
        .from("tarefas_operacionais")
        .insert({
          id: tarefaId,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          urgencia,
          criado_por: user.id,
          ficha_id: fichaId.trim() || null,
          cliente_telefone: clienteTelefone,
          prazo: prazo ? new Date(prazo).toISOString() : null,
          tolerancia_aviso_minutos: parseInt(tolerancia) || 0,
        });

      if (error) throw error;

      // Insert atribuidos
      const atribuidos = Array.from(selectedUsers).map(uid => ({
        tarefa_id: tarefaId,
        user_id: uid,
      }));

      const { error: atribError } = await (supabase as any)
        .from("tarefas_operacionais_atribuidos")
        .insert(atribuidos);

      if (atribError) throw atribError;

      toast.success("Tarefa criada!");
      onCreated();
      onOpenChange(false);
      
      // Reset form
      setTitulo("");
      setDescricao("");
      setUrgencia("media");
      setFichaId("");
      setPrazo("");
      setTolerancia("0");
      setSelectedUsers(new Set());
    } catch (err) {
      toast.error("Erro ao criar tarefa");
    } finally {
      setSaving(false);
    }
  };

  const toggleUser = (uid: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Tarefa Operacional</DialogTitle>
          <DialogDescription>Crie uma tarefa e atribua a membros da equipe</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Ligar para cliente sobre agendamento" />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes..." rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Urgência</Label>
              <Select value={urgencia} onValueChange={setUrgencia}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ficha vinculada</Label>
              <Input value={fichaId} onChange={e => setFichaId(e.target.value)} placeholder="ID da ficha (opcional)" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prazo</Label>
              <Input type="datetime-local" value={prazo} onChange={e => setPrazo(e.target.value)} />
            </div>
            <div>
              <Label>Repetir aviso a cada</Label>
              <Select value={tolerancia} onValueChange={setTolerancia}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Não repetir</SelectItem>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Atribuir a *</Label>
            <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1 mt-1">
              {users.map(u => (
                <label key={u.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-sm">
                  <Checkbox
                    checked={selectedUsers.has(u.id)}
                    onCheckedChange={() => toggleUser(u.id)}
                  />
                  {u.full_name}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Criando..." : "Criar Tarefa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
