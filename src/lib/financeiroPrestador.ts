// Shared financial calculation helpers for "Pagamento Prestadores".
// Single source of truth used by both the Financeiro tab and the Dashboard KPI,
// so the numbers stay in sync.

export const EXCLUDED_FICHAS_PAGAMENTO = ["FS4-260127"];

export const STATUS_ELEGIVEIS_PAGAMENTO_PRESTADOR = [
  "Finalizado",
  "Garantia",
  "Retorno",
] as const;

export interface FichaCalcInput {
  valor_total?: number | null;
  valor_mao_obra?: number | null;
  valor_pecas?: number | null;
  material_pago_24help?: boolean | null;
  taxa_visita_padrao?: number | null;
}

export interface FichaCalcResult {
  maoObra: number;
  pecas: number;
  taxaVisita: number;
  totalOS: number;
  taxa24help: number;
  liquidoPrestador: number;
  lucroBruto: number;
  rentab: number;
  materialPago24help: boolean;
}

export function calcFinanceiroPrestador(ficha: FichaCalcInput): FichaCalcResult {
  const maoObra = Number(ficha.valor_mao_obra ?? 0);
  const pecas = Number(ficha.valor_pecas ?? 0);
  const taxaVisita = Number(ficha.taxa_visita_padrao ?? 0);
  const subtotal = maoObra + pecas + taxaVisita;
  const margemPct = 23;
  const totalOS = Number(ficha.valor_total ?? 0);
  const taxa24help = totalOS > 0 ? totalOS - subtotal : subtotal * (margemPct / 100);
  const materialPago24help = ficha.material_pago_24help === true;
  // Se material pago pela empresa, prestador recebe só MO + taxa visita; senão MO + peças + taxa visita
  const liquidoPrestador = materialPago24help
    ? maoObra + taxaVisita
    : maoObra + pecas + taxaVisita;
  const lucroBruto = totalOS - liquidoPrestador - (materialPago24help ? pecas : 0);
  const rentab = totalOS > 0 ? (lucroBruto / totalOS) * 100 : 0;

  return {
    maoObra,
    pecas,
    taxaVisita,
    totalOS,
    taxa24help: Math.max(taxa24help, 0),
    liquidoPrestador,
    lucroBruto: Math.max(lucroBruto, 0),
    rentab: Math.max(rentab, 0),
    materialPago24help,
  };
}
