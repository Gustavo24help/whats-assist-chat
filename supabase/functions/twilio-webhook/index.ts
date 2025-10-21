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
    const mediaUrl = formData.get('MediaUrl0') as string; // URL do anexo (se houver)
    const numMedia = formData.get('NumMedia') as string;

    console.log("Mensagem recebida:", { from, body, numMedia });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar ou criar contato
    let { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('telefone', from)
      .single();

    if (!cliente) {
      console.log("Criando novo cliente:", from);
      const { data: novoCliente, error: createError } = await supabase
        .from('clientes')
        .insert([
          {
            telefone: from,
            nome: 'Desconhecido',
            status_conversa: 'aberta',
            ultima_interacao: new Date().toISOString(),
          }
        ])
        .select()
        .single();

      if (createError) {
        console.error("Erro ao criar cliente:", createError);
        throw createError;
      }
      cliente = novoCliente;
    } else {
      // Atualizar última interação
      await supabase
        .from('clientes')
        .update({ ultima_interacao: new Date().toISOString() })
        .eq('id', cliente.id);
    }

    console.log("Cliente identificado:", cliente.id);

    // Salvar mensagem
    const mensagem = {
      cliente_id: cliente.id,
      remetente: from,
      texto: body || '',
      tipo: numMedia && parseInt(numMedia) > 0 ? 'midia' : 'texto',
      arquivo_url: mediaUrl || null,
      status: 'recebido',
      data_hora: new Date().toISOString(),
    };

    const { error: mensagemError } = await supabase
      .from('mensagens')
      .insert([mensagem]);

    if (mensagemError) {
      console.error("Erro ao salvar mensagem:", mensagemError);
      throw mensagemError;
    }

    console.log("Mensagem salva com sucesso");

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
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
