
-- =====================================================
-- 1. Limpar TODAS as triggers existentes de fichas_de_servico
--    para evitar conflitos e duplicidades
-- =====================================================
DROP TRIGGER IF EXISTS trigger_auto_finalizacao_on_update ON public.fichas_de_servico;
DROP TRIGGER IF EXISTS trigger_auto_finalizacao_official ON public.fichas_de_servico;
DROP TRIGGER IF EXISTS trigger_auto_finalizacao ON public.fichas_de_servico;

-- =====================================================
-- 2. Recriar todas as triggers legítimas que devem existir
-- =====================================================

-- Status change history
DROP TRIGGER IF EXISTS registrar_mudanca_status_trigger ON public.fichas_de_servico;
CREATE TRIGGER registrar_mudanca_status_trigger
  AFTER UPDATE ON public.fichas_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_mudanca_status();

-- User internal history tracking
DROP TRIGGER IF EXISTS track_ficha_status_change_trigger ON public.fichas_de_servico;
CREATE TRIGGER track_ficha_status_change_trigger
  AFTER UPDATE ON public.fichas_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.track_ficha_status_change();

-- Close orcamento forms on status change
DROP TRIGGER IF EXISTS close_orcamento_on_status_trigger ON public.fichas_de_servico;
CREATE TRIGGER close_orcamento_on_status_trigger
  BEFORE UPDATE ON public.fichas_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.close_orcamento_on_status();

-- Validate tipo_agendamento
DROP TRIGGER IF EXISTS validate_tipo_agendamento_trigger ON public.fichas_de_servico;
CREATE TRIGGER validate_tipo_agendamento_trigger
  BEFORE INSERT OR UPDATE ON public.fichas_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_tipo_agendamento();

-- Update ficha_ativa on insert
DROP TRIGGER IF EXISTS update_ficha_ativa_trigger ON public.fichas_de_servico;
CREATE TRIGGER update_ficha_ativa_trigger
  AFTER INSERT ON public.fichas_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ficha_ativa_on_insert();

-- Bot reactivation schedule
DROP TRIGGER IF EXISTS schedule_bot_reactivation_trigger ON public.fichas_de_servico;
CREATE TRIGGER schedule_bot_reactivation_trigger
  AFTER UPDATE ON public.fichas_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_bot_reactivation();

-- =====================================================
-- 3. Criar a trigger oficial de auto-finalizacao (AFTER)
-- =====================================================
CREATE TRIGGER trigger_auto_finalizacao_official
  AFTER INSERT OR UPDATE ON public.fichas_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_finalizacao();

-- =====================================================
-- 4. Criar tabela de auditoria da automação
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id text NOT NULL,
  etapa text NOT NULL,
  status text NOT NULL DEFAULT 'started',
  detalhe text,
  payment_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index para consultas por ficha
CREATE INDEX IF NOT EXISTS idx_automation_audit_ficha ON public.automation_audit(ficha_id, created_at DESC);

-- RLS: apenas leitura para autenticados
ALTER TABLE public.automation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view automation audit"
  ON public.automation_audit FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert automation audit"
  ON public.automation_audit FOR INSERT
  TO service_role
  WITH CHECK (true);
