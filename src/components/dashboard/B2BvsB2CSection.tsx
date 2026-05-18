import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { Building2, User, FileText, DollarSign, TrendingUp } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  classificarCliente,
  type ClienteSegmento,
} from "@/lib/clienteSegment";
import type { PeriodOption } from "@/hooks/useOperationalKPIs";

interface Props {
  period: PeriodOption;
  customDateRange?: { from: Date; to: Date };
}

const PAGE = 1000;

const getRange = (
  period: PeriodOption,
  customRange?: { from: Date; to: Date },
) => {
  const now = new Date();
  switch (period) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "7days":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "30days":
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case "month": {
      const me = endOfMonth(now);
      const t = endOfDay(now);
      return { from: startOfMonth(now), to: me < t ? me : t };
    }
    case "custom":
      if (customRange)
        return {
          from: startOfDay(customRange.from),
          to: endOfDay(customRange.to),
        };
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    default:
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
  }
};

type FichaRow = {
  id: string;
  telefone_cliente: string;
  nome_cliente: string | null;
  cpf: string | null;
  valor_total: number | null;
  pagamento_realizado: boolean | null;
  created_at: string;
};

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

async function fetchAllFichas(from: string, to: string): Promise<FichaRow[]> {
  const all: FichaRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("fichas_de_servico")
      .select("id, telefone_cliente, nome_cliente, cpf, valor_total, pagamento_realizado, created_at")
      .gte("created_at", from)
      .lte("created_at", to)
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const batch = (data || []) as FichaRow[];
    all.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// Busca nome do cliente da tabela clientes como fallback (para fichas sem nome_cliente)
async function fetchClienteNomes(
  telefones: string[],
): Promise<Map<string, { nome: string | null; cpf: string | null }>> {
  const map = new Map<string, { nome: string | null; cpf: string | null }>();
  if (telefones.length === 0) return map;
  const unique = Array.from(new Set(telefones));
  const CHUNK = 500;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("clientes")
      .select("telefone, nome, cpf")
      .in("telefone", slice);
    if (error) continue;
    (data || []).forEach((c: any) => {
      map.set(c.telefone, { nome: c.nome, cpf: c.cpf });
    });
  }
  return map;
}

export const B2BvsB2CSection = ({ period, customDateRange }: Props) => {
  const range = useMemo(() => getRange(period, customDateRange), [
    period,
    customDateRange,
  ]);

  const { data, isLoading } = useQuery({
    queryKey: [
      "b2b-b2c",
      range.from.toISOString(),
      range.to.toISOString(),
    ],
    queryFn: async () => {
      const fichas = await fetchAllFichas(
        range.from.toISOString(),
        range.to.toISOString(),
      );
      // Busca dados do cliente para fichas sem nome
      const telefonesSemNome = fichas
        .filter((f) => !f.nome_cliente || !f.nome_cliente.trim())
        .map((f) => f.telefone_cliente);
      const clienteMap = await fetchClienteNomes(telefonesSemNome);

      const agg: Record<
        ClienteSegmento,
        {
          fichas: number;
          receita: number;
          fichasPagas: number;
          clientesUnicos: Set<string>;
        }
      > = {
        B2B: { fichas: 0, receita: 0, fichasPagas: 0, clientesUnicos: new Set() },
        B2C: { fichas: 0, receita: 0, fichasPagas: 0, clientesUnicos: new Set() },
      };

      for (const f of fichas) {
        const fallback = clienteMap.get(f.telefone_cliente);
        const seg = classificarCliente({
          nome: f.nome_cliente || fallback?.nome,
          cpf: f.cpf || fallback?.cpf,
        });
        agg[seg].fichas += 1;
        agg[seg].clientesUnicos.add(f.telefone_cliente);
        if (f.pagamento_realizado) {
          agg[seg].receita += Number(f.valor_total) || 0;
          agg[seg].fichasPagas += 1;
        }
      }

      const build = (seg: ClienteSegmento) => {
        const a = agg[seg];
        return {
          fichas: a.fichas,
          receita: a.receita,
          fichasPagas: a.fichasPagas,
          clientesUnicos: a.clientesUnicos.size,
          ticketMedio: a.fichasPagas > 0 ? a.receita / a.fichasPagas : 0,
        };
      };

      return { B2B: build("B2B"), B2C: build("B2C") };
    },
    staleTime: 60_000,
  });

  return (
    <section>
      <SectionHeader
        title="B2B vs B2C"
        subtitle="Comparativo entre clientes empresa (CNPJ) e pessoa física (CPF), inferido pelo nome do cliente"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <SegmentCard
          icon={<Building2 className="h-5 w-5" />}
          label="B2B — Clientes Empresa"
          badge="CNPJ"
          accentClass="bg-primary/10 text-primary border-primary/20"
          data={data?.B2B}
          isLoading={isLoading}
        />
        <SegmentCard
          icon={<User className="h-5 w-5" />}
          label="B2C — Pessoa Física"
          badge="CPF"
          accentClass="bg-accent/40 text-foreground border-accent"
          data={data?.B2C}
          isLoading={isLoading}
        />
      </div>
    </section>
  );
};

interface SegmentCardProps {
  icon: React.ReactNode;
  label: string;
  badge: string;
  accentClass: string;
  data?: {
    fichas: number;
    receita: number;
    fichasPagas: number;
    clientesUnicos: number;
    ticketMedio: number;
  };
  isLoading: boolean;
}

const SegmentCard = ({
  icon,
  label,
  badge,
  accentClass,
  data,
  isLoading,
}: SegmentCardProps) => {
  if (isLoading) return <Skeleton className="h-44 w-full rounded-xl" />;
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg border ${accentClass}`}>{icon}</div>
          <div>
            <p className="font-semibold text-sm">{label}</p>
            <p className="text-xs text-muted-foreground">
              {data?.clientesUnicos ?? 0} clientes únicos
            </p>
          </div>
        </div>
        <Badge variant="outline">{badge}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Fichas Criadas"
          value={String(data?.fichas ?? 0)}
        />
        <Metric
          icon={<DollarSign className="h-3.5 w-3.5" />}
          label="Receita (paga)"
          value={formatCurrency(data?.receita ?? 0)}
          subValue={`${data?.fichasPagas ?? 0} pagas`}
        />
        <Metric
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Ticket Médio"
          value={formatCurrency(data?.ticketMedio ?? 0)}
        />
        <Metric
          icon={<User className="h-3.5 w-3.5" />}
          label="Clientes únicos"
          value={String(data?.clientesUnicos ?? 0)}
        />
      </div>
    </Card>
  );
};

const Metric = ({
  icon,
  label,
  value,
  subValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
}) => (
  <div className="space-y-0.5">
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
    <p className="font-bold text-lg leading-tight">{value}</p>
    {subValue && (
      <p className="text-[10px] text-muted-foreground">{subValue}</p>
    )}
  </div>
);
