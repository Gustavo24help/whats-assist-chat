-- Fix: tornar trigger de bot_snooze SECURITY DEFINER para não falhar pelo RLS de bot_snooze_rules/bot_config
ALTER FUNCTION public.recompute_bot_snooze(text, boolean) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.trg_set_bot_snooze() SECURITY DEFINER SET search_path = public;