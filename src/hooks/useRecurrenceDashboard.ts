import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Segment = "all" | "B2C" | "B2B";

export interface SummarySerieItem {
  mes: string;
  clientes_unicos: number;
  recorrentes: number;
  pct_recorrencia: number;
  receita_total: number;
  receita_recorrente: number;
}

export interface SummaryData {
  clientes_total: number;
  clientes_recorrentes: number;
  recorrencia_geral_pct: number;
  clientes_periodo: number;
  recorrentes_periodo: number;
  recorrencia_periodo_pct: number;
  receita_total: number;
  receita_recorrente: number;
  pct_receita_recorrente: number;
  cac_economizado: number;
  ltv_avg: number;
  ltv_liq: number;
  ltv_cac: number;
  dias_avg: number;
  dias_med: number;
  recorrentes_dormindo: number;
  serie_mensal: SummarySerieItem[];
  tempo_recorrencia: Record<string, number>;
  cac_fixo: number;
}

export interface CohortRow {
  cohort_label: string;
  cohort_start: string;
  clientes: number;
  voltou_30: number | null;
  voltou_60: number | null;
  voltou_90: number | null;
  voltou_180: number | null;
  voltou_365: number | null;
  voltou_any: number | null;
  tempo_avg: number | null;
  tempo_med: number | null;
  ltv_avg: number | null;
  receita_recorrente: number | null;
}

export interface ProviderFirstRow {
  provider_id: string;
  provider_name: string;
  clientes_iniciados: number;
  clientes_voltaram: number;
  taxa_retorno_pct: number;
  ltv_avg: number;
  receita_recorrente: number;
  nps_avg: number | null;
  ticket_primeiro_avg: number;
}

export interface ProviderDormantRow {
  provider_id: string;
  provider_name: string;
  clientes_que_sumiram: number;
  nps_avg_ultimo: number | null;
  ticket_avg_ultimo: number;
}

export interface ReactivationRow {
  canonical_id: string;
  cliente_nome: string;
  cliente_telefone: string;
  segmento: string;
  ultimo_servico: string;
  ultimo_prestador: string | null;
  dias_sem_servico: number;
  ltv: number;
  nps_ultimo: number | null;
  tag: string;
}

export const useRecurrenceSummary = (start: Date, end: Date, segment: Segment) =>
  useQuery({
    queryKey: ["recurrence-summary", start.toISOString(), end.toISOString(), segment],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("recurrence_summary", {
        p_start: start.toISOString(),
        p_end: end.toISOString(),
        p_segment: segment,
      });
      if (error) throw error;
      return data as SummaryData;
    },
  });

export const useRecurrenceCohorts = (segment: Segment) =>
  useQuery({
    queryKey: ["recurrence-cohorts", segment],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("recurrence_cohorts", { p_segment: segment });
      if (error) throw error;
      return (data ?? []) as CohortRow[];
    },
  });

export const useRecurrenceProviderFirst = (segment: Segment) =>
  useQuery({
    queryKey: ["recurrence-provider-first", segment],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("recurrence_provider_first", { p_segment: segment });
      if (error) throw error;
      return (data ?? []) as ProviderFirstRow[];
    },
  });

export const useRecurrenceProviderDormant = (segment: Segment) =>
  useQuery({
    queryKey: ["recurrence-provider-dormant", segment],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("recurrence_provider_last_dormant", { p_segment: segment });
      if (error) throw error;
      return (data ?? []) as ProviderDormantRow[];
    },
  });

export const useRecurrenceReactivation = (segment: Segment, limit = 200) =>
  useQuery({
    queryKey: ["recurrence-reactivation", segment, limit],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("recurrence_reactivation_tags", {
        p_segment: segment,
        p_limit: limit,
        p_offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as ReactivationRow[];
    },
  });
