-- Criar tabela para histórico de mudanças de status
CREATE TABLE public.ficha_status_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ficha_id TEXT NOT NULL REFERENCES public.fichas_de_servico(id),
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  data_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_fim TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_ficha_status_historico_ficha ON public.ficha_status_historico(ficha_id);
CREATE INDEX idx_ficha_status_historico_datas ON public.ficha_status_historico(data_inicio, data_fim);

-- Habilitar RLS
ALTER TABLE public.ficha_status_historico ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Atendentes podem ver histórico de status" 
ON public.ficha_status_historico 
FOR SELECT 
USING (true);

CREATE POLICY "Sistema pode inserir histórico de status" 
ON public.ficha_status_historico 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar histórico de status" 
ON public.ficha_status_historico 
FOR UPDATE 
USING (true);

-- Função para registrar mudança de status
CREATE OR REPLACE FUNCTION public.registrar_mudanca_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o status mudou
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Fechar o registro anterior (se existir)
    UPDATE public.ficha_status_historico
    SET data_fim = now()
    WHERE ficha_id = NEW.id
      AND data_fim IS NULL;
    
    -- Criar novo registro
    INSERT INTO public.ficha_status_historico (ficha_id, status_anterior, status_novo, data_inicio)
    VALUES (NEW.id, OLD.status, NEW.status, now());
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para disparar a função
CREATE TRIGGER trigger_registrar_mudanca_status
AFTER UPDATE OF status ON public.fichas_de_servico
FOR EACH ROW
EXECUTE FUNCTION public.registrar_mudanca_status();

-- Inserir registro inicial para fichas existentes (status atual)
INSERT INTO public.ficha_status_historico (ficha_id, status_anterior, status_novo, data_inicio)
SELECT id, NULL, status, created_at
FROM public.fichas_de_servico
WHERE status IS NOT NULL;