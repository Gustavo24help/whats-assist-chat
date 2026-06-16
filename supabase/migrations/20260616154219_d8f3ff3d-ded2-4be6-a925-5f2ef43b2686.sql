
-- Add customer_phone column to customer_services and keep in sync with customers.phone
ALTER TABLE public.customer_services ADD COLUMN IF NOT EXISTS customer_phone text;

-- Backfill from customers
UPDATE public.customer_services cs
SET customer_phone = c.phone
FROM public.customers c
WHERE cs.customer_id = c.id
  AND cs.customer_phone IS DISTINCT FROM c.phone;

-- Trigger: on insert/update of customer_services, fill phone from customers
CREATE OR REPLACE FUNCTION public.customer_services_fill_phone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL AND (NEW.customer_phone IS NULL OR NEW.customer_phone = '') THEN
    SELECT phone INTO NEW.customer_phone FROM public.customers WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_services_fill_phone ON public.customer_services;
CREATE TRIGGER trg_customer_services_fill_phone
BEFORE INSERT OR UPDATE OF customer_id ON public.customer_services
FOR EACH ROW EXECUTE FUNCTION public.customer_services_fill_phone();

-- Trigger: when customers.phone changes, propagate to customer_services
CREATE OR REPLACE FUNCTION public.customers_propagate_phone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    UPDATE public.customer_services SET customer_phone = NEW.phone WHERE customer_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customers_propagate_phone ON public.customers;
CREATE TRIGGER trg_customers_propagate_phone
AFTER UPDATE OF phone ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.customers_propagate_phone();

-- Recreate enriched view exposing customer_phone (preserve previous columns)
DROP VIEW IF EXISTS public.v_customer_services_enriched CASCADE;

CREATE VIEW public.v_customer_services_enriched AS
SELECT
  cs.id, cs.ficha_id, cs.customer_id,
  vcc.canonical_id, vcc.segmento,
  cs.customer_phone,
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
