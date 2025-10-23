-- Adicionar política RLS para permitir DELETE em prestadores
CREATE POLICY "Atendentes podem deletar prestadores"
ON public.prestadores
FOR DELETE
USING (true);