import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Filter, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FichaCard } from "./FichaCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Database } from "@/integrations/supabase/types";

type FichaDeServico = Database["public"]["Tables"]["fichas_de_servico"]["Row"];

interface FichaWithData extends FichaDeServico {
  cliente_nome?: string;
  prestador_nome?: string;
  orcamentos_count?: number;
}

const STATUS_OPTIONS = [
  "Todos",
  "Não foi adiante",
  "Ficha Criada",
  "Contato Inicial",
  "Dúvida Prestador",
  "Orçamento Enviado",
  "Negociação",
  "Visita Técnica",
  "Orçamento Aprovado / Agendamento",
  "Orçamento Não Aprovado",
  "Agendado",
  "Em andamento",
  "Finalizado",
  "Garantia",
  "Perdido",
];

export const FichasOverview = () => {
  const [fichas, setFichas] = useState<FichaWithData[]>([]);
  const [prestadores, setPrestadores] = useState<Array<{ cpf: string; nome: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchNome, setSearchNome] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Todos");
  const [selectedPrestador, setSelectedPrestador] = useState("Todos");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [openPrestador, setOpenPrestador] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // ✅ Query 1: Buscar todas as fichas
      const { data: fichasData } = await supabase
        .from("fichas_de_servico")
        .select("*")
        .order("created_at", { ascending: false });

      if (!fichasData) {
        setLoading(false);
        return;
      }

      // ✅ Query 2: Buscar todos os clientes em batch
      const telefones = [...new Set(fichasData.map((f) => f.telefone_cliente))];
      const { data: clientesData } = await supabase
        .from("clientes")
        .select("telefone, nome")
        .in("telefone", telefones);

      const clientesMap = new Map(clientesData?.map((c) => [c.telefone, c.nome]));

      // ✅ Query 3: Buscar todos os prestadores em batch
      const cpfs = [...new Set(fichasData.map((f) => f.prestador_id).filter(Boolean))];
      const { data: prestadoresData } = await supabase
        .from("prestadores")
        .select("cpf, nome")
        .in("cpf", cpfs);

      const prestadoresMap = new Map(prestadoresData?.map((p) => [p.cpf, p.nome]));
      setPrestadores(prestadoresData || []);

      // ✅ Query 4: Buscar contagem de orçamentos em batch
      const fichaIds = fichasData.map((f) => f.id);
      const { data: orcamentosData } = await supabase
        .from("orcamentos")
        .select("ficha_nome")
        .in("ficha_nome", fichaIds);

      const orcamentosCountMap = new Map<string, number>();
      orcamentosData?.forEach((orc) => {
        const count = orcamentosCountMap.get(orc.ficha_nome) || 0;
        orcamentosCountMap.set(orc.ficha_nome, count + 1);
      });

      // ✅ Combinar tudo SEM QUERIES EXTRAS
      const fichasComDados: FichaWithData[] = fichasData.map((ficha) => ({
        ...ficha,
        cliente_nome: clientesMap.get(ficha.telefone_cliente) || "Desconhecido",
        prestador_nome: ficha.prestador_id ? prestadoresMap.get(ficha.prestador_id) : undefined,
        orcamentos_count: orcamentosCountMap.get(ficha.id) || 0,
      }));

      setFichas(fichasComDados);
    } catch (error) {
      console.error("Erro ao buscar fichas:", error);
    } finally {
      setLoading(false);
    }
  };

  // Aplicar filtros com useMemo
  const fichasFiltradas = useMemo(() => {
    return fichas.filter((ficha) => {
      // Filtro por nome
      if (searchNome && !ficha.nome_ficha?.toLowerCase().includes(searchNome.toLowerCase())) {
        return false;
      }

      // Filtro por status
      if (selectedStatus !== "Todos" && ficha.status !== selectedStatus) {
        return false;
      }

      // Filtro por prestador
      if (selectedPrestador !== "Todos" && ficha.prestador_id !== selectedPrestador) {
        return false;
      }

      // Filtro por data
      if (selectedDate && ficha.created_at) {
        const fichaDate = new Date(ficha.created_at);
        const filterDate = new Date(selectedDate);
        
        // Normalizar ambas as datas para comparar apenas dia/mês/ano
        fichaDate.setHours(0, 0, 0, 0);
        filterDate.setHours(0, 0, 0, 0);
        
        if (fichaDate.getTime() !== filterDate.getTime()) return false;
      }

      return true;
    });
  }, [fichas, searchNome, selectedStatus, selectedPrestador, selectedDate]);

  const limparFiltros = () => {
    setSearchNome("");
    setSelectedStatus("Todos");
    setSelectedPrestador("Todos");
    setSelectedDate(undefined);
  };

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Filtros */}
      <div className="bg-background border-b p-4 space-y-4 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Visão Geral de Fichas</h2>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg font-semibold text-primary">
              📊 {fichasFiltradas.length} fichas encontradas
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Busca por nome */}
          <Input
            placeholder="Buscar por nome da ficha..."
            value={searchNome}
            onChange={(e) => setSearchNome(e.target.value)}
            className="w-full"
          />

          {/* Filtro Status */}
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro Prestador com Busca */}
          <Popover open={openPrestador} onOpenChange={setOpenPrestador}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openPrestador}
                className="w-full justify-between"
              >
                {selectedPrestador === "Todos"
                  ? "Todos os Prestadores"
                  : prestadores.find((p) => p.cpf === selectedPrestador)?.nome || "Selecione..."}
                <Filter className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar prestador..." />
                <CommandList>
                  <CommandEmpty>Nenhum prestador encontrado.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="Todos"
                      onSelect={() => {
                        setSelectedPrestador("Todos");
                        setOpenPrestador(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedPrestador === "Todos" ? "opacity-100" : "opacity-0"
                        )}
                      />
                      Todos os Prestadores
                    </CommandItem>
                    {prestadores.map((prest) => (
                      <CommandItem
                        key={prest.cpf}
                        value={prest.nome}
                        onSelect={() => {
                          setSelectedPrestador(prest.cpf);
                          setOpenPrestador(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedPrestador === prest.cpf ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {prest.nome}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Filtro Data Única */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : "Filtrar por data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar 
                mode="single" 
                selected={selectedDate} 
                onSelect={setSelectedDate} 
                locale={ptBR}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <Button variant="outline" size="sm" onClick={limparFiltros}>
          Limpar Filtros
        </Button>
      </div>

      {/* Lista de Fichas */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-lg" />
            ))}
          </div>
        ) : fichasFiltradas.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-lg">Nenhuma ficha encontrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
            {fichasFiltradas.map((ficha) => (
              <FichaCard key={ficha.id} ficha={ficha} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
