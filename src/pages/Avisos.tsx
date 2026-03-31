import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, ArchiveRestore, ArrowLeft, Bell, CalendarDays, CheckCircle2, Eye, ImageIcon, PlusCircle, Trash2, Upload, Users, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageLayout } from "@/components/PageLayout";

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

type AvisoDestinatario = {
  aviso_id: string;
  user_id: string;
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

const Avisos = () => {
  const navigate = useNavigate();
  const { user, userProfile, isAdmin } = useAuth();

  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [lidos, setLidos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedAviso, setSelectedAviso] = useState<Aviso | null>(null);
  const [deleteConfirmAviso, setDeleteConfirmAviso] = useState<Aviso | null>(null);

  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoConteudo, setNovoConteudo] = useState("");
  const [novaImagemUrl, setNovaImagemUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [enviarPopup, setEnviarPopup] = useState(false);
  const [enviarParaTodos, setEnviarParaTodos] = useState(true);
  const [usuariosSistema, setUsuariosSistema] = useState<SistemaUsuario[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [destinatariosPorAviso, setDestinatariosPorAviso] = useState<Record<string, Set<string>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [leiturasAviso, setLeiturasAviso] = useState<AvisoLeitura[]>([]);
  const [loadingLeituras, setLoadingLeituras] = useState(false);
  const [showLeituras, setShowLeituras] = useState(false);

  const loadUsuariosSistema = async () => {
    if (!isAdmin) return;

    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "list" },
    });

    if (error || !data?.users) {
      toast.error("Não foi possível carregar a lista de usuários para destinatários.");
      return;
    }

    setUsuariosSistema(data.users as SistemaUsuario[]);
  };

  const loadAvisos = async () => {
    if (!user) return;
    setLoading(true);

    let avisosBase: Aviso[] = [];
    let targetingAtivo = true;

    const { data: avisosComTarget, error: avisosComTargetError } = await (supabase as any)
      .from("avisos")
      .select("id, titulo, conteudo, imagem_url, created_at, criado_por_nome, arquivado, enviar_popup, enviar_para_todos")
      .order("created_at", { ascending: false });

    if (avisosComTargetError) {
      const { data: avisosLegado, error: avisosLegadoError } = await (supabase as any)
        .from("avisos")
        .select("id, titulo, conteudo, imagem_url, created_at, criado_por_nome, arquivado")
        .order("created_at", { ascending: false });

      if (avisosLegadoError) {
        toast.error("Não foi possível carregar os avisos.");
        setLoading(false);
        return;
      }

      targetingAtivo = false;
      avisosBase = (avisosLegado || []).map((aviso: any) => ({
        ...aviso,
        enviar_popup: false,
        enviar_para_todos: true,
      }));
    } else {
      avisosBase = (avisosComTarget || []) as Aviso[];
    }

    const destinatariosQuery = (supabase as any)
      .from("aviso_destinatarios")
      .select("aviso_id, user_id");

    const { data: destinatariosData, error: destinatariosError } = isAdmin
      ? await destinatariosQuery
      : await destinatariosQuery.eq("user_id", user.id);

    if (destinatariosError) {
      toast.error("Não foi possível carregar os destinatários dos avisos.");
      setLoading(false);
      return;
    }

    const { data: lidosData, error: lidosError } = await (supabase as any)
      .from("aviso_leituras")
      .select("aviso_id")
      .eq("user_id", user.id);

    if (lidosError) {
      toast.error("Não foi possível carregar o status de leitura dos avisos.");
      setLoading(false);
      return;
    }

    const mapDestinatarios = (destinatariosData || []).reduce((acc: Record<string, Set<string>>, item: AvisoDestinatario) => {
      if (!acc[item.aviso_id]) acc[item.aviso_id] = new Set();
      acc[item.aviso_id].add(item.user_id);
      return acc;
    }, {});

    const avisosFiltrados = ((avisosBase || []) as Aviso[]).filter((aviso) => {
      if (isAdmin) return true;
      if (aviso.enviar_para_todos) return true;
      return mapDestinatarios[aviso.id]?.has(user.id);
    });

    setDestinatariosPorAviso(mapDestinatarios);
    setAvisos(avisosFiltrados);
    setLidos(new Set((lidosData || []).map((item: { aviso_id: string }) => item.aviso_id)));
    setLoading(false);
  };

  useEffect(() => {
    loadAvisos();
  }, [user?.id]);

  useEffect(() => {
    if (isAdmin) {
      loadUsuariosSistema();
    }
  }, [isAdmin]);

  const avisosAtivos = useMemo(() => avisos.filter((a) => !a.arquivado), [avisos]);
  const avisosArquivados = useMemo(() => avisos.filter((a) => a.arquivado), [avisos]);
  const unreadCount = useMemo(() => avisosAtivos.filter((aviso) => !lidos.has(aviso.id)).length, [avisosAtivos, lidos]);

  const markAsRead = async (avisoId: string) => {
    if (!user || lidos.has(avisoId)) return;
    const { error } = await (supabase as any)
      .from("aviso_leituras")
      .upsert({ aviso_id: avisoId, user_id: user.id, lido_em: new Date().toISOString() }, { onConflict: "aviso_id,user_id" });
    if (error) {
      toast.error("Erro ao marcar aviso como lido.");
      return;
    }
    setLidos((prev) => new Set([...prev, avisoId]));
  };

  const loadLeituras = async (avisoId: string) => {
    if (!isAdmin) return;
    setLoadingLeituras(true);
    setLeiturasAviso([]);

    const { data: leituras, error } = await (supabase as any)
      .from("aviso_leituras")
      .select("user_id, lido_em")
      .eq("aviso_id", avisoId);

    if (error) {
      setLoadingLeituras(false);
      return;
    }

    // Map user IDs to names using usuariosSistema
    const mapped: AvisoLeitura[] = (leituras || []).map((l: any) => {
      const usr = usuariosSistema.find((u) => u.id === l.user_id);
      return {
        user_id: l.user_id,
        lido_em: l.lido_em,
        user_name: usr?.full_name || null,
        user_email: usr?.email || null,
      };
    });

    setLeiturasAviso(mapped.sort((a, b) => new Date(a.lido_em).getTime() - new Date(b.lido_em).getTime()));
    setLoadingLeituras(false);
  };

  const openAviso = async (aviso: Aviso) => {
    setSelectedAviso(aviso);
    setShowLeituras(false);
    setLeiturasAviso([]);
    await markAsRead(aviso.id);
    if (isAdmin) {
      loadLeituras(aviso.id);
    }
  };

  const toggleArquivar = async (aviso: Aviso, arquivar: boolean) => {
    const { error } = await (supabase as any)
      .from("avisos")
      .update({ arquivado: arquivar })
      .eq("id", aviso.id);

    if (error) {
      toast.error("Erro ao atualizar aviso.");
      return;
    }

    toast.success(arquivar ? "Aviso arquivado!" : "Aviso desarquivado!");
    setSelectedAviso(null);
    loadAvisos();
  };

  const deleteAviso = async (aviso: Aviso) => {
    const { error } = await (supabase as any)
      .from("avisos")
      .delete()
      .eq("id", aviso.id);

    if (error) {
      toast.error("Erro ao apagar aviso.");
      return;
    }

    toast.success("Aviso apagado permanentemente!");
    setDeleteConfirmAviso(null);
    setSelectedAviso(null);
    loadAvisos();
  };

  // Upload de imagem para o bucket
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas.");
      return;
    }
    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;

    const { error } = await supabase.storage.from("avisos-images").upload(fileName, file);
    if (error) {
      toast.error("Erro ao enviar imagem.");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avisos-images").getPublicUrl(fileName);
    setNovaImagemUrl(urlData.publicUrl);
    setImagePreview(urlData.publicUrl);
    setUploading(false);
    toast.success("Imagem enviada com sucesso!");
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleImageUpload(file);
        return;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleImageUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeImage = () => {
    setNovaImagemUrl("");
    setImagePreview(null);
  };

  const createAviso = async () => {
    if (!isAdmin) return;
    if (!novoTitulo.trim() || !novoConteudo.trim()) {
      toast.error("Preencha título e conteúdo.");
      return;
    }

    if (!enviarParaTodos && selectedUserIds.size === 0) {
      toast.error("Escolha ao menos um usuário destinatário.");
      return;
    }

    setSubmitting(true);

    const { data: avisoCriado, error } = await (supabase as any).from("avisos").insert({
      titulo: novoTitulo.trim(),
      conteudo: novoConteudo.trim(),
      imagem_url: novaImagemUrl.trim() || null,
      criado_por: user?.id,
      criado_por_nome: userProfile?.fullName || null,
      enviar_popup: enviarPopup,
      enviar_para_todos: enviarParaTodos,
    }).select("id").single();

    if (error) {
      setSubmitting(false);
      toast.error("Erro ao publicar aviso.");
      return;
    }

    if (!enviarParaTodos && avisoCriado?.id) {
      const destinatarios = Array.from(selectedUserIds).map((userId) => ({
        aviso_id: avisoCriado.id,
        user_id: userId,
      }));

      const { error: destinatariosError } = await (supabase as any).from("aviso_destinatarios").insert(destinatarios);

      if (destinatariosError) {
        setSubmitting(false);
        toast.error("Aviso criado, mas houve erro ao salvar os destinatários.");
        return;
      }
    }

    setSubmitting(false);

    toast.success("Aviso publicado com sucesso!");
    setNovoTitulo("");
    setNovoConteudo("");
    setNovaImagemUrl("");
    setImagePreview(null);
    setEnviarPopup(false);
    setEnviarParaTodos(true);
    setSelectedUserIds(new Set());
    loadAvisos();
  };

  const toggleDestinatario = (userId: string, checked: boolean) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return next;
    });
  };

  const renderAvisoCard = (aviso: Aviso) => {
    const isRead = lidos.has(aviso.id);
    return (
      <button
        key={aviso.id}
        onClick={() => openAviso(aviso)}
        className="w-full text-left rounded-lg border p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-foreground truncate">{aviso.titulo}</h3>
          <Badge variant={isRead ? "secondary" : "default"}>{isRead ? "Lido" : "Não lido"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{aviso.conteudo}</p>
        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          <CalendarDays className="h-3.5 w-3.5" />
          {new Date(aviso.created_at).toLocaleString("pt-BR")}
          {aviso.enviar_popup && <span className="text-brand-green">• pop-up ativo</span>}
          {!aviso.enviar_para_todos && (
            <span>• {destinatariosPorAviso[aviso.id]?.size || 0} destinatário(s)</span>
          )}
          {aviso.criado_por_nome && (
            <span className="text-muted-foreground">• por {aviso.criado_por_nome}</span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex flex-col">
      <header className="h-16 border-b bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 shadow-sm">
        <Logo />
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Home
        </Button>
      </header>

      <main className="flex-1 container max-w-5xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-brand-yellow" />
              Avisos
            </CardTitle>
            <CardDescription>
              Central de comunicados para toda a equipe. Clique no aviso para abrir os detalhes e marcar como lido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="lista" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="lista">
                  Avisos {unreadCount > 0 && `(${unreadCount})`}
                </TabsTrigger>
                <TabsTrigger value="arquivados">
                  Arquivados {avisosArquivados.length > 0 && `(${avisosArquivados.length})`}
                </TabsTrigger>
                <TabsTrigger value="novo" disabled={!isAdmin}>Escrever aviso</TabsTrigger>
              </TabsList>

              <TabsContent value="lista" className="space-y-3">
                <div className="text-sm text-muted-foreground mb-3">
                  {unreadCount > 0 ? `Você tem ${unreadCount} aviso(s) não lido(s).` : "Todos os avisos estão lidos."}
                </div>

                {loading && <p className="text-sm text-muted-foreground">Carregando avisos...</p>}

                {!loading && avisosAtivos.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum aviso publicado até o momento.</p>
                )}

                {!loading && avisosAtivos.map(renderAvisoCard)}
              </TabsContent>

              <TabsContent value="arquivados" className="space-y-3">
                {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

                {!loading && avisosArquivados.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum aviso arquivado.</p>
                )}

                {!loading && avisosArquivados.map(renderAvisoCard)}
              </TabsContent>

              <TabsContent value="novo">
                {!isAdmin ? (
                  <p className="text-sm text-muted-foreground">Apenas administradores podem criar avisos.</p>
                ) : (
                  <div className="space-y-4">
                    <Input
                      placeholder="Título do aviso"
                      value={novoTitulo}
                      onChange={(event) => setNovoTitulo(event.target.value)}
                    />
                    <Textarea
                      placeholder="Escreva o conteúdo do aviso (cole uma imagem aqui com Ctrl+V)"
                      value={novoConteudo}
                      onChange={(event) => setNovoConteudo(event.target.value)}
                      onPaste={handlePaste}
                      rows={8}
                    />

                    {/* Upload de imagem */}
                    <div
                      className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file);
                        }}
                      />
                      {uploading ? (
                        <p className="text-sm text-muted-foreground">Enviando imagem...</p>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Clique para enviar imagem, arraste aqui, ou cole com Ctrl+V no campo acima
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Preview da imagem */}
                    {imagePreview && (
                      <div className="relative rounded-md border overflow-hidden">
                        <img src={imagePreview} alt="Preview" className="w-full h-auto max-h-64 object-contain" />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7"
                          onClick={removeImage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    <div className="space-y-3 rounded-md border p-3">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="enviar-para-todos"
                          checked={enviarParaTodos}
                          onCheckedChange={(checked) => setEnviarParaTodos(checked === true)}
                        />
                        <div className="grid gap-1.5">
                          <Label htmlFor="enviar-para-todos">Enviar para todos os usuários</Label>
                          <p className="text-xs text-muted-foreground">
                            Desmarque para escolher manualmente quem receberá este aviso.
                          </p>
                        </div>
                      </div>

                      {!enviarParaTodos && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Destinatários</p>
                          <ScrollArea className="h-40 rounded border p-2">
                            <div className="space-y-2">
                              {usuariosSistema.map((usuario) => {
                                const checked = selectedUserIds.has(usuario.id);
                                return (
                                  <label key={usuario.id} className="flex items-start gap-2 rounded p-1 hover:bg-muted/40 cursor-pointer">
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(value) => toggleDestinatario(usuario.id, value === true)}
                                    />
                                    <span className="text-sm">
                                      {usuario.full_name || "Sem nome"}
                                      <span className="block text-xs text-muted-foreground">{usuario.email}</span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        </div>
                      )}

                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="enviar-popup"
                          checked={enviarPopup}
                          onCheckedChange={(checked) => setEnviarPopup(checked === true)}
                        />
                        <div className="grid gap-1.5">
                          <Label htmlFor="enviar-popup">Exibir pop-up instantâneo para destinatários</Label>
                          <p className="text-xs text-muted-foreground">
                            O pop-up não bloqueia a operação do sistema e fecha ao clicar fora.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button onClick={createAviso} disabled={submitting || uploading}>
                      <PlusCircle className="h-4 w-4 mr-2" />
                      {submitting ? "Publicando..." : "Publicar aviso"}
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      {/* Dialog de detalhes do aviso */}
      <Dialog open={!!selectedAviso} onOpenChange={(open) => !open && setSelectedAviso(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          {selectedAviso && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedAviso.titulo}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 flex-wrap">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {new Date(selectedAviso.created_at).toLocaleString("pt-BR")}
                  {selectedAviso.criado_por_nome ? ` • por ${selectedAviso.criado_por_nome}` : ""}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 max-h-[60vh]">
                <div className="space-y-4 pr-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedAviso.conteudo}</p>

                  {selectedAviso.imagem_url && (
                    <div className="rounded-md border overflow-hidden">
                      <img src={selectedAviso.imagem_url} alt={selectedAviso.titulo} className="w-full h-auto" />
                    </div>
                  )}

                  {!selectedAviso.imagem_url && (
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <ImageIcon className="h-3.5 w-3.5" />
                      Este aviso não possui imagem.
                    </div>
                  )}

                  <div className="text-xs text-brand-green flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Marcado como lido
                  </div>

                  {/* Quem leu - apenas admin */}
                  {isAdmin && (
                    <div className="border rounded-md p-3 space-y-2">
                      <button
                        onClick={() => setShowLeituras(!showLeituras)}
                        className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors w-full"
                      >
                        <Eye className="h-4 w-4" />
                        Quem leu este aviso ({leiturasAviso.length})
                        <span className="text-xs text-muted-foreground ml-auto">
                          {showLeituras ? "▲" : "▼"}
                        </span>
                      </button>

                      {showLeituras && (
                        <div className="space-y-1 pt-1">
                          {loadingLeituras && (
                            <p className="text-xs text-muted-foreground">Carregando...</p>
                          )}
                          {!loadingLeituras && leiturasAviso.length === 0 && (
                            <p className="text-xs text-muted-foreground">Ninguém leu ainda.</p>
                          )}
                          {!loadingLeituras && leiturasAviso.map((leitura) => (
                            <div key={leitura.user_id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                              <div className="flex items-center gap-2">
                                <Users className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium">
                                  {leitura.user_name || leitura.user_email || "Usuário desconhecido"}
                                </span>
                              </div>
                              <span className="text-muted-foreground">
                                {new Date(leitura.lido_em).toLocaleString("pt-BR")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Action buttons */}
              {isAdmin && (
                <div className="flex items-center gap-2 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleArquivar(selectedAviso, !selectedAviso.arquivado)}
                  >
                    {selectedAviso.arquivado ? (
                      <>
                        <ArchiveRestore className="h-4 w-4 mr-2" />
                        Desarquivar
                      </>
                    ) : (
                      <>
                        <Archive className="h-4 w-4 mr-2" />
                        Arquivar
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteConfirmAviso(selectedAviso)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Apagar
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteConfirmAviso} onOpenChange={(open) => !open && setDeleteConfirmAviso(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar aviso permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O aviso "{deleteConfirmAviso?.titulo}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteConfirmAviso && deleteAviso(deleteConfirmAviso)}
            >
              Apagar permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Avisos;
