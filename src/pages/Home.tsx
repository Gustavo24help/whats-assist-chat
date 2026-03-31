import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOpenInNewTab } from "@/hooks/useOpenInNewTab";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bell,
  CalendarDays,
  Eye,
  Archive,
  ArchiveRestore,
  Trash2,
  PlusCircle,
  CheckCircle2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageLayout } from "@/components/PageLayout";
import { cn } from "@/lib/utils";

type Aviso = {
  id: string;
  titulo: string;
  conteudo: string;
  imagem_url: string | null;
  created_at: string;
  criado_por_nome: string | null;
  arquivado: boolean;
  enviar_popup: boolean;
  enviar_para_todos: boolean;
};

type AvisoLeitura = {
  user_id: string;
  lido_em: string;
  user_name: string | null;
  user_email: string | null;
};

type SistemaUsuario = {
  id: string;
  email: string;
  full_name: string | null;
};

const Home = () => {
  const navigate = useNavigate();
  const { user, userProfile, isAdmin } = useAuth();

  const firstName = userProfile?.fullName?.split(" ")[0] || "Usuário";

  // Load avisos
  const loadAvisos = async () => {
    if (!user) return;
    setLoading(true);

    const { data: avisosData, error: avisosError } = await (supabase as any)
      .from("avisos")
      .select("id, titulo, conteudo, imagem_url, created_at, criado_por_nome, arquivado, enviar_popup, enviar_para_todos")
      .order("created_at", { ascending: false });

    if (avisosError) {
      setLoading(false);
      return;
    }

    const destinatariosQuery = (supabase as any)
      .from("aviso_destinatarios")
      .select("aviso_id, user_id");

    const { data: destinatariosData } = isAdmin
      ? await destinatariosQuery
      : await destinatariosQuery.eq("user_id", user.id);

    const { data: lidosData } = await (supabase as any)
      .from("aviso_leituras")
      .select("aviso_id")
      .eq("user_id", user.id);

    const mapDestinatarios = (destinatariosData || []).reduce((acc: Record<string, Set<string>>, item: any) => {
      if (!acc[item.aviso_id]) acc[item.aviso_id] = new Set();
      acc[item.aviso_id].add(item.user_id);
      return acc;
    }, {});

    const avisosFiltrados = ((avisosData || []) as Aviso[]).filter((aviso) => {
      if (isAdmin) return true;
      if (aviso.enviar_para_todos) return true;
      return mapDestinatarios[aviso.id]?.has(user.id);
    });

    setDestinatariosPorAviso(mapDestinatarios);
    setAvisos(avisosFiltrados);
    setLidos(new Set((lidosData || []).map((item: { aviso_id: string }) => item.aviso_id)));
    setLoading(false);
  };

  const loadUsuariosSistema = async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "list" },
    });
    if (!error && data?.users) {
      setUsuariosSistema(data.users as SistemaUsuario[]);
    }
  };

  useEffect(() => { loadAvisos(); }, [user?.id]);
  useEffect(() => { if (isAdmin) loadUsuariosSistema(); }, [isAdmin]);

  const avisosAtivos = useMemo(() => avisos.filter(a => !a.arquivado), [avisos]);
  const avisosArquivados = useMemo(() => avisos.filter(a => a.arquivado), [avisos]);
  const unreadCount = useMemo(() => avisosAtivos.filter(a => !lidos.has(a.id)).length, [avisosAtivos, lidos]);

  const markAsRead = async (avisoId: string) => {
    if (!user || lidos.has(avisoId)) return;
    const { error } = await (supabase as any)
      .from("aviso_leituras")
      .upsert({ aviso_id: avisoId, user_id: user.id, lido_em: new Date().toISOString() }, { onConflict: "aviso_id,user_id" });
    if (!error) setLidos(prev => new Set([...prev, avisoId]));
  };

  const loadLeituras = async (avisoId: string) => {
    if (!isAdmin) return;
    setLoadingLeituras(true);
    setLeiturasAviso([]);
    const { data: leituras } = await (supabase as any)
      .from("aviso_leituras")
      .select("user_id, lido_em")
      .eq("aviso_id", avisoId);
    const mapped: AvisoLeitura[] = (leituras || []).map((l: any) => {
      const usr = usuariosSistema.find(u => u.id === l.user_id);
      return { user_id: l.user_id, lido_em: l.lido_em, user_name: usr?.full_name || null, user_email: usr?.email || null };
    });
    setLeiturasAviso(mapped.sort((a, b) => new Date(a.lido_em).getTime() - new Date(b.lido_em).getTime()));
    setLoadingLeituras(false);
  };

  const openAviso = async (aviso: Aviso) => {
    setSelectedAviso(aviso);
    setShowLeituras(false);
    setLeiturasAviso([]);
    await markAsRead(aviso.id);
    if (isAdmin) loadLeituras(aviso.id);
  };

  const toggleArquivar = async (aviso: Aviso, arquivar: boolean) => {
    const { error } = await (supabase as any).from("avisos").update({ arquivado: arquivar }).eq("id", aviso.id);
    if (error) { toast.error("Erro ao atualizar aviso."); return; }
    toast.success(arquivar ? "Aviso arquivado!" : "Aviso desarquivado!");
    setSelectedAviso(null);
    loadAvisos();
  };

  const deleteAviso = async (aviso: Aviso) => {
    const { error } = await (supabase as any).from("avisos").delete().eq("id", aviso.id);
    if (error) { toast.error("Erro ao apagar aviso."); return; }
    toast.success("Aviso apagado permanentemente!");
    setDeleteConfirmAviso(null);
    setSelectedAviso(null);
    loadAvisos();
  };

  const renderAvisoCard = (aviso: Aviso) => {
    const isRead = lidos.has(aviso.id);
    return (
      <button
        key={aviso.id}
        onClick={() => openAviso(aviso)}
        className={cn(
          "w-full text-left rounded-lg border p-4 transition-colors hover:bg-muted/40",
          !isRead && "border-primary/20 bg-primary/[0.03]"
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="font-semibold text-foreground text-sm truncate">{aviso.titulo}</h3>
          <Badge variant={isRead ? "secondary" : "default"} className="text-[10px] shrink-0">
            {isRead ? "Lido" : "Novo"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{aviso.conteudo}</p>
        <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
          <CalendarDays className="h-3 w-3" />
          {new Date(aviso.created_at).toLocaleString("pt-BR")}
          {aviso.criado_por_nome && <span>• {aviso.criado_por_nome}</span>}
          {aviso.enviar_popup && <span className="text-primary">• pop-up</span>}
          {!aviso.enviar_para_todos && (
            <span>• {destinatariosPorAviso[aviso.id]?.size || 0} dest.</span>
          )}
        </div>
      </button>
    );
  };

  return (
    <PageLayout>
      {/* Header */}
      <header className="h-14 border-b bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Olá, {firstName}!</h1>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <Badge variant="default" className="text-xs">
              {unreadCount} não lido{unreadCount > 1 ? "s" : ""}
            </Badge>
          )}
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => navigate("/avisos")}>
              <PlusCircle className="h-4 w-4 mr-1" />
              Escrever aviso
            </Button>
          )}
        </div>
      </header>

      {/* Avisos area */}
      <div className="flex-1 p-6 w-full overflow-auto">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Avisos</h2>
        </div>

        <Tabs defaultValue="ativos" className="w-full">
          <TabsList className="mb-4 justify-start">
            <TabsTrigger value="ativos">
              Ativos {unreadCount > 0 && `(${unreadCount} novos)`}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="arquivados">
                Arquivados {avisosArquivados.length > 0 && `(${avisosArquivados.length})`}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="ativos" className="space-y-2">
            {loading && <p className="text-sm text-muted-foreground">Carregando avisos...</p>}
            {!loading && avisosAtivos.length === 0 && (
              <div className="py-12 text-muted-foreground">
                <Bell className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Nenhum aviso publicado.</p>
              </div>
            )}
            {!loading && avisosAtivos.map(renderAvisoCard)}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="arquivados" className="space-y-2">
              {!loading && avisosArquivados.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum aviso arquivado.</p>
              )}
              {!loading && avisosArquivados.map(renderAvisoCard)}
            </TabsContent>
          )}
        </Tabs>
      </div>

      <footer className="py-3 text-center text-xs text-muted-foreground border-t">
        24Help © {new Date().getFullYear()}
      </footer>

      {/* Aviso detail dialog */}
      <Dialog open={!!selectedAviso} onOpenChange={(open) => !open && setSelectedAviso(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          {selectedAviso && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{selectedAviso.titulo}</DialogTitle>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                  <CalendarDays className="h-3 w-3" />
                  {new Date(selectedAviso.created_at).toLocaleString("pt-BR")}
                  {selectedAviso.criado_por_nome && <span>• {selectedAviso.criado_por_nome}</span>}
                </div>
              </DialogHeader>

              {selectedAviso.imagem_url && (
                <img
                  src={selectedAviso.imagem_url}
                  alt="Imagem do aviso"
                  className="rounded-lg w-full max-h-64 object-contain bg-muted"
                />
              )}

              <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                {selectedAviso.conteudo}
              </div>

              <div className="flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-primary font-medium">Lido</span>
              </div>

              {isAdmin && (
                <div className="border-t pt-3 mt-2 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleArquivar(selectedAviso, !selectedAviso.arquivado)}
                    >
                      {selectedAviso.arquivado ? <ArchiveRestore className="h-3.5 w-3.5 mr-1" /> : <Archive className="h-3.5 w-3.5 mr-1" />}
                      {selectedAviso.arquivado ? "Desarquivar" : "Arquivar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteConfirmAviso(selectedAviso)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Apagar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowLeituras(prev => !prev)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Quem leu
                    </Button>
                  </div>

                  {showLeituras && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs font-medium mb-2">Leituras ({leiturasAviso.length})</p>
                      {loadingLeituras && <p className="text-xs text-muted-foreground">Carregando...</p>}
                      {!loadingLeituras && leiturasAviso.length === 0 && (
                        <p className="text-xs text-muted-foreground">Ninguém leu ainda.</p>
                      )}
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {leiturasAviso.map(l => (
                          <div key={l.user_id} className="text-xs flex justify-between">
                            <span>{l.user_name || l.user_email || l.user_id}</span>
                            <span className="text-muted-foreground">{new Date(l.lido_em).toLocaleString("pt-BR")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmAviso} onOpenChange={(open) => !open && setDeleteConfirmAviso(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar aviso?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmAviso && deleteAviso(deleteConfirmAviso)}>
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default Home;
