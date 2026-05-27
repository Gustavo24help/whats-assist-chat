CREATE OR REPLACE FUNCTION public.get_ultima_msg_cliente(_telefones text[])
RETURNS TABLE(cliente_id text, ultima_data_hora timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.cliente_id, MAX(m.data_hora)
  FROM public.mensagens m
  WHERE m.cliente_id = ANY(_telefones)
    AND m.remetente <> 'whatsapp:+554138911555'
  GROUP BY m.cliente_id
$$;

CREATE OR REPLACE FUNCTION public.get_ultima_msg_qualquer(_telefones text[])
RETURNS TABLE(cliente_id text, data_hora timestamptz, remetente text, tipo_remetente text, operador_nome text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (m.cliente_id)
    m.cliente_id, m.data_hora, m.remetente, m.tipo_remetente, m.operador_nome
  FROM public.mensagens m
  WHERE m.cliente_id = ANY(_telefones)
  ORDER BY m.cliente_id, m.data_hora DESC
$$;

GRANT EXECUTE ON FUNCTION public.get_ultima_msg_cliente(text[]) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_ultima_msg_qualquer(text[]) TO authenticated, anon, service_role;