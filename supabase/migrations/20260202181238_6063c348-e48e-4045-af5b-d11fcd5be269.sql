CREATE OR REPLACE FUNCTION public.calculate_conversas_iniciadas(
  p_from_date TIMESTAMPTZ,
  p_to_date TIMESTAMPTZ,
  p_categoria_id INTEGER DEFAULT NULL,
  p_prestador_cpf TEXT DEFAULT NULL,
  p_cliente_telefone TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_novos_clientes INTEGER;
  v_fichas_subsequentes INTEGER;
BEGIN
  -- 1. Contar clientes cuja primeira mensagem foi no período
  SELECT COUNT(*) INTO v_novos_clientes
  FROM (
    SELECT cliente_id, MIN(data_hora) as primeira_msg
    FROM mensagens
    WHERE remetente = 'cliente'
    GROUP BY cliente_id
  ) sub
  WHERE primeira_msg >= p_from_date
    AND primeira_msg <= p_to_date;

  -- 2. Contar fichas subsequentes no período (aplicando filtros)
  WITH ranked_fichas AS (
    SELECT 
      id,
      telefone_cliente,
      created_at,
      categoria_id,
      prestador_id,
      ROW_NUMBER() OVER (
        PARTITION BY telefone_cliente 
        ORDER BY created_at
      ) as ficha_num
    FROM fichas_de_servico
  )
  SELECT COUNT(*) INTO v_fichas_subsequentes
  FROM ranked_fichas
  WHERE ficha_num > 1
    AND created_at >= p_from_date
    AND created_at <= p_to_date
    AND (p_categoria_id IS NULL OR categoria_id = p_categoria_id)
    AND (p_prestador_cpf IS NULL OR prestador_id = p_prestador_cpf)
    AND (p_cliente_telefone IS NULL OR telefone_cliente = p_cliente_telefone);

  RETURN v_novos_clientes + v_fichas_subsequentes;
END;
$$;