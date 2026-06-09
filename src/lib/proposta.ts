import { supabase } from "@/integrations/supabase/client";

export type PropostaItem = { descricao: string; quantidade: number; valor_unitario: number };

export type PropostaDados = {
  cliente: { nome: string; cpf?: string | null; telefone?: string | null; endereco?: string | null };
  itens: PropostaItem[];
  desconto: number;
  total: number;
  prazo?: string;
  garantia?: string;
  validade_dias?: number;
  pagamento?: string;
  observacoes?: string;
};

export function calcSubtotal(itens: PropostaItem[]): number {
  return itens.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0), 0);
}

/** Total com margem 23% (Subtotal / 0.77), arredondado para final '8' — regra global do projeto. */
export function calcTotalComMargem(subtotal: number, desconto = 0): number {
  if (subtotal <= 0) return 0;
  const bruto = (subtotal - desconto) / 0.77;
  // Arredonda para terminar em 8
  const base = Math.round(bruto / 10) * 10;
  return Math.max(base - 2, 0) + (base >= 10 ? 0 : 0) + 8 - (base + 8 > bruto + 12 ? 10 : 0);
}

/** Versão mais simples e previsível: arredonda pra cima na dezena e força final 8. */
export function calcTotalFinal8(subtotal: number, desconto = 0): number {
  const bruto = (subtotal - desconto) / 0.77;
  if (bruto <= 0) return 0;
  const dezena = Math.ceil(bruto / 10) * 10;
  return dezena - 2; // ex 110 -> 108, 100 -> 98
}

export function formatBRL(n: number): string {
  return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function gerarPropostaPDF(payload: {
  ficha_id: string;
  dados: PropostaDados;
  criado_por?: string;
  criado_por_nome?: string;
}) {
  const { data, error } = await supabase.functions.invoke("gerar-proposta-pdf", { body: payload });
  if (error) throw error;
  return data as { ok: boolean; id: string; numero: string; versao: number; pdf_url: string; aceite_url: string };
}

export async function enviarPropostaWhatsApp(payload: { proposta_id: string; telefone_cliente: string }) {
  const { data, error } = await supabase.functions.invoke("enviar-proposta-whatsapp", { body: payload });
  if (error) throw error;
  return data as { ok: boolean; message_sid: string; pdf_url: string; aceite_url: string };
}
