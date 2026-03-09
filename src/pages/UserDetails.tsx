import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type ManagedUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "supervisor" | "user";
};

type UserProfileDetail = {
  user_id: string;
  admission_date: string | null;
  position_name: string | null;
};

type UserPermission = {
  id: string;
  permission_name: string;
};

type UserHistoryItem = {
  id: string;
  history_type: string;
  description: string;
  reference_id: string | null;
  created_at: string;
};

const historyTypeOptions = ["ficha", "chat_assumido", "chat_fechado", "servico_fechado", "observacao"];

const UserDetails = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading } = useAuth();

  const [savingProfile, setSavingProfile] = useState(false);
  const [managedUser, setManagedUser] = useState<ManagedUser | null>(null);
  const [detail, setDetail] = useState<UserProfileDetail>({ user_id: "", admission_date: null, position_name: null });
  const [positionOptions, setPositionOptions] = useState<string[]>([]);
  const [newPositionOption, setNewPositionOption] = useState("");

  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [newPermission, setNewPermission] = useState("");

  const [historyItems, setHistoryItems] = useState<UserHistoryItem[]>([]);
  const [newHistoryType, setNewHistoryType] = useState(historyTypeOptions[0]);
  const [newHistoryDescription, setNewHistoryDescription] = useState("");
  const [newHistoryRefId, setNewHistoryRefId] = useState("");

  const fetchAll = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "list" },
    });

    if (error) {
      toast({ title: "Erro", description: "Não foi possível carregar usuário", variant: "destructive" });
      return;
    }

    const targetUser = (data?.users || []).find((user: ManagedUser) => user.id === userId) || null;
    if (!targetUser) {
      toast({ title: "Usuário não encontrado", description: "Não foi possível abrir os detalhes.", variant: "destructive" });
      navigate("/settings");
      return;
    }
    setManagedUser(targetUser);

    const db = supabase as any;

    const detailResponse = await db
      .from("user_internal_profiles")
      .select("user_id, admission_date, position_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (detailResponse.data) {
      setDetail(detailResponse.data);
    } else {
      setDetail({ user_id: userId, admission_date: null, position_name: null });
    }

    const permissionsResponse = await db
      .from("user_custom_permissions")
      .select("id, permission_name")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (permissionsResponse.data) setPermissions(permissionsResponse.data);

    const historyResponse = await db
      .from("user_internal_history")
      .select("id, history_type, description, reference_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (historyResponse.data) setHistoryItems(historyResponse.data);

    const positionsResponse = await db
      .from("user_position_options")
      .select("name")
      .order("name", { ascending: true });

    if (positionsResponse.data) {
      setPositionOptions(positionsResponse.data.map((item: { name: string }) => item.name));
    }
  }, [navigate, toast, userId]);

  useEffect(() => {
    if (!loading && isAdmin) {
      fetchAll();
    }
  }, [fetchAll, loading, isAdmin]);

  const roleLabel = useMemo(() => {
    if (!managedUser) return "";
    if (managedUser.role === "admin") return "Administrador";
    if (managedUser.role === "supervisor") return "Supervisor";
    return "Usuário Comum";
  }, [managedUser]);

  const saveProfile = async () => {
    if (!userId) return;
    setSavingProfile(true);

    const { error } = await supabase.from("user_internal_profiles").upsert({
      user_id: userId,
      admission_date: detail.admission_date || null,
      position_name: detail.position_name || null,
    });

    setSavingProfile(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Dados salvos", description: "Detalhes internos atualizados com sucesso." });
  };

  const addPositionOption = async () => {
    if (!newPositionOption.trim()) return;

    const { error } = await supabase.from("user_position_options").insert({ name: newPositionOption.trim() });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Cargo adicionado", description: "Novo cargo disponível para seleção." });
    setNewPositionOption("");
    fetchAll();
  };

  const addPermission = async () => {
    if (!newPermission.trim() || !userId) return;

    const { error } = await supabase
      .from("user_custom_permissions")
      .insert({ user_id: userId, permission_name: newPermission.trim() });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    setNewPermission("");
    fetchAll();
  };

  const removePermission = async (permissionId: string) => {
    const { error } = await supabase.from("user_custom_permissions").delete().eq("id", permissionId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    fetchAll();
  };

  const addHistory = async () => {
    if (!userId || !newHistoryDescription.trim()) return;

    const { data: current } = await supabase.auth.getUser();

    const { error } = await supabase.from("user_internal_history").insert({
      user_id: userId,
      history_type: newHistoryType,
      description: newHistoryDescription.trim(),
      reference_id: newHistoryRefId.trim() || null,
      created_by: current.user?.id || null,
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    setNewHistoryDescription("");
    setNewHistoryRefId("");
    fetchAll();
  };

  if (loading) return <div className="p-6">Carregando...</div>;

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription>Apenas administradores podem acessar esta área.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}> 
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Detalhes do Usuário</h1>
            <p className="text-sm text-muted-foreground">Gestão interna para documentação e acompanhamento</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{managedUser?.full_name || "Sem nome"}</CardTitle>
            <CardDescription>{managedUser?.email} · {roleLabel}</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admission">Data de ingresso</Label>
              <Input
                id="admission"
                type="date"
                value={detail.admission_date || ""}
                onChange={(e) => setDetail((prev) => ({ ...prev, admission_date: e.target.value || null }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Função / Cargo</Label>
              <Select
                value={detail.position_name || undefined}
                onValueChange={(value) => setDetail((prev) => ({ ...prev, position_name: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cargo" />
                </SelectTrigger>
                <SelectContent>
                  {positionOptions.map((position) => (
                    <SelectItem key={position} value={position}>{position}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 flex gap-2">
              <Input
                placeholder="Adicionar novo cargo"
                value={newPositionOption}
                onChange={(e) => setNewPositionOption(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={addPositionOption}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar cargo
              </Button>
            </div>

            <div className="md:col-span-2">
              <Button onClick={saveProfile} disabled={savingProfile}>
                <Save className="h-4 w-4 mr-1" />
                Salvar dados
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permissões customizáveis</CardTitle>
            <CardDescription>Registre os acessos e escopos internos deste usuário.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={newPermission} onChange={(e) => setNewPermission(e.target.value)} placeholder="Ex.: Aprovar orçamento acima de R$ 5.000" />
              <Button type="button" onClick={addPermission}>Adicionar</Button>
            </div>
            <div className="grid gap-2">
              {permissions.map((permission) => (
                <div key={permission.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">{permission.permission_name}</span>
                  <Button variant="ghost" size="icon" onClick={() => removePermission(permission.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
            <CardDescription>Registre fichas, chats assumidos/fechados e serviços fechados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-4 gap-2">
              <Select value={newHistoryType} onValueChange={setNewHistoryType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {historyTypeOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="ID referência (opcional)" value={newHistoryRefId} onChange={(e) => setNewHistoryRefId(e.target.value)} />
              <Input className="md:col-span-2" placeholder="Descrição da ação" value={newHistoryDescription} onChange={(e) => setNewHistoryDescription(e.target.value)} />
            </div>
            <Button type="button" onClick={addHistory}>Adicionar registro</Button>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.history_type}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.reference_id || "-"}</TableCell>
                    <TableCell>{new Date(item.created_at).toLocaleString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default UserDetails;
