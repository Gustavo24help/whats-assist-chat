import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarioMensal } from "@/components/calendario/CalendarioMensal";
import { CalendarioSemanal } from "@/components/calendario/CalendarioSemanal";
import { CalendarioDiario } from "@/components/calendario/CalendarioDiario";
import { AgendamentoDetalhesModal } from "@/components/calendario/AgendamentoDetalhesModal";
import { Logo } from "@/components/Logo";
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCorTipo, getLabelTipo } from "@/lib/calcularEstadoAgendamento";

const tiposAgendamento = [
  { value: 'all', label: 'Todos' },
  { value: 'servico', label: 'Serviço' },
  { value: 'visita_tecnica', label: 'Visita Técnica' },
  { value: 'retorno', label: 'Retorno' },
];

export default function Calendario() {
  const navigate = useNavigate();
  const [fichas, setFichas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<string>("mensal");
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [filtroPrestador, setFiltroPrestador] = useState("all");
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [selectedFicha, setSelectedFicha] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch fichas with scheduling data
      const { data, error } = await supabase
        .from('fichas_de_servico')
        .select(`
          id, status, telefone_cliente, nome_cliente, nome_ficha, descricao,
          horario_agendamento, data_visita_tecnica, horario_visita_tecnica,
          tipo_agendamento, hora_inicio_agendamento, hora_fim_agendamento,
          data_retorno, hora_inicio_retorno, hora_fim_retorno,
          prestador_id, categoria_id, notas,
          prestadores!fichas_de_servico_prestador_id_fkey(nome, cpf, telefone),
          clientes!fichas_de_servico_telefone_cliente_fkey(nome),
          categorias!fichas_de_servico_categoria_id_fkey(nome)
        `)
        .or('horario_agendamento.not.is.null,data_retorno.not.is.null,horario_visita_tecnica.not.is.null,data_visita_tecnica.not.is.null');

      if (error) throw error;
      setFichas(data || []);

      // Fetch prestadores for filter
      const { data: pData } = await supabase
        .from('prestadores')
        .select('cpf, nome')
        .eq('ativo', true)
        .order('nome');
      setPrestadores(pData || []);
    } catch (err) {
      console.error('Erro ao buscar agendamentos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredFichas = useMemo(() => {
    return fichas.filter(f => {
      if (filtroTipo !== 'all' && (f.tipo_agendamento || 'servico') !== filtroTipo) return false;
      if (filtroPrestador !== 'all' && f.prestador_id !== filtroPrestador) return false;
      return true;
    });
  }, [fichas, filtroTipo, filtroPrestador]);

  const contadores = useMemo(() => {
    const c = { servico: 0, visita_tecnica: 0, retorno: 0 };
    fichas.forEach(f => {
      const tipo = (f.tipo_agendamento || 'servico') as keyof typeof c;
      if (c[tipo] !== undefined) c[tipo]++;
    });
    return c;
  }, [fichas]);

  const navigateDate = (dir: 'prev' | 'next') => {
    setCurrentDate(d => {
      if (viewMode === 'mensal') return dir === 'prev' ? subMonths(d, 1) : addMonths(d, 1);
      if (viewMode === 'semanal') return dir === 'prev' ? subWeeks(d, 1) : addWeeks(d, 1);
      return dir === 'prev' ? subDays(d, 1) : addDays(d, 1);
    });
  };

  const dateLabel = useMemo(() => {
    if (viewMode === 'mensal') return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
    if (viewMode === 'semanal') return `Semana de ${format(currentDate, "dd/MM/yyyy")}`;
    return format(currentDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  }, [currentDate, viewMode]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 border-b bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Logo />
          <span className="text-lg font-semibold hidden md:inline">Calendário</span>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </header>

      <main className="flex-1 p-4 space-y-4">
        {/* Filters + navigation */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDate('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 font-semibold text-sm capitalize">{dateLabel}</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tiposAgendamento.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroPrestador} onValueChange={setFiltroPrestador}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Prestador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Prestadores</SelectItem>
                {prestadores.map(p => (
                  <SelectItem key={p.cpf} value={p.cpf}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Legenda + Contadores */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {(['servico', 'visita_tecnica', 'retorno'] as const).map(tipo => (
            <div key={tipo} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: getCorTipo(tipo) }} />
              <span>{getLabelTipo(tipo)}</span>
              <span className="font-bold">({contadores[tipo]})</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#3B82F6' }} />
            <span>Em andamento</span>
          </div>
        </div>

        {/* Calendar tabs */}
        <Tabs value={viewMode} onValueChange={setViewMode}>
          <TabsList>
            <TabsTrigger value="mensal">Mensal</TabsTrigger>
            <TabsTrigger value="semanal">Semanal</TabsTrigger>
            <TabsTrigger value="diario">Diário</TabsTrigger>
          </TabsList>

          <TabsContent value="mensal" className="mt-3">
            <CalendarioMensal fichas={filteredFichas} currentDate={currentDate} onSelectFicha={setSelectedFicha} />
          </TabsContent>
          <TabsContent value="semanal" className="mt-3">
            <CalendarioSemanal fichas={filteredFichas} currentDate={currentDate} onSelectFicha={setSelectedFicha} />
          </TabsContent>
          <TabsContent value="diario" className="mt-3">
            <CalendarioDiario fichas={filteredFichas} currentDate={currentDate} onSelectFicha={setSelectedFicha} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal */}
      <AgendamentoDetalhesModal
        ficha={selectedFicha}
        open={!!selectedFicha}
        onClose={() => setSelectedFicha(null)}
        onSaved={fetchData}
      />
    </div>
  );
}
