import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, CalendarDays, CheckCircle2, ImageIcon, PlusCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Aviso = {
  id: string;
  titulo: string;
  conteudo: string;
  imagem_url: string | null;
  created_at: string;
  criado_por_nome: string | null;
};

const Avisos = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [lidos, setLidos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedAviso, setSelectedAviso] = useState<Aviso | null>(null);

  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoConteudo, setNovoConteudo] = useState("");
  const [novaImagemUrl, setNovaImagemUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadAvisos = async () => {
    if (!user) return;

    setLoading(true);

    const { data: avisosData, error: avisosError } = await (supabase as any)
      .from("avisos")
      .select("id, titulo, conteudo, imagem_url, created_at, criado_por_nome")
      .order("created_at", { ascending: false });

    if (avisosError) {
      toast.error("Não foi possível carregar os avisos.");
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

    setAvisos((avisosData || []) as Aviso[]);
    setLidos(new Set((lidosData || []).map((item: { aviso_id: string }) => item.aviso_id)));
    setLoading(false);
  };

  useEffect(() => {
    loadAvisos();
  }, [user?.id]);

  const unreadCount = useMemo(() => avisos.filter((aviso) => !lidos.has(aviso.id)).length, [avisos, lidos]);

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

  const openAviso = async (aviso: Aviso) => {
    setSelectedAviso(aviso);
    await markAsRead(aviso.id);
  };

  const createAviso = async () => {
    if (!isAdmin) return;
    if (!novoTitulo.trim() || !novoConteudo.trim()) {
      toast.error("Preencha título e conteúdo.");
      return;
    }

    setSubmitting(true);

    const { error } = await (supabase as any).from("avisos").insert({
      titulo: novoTitulo.trim(),
      conteudo: novoConteudo.trim(),
      imagem_url: novaImagemUrl.trim() || null,
      criado_por: user?.id,
    });

    setSubmitting(false);

    if (error) {
      toast.error("Erro ao publicar aviso.");
      return;
    }

    toast.success("Aviso publicado com sucesso!");
    setNovoTitulo("");
    setNovoConteudo("");
    setNovaImagemUrl("");
    loadAvisos();
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
                <TabsTrigger value="lista">Avisos prévios</TabsTrigger>
                <TabsTrigger value="novo" disabled={!isAdmin}>Escrever aviso</TabsTrigger>
              </TabsList>

              <TabsContent value="lista" className="space-y-3">
                <div className="text-sm text-muted-foreground mb-3">
                  {unreadCount > 0 ? `Você tem ${unreadCount} aviso(s) não lido(s).` : "Todos os avisos estão lidos."}
                </div>

                {loading && <p className="text-sm text-muted-foreground">Carregando avisos...</p>}

                {!loading && avisos.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum aviso publicado até o momento.</p>
                )}

                {!loading &&
                  avisos.map((aviso) => {
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
                        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {new Date(aviso.created_at).toLocaleString("pt-BR")}
                        </div>
                      </button>
                    );
                  })}
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
                      placeholder="Escreva o conteúdo do aviso"
                      value={novoConteudo}
                      onChange={(event) => setNovoConteudo(event.target.value)}
                      rows={8}
                    />
                    <Input
                      placeholder="URL da imagem (opcional)"
                      value={novaImagemUrl}
                      onChange={(event) => setNovaImagemUrl(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Nesta versão, imagens são aceitas por URL. Upload direto de arquivo ainda não foi implementado.
                    </p>
                    <Button onClick={createAviso} disabled={submitting}>
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

      <Dialog open={!!selectedAviso} onOpenChange={(open) => !open && setSelectedAviso(null)}>
        <DialogContent className="max-w-2xl">
          {selectedAviso && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedAviso.titulo}</DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {new Date(selectedAviso.created_at).toLocaleString("pt-BR")}
                  {selectedAviso.criado_por_nome ? ` • por ${selectedAviso.criado_por_nome}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
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
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Avisos;
