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
    console.log('Callback de status de mensagem recebido da Twilio');

    const formData = await req.formData();
    const messageSid = formData.get('MessageSid')?.toString() || '';
    const messageStatus = formData.get('MessageStatus')?.toString() || '';
    
    console.log('Dados do callback de status:', {
      messageSid,
      messageStatus,
    });

    if (!messageSid) {
      console.log('MessageSid não fornecido, ignorando callback');
      return new Response('OK', { status: 200 });
    }

    // Mapear status da Twilio para nosso enum
    let dbStatus: 'enviado' | 'recebido' | 'lido' | null = null;
    
    switch (messageStatus) {
      case 'sent':
      case 'queued':
      case 'sending':
        dbStatus = 'enviado';
        break;
      case 'delivered':
        dbStatus = 'recebido';
        break;
      case 'read':
        dbStatus = 'lido';
        break;
      case 'failed':
      case 'undelivered':
        console.log('Mensagem falhou ou não foi entregue:', messageStatus);
        // Manter status atual, não atualizar
        return new Response('OK', { status: 200 });
      default:
        console.log('Status desconhecido:', messageStatus);
        return new Response('OK', { status: 200 });
    }

    if (!dbStatus) {
      return new Response('OK', { status: 200 });
    }

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar e atualizar mensagem pelo message_sid
    const { data: mensagem, error: fetchError } = await supabase
      .from('mensagens')
      .select('id, cliente_id, status')
      .eq('message_sid', messageSid)
      .maybeSingle();

    if (fetchError) {
      console.error('Erro ao buscar mensagem:', fetchError);
      throw fetchError;
    }

    if (!mensagem) {
      console.log('Mensagem não encontrada para MessageSid:', messageSid);
      return new Response('OK', { status: 200 });
    }

    // Verificar se é um upgrade de status (não downgrade)
    const statusOrder = { 'enviado': 0, 'recebido': 1, 'lido': 2 };
    const currentStatusLevel = statusOrder[mensagem.status as keyof typeof statusOrder] || 0;
    const newStatusLevel = statusOrder[dbStatus];

    if (newStatusLevel <= currentStatusLevel) {
      console.log('Status não é um upgrade, ignorando:', {
        current: mensagem.status,
        new: dbStatus
      });
      return new Response('OK', { status: 200 });
    }

    // Atualizar status da mensagem
    const { error: updateError } = await supabase
      .from('mensagens')
      .update({
        status: dbStatus,
        status_atualizado_em: new Date().toISOString(),
      })
      .eq('id', mensagem.id);

    if (updateError) {
      console.error('Erro ao atualizar status da mensagem:', updateError);
      throw updateError;
    }

    console.log('Status da mensagem atualizado com sucesso:', {
      id: mensagem.id,
      oldStatus: mensagem.status,
      newStatus: dbStatus,
    });

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Erro no callback de status da Twilio:', error);
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});
