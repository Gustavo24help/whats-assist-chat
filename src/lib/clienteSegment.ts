// Classifica clientes em B2B (empresa) vs B2C (pessoa física)
// Estratégia: inferir pelo NOME do cliente (não altera dados existentes).
// Também usa CPF/CNPJ se disponível e for inequívoco (14 dígitos = CNPJ).

export type ClienteSegmento = "B2B" | "B2C";

const B2B_REGEX =
  /\b(LTDA|S\.?\s*A\.?|S\/A|EIRELI|MEI|EPP|ME|CIA|COMERCIO|COMÉRCIO|INDUSTRIA|INDÚSTRIA|SERVI[CÇ]OS|CONDOMINIO|CONDOMÍNIO|EMPRESA|CORP|INC|TECNOLOGIA|ASSOCIA[CÇ][AÃ]O|HOTEL|POUSADA|RESTAURANTE|MERCADO|LOJA|CLINICA|CLÍNICA|ESCOLA|COL[EÉ]GIO|HOSPITAL|IGREJA|ED\.?\s|EDIF[IÍ]CIO|RESIDENCIAL)\b/i;

const onlyDigits = (s: string | null | undefined) =>
  (s || "").replace(/\D/g, "");

export function classificarCliente(params: {
  nome?: string | null;
  cpf?: string | null;
}): ClienteSegmento {
  const doc = onlyDigits(params.cpf);
  if (doc.length === 14) return "B2B";
  if (doc.length === 11) return "B2C";

  const nome = (params.nome || "").trim();
  if (nome && B2B_REGEX.test(nome)) return "B2B";

  return "B2C";
}
