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
    console.log("Webhook recebido do Twilio");
    
    // Parse form data from Twilio
    const formData = await req.formData();
    const from = formData.get('From') as string; // Número do remetente
    const body = formData.get('Body') as string; // Texto da mensagem
    const numMedia = formData.get('NumMedia') as string;
    const profileName = formData.get('ProfileName') as string; // Nome do perfil WhatsApp
    
    // Coletar todas as mídias (até 10 arquivos)
    const mediaUrls: string[] = [];
    const mediaTypes: string[] = [];
    const numMediaInt = parseInt(numMedia || '0');
    
    for (let i = 0; i < numMediaInt; i++) {
      const mediaUrl = formData.get(`MediaUrl${i}`) as string;
      const mediaType = formData.get(`MediaContentType${i}`) as string;
      if (mediaUrl) {
        mediaUrls.push(mediaUrl);
        mediaTypes.push(mediaType || 'unknown');
      }
    }

    console.log("Mensagem recebida:", { from, body, numMedia, mediaUrls, mediaTypes, profileName });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar ou criar contato (telefone é a PK)
    let { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('telefone', from)
      .maybeSingle();

    if (!cliente) {
      console.log("Criando novo cliente:", from);
      const nomeCliente = profileName || from.replace('whatsapp:', '').replace('+', '') || 'Desconhecido';
      const { data: novoCliente, error: createError } = await supabase
        .from('clientes')
        .insert({
          telefone: from,
          nome: nomeCliente,
          status_conversa: 'aberta',
          ultima_interacao: new Date().toISOString(),
          tags: [],
        })
        .select()
        .single();

      if (createError) {
        console.error("Erro ao criar cliente:", createError);
        // Return 200 to prevent Twilio retries
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/xml',
            },
          }
        );
      }
      cliente = novoCliente;
    } else {
      // Atualizar última interação e nome se disponível
      const updateData: any = { ultima_interacao: new Date().toISOString() };
      if (profileName && (cliente.nome === 'Desconhecido' || cliente.nome === from)) {
        updateData.nome = profileName;
      }
      
      const { error: updateError } = await supabase
        .from('clientes')
        .update(updateData)
        .eq('telefone', cliente.telefone);

      if (updateError) {
        console.error("Erro ao atualizar última interação:", updateError);
      }
    }

    console.log("Cliente identificado:", cliente.telefone);

    // Determinar tipo de mensagem baseado na mídia
    const getTipoMensagem = (contentType: string): string => {
      if (contentType.startsWith('image/')) return 'imagem';
      if (contentType.startsWith('video/')) return 'video';
      if (contentType.startsWith('audio/')) return 'audio';
      return 'arquivo';
    };

    // Se há mídia, criar uma mensagem para cada arquivo
    if (mediaUrls.length > 0) {
      for (let i = 0; i < mediaUrls.length; i++) {
        const mensagem = {
          cliente_id: cliente.telefone,
          remetente: 'cliente',
          texto: body || `Arquivo ${i + 1}`,
          tipo: getTipoMensagem(mediaTypes[i]),
          arquivo_url: mediaUrls[i],
          status: 'recebido',
          data_hora: new Date().toISOString(),
          ficha_id: null,
        };

        const { error: mensagemError } = await supabase
          .from('mensagens')
          .insert(mensagem);

        if (mensagemError) {
          console.error("Erro ao salvar mensagem de mídia:", mensagemError);
        }
      }
    } else {
      // Mensagem de texto apenas
      const mensagem = {
        cliente_id: cliente.telefone,
        remetente: 'cliente',
        texto: body || '',
        tipo: 'texto',
        arquivo_url: null,
        status: 'recebido',
        data_hora: new Date().toISOString(),
        ficha_id: null,
      };

      const { error: mensagemError } = await supabase
        .from('mensagens')
        .insert(mensagem);

      if (mensagemError) {
        console.error("Erro ao salvar mensagem:", mensagemError);
        console.error("Dados da mensagem:", JSON.stringify(mensagem));
        // Return 200 to prevent Twilio retries
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/xml',
            },
          }
        );
      }
    }

    console.log("Mensagem(ns) salva(s) com sucesso");

    // Resposta TwiML vazia (não responde automaticamente)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/xml',
        },
      }
    );
  } catch (error) {
    console.error("Erro no webhook:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    // Always return 200 to Twilio to prevent retries
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/xml',
        },
      }
    );
  }
});
