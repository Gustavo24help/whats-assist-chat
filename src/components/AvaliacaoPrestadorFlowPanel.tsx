import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Wrench, Copy, Check, AlertTriangle, MessageCircle, ThumbsUp, ThumbsDown, Minus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvaliacaoPrestadorFlowPanelProps {
  clienteTelefone: string;
  clienteNome: string;
  fichaId?: string;
  onCopyMessage: (message: string) => void;
}

interface AvaliacaoResposta {
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

type AvaliacaoStep = "idle" | "waiting_score" | "waiting_feedback" | "completed";

export const AvaliacaoPrestadorFlowPanel = ({
  clienteTelefone,
  clienteNome,
  fichaId,
  onCopyMessage,
}: AvaliacaoPrestadorFlowPanelProps) => {
  const [open, setOpen] = useState(false);
  const [currentAvaliacao, setCurrentAvaliacao] = useState<AvaliacaoResposta | null>(null);
  const [step, setStep] = useState<AvaliacaoStep>("idle");
  const [loading, setLoading] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const [showAlertSupervisor, setShowAlertSupervisor] = useState(false);
  const [manualFeedback, setManualFeedback] = useState("");

  useEffect(() => {
    if (open && fichaId) {
      checkExistingAvaliacao();
    }
  }, [open, fichaId]);

  // Realtime: atualização da avaliação
  useEffect(() => {
    if (!fichaId) return;

    const channel = supabase
      .channel(`avaliacao-prestador-updates-${fichaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'avaliacao_prestador',
          filter: `ficha_id=eq.${fichaId}`
        },
        (payload) => {
          console.log("🔧 [Av.Prestador] Atualização recebida via realtime:", payload);
          const updated = payload.new as AvaliacaoResposta;
          setCurrentAvaliacao(updated);
          
          if (updated.feedback_respondido_em) {
            setStep("completed");
          } else if (updated.respondido_em && updated.nota !== null) {
            setStep("waiting_feedback");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fichaId]);

  // Realtime: monitorar mensagens do cliente para auto-detectar nota e feedback
  useEffect(() => {
    if (!clienteTelefone || !currentAvaliacao) return;
    if (step !== "waiting_score" && step !== "waiting_feedback") return;

    const channel = supabase
      .channel(`av-prestador-msgs-${clienteTelefone}-${currentAvaliacao.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens',
          filter: `cliente_id=eq.${clienteTelefone}`
        },
        (payload) => {
          const msg = payload.new as { remetente: string; texto: string | null };
          const NUMERO_24HELP_LOCAL = 'whatsapp:+554138911555';
          if (msg.remetente === NUMERO_24HELP_LOCAL || msg.remetente === 'atendente' || msg.remetente === 'bot' || !msg.texto) return;

          const texto = msg.texto.trim();
          console.log(`🔧 [Av.Prestador] Mensagem do cliente detectada: "${texto}" (step: ${step})`);

          if (step === "waiting_score") {
            const nota = parseNotaPrestador(texto);
            if (nota !== null) {
              console.log(`🔧 [Av.Prestador] Nota ${nota} auto-detectada!`);
              registrarNota(nota);
            }
          } else if (step === "waiting_feedback") {
            // Qualquer texto que não seja apenas um número é feedback
            if (!/^[1-5]$/.test(texto)) {
              console.log(`🔧 [Av.Prestador] Feedback auto-detectado: "${texto.substring(0, 50)}..."`);
              autoRegistrarFeedback(texto);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clienteTelefone, currentAvaliacao?.id, step]);

  const parseNotaPrestador = (text: string): number | null => {
    const match = text.match(/^[1-5]$/);
    return match ? parseInt(match[0], 10) : null;
  };

  const autoRegistrarFeedback = async (texto: string) => {
    if (!currentAvaliacao) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("avaliacao_prestador")
        .update({
          feedback: texto,
          feedback_respondido_em: new Date().toISOString(),
        })
        .eq("id", currentAvaliacao.id)
        .select()
        .single();

      if (error) throw error;

      setCurrentAvaliacao(data as AvaliacaoResposta);
      setStep("completed");
      toast.success("Feedback do cliente registrado automaticamente!");
    } catch (error) {
      console.error("Erro ao registrar feedback automático:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkExistingAvaliacao = async () => {
    if (!fichaId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("avaliacao_prestador")
        .select("*")
        .eq("ficha_id", fichaId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCurrentAvaliacao(data as AvaliacaoResposta);
        if (data.feedback_respondido_em) {
          setStep("completed");
        } else if (data.respondido_em && data.nota !== null) {
          setStep("waiting_feedback");
        } else if (data.enviado_em) {
          setStep("waiting_score");
        }
      } else {
        setCurrentAvaliacao(null);
        setStep("idle");
      }
    } catch (error) {
      console.error("Erro ao buscar avaliação do prestador:", error);
    } finally {
      setLoading(false);
    }
  };

  const getClassificacao = (nota: number): { classificacao: string; tipo: string } => {
    if (nota >= 4) return { classificacao: "positivo", tipo: "positivo" };
    if (nota === 3) return { classificacao: "neutro", tipo: "neutro" };
    return { classificacao: "critico", tipo: "negativo" };
  };

  const getClassificacaoBadge = (classificacao: string | null) => {
    switch (classificacao) {
      case "positivo":
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1">
            <ThumbsUp className="h-3 w-3" />
            Positivo
          </Badge>
        );
      case "neutro":
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white gap-1">
            <Minus className="h-3 w-3" />
            Neutro
          </Badge>
        );
      case "critico":
        return (
          <Badge className="bg-red-500 hover:bg-red-600 text-white gap-1">
            <ThumbsDown className="h-3 w-3" />
            Crítico
          </Badge>
        );
      default:
        return null;
    }
  };

  const getMensagemInicial = () => {
    const nome = clienteNome?.split(" ")[0] || "Cliente";
    return `Olá, ${nome}! 😊
O serviço do prestador foi finalizado.

Em uma escala de 1 a 5,
como você avalia o trabalho do prestador?

(Responda só com um número)`;
  };

  const getMensagemInvalida = () => {
    return `Pode me responder apenas com um número de 1 a 5? 😊`;
  };

  const getMensagemFollowUp = (classificacao: string) => {
    switch (classificacao) {
      case "positivo":
        return `Que ótimo! 🙌
O que mais gostou no trabalho do prestador?`;
      case "neutro":
        return `Obrigado!
O que o prestador poderia ter feito melhor?`;
      case "critico":
        return `Obrigado pela sinceridade.
O que deu errado no trabalho do prestador?`;
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

  const iniciarAvaliacao = async () => {
    if (!fichaId) {
      toast.error("É necessário ter uma ficha de serviço para enviar a avaliação do prestador");
      return;
    }

    const { data: existing } = await supabase
      .from("avaliacao_prestador")
      .select("id")
      .eq("ficha_id", fichaId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      toast.error("Já existe uma avaliação de prestador para esta ficha");
      return;
    }

    setLoading(true);
    try {
      const { data: ficha } = await supabase
        .from("fichas_de_servico")
        .select("prestador_id")
        .eq("id", fichaId)
        .single();

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("avaliacao_prestador")
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

      setCurrentAvaliacao(data as AvaliacaoResposta);
      setStep("waiting_score");
      toast.success("Avaliação do Prestador iniciada! Copie a mensagem e envie ao cliente.");
    } catch (error) {
      console.error("Erro ao iniciar avaliação:", error);
      toast.error("Erro ao iniciar avaliação do prestador");
    } finally {
      setLoading(false);
    }
  };

  const registrarNota = async (nota: number) => {
    if (!currentAvaliacao) return;
    if (nota < 1 || nota > 5) {
      toast.error("A nota deve ser entre 1 e 5");
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

      if (classificacao === "critico") {
        updateData.prioridade = true;
        setShowAlertSupervisor(true);
      }

      const { data, error } = await supabase
        .from("avaliacao_prestador")
        .update(updateData)
        .eq("id", currentAvaliacao.id)
        .select()
        .single();

      if (error) throw error;

      setCurrentAvaliacao(data as AvaliacaoResposta);
      setStep("waiting_feedback");
      toast.success(`Nota ${nota} registrada como ${classificacao.toUpperCase()}`);
    } catch (error) {
      console.error("Erro ao registrar nota:", error);
      toast.error("Erro ao registrar nota");
    } finally {
      setLoading(false);
    }
  };

  const registrarFeedback = async () => {
    if (!currentAvaliacao || !manualFeedback.trim()) {
      toast.error("Digite o feedback do cliente");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("avaliacao_prestador")
        .update({
          feedback: manualFeedback.trim(),
          feedback_respondido_em: new Date().toISOString(),
        })
        .eq("id", currentAvaliacao.id)
        .select()
        .single();

      if (error) throw error;

      setCurrentAvaliacao(data as AvaliacaoResposta);
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
    if (!currentAvaliacao) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("avaliacao_prestador")
        .update({ supervisor_alertado: true })
        .eq("id", currentAvaliacao.id);

      if (error) throw error;

      toast.success("Supervisor alertado sobre avaliação crítica do prestador");
      setShowAlertSupervisor(false);
    } catch (error) {
      console.error("Erro ao alertar supervisor:", error);
      toast.error("Erro ao alertar supervisor");
    } finally {
      setLoading(false);
    }
  };

  const pularFeedback = async () => {
    if (!currentAvaliacao) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("avaliacao_prestador")
        .update({
          feedback_respondido_em: new Date().toISOString(),
        })
        .eq("id", currentAvaliacao.id)
        .select()
        .single();

      if (error) throw error;

      setCurrentAvaliacao(data as AvaliacaoResposta);
      setStep("completed");
      toast.info("Avaliação finalizada sem feedback");
    } catch (error) {
      console.error("Erro ao pular feedback:", error);
    } finally {
      setLoading(false);
    }
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
            title={!fichaId ? "É necessário ter uma ficha de serviço" : "Avaliar prestador do serviço"}
          >
            <Wrench className="h-4 w-4" />
            <span className="hidden md:inline">Av. Prestador</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-orange-500" />
              Avaliação do Prestador
            </DialogTitle>
            <DialogDescription>
              Colete a avaliação do cliente sobre o trabalho do prestador
            </DialogDescription>
          </DialogHeader>

          {loading && !currentAvaliacao ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {currentAvaliacao && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      {getClassificacaoBadge(currentAvaliacao.classificacao)}
                    </div>
                    {currentAvaliacao.nota !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Nota</span>
                        <span className="text-2xl font-bold">{currentAvaliacao.nota}</span>
                      </div>
                    )}
                    {currentAvaliacao.feedback && (
                      <div>
                        <span className="text-sm text-muted-foreground">Feedback</span>
                        <p className="text-sm mt-1 bg-background p-2 rounded">
                          "{currentAvaliacao.feedback}"
                        </p>
                      </div>
                    )}
                    {currentAvaliacao.prioridade && (
                      <div className="flex items-center gap-2 text-red-500 text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        Avaliação crítica - prioridade
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

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

                  <Button onClick={iniciarAvaliacao} disabled={loading} className="w-full gap-2">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MessageCircle className="h-4 w-4" />
                    )}
                    Iniciar Avaliação do Prestador
                  </Button>
                </div>
              )}

              {step === "waiting_score" && (
                <div className="space-y-4">
                  <Card className="border-orange-500/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                        Aguardando resposta do cliente
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        A nota será registrada automaticamente quando o cliente responder com um número de 1 a 5. Ou registre manualmente:
                      </p>

                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Button
                            key={n}
                            variant="outline"
                            size="sm"
                            onClick={() => registrarNota(n)}
                            disabled={loading}
                            className={cn(
                              "w-9 h-9 p-0 font-bold",
                              n <= 2 && "hover:bg-red-500 hover:text-white hover:border-red-500",
                              n === 3 && "hover:bg-yellow-500 hover:text-white hover:border-yellow-500",
                              n >= 4 && "hover:bg-emerald-500 hover:text-white hover:border-emerald-500"
                            )}
                          >
                            {n}
                          </Button>
                        ))}
                      </div>

                      <div className="text-xs text-center text-muted-foreground">
                        <span className="text-red-500">1-2 Crítico</span>
                        {" • "}
                        <span className="text-yellow-500">3 Neutro</span>
                        {" • "}
                        <span className="text-emerald-500">4-5 Positivo</span>
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

              {step === "waiting_feedback" && currentAvaliacao?.classificacao && (
                <div className="space-y-4">
                  <Card className="border-blue-500/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Mensagem de follow-up</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg font-sans">
                        {getMensagemFollowUp(currentAvaliacao.classificacao)}
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full gap-2"
                        onClick={() =>
                          copyToClipboard(
                            getMensagemFollowUp(currentAvaliacao.classificacao!),
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
                    <label className="text-sm font-medium">O feedback será capturado automaticamente da resposta do cliente, ou registre manualmente:</label>
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

              {step === "completed" && (
                <div className="text-center py-4 space-y-2">
                  <div className="text-4xl">✅</div>
                  <p className="text-lg font-medium">Avaliação do Prestador concluída!</p>
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

      <AlertDialog open={showAlertSupervisor} onOpenChange={setShowAlertSupervisor}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Avaliação Crítica do Prestador
            </AlertDialogTitle>
            <AlertDialogDescription>
              O cliente deu uma nota baixa (1-2) ao prestador. Isso indica insatisfação significativa com o trabalho realizado.
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
