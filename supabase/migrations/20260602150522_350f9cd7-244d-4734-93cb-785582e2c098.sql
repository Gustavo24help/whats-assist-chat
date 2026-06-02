
-- =====================================================================
-- CRM: customers, customer_services, leads
-- =====================================================================

-- ---------- TABLE: customers ----------
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL UNIQUE,
  email text,
  cpf text,
  address_street text,
  address_neighborhood text,
  address_city text,
  address_state text,
  address_zip text,
  address_complement text,
  address_lat numeric,
  address_lng numeric,
  total_services_completed integer NOT NULL DEFAULT 0,
  total_services_cancelled integer NOT NULL DEFAULT 0,
  total_spent numeric(12,2) NOT NULL DEFAULT 0,
  avg_ticket numeric(12,2) NOT NULL DEFAULT 0,
  first_service_at timestamptz,
  last_service_at timestamptz,
  last_contact_at timestamptz,
  status text NOT NULL DEFAULT 'ativo',
  segment text,
  preferred_skus text[] NOT NULL DEFAULT '{}',
  preferred_provider_id text,
  preferred_provider_name text,
  satisfaction_avg numeric(3,1),
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  days_since_last_service integer,
  acquisition_source text,
  referred_by_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_status_check CHECK (status IN ('ativo','inativo','churned','vip')),
  CONSTRAINT customers_segment_check CHECK (segment IS NULL OR segment IN ('residencial','comercial','condominio'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read customers"
  ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert customers"
  ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update customers"
  ON public.customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete customers"
  ON public.customers FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_customers_status ON public.customers(status);
CREATE INDEX idx_customers_last_service_at ON public.customers(last_service_at DESC);
CREATE INDEX idx_customers_segment ON public.customers(segment);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- TABLE: customer_services ----------
CREATE TABLE public.customer_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  ficha_id text UNIQUE,
  sku text,
  description text,
  diagnosis text,
  service_date timestamptz,
  requested_at timestamptz,
  completed_at timestamptz,
  status text NOT NULL,
  cancellation_reason text,
  quoted_value numeric(12,2),
  final_value numeric(12,2),
  payment_method text,
  provider_id text,
  provider_name text,
  provider_phone text,
  customer_rating integer CHECK (customer_rating IS NULL OR (customer_rating >= 1 AND customer_rating <= 5)),
  customer_feedback text,
  had_warranty_claim boolean NOT NULL DEFAULT false,
  warranty_description text,
  address_used text,
  photos_before text[] NOT NULL DEFAULT '{}',
  photos_after text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_services_status_check CHECK (
    status IN ('finalizado','em_garantia','cancelado_cliente','cancelado_prestador','orcamento_recusado','sem_resposta','em_andamento')
  ),
  CONSTRAINT customer_services_payment_check CHECK (
    payment_method IS NULL OR payment_method IN ('pix','cartao','dinheiro','transferencia')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_services TO authenticated;
GRANT ALL ON public.customer_services TO service_role;

ALTER TABLE public.customer_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read customer_services"
  ON public.customer_services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert customer_services"
  ON public.customer_services FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update customer_services"
  ON public.customer_services FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete customer_services"
  ON public.customer_services FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_cs_customer ON public.customer_services(customer_id);
CREATE INDEX idx_cs_status ON public.customer_services(status);
CREATE INDEX idx_cs_sku ON public.customer_services(sku);
CREATE INDEX idx_cs_service_date ON public.customer_services(service_date DESC);
CREATE INDEX idx_cs_provider ON public.customer_services(provider_id);

-- ---------- TABLE: leads ----------
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL UNIQUE,
  email text,
  address_neighborhood text,
  address_city text,
  address_state text,
  total_quotes_requested integer NOT NULL DEFAULT 0,
  last_quote_at timestamptz,
  first_contact_at timestamptz,
  last_contact_at timestamptz,
  status text NOT NULL DEFAULT 'novo',
  lost_reason text,
  last_sku_requested text,
  skus_requested text[] NOT NULL DEFAULT '{}',
  last_quoted_value numeric(12,2),
  acquisition_source text,
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  converted_to_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leads_status_check CHECK (status IN ('novo','em_negociacao','frio','perdido','converted'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read leads"
  ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert leads"
  ON public.leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update leads"
  ON public.leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete leads"
  ON public.leads FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_phone ON public.leads(phone);
CREATE INDEX idx_leads_last_contact ON public.leads(last_contact_at DESC);
CREATE INDEX idx_leads_last_sku ON public.leads(last_sku_requested);

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- HELPER: map ficha status -> CRM status
-- =====================================================================
CREATE OR REPLACE FUNCTION public.crm_map_ficha_status(_status text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _status IN ('Finalizado','Retorno') THEN 'finalizado'
    WHEN _status = 'Garantia' THEN 'em_garantia'
    WHEN _status IN ('Agendado','Em andamento','Visita Técnica') THEN 'em_andamento'
    WHEN _status IN ('Perdido','Não foi adiante') THEN 'orcamento_recusado'
    ELSE 'sem_resposta'
  END;
$$;

CREATE OR REPLACE FUNCTION public.crm_is_closed_status(_status text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _status IN ('Finalizado','Garantia','Retorno');
$$;

-- =====================================================================
-- AGGREGATOR
-- =====================================================================
CREATE OR REPLACE FUNCTION public.recalc_customer_aggregates(_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed int;
  v_cancelled int;
  v_spent numeric;
  v_avg numeric;
  v_first timestamptz;
  v_last timestamptz;
  v_pref_skus text[];
  v_pref_prov_id text;
  v_pref_prov_name text;
  v_days int;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE status IN ('finalizado','em_garantia')),
    COUNT(*) FILTER (WHERE status IN ('cancelado_cliente','cancelado_prestador','orcamento_recusado','sem_resposta')),
    COALESCE(SUM(final_value) FILTER (WHERE status IN ('finalizado','em_garantia')), 0),
    COALESCE(AVG(final_value) FILTER (WHERE status IN ('finalizado','em_garantia') AND final_value > 0), 0),
    MIN(service_date) FILTER (WHERE status IN ('finalizado','em_garantia')),
    MAX(service_date) FILTER (WHERE status IN ('finalizado','em_garantia'))
  INTO v_completed, v_cancelled, v_spent, v_avg, v_first, v_last
  FROM public.customer_services WHERE customer_id = _customer_id;

  SELECT array_agg(sku ORDER BY cnt DESC)
  INTO v_pref_skus
  FROM (
    SELECT sku, COUNT(*) cnt
    FROM public.customer_services
    WHERE customer_id = _customer_id AND sku IS NOT NULL
    GROUP BY sku ORDER BY cnt DESC LIMIT 5
  ) s;

  SELECT provider_id, provider_name
  INTO v_pref_prov_id, v_pref_prov_name
  FROM (
    SELECT provider_id, MAX(provider_name) provider_name, COUNT(*) cnt
    FROM public.customer_services
    WHERE customer_id = _customer_id
      AND provider_id IS NOT NULL
      AND status IN ('finalizado','em_garantia')
    GROUP BY provider_id ORDER BY cnt DESC LIMIT 1
  ) p;

  v_days := CASE WHEN v_last IS NULL THEN NULL ELSE EXTRACT(DAY FROM (now() - v_last))::int END;

  UPDATE public.customers SET
    total_services_completed = v_completed,
    total_services_cancelled = v_cancelled,
    total_spent = v_spent,
    avg_ticket = v_avg,
    first_service_at = v_first,
    last_service_at = v_last,
    preferred_skus = COALESCE(v_pref_skus, '{}'),
    preferred_provider_id = v_pref_prov_id,
    preferred_provider_name = v_pref_prov_name,
    days_since_last_service = v_days
  WHERE id = _customer_id;
END;
$$;

-- =====================================================================
-- SYNC FROM FICHAS
-- =====================================================================
CREATE OR REPLACE FUNCTION public.crm_sync_ficha(_ficha public.fichas_de_servico)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := _ficha.telefone_cliente;
  v_customer_id uuid;
  v_crm_status text;
  v_is_closed boolean;
  v_cliente_nome text;
  v_cliente record;
  v_prestador record;
  v_skus text[];
  v_sku text;
  v_lead_id uuid;
BEGIN
  IF v_phone IS NULL OR btrim(v_phone) = '' THEN RETURN; END IF;

  v_crm_status := public.crm_map_ficha_status(_ficha.status::text);
  v_is_closed := public.crm_is_closed_status(_ficha.status::text);

  -- Lookup cliente para enriquecer
  SELECT * INTO v_cliente FROM public.clientes WHERE telefone = v_phone LIMIT 1;

  -- Lookup prestador
  IF _ficha.prestador_id IS NOT NULL THEN
    SELECT cpf, nome, telefone INTO v_prestador FROM public.prestadores WHERE cpf = _ficha.prestador_id LIMIT 1;
  END IF;

  -- Categoria como SKU
  v_sku := NULL;
  IF _ficha.categoria_id IS NOT NULL THEN
    BEGIN
      SELECT lower(regexp_replace(nome, '\s+', '_', 'g')) INTO v_sku
      FROM public.categorias WHERE id = _ficha.categoria_id LIMIT 1;
    EXCEPTION WHEN OTHERS THEN v_sku := NULL;
    END;
  END IF;

  -- Caso: ficha fechada → garantir customer (promover lead se necessário)
  IF v_is_closed THEN
    SELECT id INTO v_customer_id FROM public.customers WHERE phone = v_phone;
    IF v_customer_id IS NULL THEN
      INSERT INTO public.customers (
        name, phone, cpf, address_neighborhood, address_city,
        first_service_at, last_contact_at
      ) VALUES (
        COALESCE(NULLIF(btrim(_ficha.nome_cliente),''), NULLIF(btrim(v_cliente.nome),''), 'Cliente'),
        v_phone,
        COALESCE(_ficha.cpf, v_cliente.cpf),
        COALESCE(_ficha.bairro, v_cliente.bairro),
        COALESCE(_ficha.cidade, v_cliente.cidade),
        now(), now()
      )
      RETURNING id INTO v_customer_id;

      -- Promover lead, se existir
      UPDATE public.leads
      SET status = 'converted',
          converted_to_customer_id = v_customer_id,
          converted_at = now()
      WHERE phone = v_phone AND status <> 'converted';
    END IF;
  ELSE
    -- Não-fechada: se já existe customer, vincula a ele
    SELECT id INTO v_customer_id FROM public.customers WHERE phone = v_phone;
  END IF;

  IF v_customer_id IS NOT NULL THEN
    INSERT INTO public.customer_services (
      customer_id, ficha_id, sku, description,
      service_date, requested_at, completed_at,
      status, quoted_value, final_value,
      provider_id, provider_name, provider_phone,
      address_used,
      cancellation_reason
    ) VALUES (
      v_customer_id, _ficha.id, v_sku, _ficha.descricao,
      COALESCE(_ficha.horario_agendamento, _ficha.created_at),
      _ficha.created_at,
      CASE WHEN v_is_closed THEN COALESCE(_ficha.updated_at, now()) ELSE NULL END,
      v_crm_status,
      _ficha.valor_total, CASE WHEN v_is_closed THEN _ficha.valor_total ELSE NULL END,
      _ficha.prestador_id, v_prestador.nome, v_prestador.telefone,
      _ficha.endereco,
      _ficha.motivo_perda
    )
    ON CONFLICT (ficha_id) DO UPDATE SET
      sku = EXCLUDED.sku,
      description = EXCLUDED.description,
      service_date = EXCLUDED.service_date,
      completed_at = EXCLUDED.completed_at,
      status = EXCLUDED.status,
      quoted_value = EXCLUDED.quoted_value,
      final_value = EXCLUDED.final_value,
      provider_id = EXCLUDED.provider_id,
      provider_name = EXCLUDED.provider_name,
      provider_phone = EXCLUDED.provider_phone,
      cancellation_reason = EXCLUDED.cancellation_reason;

    PERFORM public.recalc_customer_aggregates(v_customer_id);
  ELSE
    -- Sem customer → atualizar/criar lead
    INSERT INTO public.leads (
      name, phone, address_neighborhood, address_city,
      total_quotes_requested, last_quote_at,
      first_contact_at, last_contact_at,
      last_sku_requested, skus_requested, last_quoted_value
    ) VALUES (
      COALESCE(NULLIF(btrim(_ficha.nome_cliente),''), NULLIF(btrim(v_cliente.nome),''), 'Lead'),
      v_phone,
      COALESCE(_ficha.bairro, v_cliente.bairro),
      COALESCE(_ficha.cidade, v_cliente.cidade),
      1, _ficha.created_at,
      _ficha.created_at, now(),
      v_sku,
      CASE WHEN v_sku IS NULL THEN '{}' ELSE ARRAY[v_sku] END,
      _ficha.valor_total
    )
    ON CONFLICT (phone) DO UPDATE SET
      total_quotes_requested = public.leads.total_quotes_requested + 1,
      last_quote_at = GREATEST(COALESCE(public.leads.last_quote_at, _ficha.created_at), _ficha.created_at),
      last_contact_at = now(),
      last_sku_requested = COALESCE(EXCLUDED.last_sku_requested, public.leads.last_sku_requested),
      skus_requested = (
        SELECT ARRAY(SELECT DISTINCT unnest(public.leads.skus_requested || EXCLUDED.skus_requested))
      ),
      last_quoted_value = COALESCE(EXCLUDED.last_quoted_value, public.leads.last_quoted_value);
  END IF;
END;
$$;

-- Trigger
CREATE OR REPLACE FUNCTION public.trg_crm_sync_ficha()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.crm_sync_ficha(NEW);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG '[crm_sync_ficha] erro ficha %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fichas_crm_sync
  AFTER INSERT OR UPDATE OF status, valor_total, prestador_id, categoria_id, nome_cliente, motivo_perda
  ON public.fichas_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.trg_crm_sync_ficha();

-- Trigger em mensagens p/ last_contact_at
CREATE OR REPLACE FUNCTION public.trg_crm_touch_last_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.customers SET last_contact_at = NEW.data_hora WHERE phone = NEW.cliente_id;
  UPDATE public.leads SET last_contact_at = NEW.data_hora WHERE phone = NEW.cliente_id AND status <> 'converted';
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mensagens_crm_touch
  AFTER INSERT ON public.mensagens
  FOR EACH ROW EXECUTE FUNCTION public.trg_crm_touch_last_contact();

-- =====================================================================
-- RPC: promote lead manually
-- =====================================================================
CREATE OR REPLACE FUNCTION public.promote_lead_to_customer(_lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.leads;
  v_customer_id uuid;
BEGIN
  SELECT * INTO v_lead FROM public.leads WHERE id = _lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'lead not found'; END IF;

  SELECT id INTO v_customer_id FROM public.customers WHERE phone = v_lead.phone;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      name, phone, email, address_neighborhood, address_city, address_state,
      tags, notes, acquisition_source, last_contact_at, first_service_at
    ) VALUES (
      v_lead.name, v_lead.phone, v_lead.email,
      v_lead.address_neighborhood, v_lead.address_city, v_lead.address_state,
      v_lead.tags, v_lead.notes, v_lead.acquisition_source,
      COALESCE(v_lead.last_contact_at, now()), now()
    )
    RETURNING id INTO v_customer_id;
  END IF;

  UPDATE public.leads
  SET status = 'converted', converted_to_customer_id = v_customer_id, converted_at = now()
  WHERE id = _lead_id;

  PERFORM public.recalc_customer_aggregates(v_customer_id);
  RETURN v_customer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_lead_to_customer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_customer_aggregates(uuid) TO authenticated;

-- =====================================================================
-- BACKFILL (idempotente, roda na migração)
-- =====================================================================
DO $$
DECLARE
  r public.fichas_de_servico;
BEGIN
  FOR r IN
    SELECT * FROM public.fichas_de_servico
    WHERE telefone_cliente IS NOT NULL AND btrim(telefone_cliente) <> ''
    ORDER BY created_at ASC
  LOOP
    BEGIN
      PERFORM public.crm_sync_ficha(r);
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[backfill crm] erro ficha %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;
