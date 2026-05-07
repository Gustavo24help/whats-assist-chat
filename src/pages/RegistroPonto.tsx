import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock3, LogIn, LogOut, Plus, Timer, TrendingDown, TrendingUp } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageLayout } from "@/components/PageLayout";

interface RegistroPonto {
  id: string;
  user_id: string;
  entrada_em: string;
  entrada_oficial: string | null;
  saida_em: string | null;
  tipo: string;
  observacao: string | null;
  created_at: string;
}

interface ConfigPonto {
  carga_diaria_minutos: number;
  hora_inicio_prevista: string;
  hora_fim_prevista: string;
  saldo_inicial_minutos: number;
}

const PAGE_SIZE = 10;

const formatMinutes = (mins: number): string => {
  const sign = mins < 0 ? "-" : "";
  const abs = Math.abs(Math.floor(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h${m.toString().padStart(2, "0")}min`;
};

const formatTimer = (mins: number): string => {
  const sign = mins < 0 ? "-" : "";
  const abs = Math.abs(Math.floor(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const s = Math.floor((Math.abs(mins) - abs) * 60);
  return `${sign}${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};


const formatHourMinute = (date: Date): string =>
  date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const RegistroPontoPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [registros, setRegistros] = useState<RegistroPonto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(Date.now());
  const [config, setConfig] = useState<ConfigPonto | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // Config form
  const [cfgCarga, setCfgCarga] = useState("08:00");
  const [cfgInicio, setCfgInicio] = useState("08:00");
  const [cfgFim, setCfgFim] = useState("17:00");
  const [cfgSaldo, setCfgSaldo] = useState("0");
  const [showConfig, setShowConfig] = useState(false);

  // Manual entry form
  const [showManual, setShowManual] = useState(false);
  const [showHorarioPrevisto, setShowHorarioPrevisto] = useState(true);
  const [manualData, setManualData] = useState("");
  const [manualEntrada, setManualEntrada] = useState("");
  const [manualSaida, setManualSaida] = useState("");
  const [manualObs, setManualObs] = useState("");

  // Timer tick
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadConfig = useCallback(async () => {
    if (!user) return;
    setConfigLoading(true);
    const { data } = await (supabase as any)
      .from("configuracao_ponto")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setConfig(data);
      const h = Math.floor(data.carga_diaria_minutos / 60);
      const m = data.carga_diaria_minutos % 60;
      setCfgCarga(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      setCfgInicio(data.hora_inicio_prevista?.slice(0, 5) || "08:00");
      setCfgFim(data.hora_fim_prevista?.slice(0, 5) || "17:00");
      setCfgSaldo(String(data.saldo_inicial_minutos || 0));
    }
    setConfigLoading(false);
  }, [user]);

  const loadRegistros = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("registro_ponto")
      .select("*")
      .eq("user_id", user.id)
      .order("entrada_em", { ascending: false });

    if (error) {
      toast.error("Não foi possível carregar os registros de ponto.");
      setLoading(false);
      return;
    }
    setRegistros(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadConfig();
    loadRegistros();
  }, [loadConfig, loadRegistros]);

  const registroAberto = useMemo(
    () => registros.find((r) => !r.saida_em && r.tipo === "normal") ?? null,
    [registros]
  );

  const cargaMinutos = config?.carga_diaria_minutos ?? 480;

  // Timer calculations
  const horasTrabalhadasHojeMin = useMemo(() => {
    if (!registroAberto) return 0;
    const entrada = registroAberto.entrada_oficial || registroAberto.entrada_em;
    return Math.max(0, (now - new Date(entrada).getTime()) / 60000);
  }, [registroAberto, now]);

  const horarioPrevistoSaida = useMemo(() => {
    if (!registroAberto) return null;
    const entrada = new Date(registroAberto.entrada_oficial || registroAberto.entrada_em);
    return new Date(entrada.getTime() + cargaMinutos * 60000);
  }, [registroAberto, cargaMinutos]);

  const minutosRestantes = Math.max(0, cargaMinutos - horasTrabalhadasHojeMin);
  const emHoraExtra = horasTrabalhadasHojeMin > cargaMinutos;
  const minutosHoraExtra = emHoraExtra ? horasTrabalhadasHojeMin - cargaMinutos : 0;

  // Weekly balance: sum of (worked - carga) for closed records this week
  const saldoSemanal = useMemo(() => {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);

    let total = config?.saldo_inicial_minutos ?? 0;

    registros.forEach((r) => {
      if (!r.saida_em) return;
      const entrada = new Date(r.entrada_oficial || r.entrada_em);
      if (entrada < startOfWeek) return;
      const saida = new Date(r.saida_em);
      const worked = (saida.getTime() - entrada.getTime()) / 60000;
      // Only weekdays count
      const day = entrada.getDay();
      if (day >= 1 && day <= 5) {
        total += worked - cargaMinutos;
      }
    });

    return total;
  }, [registros, config, cargaMinutos]);

  const totalPages = Math.max(1, Math.ceil(registros.length / PAGE_SIZE));
  const registrosPaginados = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return registros.slice(start, start + PAGE_SIZE);
  }, [page, registros]);

  const registrarEntrada = async () => {
    if (!user || registroAberto) return;
    setSaving(true);

    const agora = new Date();
    let entradaOficial = agora.toISOString();

    // Tolerância de 2 minutos
    if (config?.hora_inicio_prevista) {
      const [h, m] = config.hora_inicio_prevista.split(":").map(Number);
      const prevista = new Date(agora);
      prevista.setHours(h, m, 0, 0);
      const diffMs = agora.getTime() - prevista.getTime();
      if (diffMs >= 0 && diffMs <= 2 * 60 * 1000) {
        entradaOficial = prevista.toISOString();
      }
    }

    const { error } = await (supabase as any).from("registro_ponto").insert({
      user_id: user.id,
      entrada_em: agora.toISOString(),
      entrada_oficial: entradaOficial,
    });
    setSaving(false);

    if (error) {
      toast.error("Erro ao registrar entrada.");
      return;
    }
    toast.success("Entrada registrada com sucesso!");
    await loadRegistros();
  };

  const registrarSaida = async () => {
    if (!registroAberto) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("registro_ponto")
      .update({ saida_em: new Date().toISOString() })
      .eq("id", registroAberto.id);
    setSaving(false);

    if (error) {
      toast.error("Erro ao registrar saída.");
      return;
    }
    toast.success("Saída registrada com sucesso!");
    await loadRegistros();
  };

  const salvarConfig = async () => {
    if (!user) return;
    setSaving(true);

    const [ch, cm] = cfgCarga.split(":").map(Number);
    const cargaMin = (ch || 0) * 60 + (cm || 0);

    const payload = {
      user_id: user.id,
      carga_diaria_minutos: cargaMin,
      hora_inicio_prevista: cfgInicio + ":00",
      hora_fim_prevista: cfgFim + ":00",
      saldo_inicial_minutos: parseInt(cfgSaldo) || 0,
    };

    const { error } = config
      ? await (supabase as any).from("configuracao_ponto").update(payload).eq("user_id", user.id)
      : await (supabase as any).from("configuracao_ponto").insert(payload);

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar configuração.");
      return;
    }
    toast.success("Configuração salva!");
    setShowConfig(false);
    await loadConfig();
  };

  const salvarManual = async () => {
    if (!user || !manualData || !manualEntrada || !manualSaida) {
      toast.error("Preencha data, entrada e saída.");
      return;
    }
    setSaving(true);
    const entradaISO = new Date(`${manualData}T${manualEntrada}:00`).toISOString();
    const saidaISO = new Date(`${manualData}T${manualSaida}:00`).toISOString();

    const { error } = await (supabase as any).from("registro_ponto").insert({
      user_id: user.id,
      entrada_em: entradaISO,
      entrada_oficial: entradaISO,
      saida_em: saidaISO,
      tipo: "ajuste_manual",
      observacao: manualObs || "Lançamento avulso",
    });
    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar lançamento.");
      return;
    }
    toast.success("Lançamento avulso salvo!");
    setShowManual(false);
    setManualData("");
    setManualEntrada("");
    setManualSaida("");
    setManualObs("");
    await loadRegistros();
  };

  const limparSaldos = async () => {
    if (!user) return;
    const confirmar = window.confirm(
      "Deseja limpar os valores de Saldo hoje, Saldo semanal e Saldo inicial?"
    );
    if (!confirmar) return;

    setSaving(true);

    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1);
    inicioSemana.setHours(0, 0, 0, 0);

    const { error: errorSemana } = await (supabase as any)
      .from("registro_ponto")
      .delete()
      .eq("user_id", user.id)
      .gte("entrada_em", inicioSemana.toISOString());

    const { error: errorAberto } = await (supabase as any)
      .from("registro_ponto")
      .delete()
      .eq("user_id", user.id)
      .is("saida_em", null);

    const { error: errorConfig } = await (supabase as any)
      .from("configuracao_ponto")
      .update({ saldo_inicial_minutos: 0 })
      .eq("user_id", user.id);

    setSaving(false);

    if (errorSemana || errorAberto || errorConfig) {
      toast.error("Não foi possível limpar os saldos.");
      return;
    }

    toast.success("Saldos limpos com sucesso!");
    setCfgSaldo("0");
    await Promise.all([loadConfig(), loadRegistros()]);
  };

  return (
    <PageLayout>
      <header className="h-16 border-b bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 shadow-sm">
        <Logo />
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </header>

      <main className="flex-1 container max-w-4xl mx-auto p-4 md:p-6 space-y-4">
        {/* Status & Timer */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-primary" />
                Registro de Ponto
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                {registroAberto ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600">Em expediente</Badge>
                ) : (
                  <Badge variant="secondary">Fora do expediente</Badge>
                )}
                {config && (
                  <Badge variant="outline">
                    {config.hora_inicio_prevista?.slice(0, 5)} - {config.hora_fim_prevista?.slice(0, 5)} | Carga: {formatMinutes(cargaMinutos)}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Timer */}
            {registroAberto && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-1">
                  {emHoraExtra ? "Hora Extra" : "Tempo restante"}
                </p>
                <p className={`text-4xl font-mono font-bold ${emHoraExtra ? "text-orange-500" : minutosRestantes < 30 ? "text-red-500" : "text-primary"}`}>
                  {emHoraExtra ? `+${formatTimer(minutosHoraExtra)}` : formatTimer(minutosRestantes)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Trabalhado: {formatMinutes(horasTrabalhadasHojeMin)}
                </p>
                {showHorarioPrevisto && horarioPrevistoSaida && (
                  <p className="text-xs text-muted-foreground">
                    Horário previsto saída: <span className="font-medium text-foreground">{formatHourMinute(horarioPrevistoSaida)}</span>
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-2">
              <Label htmlFor="toggle-horario-previsto" className="text-xs text-muted-foreground cursor-pointer">
                Mostrar horário previsto saída
              </Label>
              <Switch
                id="toggle-horario-previsto"
                checked={showHorarioPrevisto}
                onCheckedChange={setShowHorarioPrevisto}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button onClick={registrarEntrada} disabled={!!registroAberto || saving}>
                <LogIn className="h-4 w-4 mr-2" />
                Registrar Entrada
              </Button>
              <Button variant="outline" onClick={registrarSaida} disabled={!registroAberto || saving}>
                <LogOut className="h-4 w-4 mr-2" />
                Registrar Saída
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Timer className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Trabalhado hoje</p>
              <p className="font-bold">{formatMinutes(horasTrabalhadasHojeMin)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              {emHoraExtra ? <TrendingUp className="h-4 w-4 mx-auto mb-1 text-orange-500" /> : <TrendingDown className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />}
              <p className="text-xs text-muted-foreground">Saldo hoje</p>
              <p className={`font-bold ${emHoraExtra ? "text-orange-500" : ""}`}>
                {emHoraExtra ? `+${formatMinutes(minutosHoraExtra)}` : `-${formatMinutes(minutosRestantes)}`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Saldo semanal</p>
              <p className={`font-bold ${saldoSemanal >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {saldoSemanal >= 0 ? "+" : ""}{formatMinutes(saldoSemanal)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Saldo inicial</p>
              <p className="font-bold">{formatMinutes(config?.saldo_inicial_minutos ?? 0)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Config & Manual buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)}>
            ⚙️ Configuração
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowManual(!showManual)}>
            <Plus className="h-4 w-4 mr-1" />
            Lançamento Avulso
          </Button>
          <Button variant="destructive" size="sm" onClick={limparSaldos} disabled={saving}>
            Limpar saldos
          </Button>
        </div>

        {/* Config form */}
        {showConfig && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuração do Ponto</CardTitle>
              <CardDescription>Defina sua carga horária e horário previsto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Carga diária (HH:MM)</Label>
                  <Input value={cfgCarga} onChange={(e) => setCfgCarga(e.target.value)} placeholder="08:00" />
                </div>
                <div>
                  <Label>Saldo inicial (minutos)</Label>
                  <Input type="number" value={cfgSaldo} onChange={(e) => setCfgSaldo(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label>Início previsto</Label>
                  <Input type="time" value={cfgInicio} onChange={(e) => setCfgInicio(e.target.value)} />
                </div>
                <div>
                  <Label>Fim previsto</Label>
                  <Input type="time" value={cfgFim} onChange={(e) => setCfgFim(e.target.value)} />
                </div>
              </div>
              <Button onClick={salvarConfig} disabled={saving} size="sm">
                Salvar configuração
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Manual entry form */}
        {showManual && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lançamento Avulso</CardTitle>
              <CardDescription>Para ajustes retroativos ou registros manuais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={manualData} onChange={(e) => setManualData(e.target.value)} />
                </div>
                <div>
                  <Label>Observação</Label>
                  <Input value={manualObs} onChange={(e) => setManualObs(e.target.value)} placeholder="Motivo do ajuste" />
                </div>
                <div>
                  <Label>Entrada</Label>
                  <Input type="time" value={manualEntrada} onChange={(e) => setManualEntrada(e.target.value)} />
                </div>
                <div>
                  <Label>Saída</Label>
                  <Input type="time" value={manualSaida} onChange={(e) => setManualSaida(e.target.value)} />
                </div>
              </div>
              <Button onClick={salvarManual} disabled={saving} size="sm">
                Salvar lançamento
              </Button>
            </CardContent>
          </Card>
        )}

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : registros.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
            ) : (
              <div className="space-y-2">
                {registrosPaginados.map((r) => {
                  const entrada = new Date(r.entrada_oficial || r.entrada_em);
                  const saida = r.saida_em ? new Date(r.saida_em) : null;
                  const durMin = saida ? (saida.getTime() - entrada.getTime()) / 60000 : null;
                  const tolerancia = r.entrada_oficial && r.entrada_oficial !== r.entrada_em;

                  return (
                    <div key={r.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p>
                            <span className="font-medium">Entrada:</span> {entrada.toLocaleString("pt-BR")}
                            {tolerancia && <span className="ml-1 text-xs text-emerald-600">(tolerância)</span>}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Saída:</span>{" "}
                            {saida ? saida.toLocaleString("pt-BR") : "Em aberto"}
                          </p>
                          {r.observacao && <p className="text-xs text-muted-foreground italic mt-1">{r.observacao}</p>}
                        </div>
                        <div className="text-right">
                          {durMin != null && <p className="font-medium">{formatMinutes(durMin)}</p>}
                          {r.tipo === "ajuste_manual" && <Badge variant="outline" className="text-xs">Manual</Badge>}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    Página {page} de {totalPages} • {registros.length} registro(s)
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                      Próxima
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </PageLayout>
  );
};

export default RegistroPontoPage;
