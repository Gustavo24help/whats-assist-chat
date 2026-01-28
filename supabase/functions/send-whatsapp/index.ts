import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, message, mediaUrl, userId, remetente } = await req.json();
    console.log('📤 [send-whatsapp] Iniciando envio:', {
      to,
      message: message?.substring(0, 50),
      hasMedia: !!mediaUrl,
      userId: userId || 'não informado',
      remetente: remetente || 'não informado'
    });

    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      throw new Error('Credenciais Twilio não configuradas');
    }

    // Inicializar Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ========== PROTEÇÃO: Bloquear mensagens do bot se estiver desabilitado ==========
    // Isso impede race conditions onde o Twilio Studio ainda tenta enviar após desligar o bot
    if (remetente === 'bot') {
      const { data: clienteBot } = await supabase
        .from('clientes')
        .select('bot_habilitado')
        .eq('telefone', to)
        .maybeSingle();
      
      if (clienteBot?.bot_habilitado === false) {
        console.log(`⛔ [send-whatsapp] BLOQUEANDO envio - bot está DESABILITADO para ${to}`);
        console.log(`⛔ [send-whatsapp] Mensagem bloqueada: "${message?.substring(0, 50)}..."`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'BOT_DESABILITADO',
            message: 'Bot está desabilitado para este cliente. Mensagem bloqueada.',
            blocked: true
          }),
          {
            status: 200, // 200 para não causar retry no Twilio
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      console.log(`✅ [send-whatsapp] Bot habilitado para ${to}, prosseguindo com envio`);
    }
    // ========== FIM PROTEÇÃO ==========

    // Verificar janela de 24h
    const { data: cliente } = await supabase
      .from('clientes')
      .select('ultima_interacao')
      .eq('telefone', to)
      .single();

    const now = new Date();
    const ultimaInteracao = cliente?.ultima_interacao ? new Date(cliente.ultima_interacao) : null;
    const diferencaHoras = ultimaInteracao 
      ? (now.getTime() - ultimaInteracao.getTime()) / (1000 * 60 * 60)
      : 25;

    const dentroJanela24h = diferencaHoras < 24;

    console.log("Verificação janela 24h:", { diferencaHoras, dentroJanela24h });

    if (!dentroJanela24h) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'FORA_JANELA_24H',
          message: 'Conversa fora da janela de 24h. Use um template aprovado.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Enviar via Twilio
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    
    // Garantir que o número From tenha o mesmo formato que o To (com prefixo whatsapp: se necessário)
    const fromNumber = to.startsWith('whatsapp:') && !twilioPhoneNumber.startsWith('whatsapp:') 
      ? `whatsapp:${twilioPhoneNumber}` 
      : twilioPhoneNumber;
    
    const body = new URLSearchParams();
    body.append('To', to);
    body.append('From', fromNumber);
    body.append('Body', message);
    if (mediaUrl) {
      body.append('MediaUrl', mediaUrl);
    }
    
    console.log('📤 Payload completo sendo enviado para Twilio:', {
      To: to,
      From: fromNumber,
      Body: message?.substring(0, 50),
      hasMedia: !!mediaUrl
    });

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    );

    const twilioData = await twilioResponse.json();
    
    console.log("📬 ========== RESPOSTA DA TWILIO ==========");
    console.log("Status HTTP:", twilioResponse.status);
    console.log("Resposta completa:", JSON.stringify(twilioData, null, 2));
    console.log("📬 ========================================");

    if (!twilioResponse.ok) {
      console.error("Erro Twilio:", twilioData);
      throw new Error(twilioData.message || 'Erro ao enviar mensagem via Twilio');
    }

    console.log("Mensagem enviada com sucesso:", twilioData.sid);

    // Detectar tipo de mídia baseado na URL
    const getMediaType = (url: string): 'audio' | 'imagem' | 'video' | 'arquivo' => {
      const lower = url.toLowerCase();
      if (lower.match(/\.(ogg|opus|mp3|m4a|aac|amr|3gp|wav|webm)(\?|$)/)) return 'audio';
      if (lower.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/)) return 'imagem';
      if (lower.match(/\.(mp4|mov|avi)(\?|$)/)) return 'video';
      return 'arquivo';
    };

    // Salvar mensagem no banco (usando telefone como PK de clientes)
    const { error: insertError } = await supabase.from('mensagens').insert({
      cliente_id: to,
      remetente: 'atendente',
      texto: message,
      tipo: mediaUrl ? getMediaType(mediaUrl) : 'texto',
      arquivo_url: mediaUrl || null,
      status: 'enviado',
      data_hora: new Date().toISOString(),
      message_sid: twilioData.sid,
      enviado_por_id: userId || null
    });

    if (insertError) {
      console.error("Erro ao inserir mensagem:", insertError);
      throw new Error(`Erro ao salvar mensagem: ${insertError.message}`);
    }

    // Atualizar última interação
    const { error: updateError } = await supabase
      .from('clientes')
      .update({ ultima_interacao: new Date().toISOString() })
      .eq('telefone', to);

    if (updateError) {
      console.error("Erro ao atualizar cliente:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: twilioData.sid,
        dentroJanela24h 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
