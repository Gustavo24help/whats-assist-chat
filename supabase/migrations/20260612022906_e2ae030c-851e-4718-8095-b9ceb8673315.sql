
DROP VIEW IF EXISTS public.v_customer_services_enriched CASCADE;

CREATE VIEW public.v_customer_services_enriched AS
SELECT
  cs.id, cs.ficha_id, cs.customer_id,
  vcc.canonical_id, vcc.segmento,
  cs.provider_id, cs.provider_name, cs.sku,
  cs.service_date, cs.completed_at, cs.requested_at, cs.created_at, cs.status,
  COALESCE(cs.service_date, cs.requested_at, cs.completed_at, cs.created_at) AS event_date,
  COALESCE(cs.final_value, cs.quoted_value, 0)::numeric AS valor,
  (cs.status IN ('finalizado','em_garantia')) AS is_valid,
  nps.nota AS nps_nota
FROM public.customer_services cs
LEFT JOIN public.v_customer_canonical vcc ON vcc.id = cs.customer_id
LEFT JOIN LATERAL (
  SELECT nr.nota FROM public.nps_respostas nr
  WHERE nr.ficha_id = cs.ficha_id AND nr.nota IS NOT NULL
  ORDER BY COALESCE(nr.respondido_em, nr.created_at) DESC LIMIT 1
) nps ON true;

GRANT SELECT ON public.v_customer_services_enriched TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.recurrence_summary(
  p_start timestamptz, p_end timestamptz, p_segment text DEFAULT 'all'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_cac numeric := 80;
  v_clientes_total int; v_clientes_recorrentes int;
  v_clientes_periodo int; v_recorrentes_periodo int;
  v_receita_total numeric; v_receita_recorrente numeric;
  v_ltv_avg numeric; v_ltv_liq numeric; v_ltv_cac numeric;
  v_dias_avg numeric; v_dias_med numeric;
  v_dormindo int; v_serie jsonb; v_buckets jsonb;
  v_serie_start timestamptz;
BEGIN
  WITH services AS (
    SELECT * FROM public.v_customer_services_enriched
    WHERE is_valid AND canonical_id IS NOT NULL
      AND (p_segment = 'all' OR segmento = p_segment)
  ),
  per_customer AS (
    SELECT canonical_id, COUNT(*) AS svc_count, SUM(valor) AS ltv FROM services GROUP BY canonical_id
  )
  SELECT COUNT(*), COUNT(*) FILTER (WHERE svc_count >= 2), COALESCE(AVG(ltv), 0)
  INTO v_clientes_total, v_clientes_recorrentes, v_ltv_avg FROM per_customer;

  v_ltv_liq := COALESCE(v_ltv_avg, 0) - v_cac;
  v_ltv_cac := CASE WHEN v_cac > 0 THEN COALESCE(v_ltv_avg, 0) / v_cac ELSE NULL END;

  WITH services AS (
    SELECT * FROM public.v_customer_services_enriched
    WHERE is_valid AND canonical_id IS NOT NULL AND (p_segment = 'all' OR segmento = p_segment)
  ),
  no_periodo AS (SELECT DISTINCT canonical_id FROM services WHERE event_date BETWEEN p_start AND p_end),
  com_historico AS (
    SELECT DISTINCT np.canonical_id FROM no_periodo np
    JOIN services s ON s.canonical_id = np.canonical_id WHERE s.event_date < p_start
  )
  SELECT (SELECT COUNT(*) FROM no_periodo), (SELECT COUNT(*) FROM com_historico)
  INTO v_clientes_periodo, v_recorrentes_periodo;

  WITH services AS (
    SELECT * FROM public.v_customer_services_enriched
    WHERE is_valid AND canonical_id IS NOT NULL AND (p_segment = 'all' OR segmento = p_segment)
  ),
  totais AS (SELECT canonical_id, COUNT(*) AS svc_count FROM services GROUP BY canonical_id)
  SELECT COALESCE(SUM(s.valor), 0), COALESCE(SUM(s.valor) FILTER (WHERE t.svc_count >= 2), 0)
  INTO v_receita_total, v_receita_recorrente
  FROM services s JOIN totais t USING (canonical_id)
  WHERE s.event_date BETWEEN p_start AND p_end;

  WITH services AS (
    SELECT canonical_id, event_date AS dt FROM public.v_customer_services_enriched
    WHERE is_valid AND canonical_id IS NOT NULL AND (p_segment = 'all' OR segmento = p_segment)
  ),
  ranked AS (SELECT canonical_id, dt, ROW_NUMBER() OVER (PARTITION BY canonical_id ORDER BY dt) AS rn FROM services),
  segundos AS (
    SELECT a.canonical_id, (EXTRACT(EPOCH FROM (b.dt - a.dt)) / 86400.0)::numeric AS dias
    FROM ranked a JOIN ranked b ON b.canonical_id = a.canonical_id AND b.rn = 2 WHERE a.rn = 1
  )
  SELECT COALESCE(AVG(dias), 0), COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY dias)::numeric, 0)
  INTO v_dias_avg, v_dias_med FROM segundos;

  WITH per_customer AS (
    SELECT canonical_id, COUNT(*) AS svc_count, MAX(event_date) AS last_dt
    FROM public.v_customer_services_enriched
    WHERE is_valid AND canonical_id IS NOT NULL AND (p_segment = 'all' OR segmento = p_segment)
    GROUP BY canonical_id
  )
  SELECT COUNT(*) INTO v_dormindo FROM per_customer
  WHERE svc_count >= 2 AND last_dt < (now() - interval '180 days');

  SELECT date_trunc('month', COALESCE(MIN(event_date), p_end - interval '12 months'))
  INTO v_serie_start FROM public.v_customer_services_enriched
  WHERE is_valid AND canonical_id IS NOT NULL AND (p_segment = 'all' OR segmento = p_segment);

  WITH meses AS (
    SELECT generate_series(v_serie_start, date_trunc('month', p_end), interval '1 month') AS mes
  ),
  services AS (
    SELECT canonical_id, event_date AS dt, valor FROM public.v_customer_services_enriched
    WHERE is_valid AND canonical_id IS NOT NULL AND (p_segment = 'all' OR segmento = p_segment)
  ),
  por_mes AS (
    SELECT m.mes,
      (SELECT COUNT(DISTINCT s.canonical_id) FROM services s
         WHERE s.dt >= m.mes AND s.dt < m.mes + interval '1 month') AS clientes_unicos,
      (SELECT COUNT(DISTINCT s.canonical_id) FROM services s
         WHERE s.dt >= m.mes AND s.dt < m.mes + interval '1 month'
           AND EXISTS (SELECT 1 FROM services s2 WHERE s2.canonical_id = s.canonical_id AND s2.dt < m.mes)) AS recorrentes,
      (SELECT COALESCE(SUM(s.valor), 0) FROM services s
         WHERE s.dt >= m.mes AND s.dt < m.mes + interval '1 month') AS receita_total,
      (SELECT COALESCE(SUM(s.valor), 0) FROM services s
         WHERE s.dt >= m.mes AND s.dt < m.mes + interval '1 month'
           AND EXISTS (SELECT 1 FROM services s2 WHERE s2.canonical_id = s.canonical_id AND s2.dt < m.mes)) AS receita_recorrente
    FROM meses m
  )
  SELECT jsonb_agg(jsonb_build_object(
    'mes', to_char(mes, 'YYYY-MM'),
    'clientes_unicos', clientes_unicos, 'recorrentes', recorrentes,
    'pct_recorrencia', CASE WHEN clientes_unicos > 0 THEN ROUND(recorrentes::numeric * 100 / clientes_unicos, 2) ELSE 0 END,
    'receita_total', receita_total, 'receita_recorrente', receita_recorrente
  ) ORDER BY mes) INTO v_serie FROM por_mes;

  WITH services AS (
    SELECT canonical_id, event_date AS dt FROM public.v_customer_services_enriched
    WHERE is_valid AND canonical_id IS NOT NULL AND (p_segment = 'all' OR segmento = p_segment)
  ),
  ranked AS (SELECT canonical_id, dt, ROW_NUMBER() OVER (PARTITION BY canonical_id ORDER BY dt) AS rn FROM services),
  primeiros AS (SELECT canonical_id, dt AS first_dt FROM ranked WHERE rn = 1),
  segundos  AS (SELECT canonical_id, dt AS second_dt FROM ranked WHERE rn = 2),
  classif AS (
    SELECT CASE
      WHEN s.second_dt IS NULL THEN 'nao_voltou'
      WHEN s.second_dt - p.first_dt <= interval '7 days' THEN 'd_0_7'
      WHEN s.second_dt - p.first_dt <= interval '30 days' THEN 'd_8_30'
      WHEN s.second_dt - p.first_dt <= interval '60 days' THEN 'd_31_60'
      WHEN s.second_dt - p.first_dt <= interval '90 days' THEN 'd_61_90'
      WHEN s.second_dt - p.first_dt <= interval '180 days' THEN 'd_91_180'
      WHEN s.second_dt - p.first_dt <= interval '365 days' THEN 'd_181_365'
      ELSE 'd_365_plus' END AS bucket
    FROM primeiros p LEFT JOIN segundos s USING (canonical_id)
  )
  SELECT jsonb_object_agg(bucket, qtd) INTO v_buckets
  FROM (SELECT bucket, COUNT(*) AS qtd FROM classif GROUP BY bucket) x;

  RETURN jsonb_build_object(
    'clientes_total', v_clientes_total, 'clientes_recorrentes', v_clientes_recorrentes,
    'recorrencia_geral_pct', CASE WHEN v_clientes_total > 0 THEN ROUND(v_clientes_recorrentes::numeric * 100 / v_clientes_total, 2) ELSE 0 END,
    'clientes_periodo', v_clientes_periodo, 'recorrentes_periodo', v_recorrentes_periodo,
    'recorrencia_periodo_pct', CASE WHEN v_clientes_periodo > 0 THEN ROUND(v_recorrentes_periodo::numeric * 100 / v_clientes_periodo, 2) ELSE 0 END,
    'receita_total', v_receita_total, 'receita_recorrente', v_receita_recorrente,
    'pct_receita_recorrente', CASE WHEN v_receita_total > 0 THEN ROUND(v_receita_recorrente * 100 / v_receita_total, 2) ELSE 0 END,
    'cac_economizado', GREATEST(v_recorrentes_periodo, 0) * v_cac,
    'ltv_avg', ROUND(COALESCE(v_ltv_avg, 0), 2), 'ltv_liq', ROUND(v_ltv_liq, 2),
    'ltv_cac', ROUND(COALESCE(v_ltv_cac, 0), 2),
    'dias_avg', ROUND(v_dias_avg, 1), 'dias_med', ROUND(v_dias_med, 1),
    'recorrentes_dormindo', v_dormindo,
    'serie_mensal', COALESCE(v_serie, '[]'::jsonb),
    'tempo_recorrencia', COALESCE(v_buckets, '{}'::jsonb),
    'cac_fixo', v_cac
  );
END; $$;

CREATE OR REPLACE FUNCTION public.recurrence_cohorts(p_segment text DEFAULT 'all')
RETURNS TABLE(
  cohort_label text, cohort_start timestamptz, clientes int,
  voltou_30 numeric, voltou_60 numeric, voltou_90 numeric,
  voltou_180 numeric, voltou_365 numeric, voltou_any numeric,
  tempo_avg numeric, tempo_med numeric, ltv_avg numeric, receita_recorrente numeric
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH services AS (
    SELECT canonical_id, event_date AS dt, valor FROM public.v_customer_services_enriched
    WHERE is_valid AND canonical_id IS NOT NULL AND (p_segment = 'all' OR segmento = p_segment)
  ),
  ranked AS (SELECT canonical_id, dt, valor, ROW_NUMBER() OVER (PARTITION BY canonical_id ORDER BY dt) AS rn FROM services),
  primeiros AS (SELECT canonical_id, dt AS first_dt, date_trunc('quarter', dt) AS cohort_q FROM ranked WHERE rn = 1),
  segundos AS (SELECT canonical_id, dt AS second_dt FROM ranked WHERE rn = 2),
  ltv AS (SELECT canonical_id, SUM(valor) AS total_ltv, COUNT(*) AS svc_count FROM services GROUP BY canonical_id),
  base AS (
    SELECT p.cohort_q, p.canonical_id, p.first_dt, s.second_dt, l.total_ltv, l.svc_count
    FROM primeiros p LEFT JOIN segundos s USING (canonical_id) LEFT JOIN ltv l USING (canonical_id)
  )
  SELECT
    to_char(cohort_q, 'YYYY') || ' ' ||
      CASE EXTRACT(QUARTER FROM cohort_q)::int
        WHEN 1 THEN 'Jan-Mar' WHEN 2 THEN 'Abr-Jun'
        WHEN 3 THEN 'Jul-Set' ELSE 'Out-Dez' END,
    cohort_q, COUNT(*)::int,
    CASE WHEN now() >= cohort_q + interval '30 days' THEN ROUND(100.0 * COUNT(*) FILTER (WHERE second_dt - first_dt <= interval '30 days') / NULLIF(COUNT(*),0), 2) END,
    CASE WHEN now() >= cohort_q + interval '60 days' THEN ROUND(100.0 * COUNT(*) FILTER (WHERE second_dt - first_dt <= interval '60 days') / NULLIF(COUNT(*),0), 2) END,
    CASE WHEN now() >= cohort_q + interval '90 days' THEN ROUND(100.0 * COUNT(*) FILTER (WHERE second_dt - first_dt <= interval '90 days') / NULLIF(COUNT(*),0), 2) END,
    CASE WHEN now() >= cohort_q + interval '180 days' THEN ROUND(100.0 * COUNT(*) FILTER (WHERE second_dt - first_dt <= interval '180 days') / NULLIF(COUNT(*),0), 2) END,
    CASE WHEN now() >= cohort_q + interval '365 days' THEN ROUND(100.0 * COUNT(*) FILTER (WHERE second_dt - first_dt <= interval '365 days') / NULLIF(COUNT(*),0), 2) END,
    ROUND(100.0 * COUNT(*) FILTER (WHERE second_dt IS NOT NULL) / NULLIF(COUNT(*),0), 2),
    ROUND(AVG((EXTRACT(EPOCH FROM (second_dt - first_dt))/86400.0)::numeric) FILTER (WHERE second_dt IS NOT NULL), 1),
    ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY (EXTRACT(EPOCH FROM (second_dt - first_dt))/86400.0)) FILTER (WHERE second_dt IS NOT NULL))::numeric, 1),
    ROUND(AVG(total_ltv), 2),
    ROUND(SUM(total_ltv) FILTER (WHERE svc_count >= 2), 2)
  FROM base GROUP BY cohort_q ORDER BY cohort_q;
$$;

CREATE OR REPLACE FUNCTION public.recurrence_provider_first(p_segment text DEFAULT 'all')
RETURNS TABLE(
  provider_id text, provider_name text,
  clientes_iniciados int, clientes_voltaram int, taxa_retorno_pct numeric,
  ltv_avg numeric, receita_recorrente numeric, nps_avg numeric, ticket_primeiro_avg numeric
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH services AS (
    SELECT *, event_date AS dt FROM public.v_customer_services_enriched
    WHERE is_valid AND canonical_id IS NOT NULL AND (p_segment = 'all' OR segmento = p_segment)
  ),
  ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY canonical_id ORDER BY dt) AS rn,
           COUNT(*) OVER (PARTITION BY canonical_id) AS total FROM services
  ),
  primeiros AS (SELECT canonical_id, provider_id, provider_name, valor AS first_valor, nps_nota, total FROM ranked WHERE rn = 1),
  ltv AS (SELECT canonical_id, SUM(valor) AS total_ltv FROM services GROUP BY canonical_id)
  SELECT COALESCE(p.provider_id, 'sem_prestador'), COALESCE(MAX(p.provider_name), '(sem prestador)'),
    COUNT(*)::int, COUNT(*) FILTER (WHERE p.total >= 2)::int,
    ROUND(100.0 * COUNT(*) FILTER (WHERE p.total >= 2) / NULLIF(COUNT(*),0), 2),
    ROUND(AVG(l.total_ltv), 2), ROUND(SUM(l.total_ltv) FILTER (WHERE p.total >= 2), 2),
    ROUND(AVG(p.nps_nota), 2), ROUND(AVG(p.first_valor), 2)
  FROM primeiros p LEFT JOIN ltv l USING (canonical_id)
  GROUP BY p.provider_id HAVING COUNT(*) >= 3
  ORDER BY COUNT(*) FILTER (WHERE p.total >= 2)::numeric / NULLIF(COUNT(*),0) DESC NULLS LAST, COUNT(*) DESC;
$$;

CREATE OR REPLACE FUNCTION public.recurrence_provider_last_dormant(p_segment text DEFAULT 'all')
RETURNS TABLE(provider_id text, provider_name text, clientes_que_sumiram int, nps_avg_ultimo numeric, ticket_avg_ultimo numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH services AS (
    SELECT *, event_date AS dt FROM public.v_customer_services_enriched
    WHERE is_valid AND canonical_id IS NOT NULL AND (p_segment = 'all' OR segmento = p_segment)
  ),
  per_customer AS (SELECT canonical_id, COUNT(*) AS total, MAX(dt) AS last_dt FROM services GROUP BY canonical_id),
  dormentes AS (SELECT canonical_id, last_dt FROM per_customer WHERE total >= 2 AND last_dt < (now() - interval '180 days')),
  ultimo AS (
    SELECT s.canonical_id, s.provider_id, s.provider_name, s.valor, s.nps_nota
    FROM dormentes d JOIN services s ON s.canonical_id = d.canonical_id AND s.dt = d.last_dt
  )
  SELECT COALESCE(provider_id, 'sem_prestador'), COALESCE(MAX(provider_name), '(sem prestador)'),
         COUNT(*)::int, ROUND(AVG(nps_nota), 2), ROUND(AVG(valor), 2)
  FROM ultimo GROUP BY provider_id HAVING COUNT(*) >= 2 ORDER BY COUNT(*) DESC;
$$;

CREATE OR REPLACE FUNCTION public.recurrence_reactivation_tags(
  p_segment text DEFAULT 'all', p_limit int DEFAULT 200, p_offset int DEFAULT 0
) RETURNS TABLE(
  canonical_id uuid, cliente_nome text, cliente_telefone text, segmento text,
  ultimo_servico timestamptz, ultimo_prestador text, dias_sem_servico int,
  ltv numeric, nps_ultimo int, tag text
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH services AS (
    SELECT *, event_date AS dt FROM public.v_customer_services_enriched
    WHERE is_valid AND canonical_id IS NOT NULL AND (p_segment = 'all' OR segmento = p_segment)
  ),
  per_customer AS (SELECT canonical_id, COUNT(*) AS total, SUM(valor) AS ltv, MAX(dt) AS last_dt FROM services GROUP BY canonical_id),
  ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY canonical_id ORDER BY dt DESC) AS rn_desc,
           ROW_NUMBER() OVER (PARTITION BY canonical_id ORDER BY dt ASC) AS rn_asc FROM services
  ),
  ultimos AS (SELECT canonical_id, provider_name, nps_nota FROM ranked WHERE rn_desc = 1),
  primeiros AS (SELECT canonical_id, valor AS valor_primeiro FROM ranked WHERE rn_asc = 1),
  avg_global AS (SELECT AVG(valor) AS m FROM services),
  cli AS (SELECT v.id, v.name, v.phone, v.segmento FROM public.v_customer_canonical v WHERE v.id = v.canonical_id),
  tagged AS (
    SELECT pc.canonical_id, c.name AS cliente_nome, c.phone AS cliente_telefone, c.segmento,
      pc.last_dt AS ultimo_servico, u.provider_name AS ultimo_prestador,
      EXTRACT(DAY FROM (now() - pc.last_dt))::int AS dias_sem,
      pc.ltv, u.nps_nota,
      CASE
        WHEN pc.total >= 2 AND pc.last_dt < now() - interval '365 days' THEN 'recorrente_perdido_365d'
        WHEN pc.total >= 2 AND pc.last_dt < now() - interval '180 days' THEN 'recorrente_dormindo_180d'
        WHEN pc.total >= 2 AND pc.last_dt < now() - interval '90 days'  THEN 'recorrente_alerta_90d'
        WHEN pc.total = 1 AND u.nps_nota IS NOT NULL AND u.nps_nota >= 9 THEN 'promotor_sem_recompra'
        WHEN pc.total = 1 AND pc.last_dt < now() - interval '90 days'
             AND pr.valor_primeiro > (SELECT m FROM avg_global) * 1.5 THEN 'alto_valor_sem_recompra'
        ELSE NULL END AS tag
    FROM per_customer pc
    JOIN cli c ON c.id = pc.canonical_id
    JOIN ultimos u ON u.canonical_id = pc.canonical_id
    JOIN primeiros pr ON pr.canonical_id = pc.canonical_id
  )
  SELECT canonical_id, cliente_nome, cliente_telefone, segmento, ultimo_servico,
         ultimo_prestador, dias_sem, ROUND(ltv, 2), nps_nota::int, tag
  FROM tagged WHERE tag IS NOT NULL
  ORDER BY CASE tag
    WHEN 'promotor_sem_recompra' THEN 1 WHEN 'alto_valor_sem_recompra' THEN 2
    WHEN 'recorrente_alerta_90d' THEN 3 WHEN 'recorrente_dormindo_180d' THEN 4
    WHEN 'recorrente_perdido_365d' THEN 5 END, dias_sem DESC
  LIMIT p_limit OFFSET p_offset;
$$;
