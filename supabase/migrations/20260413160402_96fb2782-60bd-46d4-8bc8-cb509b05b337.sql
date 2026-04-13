ALTER TABLE public.mensagem_leitura_operador 
ADD COLUMN IF NOT EXISTS manual_unread_at timestamptz DEFAULT NULL;

CREATE POLICY "Users can delete own read status" 
ON public.mensagem_leitura_operador 
FOR DELETE TO authenticated 
USING (user_id = auth.uid());