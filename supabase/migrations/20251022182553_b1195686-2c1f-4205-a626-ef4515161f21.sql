-- Criar bucket para arquivos de chat
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para o bucket chat-files
CREATE POLICY "Atendentes podem ver arquivos de chat"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-files');

CREATE POLICY "Atendentes podem fazer upload de arquivos de chat"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'chat-files');

CREATE POLICY "Atendentes podem atualizar arquivos de chat"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'chat-files');

CREATE POLICY "Atendentes podem deletar arquivos de chat"
ON storage.objects
FOR DELETE
USING (bucket_id = 'chat-files');