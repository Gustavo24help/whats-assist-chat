import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Star, Copy, Check, AlertTriangle, MessageCircle, ThumbsUp, ThumbsDown, Minus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface NPSFlowPanelProps {
  clienteTelefone: string;
  clienteNome: string;
  fichaId?: string;
  onCopyMessage: (message: string) => void;
}

interface NPSResposta {
  id: string;
  ficha_id: string;
  telefone_cliente: string;
  nota: number | null;
  classificacao: string | null;
  feedback: string | null;
  tipo_feedback: string | null;
  enviado_em: string;
  respondido_em: string | null;
  feedback_respondido_em: string | null;
  prioridade: boolean;
  supervisor_alertado: boolean;
}

type NPSStep = "idle" | "waiting_score" | "waiting_feedback" | "completed";

export const NPSFlowPanel = ({
  clienteTelefone,
  clienteNome,
  fichaId,
  onCopyMessage,
}: NPSFlowPanelProps) => {
  const [open, setOpen] = useState(false);
  const [currentNPS, setCurrentNPS] = useState<NPSResposta | null>(null);
  const [step, setStep] = useState<NPSStep>("idle");
  const [loading, setLoading] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const [showAlertSupervisor, setShowAlertSupervisor] = useState(false);
  const [manualScore, setManualScore] = useState<string>("");
  const [manualFeedback, setManualFeedback] = useState<string>("");

  // Carregar NPS existente quando abrir o dialog
  useEffect(() => {
    if (open && fichaId) {
      checkExistingNPS();
    }
  }, [open, fichaId]);

  // Realtime subscription para atualizar automaticamente quando cliente responder
  useEffect(() => {
    if (!fichaId) return;

    const channel = supabase
      .channel(`nps-updates-${fichaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'nps_respostas',
          filter: `ficha_id=eq.${fichaId}`
        },
        (payload) => {
          console.log("📊 [NPS] Atualização recebida via realtime:", payload);
          const updatedNPS = payload.new as NPSResposta;
          setCurrentNPS(updatedNPS);
          
          // Atualizar step baseado no novo estado (sem popups)
          if (updatedNPS.feedback_respondido_em) {
            setStep("completed");
          } else if (updatedNPS.respondido_em && updatedNPS.nota !== null) {
            setStep("waiting_feedback");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fichaId]);

  const checkExistingNPS = async () => {
    if (!fichaId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("nps_respostas")
        .select("*")
        .eq("ficha_id", fichaId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCurrentNPS(data as NPSResposta);
        // Determinar o step baseado no estado
        if (data.feedback_respondido_em) {
          setStep("completed");
        } else if (data.respondido_em && data.nota !== null) {
          setStep("waiting_feedback");
        } else if (data.enviado_em) {
          setStep("waiting_score");
        }
      } else {
        setCurrentNPS(null);
        setStep("idle");
      }
    } catch (error) {
      console.error("Erro ao buscar NPS:", error);
    } finally {
      setLoading(false);
    }
  };

  const getClassificacao = (nota: number): { classificacao: string; tipo: string } => {
    if (nota >= 9) return { classificacao: "promotor", tipo: "positivo" };
    if (nota >= 7) return { classificacao: "neutro", tipo: "neutro" };
    return { classificacao: "detrator", tipo: "negativo" };
  };

  const getClassificacaoBadge = (classificacao: string | null) => {
    switch (classificacao) {
      case "promotor":
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1">
            <ThumbsUp className="h-3 w-3" />
            Promotor
          </Badge>
        );
      case "neutro":
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white gap-1">
            <Minus className="h-3 w-3" />
            Neutro
          </Badge>
        );
      case "detrator":
        return (
          <Badge className="bg-red-500 hover:bg-red-600 text-white gap-1">
            <ThumbsDown className="h-3 w-3" />
            Detrator
          </Badge>
        );
      default:
        return null;
    }
  };

  // Mensagens sugeridas
  const getMensagemInicial = () => {
    const nome = clienteNome?.split(" ")[0] || "Cliente";
    return `Olá, ${nome}! 😊
Seu atendimento foi finalizado agora.

Em uma escala de 0 a 10,
o quanto você recomendaria a 24help para um amigo?

(Pode responder só com um número)`;
  };

  const getMensagemInvalida = () => {
    return `Pode me responder apenas com um número de 0 a 10? 😊`;
  };

  const getMensagemFollowUp = (classificacao: string) => {
    switch (classificacao) {
      case "promotor":
        return `Que ótimo! 🙌
O que mais te fez dar essa nota?`;
      case "neutro":
        return `Obrigado!
O que podemos melhorar para chegar no 10?`;
      case "detrator":
        return `Obrigado pela sinceridade.
Pode me contar o que deu errado na sua experiência?`;
      default:
        return "";
    }
  };

  const copyToClipboard = async (message: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedMessage(messageId);
      onCopyMessage(message);
      toast.success("Mensagem copiada! Cole no chat para enviar.");
      setTimeout(() => setCopiedMessage(null), 2000);
    } catch (error) {
      toast.error("Erro ao copiar mensagem");
    }
  };

  const iniciarNPS = async () => {
    if (!fichaId) {
      toast.error("É necessário ter uma ficha de serviço para enviar NPS");
      return;
    }

    // Verificar se já existe NPS para esta ficha
    const { data: existingNPS } = await supabase
      .from("nps_respostas")
      .select("id")
      .eq("ficha_id", fichaId)
      .limit(1)
      .maybeSingle();

    if (existingNPS) {
      toast.error("Já existe uma pesquisa NPS para esta ficha");
      return;
    }

    setLoading(true);
    try {
      // Buscar prestador da ficha
      const { data: ficha } = await supabase
        .from("fichas_de_servico")
        .select("prestador_id")
        .eq("id", fichaId)
        .single();

      // Pegar ID do usuário atual
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("nps_respostas")
        .insert({
          ficha_id: fichaId,
          telefone_cliente: clienteTelefone,
          prestador_id: ficha?.prestador_id || null,
          operador_id: user?.id || null,
          enviado_em: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentNPS(data as NPSResposta);
      setStep("waiting_score");
      toast.success("Pesquisa NPS iniciada! Copie a mensagem e envie ao cliente.");
    } catch (error) {
      console.error("Erro ao iniciar NPS:", error);
      toast.error("Erro ao iniciar pesquisa NPS");
    } finally {
      setLoading(false);
    }
  };

  const registrarNota = async (nota: number) => {
    if (!currentNPS) return;

    if (nota < 0 || nota > 10) {
      toast.error("A nota deve ser entre 0 e 10");
      return;
    }

    const { classificacao, tipo } = getClassificacao(nota);

    setLoading(true);
    try {
      const updateData: any = {
        nota,
        classificacao,
        tipo_feedback: tipo,
        respondido_em: new Date().toISOString(),
      };

      // Se for detrator, marcar como prioridade
      if (classificacao === "detrator") {
        updateData.prioridade = true;
        setShowAlertSupervisor(true);
      }

      const { data, error } = await supabase
        .from("nps_respostas")
        .update(updateData)
        .eq("id", currentNPS.id)
        .select()
        .single();

      if (error) throw error;

      setCurrentNPS(data as NPSResposta);
      setStep("waiting_feedback");
      setManualScore("");
      toast.success(`Nota ${nota} registrada como ${classificacao.toUpperCase()}`);
    } catch (error) {
      console.error("Erro ao registrar nota:", error);
      toast.error("Erro ao registrar nota");
    } finally {
      setLoading(false);
    }
  };

  const registrarFeedback = async () => {
    if (!currentNPS || !manualFeedback.trim()) {
      toast.error("Digite o feedback do cliente");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("nps_respostas")
        .update({
          feedback: manualFeedback.trim(),
          feedback_respondido_em: new Date().toISOString(),
        })
        .eq("id", currentNPS.id)
        .select()
        .single();

      if (error) throw error;

      setCurrentNPS(data as NPSResposta);
      setStep("completed");
      setManualFeedback("");
      toast.success("Feedback registrado com sucesso!");
    } catch (error) {
      console.error("Erro ao registrar feedback:", error);
      toast.error("Erro ao registrar feedback");
    } finally {
      setLoading(false);
    }
  };

  const alertarSupervisor = async () => {
    if (!currentNPS) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("nps_respostas")
        .update({ supervisor_alertado: true })
        .eq("id", currentNPS.id);

      if (error) throw error;

      toast.success("Supervisor alertado sobre cliente detrator");
      setShowAlertSupervisor(false);
    } catch (error) {
      console.error("Erro ao alertar supervisor:", error);
      toast.error("Erro ao alertar supervisor");
    } finally {
      setLoading(false);
    }
  };

  const pularFeedback = async () => {
    if (!currentNPS) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("nps_respostas")
        .update({
          feedback_respondido_em: new Date().toISOString(),
        })
        .eq("id", currentNPS.id)
        .select()
        .single();

      if (error) throw error;

      setCurrentNPS(data as NPSResposta);
      setStep("completed");
      toast.info("Pesquisa finalizada sem feedback");
    } catch (error) {
      console.error("Erro ao pular feedback:", error);
    } finally {
      setLoading(false);
    }
  };

  // Detectar se uma mensagem contém nota válida
  const isValidScore = (text: string): number | null => {
    const cleaned = text.trim();
    const match = cleaned.match(/^(10|[0-9])$/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!fichaId}
            title={!fichaId ? "É necessário ter uma ficha de serviço" : "Enviar pesquisa NPS"}
          >
            <Star className="h-4 w-4" />
            <span className="hidden md:inline">NPS</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Pesquisa NPS
            </DialogTitle>
            <DialogDescription>
              Colete a avaliação do cliente após o atendimento
            </DialogDescription>
          </DialogHeader>

          {loading && !currentNPS ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status atual */}
              {currentNPS && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      {getClassificacaoBadge(currentNPS.classificacao)}
                    </div>
                    {currentNPS.nota !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Nota</span>
                        <span className="text-2xl font-bold">{currentNPS.nota}</span>
                      </div>
                    )}
                    {currentNPS.feedback && (
                      <div>
                        <span className="text-sm text-muted-foreground">Feedback</span>
                        <p className="text-sm mt-1 bg-background p-2 rounded">
                          "{currentNPS.feedback}"
                        </p>
                      </div>
                    )}
                    {currentNPS.prioridade && (
                      <div className="flex items-center gap-2 text-red-500 text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        Cliente marcado como prioridade
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Step: Idle - Iniciar NPS */}
              {step === "idle" && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Mensagem sugerida</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg font-sans">
                        {getMensagemInicial()}
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full gap-2"
                        onClick={() => copyToClipboard(getMensagemInicial(), "inicial")}
                      >
                        {copiedMessage === "inicial" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        Copiar mensagem
                      </Button>
                    </CardContent>
                  </Card>

                  <Button onClick={iniciarNPS} disabled={loading} className="w-full gap-2">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MessageCircle className="h-4 w-4" />
                    )}
                    Iniciar Pesquisa NPS
                  </Button>
                </div>
              )}

              {/* Step: Waiting Score */}
              {step === "waiting_score" && (
                <div className="space-y-4">
                  <Card className="border-yellow-500/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                        Aguardando resposta do cliente
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Quando o cliente responder, registre a nota abaixo:
                      </p>

                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <Button
                            key={n}
                            variant="outline"
                            size="sm"
                            onClick={() => registrarNota(n)}
                            disabled={loading}
                            className={cn(
                              "w-9 h-9 p-0 font-bold",
                              n <= 6 && "hover:bg-red-500 hover:text-white hover:border-red-500",
                              n >= 7 && n <= 8 && "hover:bg-yellow-500 hover:text-white hover:border-yellow-500",
                              n >= 9 && "hover:bg-emerald-500 hover:text-white hover:border-emerald-500"
                            )}
                          >
                            {n}
                          </Button>
                        ))}
                      </div>

                      <div className="text-xs text-center text-muted-foreground">
                        <span className="text-red-500">0-6 Detrator</span>
                        {" • "}
                        <span className="text-yellow-500">7-8 Neutro</span>
                        {" • "}
                        <span className="text-emerald-500">9-10 Promotor</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Se resposta inválida:</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg font-sans">
                        {getMensagemInvalida()}
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full gap-2"
                        onClick={() => copyToClipboard(getMensagemInvalida(), "invalida")}
                      >
                        {copiedMessage === "invalida" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        Copiar mensagem
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Step: Waiting Feedback */}
              {step === "waiting_feedback" && currentNPS?.classificacao && (
                <div className="space-y-4">
                  <Card className="border-blue-500/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Mensagem de follow-up</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg font-sans">
                        {getMensagemFollowUp(currentNPS.classificacao)}
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full gap-2"
                        onClick={() =>
                          copyToClipboard(
                            getMensagemFollowUp(currentNPS.classificacao!),
                            "followup"
                          )
                        }
                      >
                        {copiedMessage === "followup" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        Copiar mensagem
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Registrar feedback do cliente:</label>
                    <Textarea
                      placeholder="Cole aqui a resposta do cliente..."
                      value={manualFeedback}
                      onChange={(e) => setManualFeedback(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={registrarFeedback}
                        disabled={loading || !manualFeedback.trim()}
                        className="flex-1"
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Salvar Feedback"
                        )}
                      </Button>
                      <Button variant="ghost" onClick={pularFeedback} disabled={loading}>
                        Pular
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step: Completed */}
              {step === "completed" && (
                <div className="text-center py-4 space-y-2">
                  <div className="text-4xl">✅</div>
                  <p className="text-lg font-medium">Pesquisa NPS concluída!</p>
                  <p className="text-sm text-muted-foreground">
                    Os dados foram salvos com sucesso.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert para supervisor */}
      <AlertDialog open={showAlertSupervisor} onOpenChange={setShowAlertSupervisor}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Cliente Detrator Identificado
            </AlertDialogTitle>
            <AlertDialogDescription>
              O cliente deu uma nota baixa (0-6). Isso indica insatisfação significativa.
              Deseja alertar o supervisor imediatamente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não alertar agora</AlertDialogCancel>
            <AlertDialogAction
              onClick={alertarSupervisor}
              className="bg-red-500 hover:bg-red-600"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Alertar Supervisor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
