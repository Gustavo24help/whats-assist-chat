
DROP POLICY "Admins podem fazer upload de imagens de avisos" ON storage.objects;
CREATE POLICY "Gestores podem fazer upload de imagens de avisos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avisos-images'
  AND public.can_manage_avisos(auth.uid())
);

DROP POLICY "Admins podem deletar imagens de avisos" ON storage.objects;
CREATE POLICY "Gestores podem deletar imagens de avisos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avisos-images'
  AND public.can_manage_avisos(auth.uid())
);
