
CREATE OR REPLACE FUNCTION public.adicionar_dias_uteis(data_base timestamp with time zone, dias integer)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  data_resultado TIMESTAMPTZ;
  dias_adicionados INTEGER := 0;
  dia_semana INTEGER;
  data_key TEXT;
  feriados TEXT[] := ARRAY[
    '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18',
    '2026-04-03', '2026-04-21', '2026-05-01', '2026-06-04',
    '2026-09-07', '2026-09-08', '2026-10-12', '2026-11-02',
    '2026-11-20', '2026-12-25'
  ];
BEGIN
  data_resultado := data_base;
  
  WHILE dias_adicionados < dias LOOP
    data_resultado := data_resultado + INTERVAL '1 day';
    dia_semana := EXTRACT(DOW FROM data_resultado);
    data_key := to_char(data_resultado, 'YYYY-MM-DD');
    
    IF dia_semana != 0 AND dia_semana != 6 AND NOT (data_key = ANY(feriados)) THEN
      dias_adicionados := dias_adicionados + 1;
    END IF;
  END LOOP;
  
  RETURN data_resultado;
END;
$function$;
