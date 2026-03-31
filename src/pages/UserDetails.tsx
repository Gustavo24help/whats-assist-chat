import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Save, Trash2, Filter, ChevronLeft, ChevronRight, MessageSquare, Users, FileText, DollarSign, Bot, Clock, CreditCard, Eye, Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO, subMonths } from "date-fns";

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
  metadata?: Record<string, any> | null;
};

const HISTORY_TYPES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  mensagem_enviada: { label: "Mensagem Enviada", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  chat_assumido: { label: "Chat Assumido", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: <Users className="h-3.5 w-3.5" /> },
  chat_fechado: { label: "Chat Fechado", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", icon: <Users className="h-3.5 w-3.5" /> },
  ficha_status: { label: "Status Ficha", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: <FileText className="h-3.5 w-3.5" /> },
  transacao_criada: { label: "Transação Criada", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200", icon: <DollarSign className="h-3.5 w-3.5" /> },
  pagamento_atualizado: { label: "Pagamento Atualizado", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: <CreditCard className="h-3.5 w-3.5" /> },
  bot_toggle: { label: "Bot Toggle", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: <Bot className="h-3.5 w-3.5" /> },
  ficha: { label: "Ficha", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200", icon: <FileText className="h-3.5 w-3.5" /> },
  servico_fechado: { label: "Serviço Fechado", color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200", icon: <FileText className="h-3.5 w-3.5" /> },
  observacao: { label: "Observação", color: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200", icon: <Eye className="h-3.5 w-3.5" /> },
};

const manualHistoryTypes = ["observacao", "ficha", "chat_assumido", "chat_fechado", "servico_fechado"];

const PAGE_SIZE = 30;

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

  // History state
  const [historyItems, setHistoryItems] = useState<UserHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyFilterType, setHistoryFilterType] = useState("todos");
  const [historyDateFrom, setHistoryDateFrom] = useState(() => format(subMonths(new Date(), 1), "yyyy-MM-dd"));
  const [historyDateTo, setHistoryDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [exportingHistory, setExportingHistory] = useState(false);

  // Manual history entry
  const [newHistoryType, setNewHistoryType] = useState(manualHistoryTypes[0]);
  const [newHistoryDescription, setNewHistoryDescription] = useState("");
  const [newHistoryRefId, setNewHistoryRefId] = useState("");

  const fetchUserData = useCallback(async () => {
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

    const [detailRes, permRes, posRes] = await Promise.all([
      db.from("user_internal_profiles").select("user_id, admission_date, position_name").eq("user_id", userId).maybeSingle(),
      db.from("user_custom_permissions").select("id, permission_name").eq("user_id", userId).order("created_at", { ascending: false }),
      db.from("user_position_options").select("name").order("name", { ascending: true }),
    ]);

    if (detailRes.data) setDetail(detailRes.data);
    else setDetail({ user_id: userId, admission_date: null, position_name: null });

    if (permRes.data) setPermissions(permRes.data);
    if (posRes.data) setPositionOptions(posRes.data.map((item: { name: string }) => item.name));
  }, [navigate, toast, userId]);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    setHistoryLoading(true);

    const db = supabase as any;
    let query = db
      .from("user_internal_history")
      .select("id, history_type, description, reference_id, created_at, metadata", { count: "exact" })
      .eq("user_id", userId)
      .gte("created_at", `${historyDateFrom}T00:00:00`)
      .lte("created_at", `${historyDateTo}T23:59:59`)
      .order("created_at", { ascending: false })
      .range(historyPage * PAGE_SIZE, (historyPage + 1) * PAGE_SIZE - 1);

    if (historyFilterType !== "todos") {
      query = query.eq("history_type", historyFilterType);
    }

    const { data, count } = await query;
    setHistoryItems(data || []);
    setHistoryTotal(count || 0);
    setHistoryLoading(false);
  }, [userId, historyDateFrom, historyDateTo, historyFilterType, historyPage]);

  useEffect(() => {
    if (!loading && isAdmin) fetchUserData();
  }, [fetchUserData, loading, isAdmin]);

  useEffect(() => {
    if (!loading && isAdmin && userId) fetchHistory();
  }, [fetchHistory, loading, isAdmin, userId]);

  const roleLabel = useMemo(() => {
    if (!managedUser) return "";
    if (managedUser.role === "admin") return "Administrador";
    if (managedUser.role === "supervisor") return "Supervisor";
    return "Usuário Comum";
  }, [managedUser]);

  const saveProfile = async () => {
    if (!userId) return;
    setSavingProfile(true);
    const db = supabase as any;
    const { error } = await db.from("user_internal_profiles").upsert({
      user_id: userId,
      admission_date: detail.admission_date || null,
      position_name: detail.position_name || null,
    });
    setSavingProfile(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Dados salvos" });
  };

  const addPositionOption = async () => {
    if (!newPositionOption.trim()) return;
    const db = supabase as any;
    const { error } = await db.from("user_position_options").insert({ name: newPositionOption.trim() });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Cargo adicionado" });
    setNewPositionOption("");
    fetchUserData();
  };

  const addPermission = async () => {
    if (!newPermission.trim() || !userId) return;
    const db = supabase as any;
    const { error } = await db.from("user_custom_permissions").insert({ user_id: userId, permission_name: newPermission.trim() });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setNewPermission("");
    fetchUserData();
  };

  const removePermission = async (permissionId: string) => {
    const db = supabase as any;
    const { error } = await db.from("user_custom_permissions").delete().eq("id", permissionId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    fetchUserData();
  };

  const addHistory = async () => {
    if (!userId || !newHistoryDescription.trim()) return;
    const { data: current } = await supabase.auth.getUser();
    const db = supabase as any;
    const { error } = await db.from("user_internal_history").insert({
      user_id: userId,
      history_type: newHistoryType,
      description: newHistoryDescription.trim(),
      reference_id: newHistoryRefId.trim() || null,
      created_by: current.user?.id || null,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setNewHistoryDescription("");
    setNewHistoryRefId("");
    fetchHistory();
  };

  const handleFilterHistory = () => {
    setHistoryPage(0);
    fetchHistory();
  };

  const formatHistoryCsv = (items: UserHistoryItem[]) => {
    const escapeCsvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const headers = ["Data/Hora", "Tipo", "Descrição", "Referência", "Metadados"];
    const rows = items.map((item) => {
      const metadata = item.metadata && Object.keys(item.metadata).length > 0
        ? JSON.stringify(item.metadata)
        : "";

      return [
        format(parseISO(item.created_at), "dd/MM/yyyy HH:mm:ss"),
        getTypeInfo(item.history_type).label,
        item.description || "",
        item.reference_id || "",
        metadata,
      ];
    });

    return [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(";"))
      .join("\n");
  };

  const exportHistory = async (exportAll: boolean) => {
    if (!userId) return;
    setExportingHistory(true);

    const db = supabase as any;
    let query = db
      .from("user_internal_history")
      .select("id, history_type, description, reference_id, created_at, metadata")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!exportAll) {
      query = query
        .gte("created_at", `${historyDateFrom}T00:00:00`)
        .lte("created_at", `${historyDateTo}T23:59:59`);
    }

    if (historyFilterType !== "todos") {
      query = query.eq("history_type", historyFilterType);
    }

    const { data, error } = await query;
    setExportingHistory(false);

    if (error) {
      toast({ title: "Erro ao exportar", description: error.message, variant: "destructive" });
      return;
    }

    const rows = data || [];
    if (rows.length === 0) {
      toast({ title: "Sem registros", description: "Nenhum registro encontrado para exportação." });
      return;
    }

    const csv = "\uFEFF" + formatHistoryCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const operatorName = managedUser?.full_name?.trim().replace(/\s+/g, "-").toLowerCase() || "operador";
    const dateScope = exportAll ? "completo" : `${historyDateFrom}_${historyDateTo}`;

    anchor.href = url;
    anchor.download = `historico-acoes-${operatorName}-${dateScope}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    toast({
      title: "Exportação concluída",
      description: `${rows.length} registro${rows.length !== 1 ? "s" : ""} exportado${rows.length !== 1 ? "s" : ""}.`,
    });
  };

  const totalPages = Math.ceil(historyTotal / PAGE_SIZE);

  const getTypeInfo = (type: string) => HISTORY_TYPES[type] || { label: type, color: "bg-muted text-muted-foreground", icon: <Clock className="h-3.5 w-3.5" /> };

  const renderMetadata = (metadata: Record<string, any> | null | undefined) => {
    if (!metadata || Object.keys(metadata).length === 0) return null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 p-3 rounded-md bg-muted/50 text-xs">
        {Object.entries(metadata).map(([key, value]) => {
          if (value === null || value === undefined) return null;
          const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
          return (
            <div key={key}>
              <span className="text-muted-foreground">{label}: </span>
              <span className="font-medium">{String(value)}</span>
            </div>
          );
        })}
      </div>
    );
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
    <PageLayout>
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{managedUser?.full_name || "Detalhes do Usuário"}</h1>
            <p className="text-sm text-muted-foreground">{managedUser?.email} · {roleLabel}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6">
        <Tabs defaultValue="historico" className="space-y-6">
          <TabsList>
            <TabsTrigger value="historico">Histórico de Ações</TabsTrigger>
            <TabsTrigger value="dados">Dados Internos</TabsTrigger>
            <TabsTrigger value="permissoes">Permissões</TabsTrigger>
          </TabsList>

          {/* ===== HISTÓRICO ===== */}
          <TabsContent value="historico" className="space-y-4">
            {/* Filters */}
            <Card className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">De</label>
                  <Input type="date" value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Até</label>
                  <Input type="date" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                  <Select value={historyFilterType} onValueChange={setHistoryFilterType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {Object.entries(HISTORY_TYPES).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleFilterHistory}>
                  <Filter className="h-4 w-4 mr-1" /> Filtrar
                </Button>
                <div className="md:col-span-2 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => exportHistory(false)} disabled={exportingHistory}>
                    <Download className="h-4 w-4 mr-1" /> Exportar período
                  </Button>
                  <Button variant="outline" onClick={() => exportHistory(true)} disabled={exportingHistory}>
                    <Download className="h-4 w-4 mr-1" /> Exportar tudo
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground self-center">
                  {historyTotal} registro{historyTotal !== 1 ? "s" : ""}
                </div>
              </div>
            </Card>

            {/* Manual entry */}
            <Card className="p-4">
              <p className="text-sm font-medium mb-2">Adicionar registro manual</p>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                <Select value={newHistoryType} onValueChange={setNewHistoryType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {manualHistoryTypes.map((option) => (
                      <SelectItem key={option} value={option}>{getTypeInfo(option).label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="Referência (opcional)" value={newHistoryRefId} onChange={(e) => setNewHistoryRefId(e.target.value)} />
                <Input className="md:col-span-2" placeholder="Descrição da ação" value={newHistoryDescription} onChange={(e) => setNewHistoryDescription(e.target.value)} />
                <Button onClick={addHistory}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
            </Card>

            {/* History table */}
            <Card>
              {historyLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Carregando...</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">Data/Hora</TableHead>
                          <TableHead className="w-[160px]">Tipo</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="w-[120px]">Referência</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              Nenhum registro encontrado no período
                            </TableCell>
                          </TableRow>
                        ) : (
                          historyItems.map((item) => {
                            const typeInfo = getTypeInfo(item.history_type);
                            const isExpanded = expandedRow === item.id;
                            const hasMetadata = item.metadata && Object.keys(item.metadata).length > 0;
                            return (
                              <TableRow
                                key={item.id}
                                className={hasMetadata ? "cursor-pointer" : ""}
                                onClick={() => hasMetadata && setExpandedRow(isExpanded ? null : item.id)}
                              >
                                <TableCell className="text-xs whitespace-nowrap font-mono">
                                  {format(parseISO(item.created_at), "dd/MM/yy HH:mm")}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`text-[10px] gap-1 ${typeInfo.color}`}>
                                    {typeInfo.icon}
                                    {typeInfo.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                  <div>{item.description}</div>
                                  {isExpanded && renderMetadata(item.metadata)}
                                </TableCell>
                                <TableCell className="text-xs font-mono text-muted-foreground">
                                  {item.reference_id || "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <span className="text-xs text-muted-foreground">{historyTotal} registros</span>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled={historyPage === 0} onClick={() => setHistoryPage((p) => p - 1)}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm">{historyPage + 1} / {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={historyPage >= totalPages - 1} onClick={() => setHistoryPage((p) => p + 1)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          </TabsContent>

          {/* ===== DADOS INTERNOS ===== */}
          <TabsContent value="dados">
            <Card>
              <CardHeader>
                <CardTitle>Dados Internos</CardTitle>
                <CardDescription>Data de ingresso e cargo do funcionário</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="admission">Data de ingresso</Label>
                  <Input id="admission" type="date" value={detail.admission_date || ""} onChange={(e) => setDetail((prev) => ({ ...prev, admission_date: e.target.value || null }))} />
                </div>
                <div className="space-y-2">
                  <Label>Função / Cargo</Label>
                  <Select value={detail.position_name || undefined} onValueChange={(value) => setDetail((prev) => ({ ...prev, position_name: value }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione um cargo" /></SelectTrigger>
                    <SelectContent>
                      {positionOptions.map((position) => (
                        <SelectItem key={position} value={position}>{position}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <Input placeholder="Adicionar novo cargo" value={newPositionOption} onChange={(e) => setNewPositionOption(e.target.value)} />
                  <Button type="button" variant="outline" onClick={addPositionOption}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar cargo
                  </Button>
                </div>
                <div className="md:col-span-2">
                  <Button onClick={saveProfile} disabled={savingProfile}>
                    <Save className="h-4 w-4 mr-1" /> Salvar dados
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== PERMISSÕES ===== */}
          <TabsContent value="permissoes">
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
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default UserDetails;
