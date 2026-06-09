// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Item = { descricao: string; quantidade: number; valor_unitario: number };
type Dados = {
  cliente: { nome: string; cpf?: string | null; telefone?: string | null; endereco?: string | null };
  itens: Item[];
  desconto: number;
  total: number; // total final que o operador validou
  prazo?: string;
  garantia?: string;
  validade_dias?: number;
  pagamento?: string;
  observacoes?: string;
};

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function wrapText(text: string, maxWidth: number, font: any, size: number): string[] {
  const words = (text || "").split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

async function gerarPDF(
  numero: string,
  dados: Dados,
  aceiteUrl: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const margin = 50;
  const verde = rgb(0, 0.39, 0.24);
  const cinzaEscuro = rgb(0.24, 0.24, 0.24);
  const cinzaClaro = rgb(0.47, 0.47, 0.47);
  const branco = rgb(1, 1, 1);

  let y = height - 60;

  // HEADER
  page.drawText("24help", { x: margin, y, size: 28, font: fontBold, color: verde });
  const barraW = 180, barraH = 36;
  const barraX = width - margin - barraW;
  page.drawRectangle({ x: barraX, y: y - 9, width: barraW, height: barraH, color: verde });
  const t = "PROPOSTA COMERCIAL";
  const tw = fontBold.widthOfTextAtSize(t, 11);
  page.drawText(t, { x: barraX + (barraW - tw) / 2, y: y + 1, size: 11, font: fontBold, color: branco });
  y -= 45;

  page.drawText("24HELP INTERMEDIACAO E GESTAO DE SERVICOS LTDA", { x: margin, y, size: 9, font: fontBold, color: cinzaEscuro });
  y -= 12;
  page.drawText("CNPJ: 85.016.434/0001-32 — chat.24help.com.br", { x: margin, y, size: 8, font: fontNormal, color: cinzaClaro });

  // Número/data lado direito
  const numText = `Nº ${numero}`;
  const numW = fontBold.widthOfTextAtSize(numText, 11);
  page.drawText(numText, { x: width - margin - numW, y: y + 12, size: 11, font: fontBold, color: cinzaEscuro });
  const dataText = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const dataW = fontNormal.widthOfTextAtSize(dataText, 9);
  page.drawText(dataText, { x: width - margin - dataW, y, size: 9, font: fontNormal, color: cinzaClaro });

  y -= 24;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.78, 0.78, 0.78) });
  y -= 20;

  // CLIENTE
  page.drawText("DADOS DO CLIENTE", { x: margin, y, size: 10, font: fontBold, color: verde });
  y -= 16;
  page.drawText(dados.cliente.nome || "—", { x: margin, y, size: 11, font: fontBold, color: cinzaEscuro });
  y -= 14;
  if (dados.cliente.cpf) { page.drawText(`CPF/CNPJ: ${dados.cliente.cpf}`, { x: margin, y, size: 9, font: fontNormal, color: cinzaClaro }); y -= 12; }
  if (dados.cliente.telefone) { page.drawText(`Telefone: ${dados.cliente.telefone}`, { x: margin, y, size: 9, font: fontNormal, color: cinzaClaro }); y -= 12; }
  if (dados.cliente.endereco) {
    const enderecoLines = wrapText(`Endereço: ${dados.cliente.endereco}`, width - 2 * margin, fontNormal, 9);
    for (const ln of enderecoLines) { page.drawText(ln, { x: margin, y, size: 9, font: fontNormal, color: cinzaClaro }); y -= 12; }
  }
  y -= 10;

  // ITENS — tabela
  page.drawText("ESCOPO DO SERVIÇO", { x: margin, y, size: 10, font: fontBold, color: verde });
  y -= 14;

  // Header tabela
  const colDescX = margin + 6;
  const colQtdX = width - margin - 220;
  const colUnitX = width - margin - 150;
  const colSubX = width - margin - 6;
  page.drawRectangle({ x: margin, y: y - 4, width: width - 2 * margin, height: 18, color: rgb(0.93, 0.95, 0.93) });
  page.drawText("Descrição", { x: colDescX, y: y + 2, size: 9, font: fontBold, color: cinzaEscuro });
  page.drawText("Qtd", { x: colQtdX, y: y + 2, size: 9, font: fontBold, color: cinzaEscuro });
  page.drawText("Unitário", { x: colUnitX, y: y + 2, size: 9, font: fontBold, color: cinzaEscuro });
  const subtH = "Subtotal";
  const subtHW = fontBold.widthOfTextAtSize(subtH, 9);
  page.drawText(subtH, { x: colSubX - subtHW, y: y + 2, size: 9, font: fontBold, color: cinzaEscuro });
  y -= 16;

  let subtotal = 0;
  for (const it of dados.itens) {
    const sub = (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0);
    subtotal += sub;
    const descLines = wrapText(it.descricao || "—", colQtdX - colDescX - 10, fontNormal, 9);
    if (y < 140) { // nova página
      page = pdfDoc.addPage([595, 842]);
      y = height - 60;
    }
    let firstLine = true;
    for (const ln of descLines) {
      page.drawText(ln, { x: colDescX, y, size: 9, font: fontNormal, color: cinzaEscuro });
      if (firstLine) {
        page.drawText(String(it.quantidade), { x: colQtdX, y, size: 9, font: fontNormal, color: cinzaEscuro });
        page.drawText(formatBRL(it.valor_unitario), { x: colUnitX, y, size: 9, font: fontNormal, color: cinzaEscuro });
        const subText = formatBRL(sub);
        const subW = fontNormal.widthOfTextAtSize(subText, 9);
        page.drawText(subText, { x: colSubX - subW, y, size: 9, font: fontNormal, color: cinzaEscuro });
        firstLine = false;
      }
      y -= 12;
    }
    y -= 3;
    page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: width - margin, y: y + 6 }, thickness: 0.2, color: rgb(0.85, 0.85, 0.85) });
  }

  y -= 8;
  // Totais
  const drawTotalLine = (label: string, value: string, bold = false) => {
    const f = bold ? fontBold : fontNormal;
    const sz = bold ? 12 : 10;
    const lw = f.widthOfTextAtSize(value, sz);
    page.drawText(label, { x: width - margin - 200, y, size: sz, font: f, color: cinzaEscuro });
    page.drawText(value, { x: width - margin - lw, y, size: sz, font: f, color: bold ? verde : cinzaEscuro });
    y -= bold ? 18 : 14;
  };
  drawTotalLine("Subtotal:", formatBRL(subtotal));
  if (dados.desconto > 0) drawTotalLine("Desconto:", `- ${formatBRL(dados.desconto)}`);
  drawTotalLine("TOTAL:", formatBRL(dados.total), true);

  y -= 6;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.3, color: rgb(0.78, 0.78, 0.78) });
  y -= 18;

  // CONDIÇÕES
  page.drawText("CONDIÇÕES", { x: margin, y, size: 10, font: fontBold, color: verde });
  y -= 14;
  const condRow = (label: string, val?: string) => {
    if (!val) return;
    page.drawText(`${label}:`, { x: margin, y, size: 9, font: fontBold, color: cinzaEscuro });
    const lines = wrapText(val, width - 2 * margin - 80, fontNormal, 9);
    let first = true;
    for (const ln of lines) {
      page.drawText(ln, { x: margin + 80, y, size: 9, font: fontNormal, color: cinzaEscuro });
      y -= 12;
      first = false;
    }
    if (first) y -= 12;
  };
  condRow("Prazo", dados.prazo);
  condRow("Garantia", dados.garantia || "90 dias para serviços executados");
  condRow("Validade", `${dados.validade_dias || 7} dias a contar da data de emissão`);
  condRow("Pagamento", dados.pagamento);
  if (dados.observacoes) condRow("Observações", dados.observacoes);

  y -= 10;
  // ACEITE — link
  page.drawRectangle({ x: margin, y: y - 38, width: width - 2 * margin, height: 44, color: rgb(0.96, 0.98, 0.96), borderColor: verde, borderWidth: 0.8 });
  page.drawText("ACEITE DIGITAL", { x: margin + 12, y: y - 6, size: 9, font: fontBold, color: verde });
  page.drawText("Para aceitar esta proposta, acesse o link abaixo e confirme:", {
    x: margin + 12, y: y - 18, size: 8, font: fontNormal, color: cinzaEscuro,
  });
  page.drawText(aceiteUrl, { x: margin + 12, y: y - 30, size: 8, font: fontItalic, color: verde });
  y -= 60;

  // Linha de assinatura tradicional (fallback)
  if (y < 100) { page = pdfDoc.addPage([595, 842]); y = height - 80; }
  y -= 20;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + 220, y }, thickness: 0.5, color: cinzaEscuro });
  page.drawText("Assinatura do cliente", { x: margin, y: y - 12, size: 8, font: fontNormal, color: cinzaClaro });
  page.drawLine({ start: { x: width - margin - 220, y }, end: { x: width - margin, y }, thickness: 0.5, color: cinzaEscuro });
  page.drawText("24help — Responsável", { x: width - margin - 220, y: y - 12, size: 8, font: fontNormal, color: cinzaClaro });

  // Rodapé
  const rodape = `Proposta ${numero} — 24HELP INTERMEDIACAO E GESTAO DE SERVICOS LTDA — CNPJ 85.016.434/0001-32`;
  const rw = fontNormal.widthOfTextAtSize(rodape, 7);
  page.drawText(rodape, { x: (width - rw) / 2, y: 30, size: 7, font: fontNormal, color: cinzaClaro });

  return await pdfDoc.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { ficha_id, dados, criado_por, criado_por_nome } = body as {
      ficha_id: string; dados: Dados; criado_por?: string; criado_por_nome?: string;
    };

    if (!ficha_id || !dados) {
      return new Response(JSON.stringify({ error: "ficha_id e dados são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Buscar cliente_id da ficha
    const { data: ficha } = await supabase
      .from("fichas_de_servico")
      .select("id, cliente_id")
      .eq("id", ficha_id)
      .maybeSingle();

    // Próxima versão para essa ficha
    const { data: prev } = await supabase
      .from("propostas_comerciais")
      .select("versao")
      .eq("ficha_id", ficha_id)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();
    const versao = (prev?.versao || 0) + 1;

    // Gera número sequencial baseado em count total + 1 (suficiente; unique constraint protege colisão)
    const { count: total } = await supabase
      .from("propostas_comerciais")
      .select("id", { count: "exact", head: true });
    const numero = `PROP-2026-${String((total || 0) + 1).padStart(5, "0")}`;

    // Insere a linha (gera id + aceite_token)
    const { data: inserted, error: insErr } = await supabase
      .from("propostas_comerciais")
      .insert({
        ficha_id,
        cliente_id: ficha?.cliente_id || null,
        numero,
        versao,
        dados_snapshot: dados,
        valor_total: Number(dados.total) || 0,
        validade_dias: Number(dados.validade_dias) || 7,
        criado_por: criado_por || null,
        criado_por_nome: criado_por_nome || null,
      })
      .select("id, aceite_token, numero")
      .single();

    if (insErr || !inserted) {
      console.error("[gerar-proposta-pdf] insert err:", insErr);
      return new Response(JSON.stringify({ error: "Falha ao salvar proposta", details: insErr?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Monta URL de aceite — preview ou prod
    const origin = req.headers.get("origin") || "https://chat.24help.com.br";
    const aceiteUrl = `${origin}/proposta-aceite/${inserted.aceite_token}`;

    // Gera PDF
    const pdfBytes = await gerarPDF(inserted.numero, dados, aceiteUrl);

    const fileName = `propostas/${ficha_id}/${inserted.id}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("chat-files")
      .upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: true });

    if (upErr) {
      console.error("[gerar-proposta-pdf] upload err:", upErr);
      return new Response(JSON.stringify({ error: "Falha no upload do PDF", details: upErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: pub } = supabase.storage.from("chat-files").getPublicUrl(fileName);
    const pdfUrl = pub.publicUrl;

    await supabase.from("propostas_comerciais")
      .update({ pdf_storage_path: fileName })
      .eq("id", inserted.id);

    return new Response(JSON.stringify({
      ok: true,
      id: inserted.id,
      numero: inserted.numero,
      versao,
      pdf_url: pdfUrl,
      aceite_url: aceiteUrl,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[gerar-proposta-pdf] fatal:", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
