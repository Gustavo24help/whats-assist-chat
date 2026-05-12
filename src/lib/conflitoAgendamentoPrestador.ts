/**
 * Detecção de conflito de agendamento para o mesmo prestador.
 * Usa a janela do PRESTADOR (com fallback para janela do cliente).
 *
 * - BLOQUEIO: novo início igual ao início de outro compromisso do mesmo prestador.
 * - AVISO: outro compromisso a ≤ 60 minutos do início, ou janelas que se sobrepõem.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  getAllAgendamentoSlots,
  type AgendamentoData,
  type TipoSlot,
} from "@/lib/calcularEstadoAgendamento";

export interface ConflitoSlot {
  fichaId: string;
  nomeFicha: string | null;
  nomeCliente: string | null;
  tipoSlot: TipoSlot;
  inicio: Date;
  fim: Date | null;
  distanciaMin: number; // minutos de distância entre inícios (sinalizado: negativo = antes)
  sobreposto: boolean;
}

const STATUS_EXCLUIDOS_CONFLITO = new Set([
  "Finalizado",
  "Perdido",
  "Não foi adiante",
  "Garantia",
  "Orçamento Não Aprovado",
]);

/**
 * Resolve a janela do PRESTADOR para um slot, fazendo fallback para janela do cliente.
 * Retorna o início/fim REAIS daquele compromisso para o prestador.
 */
function resolverJanelaPrestador(ag: AgendamentoData, slot: { inicio: Date; fim: Date | null; tipoSlot: TipoSlot }): { inicio: Date; fim: Date | null } {
  const dataBase = slot.inicio.toISOString().split("T")[0];
  let prestadorIni: string | null | undefined = null;
  let prestadorFim: string | null | undefined = null;

  if (slot.tipoSlot === "agendamento") {
    prestadorIni = ag.hora_inicio_prestador_agendamento;
    prestadorFim = ag.hora_fim_prestador_agendamento;
  } else if (slot.tipoSlot === "retorno") {
    prestadorIni = ag.hora_inicio_prestador_retorno;
    prestadorFim = ag.hora_fim_prestador_retorno;
  }

  let inicio = slot.inicio;
  let fim = slot.fim;
  if (prestadorIni) inicio = new Date(`${dataBase}T${prestadorIni}-03:00`);
  if (prestadorFim) fim = new Date(`${dataBase}T${prestadorFim}-03:00`);
  return { inicio, fim };
}

/**
 * Constrói os slots completos (com janela do prestador) de uma ficha.
 */
export function getSlotsPrestadorDeFicha(ficha: any): { inicio: Date; fim: Date | null; tipoSlot: TipoSlot }[] {
  const ag: AgendamentoData = {
    tipo_agendamento: ficha.tipo_agendamento ?? null,
    horario_agendamento: ficha.horario_agendamento ?? null,
    hora_inicio_agendamento: ficha.hora_inicio_agendamento ?? null,
    hora_fim_agendamento: ficha.hora_fim_agendamento ?? null,
    data_retorno: ficha.data_retorno ?? null,
    hora_inicio_retorno: ficha.hora_inicio_retorno ?? null,
    hora_fim_retorno: ficha.hora_fim_retorno ?? null,
    status: ficha.status ?? null,
    data_visita_tecnica: ficha.data_visita_tecnica ?? null,
    horario_visita_tecnica: ficha.horario_visita_tecnica ?? null,
    hora_inicio_prestador_agendamento: ficha.hora_inicio_prestador_agendamento ?? null,
    hora_fim_prestador_agendamento: ficha.hora_fim_prestador_agendamento ?? null,
    hora_inicio_prestador_retorno: ficha.hora_inicio_prestador_retorno ?? null,
    hora_fim_prestador_retorno: ficha.hora_fim_prestador_retorno ?? null,
  };
  return getAllAgendamentoSlots(ag).map((s) => ({ ...resolverJanelaPrestador(ag, s), tipoSlot: s.tipoSlot }));
}

export interface DetectarParams {
  prestadorId: string | null | undefined;
  fichaIdAtual: string | null | undefined;
  /** novo slot que se quer agendar (já com janela final do prestador) */
  novoInicio: Date;
  novoFim?: Date | null;
  /** lista de outras fichas do prestador candidatas (já filtradas por dia) */
  outrasFichas: any[];
  /** janela em minutos para considerar AVISO (default 60) */
  janelaAvisoMin?: number;
}

export interface DeteccaoResultado {
  bloqueio: ConflitoSlot | null;
  avisos: ConflitoSlot[];
}

export function detectarConflitos(params: DetectarParams): DeteccaoResultado {
  const { prestadorId, fichaIdAtual, novoInicio, novoFim, outrasFichas, janelaAvisoMin = 60 } = params;
  if (!prestadorId || !novoInicio || isNaN(novoInicio.getTime())) {
    return { bloqueio: null, avisos: [] };
  }

  const novoFimReal = novoFim && !isNaN(novoFim.getTime()) ? novoFim : null;
  const avisos: ConflitoSlot[] = [];
  let bloqueio: ConflitoSlot | null = null;

  for (const f of outrasFichas) {
    if (!f) continue;
    if (f.id === fichaIdAtual) continue;
    if (f.prestador_id !== prestadorId) continue;
    if (STATUS_EXCLUIDOS_CONFLITO.has(f.status || "")) continue;

    const slots = getSlotsPrestadorDeFicha(f);
    for (const s of slots) {
      const distMs = s.inicio.getTime() - novoInicio.getTime();
      const distMin = Math.round(distMs / 60000);

      // Sobreposição de janelas (se ambos têm fim)
      let sobreposto = false;
      if (novoFimReal && s.fim) {
        sobreposto = novoInicio < s.fim && s.inicio < novoFimReal;
      }

      const conflito: ConflitoSlot = {
        fichaId: f.id,
        nomeFicha: f.nome_ficha ?? null,
        nomeCliente: f.nome_cliente ?? f.clientes?.nome ?? null,
        tipoSlot: s.tipoSlot,
        inicio: s.inicio,
        fim: s.fim,
        distanciaMin: distMin,
        sobreposto,
      };

      if (distMin === 0) {
        // Bloqueio: mesmo início. Mantém o "mais relevante" (primeiro encontrado).
        if (!bloqueio) bloqueio = conflito;
      } else if (Math.abs(distMin) <= janelaAvisoMin || sobreposto) {
        avisos.push(conflito);
      }
    }
  }

  // Dedup avisos por fichaId+tipoSlot
  const seen = new Set<string>();
  const avisosUnicos = avisos.filter((a) => {
    const k = `${a.fichaId}-${a.tipoSlot}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { bloqueio, avisos: avisosUnicos };
}

/**
 * Busca fichas do prestador no dia (±1 dia) que possam conflitar.
 * Filtra status terminais para reduzir payload.
 */
export async function buscarFichasPrestadorDia(prestadorId: string, dataRef: Date): Promise<any[]> {
  const inicio = new Date(dataRef);
  inicio.setDate(inicio.getDate() - 1);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(dataRef);
  fim.setDate(fim.getDate() + 1);
  fim.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("fichas_de_servico")
    .select(`
      id, status, nome_ficha, nome_cliente, prestador_id, tipo_agendamento,
      horario_agendamento, hora_inicio_agendamento, hora_fim_agendamento,
      data_retorno, hora_inicio_retorno, hora_fim_retorno,
      data_visita_tecnica, horario_visita_tecnica,
      hora_inicio_prestador_agendamento, hora_fim_prestador_agendamento,
      hora_inicio_prestador_retorno, hora_fim_prestador_retorno
    `)
    .eq("prestador_id", prestadorId)
    .or(
      `and(horario_agendamento.gte.${inicio.toISOString()},horario_agendamento.lte.${fim.toISOString()}),and(data_retorno.gte.${inicio.toISOString()},data_retorno.lte.${fim.toISOString()}),and(horario_visita_tecnica.gte.${inicio.toISOString()},horario_visita_tecnica.lte.${fim.toISOString()})`
    );

  if (error) {
    console.warn("[conflito] erro buscar fichas:", error);
    return [];
  }
  return data || [];
}

/**
 * Resumo curto para toast/dialog.
 */
export function descreverConflito(c: ConflitoSlot): string {
  const hora = c.inicio.toTimeString().slice(0, 5);
  const tipoLabel = c.tipoSlot === "visita" ? "Visita Técnica" : c.tipoSlot === "retorno" ? "Retorno" : "Serviço";
  const nome = c.nomeCliente || c.nomeFicha || c.fichaId;
  return `${hora} — ${tipoLabel} — ${nome} (#${c.fichaId})`;
}

/**
 * Para o calendário: dado um conjunto de fichas, retorna um Map
 * fichaId+tipoSlot → vizinhos (mesma data, mesmo prestador, ≤ janelaMin).
 */
export type ProximidadeMapa = Map<string, ConflitoSlot[]>;

export function computarProximidadeCalendario(fichas: any[], janelaMin = 60): ProximidadeMapa {
  const mapa: ProximidadeMapa = new Map();

  // Agrupa por prestador
  const porPrestador = new Map<string, { ficha: any; slot: { inicio: Date; fim: Date | null; tipoSlot: TipoSlot } }[]>();
  for (const f of fichas) {
    if (!f?.prestador_id) continue;
    if (STATUS_EXCLUIDOS_CONFLITO.has(f.status || "")) continue;
    const slots = getSlotsPrestadorDeFicha(f);
    for (const s of slots) {
      if (!porPrestador.has(f.prestador_id)) porPrestador.set(f.prestador_id, []);
      porPrestador.get(f.prestador_id)!.push({ ficha: f, slot: s });
    }
  }

  for (const arr of porPrestador.values()) {
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i];
      const vizinhos: ConflitoSlot[] = [];
      for (let j = 0; j < arr.length; j++) {
        if (i === j) continue;
        const b = arr[j];
        const distMs = b.slot.inicio.getTime() - a.slot.inicio.getTime();
        const distMin = Math.round(distMs / 60000);
        let sobreposto = false;
        if (a.slot.fim && b.slot.fim) {
          sobreposto = a.slot.inicio < b.slot.fim && b.slot.inicio < a.slot.fim;
        }
        if (Math.abs(distMin) <= janelaMin || sobreposto) {
          vizinhos.push({
            fichaId: b.ficha.id,
            nomeFicha: b.ficha.nome_ficha ?? null,
            nomeCliente: b.ficha.nome_cliente ?? b.ficha.clientes?.nome ?? null,
            tipoSlot: b.slot.tipoSlot,
            inicio: b.slot.inicio,
            fim: b.slot.fim,
            distanciaMin: distMin,
            sobreposto,
          });
        }
      }
      if (vizinhos.length > 0) {
        const key = `${a.ficha.id}-${a.slot.tipoSlot}`;
        mapa.set(key, vizinhos);
      }
    }
  }

  return mapa;
}
