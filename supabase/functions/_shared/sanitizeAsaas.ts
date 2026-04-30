/**
 * Sanitiza strings para envio ao Asaas.
 *
 * O Asaas rejeita o campo "name" do paymentLink quando contém caracteres
 * "especiais" — entre eles letras Unicode estilizadas (Mathematical Bold
 * Script, Fullwidth, etc.) e símbolos não-ASCII fora de acentos latinos.
 *
 * Estratégia:
 *  1. Normaliza para NFKD (decompõe caracteres compostos e converte
 *     variantes tipográficas Unicode — ex.: 𝓟 → P).
 *  2. Remove combining marks (acentos) — opcional, mas evita rejeições
 *     quando o nome chega com formas raras.
 *  3. Mantém apenas: letras ASCII, dígitos, espaços, e a pontuação básica
 *     que o Asaas aceita ( - _ . , : / ( ) ).
 *  4. Colapsa espaços em excesso.
 *
 * Se o resultado ficar vazio, devolve `fallback`.
 */
export function sanitizeAsaasName(input: string | null | undefined, fallback = "Cliente"): string {
  if (!input) return fallback;
  const decomposed = String(input).normalize("NFKD");
  // Remove diacríticos
  const noDiacritics = decomposed.replace(/[\u0300-\u036f]/g, "");
  // Mantém apenas ASCII permitido
  const cleaned = noDiacritics
    .replace(/[^A-Za-z0-9 \-_.,:/()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 100) : fallback;
}

/** Sanitização mais permissiva para descrição (mantém pontuação comum). */
export function sanitizeAsaasDescription(input: string | null | undefined, fallback = ""): string {
  if (!input) return fallback;
  const decomposed = String(input).normalize("NFKD");
  const noDiacritics = decomposed.replace(/[\u0300-\u036f]/g, "");
  const cleaned = noDiacritics
    .replace(/[^A-Za-z0-9 \-_.,:;/()!?\n]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 500) : fallback;
}
