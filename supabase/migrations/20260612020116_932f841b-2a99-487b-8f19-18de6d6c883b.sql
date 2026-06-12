
CREATE OR REPLACE FUNCTION public.customer_doc_digits(_cpf text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(regexp_replace(COALESCE(_cpf, ''), '\D', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public.customer_segment(_cpf text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN length(public.customer_doc_digits(_cpf)) > 11 THEN 'B2B' ELSE 'B2C' END;
$$;

CREATE OR REPLACE FUNCTION public.customer_dedup_key(_cpf text, _phone text, _name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  WITH d AS (
    SELECT
      public.customer_doc_digits(_cpf) AS doc,
      NULLIF(regexp_replace(COALESCE(_phone, ''), '\D', '', 'g'), '') AS tel,
      NULLIF(btrim(lower(COALESCE(_name, ''))), '') AS nm
  )
  SELECT CASE
    WHEN d.doc IS NOT NULL AND length(d.doc) > 11 THEN 'cnpj:' || d.doc
    WHEN d.doc IS NOT NULL THEN 'cpf:' || d.doc
    WHEN d.tel IS NOT NULL THEN 'tel:' || d.tel
    WHEN public.customer_segment(_cpf) = 'B2B' AND d.nm IS NOT NULL THEN 'nm:' || d.nm
    ELSE NULL
  END FROM d;
$$;

CREATE OR REPLACE VIEW public.v_customer_canonical AS
WITH base AS (
  SELECT
    c.id, c.name, c.phone, c.cpf,
    c.first_service_at, c.last_service_at, c.total_spent,
    public.customer_segment(c.cpf) AS segmento,
    COALESCE(public.customer_dedup_key(c.cpf, c.phone, c.name), 'id:' || c.id::text) AS dedup_key
  FROM public.customers c
)
SELECT
  b.id, b.name, b.phone, b.cpf,
  b.first_service_at, b.last_service_at, b.total_spent,
  b.segmento, b.dedup_key,
  first_value(b.id) OVER (PARTITION BY b.dedup_key ORDER BY b.id::text) AS canonical_id
FROM base b;

CREATE OR REPLACE VIEW public.v_customer_services_enriched AS
SELECT
  cs.id, cs.ficha_id, cs.customer_id,
  vcc.canonical_id, vcc.segmento,
  cs.provider_id, cs.provider_name, cs.sku,
  cs.service_date, cs.completed_at, cs.requested_at, cs.created_at, cs.status,
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

GRANT SELECT ON public.v_customer_canonical TO authenticated, anon, service_role;
GRANT SELECT ON public.v_customer_services_enriched TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.customer_doc_digits(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.customer_segment(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.customer_dedup_key(text, text, text) TO authenticated, anon, service_role;
