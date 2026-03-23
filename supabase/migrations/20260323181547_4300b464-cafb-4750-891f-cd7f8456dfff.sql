
-- Update prestadores_chat entries with matched names from prestadores table
UPDATE public.prestadores_chat pc
SET 
  nome = p.nome,
  cpf = p.cpf
FROM public.prestadores p
WHERE pc.cpf IS NULL
AND (
  p.telefone = REPLACE(pc.telefone, 'whatsapp:+', '')
  OR p.telefone = REPLACE(pc.telefone, 'whatsapp:+55', '')
  OR ('55' || p.telefone) = REPLACE(pc.telefone, 'whatsapp:+', '')
  OR ('5541' || p.telefone) = REPLACE(pc.telefone, 'whatsapp:+', '')
  OR p.telefone LIKE '%' || RIGHT(REPLACE(pc.telefone, 'whatsapp:+', ''), 8) || '%'
);

-- Also merge duplicate conversations (same prestador, different phone format)
-- e.g., whatsapp:+554195720271 and whatsapp:+5541995720271 are the same person
-- Move messages from shorter format to longer format (with 9-digit mobile)
-- First, identify duplicates by matching last 8 digits
