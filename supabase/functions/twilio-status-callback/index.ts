import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Status callback recebido da Twilio');

    const formData = await req.formData();
    const messageSid = formData.get('MessageSid')?.toString() || '';
    const messageStatus = formData.get('MessageStatus')?.toString() || '';
    const to = formData.get('To')?.toString() || '';
    const from = formData.get('From')?.toString() || '';
    const body = formData.get('Body')?.toString() || '';
    const numMedia = parseInt(formData.get('NumMedia')?.toString() || '0', 10);

    console.log('Dados do callback:', {
      messageSid,
      messageStatus,
      to,
      from,
      body,
      numMedia,
    });

    // Só processar mensagens enviadas (não recebidas)
    // Se 'From' é o número da Twilio, é uma mensagem enviada
    const twilioNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    
    if (!from.includes(twilioNumber || '')) {
      console.log('Mensagem recebida, não enviada. Ignorando callback.');
      return new Response('OK', { status: 200 });
    }

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se a mensagem já existe no banco (pode ter sido enviada pelo sistema)
    const { data: existingMessage } = await supabase
      .from('mensagens')
      .select('id, remetente')
      .eq('cliente_id', to)
      .eq('texto', body)
      .order('data_hora', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingMessage) {
      console.log('Mensagem já existe no banco:', existingMessage);
      
      // Se a mensagem existe e é do atendente, não fazer nada
      if (existingMessage.remetente === 'atendente') {
        console.log('Mensagem enviada pelo atendente, não registrar como bot');
        return new Response('OK', { status: 200 });
      }
    } else {
      // Mensagem não existe no banco, então foi enviada pelo bot da Twilio
      console.log('Mensagem do bot detectada, salvando no banco');

      // Processar mídia se houver
      const mediaUrls: string[] = [];
      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = formData.get(`MediaUrl${i}`)?.toString();
        if (mediaUrl) {
          mediaUrls.push(mediaUrl);
        }
      }

      // Determinar tipo de mensagem
      let tipoMensagem = 'texto';
      let arquivoUrl = null;

      if (mediaUrls.length > 0) {
        const mediaType = formData.get('MediaContentType0')?.toString() || '';
        
        if (mediaType.startsWith('image/')) {
          tipoMensagem = 'imagem';
        } else if (mediaType.startsWith('video/')) {
          tipoMensagem = 'video';
        } else if (mediaType.startsWith('audio/')) {
          tipoMensagem = 'audio';
        } else {
          tipoMensagem = 'arquivo';
        }
        
        arquivoUrl = mediaUrls[0];
      }

      // Salvar mensagem do bot no banco
      const { data: insertedMessage, error: insertError } = await supabase
        .from('mensagens')
        .insert({
          cliente_id: to,
          remetente: 'bot',
          texto: body || null,
          tipo: tipoMensagem,
          arquivo_url: arquivoUrl,
          status: messageStatus === 'delivered' ? 'recebido' : 'enviado',
          message_sid: messageSid,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao salvar mensagem do bot:', insertError);
        throw insertError;
      }

      console.log('Mensagem do bot salva com sucesso:', insertedMessage);

      // Fazer broadcast manual usando httpSend para garantir entrega
      try {
        console.log(`Enviando broadcast para canal: bot-messages-${to}`);
        const response = await fetch(
          `${supabaseUrl}/realtime/v1/api/broadcast`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
            },
            body: JSON.stringify({
              messages: [
                {
                  topic: `realtime:bot-messages-${to}`,
                  event: 'new-bot-message',
                  payload: insertedMessage,
                  private: false,
                },
              ],
            }),
          }
        );

        if (response.ok) {
          console.log('Broadcast HTTP enviado com sucesso');
        } else {
          const errorText = await response.text();
          console.error('Erro no broadcast HTTP:', response.status, errorText);
        }
      } catch (broadcastError) {
        console.error('Erro ao enviar broadcast:', broadcastError);
        // Não falhar a requisição se o broadcast falhar
      }
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Erro no callback da Twilio:', error);
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});
