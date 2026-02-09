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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // ===== Authentication =====
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { to, message, mediaUrl, userId, remetente } = await req.json();

    // Input validation
    if (!to || typeof to !== 'string' || to.length > 50) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid recipient' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!message || typeof message !== 'string' || message.length > 5000) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📤 [send-whatsapp] Enviando:', {
      to,
      messagePreview: message?.substring(0, 50),
      hasMedia: !!mediaUrl,
      executedBy: userData.user.id
    });

    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      throw new Error('Credenciais Twilio não configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ========== PROTEÇÃO: Bloquear mensagens do bot se estiver desabilitado ==========
    if (remetente === 'bot') {
      const { data: clienteBot } = await supabase
        .from('clientes')
        .select('bot_habilitado')
        .eq('telefone', to)
        .maybeSingle();
      
      if (clienteBot?.bot_habilitado === false) {
        console.log(`⛔ [send-whatsapp] BLOQUEANDO envio - bot DESABILITADO para ${to}`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'BOT_DESABILITADO',
            message: 'Bot está desabilitado para este cliente.',
            blocked: true
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

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

    if (!dentroJanela24h) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'FORA_JANELA_24H',
          message: 'Conversa fora da janela de 24h. Use um template aprovado.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enviar via Twilio
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
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

    if (!twilioResponse.ok) {
      console.error("Erro Twilio:", twilioData);
      throw new Error(twilioData.message || 'Erro ao enviar mensagem via Twilio');
    }

    // Detectar tipo de mídia
    const getMediaType = (url: string): 'audio' | 'imagem' | 'video' | 'arquivo' => {
      const lower = url.toLowerCase();
      if (lower.match(/\.(ogg|opus|mp3|m4a|aac|amr|3gp|wav|webm)(\?|$)/)) return 'audio';
      if (lower.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/)) return 'imagem';
      if (lower.match(/\.(mp4|mov|avi)(\?|$)/)) return 'video';
      return 'arquivo';
    };

    // Salvar mensagem
    const { error: insertError } = await supabase.from('mensagens').insert({
      cliente_id: to,
      remetente: 'atendente',
      texto: message,
      tipo: mediaUrl ? getMediaType(mediaUrl) : 'texto',
      arquivo_url: mediaUrl || null,
      status: 'enviado',
      data_hora: new Date().toISOString(),
      message_sid: twilioData.sid,
      enviado_por_id: userData.user.id
    });

    if (insertError) {
      console.error("Erro ao inserir mensagem:", insertError);
      throw new Error(`Erro ao salvar mensagem: ${insertError.message}`);
    }

    // Atualizar última interação
    await supabase
      .from('clientes')
      .update({ ultima_interacao: new Date().toISOString() })
      .eq('telefone', to);

    return new Response(
      JSON.stringify({ success: true, messageSid: twilioData.sid, dentroJanela24h }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno ao enviar mensagem' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
