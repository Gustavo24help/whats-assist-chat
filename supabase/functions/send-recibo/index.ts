import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function gerarReciboPDF(
  fichaId: string,
  nomeCliente: string,
  cpfCliente: string | null,
  nomeFicha: string,
  valorTotal: number,
  descricao: string | null,
  pagamentoRealizado: boolean
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const margin = 57; // ~20mm
  const verde = rgb(0, 0.39, 0.24);
  const cinzaEscuro = rgb(0.24, 0.24, 0.24);
  const cinzaClaro = rgb(0.47, 0.47, 0.47);
  const branco = rgb(1, 1, 1);

  let y = height - 70;

  // === HEADER ===
  page.drawText("24help", { x: margin, y, size: 28, font: fontBold, color: verde });

  // Barra verde com "RECIBO"
  const barraW = 142;
  const barraH = 34;
  const barraX = width - margin - barraW;
  const barraY = y - 8;
  page.drawRectangle({ x: barraX, y: barraY, width: barraW, height: barraH, color: verde });
  const reciboText = "RECIBO";
  const reciboW = fontBold.widthOfTextAtSize(reciboText, 14);
  page.drawText(reciboText, {
    x: barraX + (barraW - reciboW) / 2,
    y: barraY + 11,
    size: 14,
    font: fontBold,
    color: branco,
  });

  y -= 43;

  // === EMPRESA ===
  page.drawText("24HELP INTERMEDIACAO E GESTAO DE SERVICOS", {
    x: margin, y, size: 10, font: fontBold, color: cinzaEscuro,
  });
  y -= 14;
  page.drawText("CNPJ: 85.016.434/0001-32", {
    x: margin, y, size: 9, font: fontNormal, color: cinzaEscuro,
  });

  // Valor (lado direito)
  const valorFormatado = valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const valorW = fontBold.widthOfTextAtSize(valorFormatado, 28);
  page.drawText(valorFormatado, {
    x: width - margin - valorW, y: y + 6, size: 28, font: fontBold, color: verde,
  });

  y -= 34;

  // === LINHA DIVISÓRIA ===
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.78, 0.78, 0.78),
  });
  y -= 43;

  // === RECEBEMOS DE ===
  page.drawText("Recebemos de:", { x: margin, y, size: 10, font: fontBold, color: cinzaEscuro });

  // Selo PAGO
  if (pagamentoRealizado) {
    const seloX = width - margin - 40;
    const seloY = y - 5;
    page.drawCircle({
      x: seloX, y: seloY + 5, size: 34, borderColor: verde, borderWidth: 2,
    });
    const pagoW = fontBold.widthOfTextAtSize("PAGO", 12);
    page.drawText("PAGO", {
      x: seloX - pagoW / 2, y: seloY + 1, size: 12, font: fontBold, color: verde,
    });
  }

  y -= 17;
  page.drawText(nomeCliente || "Cliente", { x: margin, y, size: 11, font: fontNormal, color: cinzaEscuro });
  y -= 23;

  if (cpfCliente) {
    page.drawText(`CPF/CNPJ: ${cpfCliente}`, { x: margin, y, size: 9, font: fontNormal, color: cinzaClaro });
    y -= 28;
  }

  y -= 14;

  // === REFERENTE A ===
  page.drawText("Referente a:", { x: margin, y, size: 10, font: fontBold, color: cinzaEscuro });
  y -= 17;

  const descText = descricao || "Serviço realizado conforme solicitação";
  // Simple line wrapping
  const maxLineWidth = width - 2 * margin;
  const words = descText.split(" ");
  let currentLine = "";
  const lines: string[] = [];
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (fontNormal.widthOfTextAtSize(testLine, 10) > maxLineWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  for (const line of lines) {
    page.drawText(line, { x: margin, y, size: 10, font: fontNormal, color: cinzaEscuro });
    y -= 14;
  }

  y -= 14;

  // === DATA ===
  const dataAtual = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  page.drawText("Data:", { x: margin, y, size: 10, font: fontBold, color: cinzaEscuro });
  page.drawText(dataAtual, { x: margin + 34, y, size: 10, font: fontNormal, color: cinzaEscuro });

  y -= 43;

  // === RODAPÉ ===
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.3,
    color: rgb(0.78, 0.78, 0.78),
  });
  y -= 23;

  const rodape1 = "24HELP INTERMEDIACAO E GESTAO DE SERVICOS LTDA";
  const rodape1W = fontNormal.widthOfTextAtSize(rodape1, 8);
  page.drawText(rodape1, { x: (width - rodape1W) / 2, y, size: 8, font: fontNormal, color: cinzaClaro });
  y -= 11;
  const rodape2 = "CNPJ: 85.016.434/0001-32";
  const rodape2W = fontNormal.widthOfTextAtSize(rodape2, 8);
  page.drawText(rodape2, { x: (width - rodape2W) / 2, y, size: 8, font: fontNormal, color: cinzaClaro });

  return await pdfDoc.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { ficha_id, telefone_cliente } = await req.json();
    console.log(`[send-recibo] Iniciando para ficha: ${ficha_id}, tel: ${telefone_cliente}`);

    if (!ficha_id || !telefone_cliente) {
      return new Response(JSON.stringify({ error: "ficha_id e telefone_cliente obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Idempotência
    const { data: fichaFlag } = await supabase
      .from("fichas_de_servico")
      .select("recibo_enviado")
      .eq("id", ficha_id)
      .single();

    if (fichaFlag?.recibo_enviado) {
      console.log(`[send-recibo] Já enviado para ficha ${ficha_id}`);
      return new Response(JSON.stringify({ ok: true, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Buscar dados da ficha
    const { data: ficha, error: fichaError } = await supabase
      .from("fichas_de_servico")
      .select("nome_cliente, nome_ficha, valor_total, descricao, cpf, recibo_url, pagamento_realizado, status")
      .eq("id", ficha_id)
      .single();

    if (fichaError || !ficha) {
      console.error("[send-recibo] Ficha não encontrada:", ficha_id);
      return new Response(JSON.stringify({ error: "Ficha não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === GERAR/REUTILIZAR PDF ===
    let reciboUrl = ficha.recibo_url;
    let pdfFalhou = false;

    if (!reciboUrl) {
      try {
        console.log("[send-recibo] Gerando PDF do recibo...");
        const pdfBytes = await gerarReciboPDF(
          ficha_id,
          ficha.nome_cliente || "Cliente",
          ficha.cpf,
          ficha.nome_ficha || ficha_id,
          Number(ficha.valor_total || 0),
          ficha.descricao,
          ficha.pagamento_realizado === true
        );

        const fileName = `recibo_${ficha_id}_${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from("chat-files")
          .upload(`recibos/${fileName}`, pdfBytes, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) {
          console.error("[send-recibo] Erro upload PDF:", uploadError);
          pdfFalhou = true;
        } else {
          const { data: urlData } = supabase.storage
            .from("chat-files")
            .getPublicUrl(`recibos/${fileName}`);

          reciboUrl = urlData.publicUrl;
          console.log(`[send-recibo] PDF gerado: ${reciboUrl}`);

          // Salvar URL na ficha
          await supabase
            .from("fichas_de_servico")
            .update({ recibo_url: reciboUrl })
            .eq("id", ficha_id);
        }
      } catch (pdfErr) {
        console.error("[send-recibo] ⚠️ Falha ao gerar/upload PDF, enviando só texto:", pdfErr);
        pdfFalhou = true;
      }
    } else {
      console.log(`[send-recibo] Usando recibo existente: ${reciboUrl}`);
    }

    // === CHECAR JANELA 24H ===
    const { data: lastMsg } = await supabase
      .from("mensagens")
      .select("data_hora")
      .eq("cliente_id", telefone_cliente)
      .eq("remetente", "cliente")
      .order("data_hora", { ascending: false })
      .limit(1)
      .maybeSingle();

    const dentroJanela = lastMsg?.data_hora
      ? Date.now() - new Date(lastMsg.data_hora).getTime() < 24 * 60 * 60 * 1000
      : false;

    const nomeCliente = ficha.nome_cliente || "Cliente";
    const nomeFicha = ficha.nome_ficha || ficha_id;
    const valorFormatado = Number(ficha.valor_total || 0).toFixed(2);

    // Credenciais Twilio
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER")!;
    const auth = btoa(`${twilioSid}:${twilioToken}`);
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;

    const whatsappTo = telefone_cliente.startsWith("whatsapp:") ? telefone_cliente : `whatsapp:${telefone_cliente}`;
    const whatsappFrom = `whatsapp:${twilioPhone}`;

    let messageSid = "";

    if (dentroJanela) {
      // Mensagem livre com PDF anexo
      const mensagem = `✅ *Pagamento confirmado!*\n\n📋 Serviço: ${nomeFicha}\n💰 Valor: R$ ${valorFormatado}\n\nObrigado pela confiança, ${nomeCliente}! 🙏`;

      const body = new URLSearchParams();
      body.append("To", whatsappTo);
      body.append("From", whatsappFrom);
      body.append("Body", mensagem);
      body.append("MediaUrl", reciboUrl!);
      body.append("StatusCallback", `${supabaseUrl}/functions/v1/update-message-status`);

      const res = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const resData = await res.json();
      if (!res.ok) {
        console.error("[send-recibo] Erro Twilio (livre):", resData);
        throw new Error(resData.message || "Erro Twilio");
      }
      messageSid = resData.sid;

      await supabase.from("mensagens").insert({
        cliente_id: whatsappTo,
        remetente: whatsappFrom,
        texto: mensagem,
        arquivo_url: reciboUrl,
        tipo: "documento",
        status: "enviado",
        data_hora: new Date().toISOString(),
        message_sid: messageSid,
        ficha_id,
        tipo_remetente: "sistema",
        operador_nome: "Sistema",
      });

      console.log(`[send-recibo] ✅ Mensagem livre + PDF enviada: ${messageSid}`);
    } else {
      // Template — buscar content_sid
      const { data: template } = await supabase
        .from("whatsapp_templates")
        .select("content_sid")
        .eq("friendly_name", "recibo_confirmado")
        .maybeSingle();

      if (!template?.content_sid) {
        console.warn("[send-recibo] ⚠️ Template 'recibo_confirmado' não encontrado. Enviando só texto sem PDF fora da janela 24h.");
      } else {
        const contentVars = JSON.stringify({
          "1": nomeCliente,
          "2": nomeFicha,
          "3": valorFormatado,
        });

        const body = new URLSearchParams();
        body.append("To", whatsappTo);
        body.append("From", whatsappFrom);
        body.append("ContentSid", template.content_sid);
        body.append("ContentVariables", contentVars);
        body.append("StatusCallback", `${supabaseUrl}/functions/v1/update-message-status`);

        const res = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        const resData = await res.json();
        if (!res.ok) {
          console.error("[send-recibo] Erro Twilio (template):", resData);
          throw new Error(resData.message || "Erro Twilio template");
        }
        messageSid = resData.sid;

        await supabase.from("mensagens").insert({
          cliente_id: whatsappTo,
          remetente: whatsappFrom,
          texto: `✅ Pagamento confirmado! Serviço: ${nomeFicha} — Valor: R$ ${valorFormatado}`,
          tipo: "texto",
          status: "enviado",
          data_hora: new Date().toISOString(),
          message_sid: messageSid,
          ficha_id,
          tipo_remetente: "sistema",
          operador_nome: "Sistema",
        });

        console.log(`[send-recibo] ✅ Template enviado: ${messageSid}`);
      }
    }

    // Marcar como enviado
    await supabase
      .from("fichas_de_servico")
      .update({ recibo_enviado: true, recibo_enviado_em: new Date().toISOString() })
      .eq("id", ficha_id);

    return new Response(
      JSON.stringify({ ok: true, message_sid: messageSid, recibo_url: reciboUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-recibo] 💥 Erro:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
