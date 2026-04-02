
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _assignee_id text;
  _creator_name text;
BEGIN
  -- Get creator name
  SELECT COALESCE(p.full_name, 'Alguém') INTO _creator_name
  FROM profiles p WHERE p.id = NEW.created_by;

  -- Notify each assignee
  IF NEW.assignee_ids IS NOT NULL THEN
    FOREACH _assignee_id IN ARRAY NEW.assignee_ids
    LOOP
      -- Don't notify the creator if they assigned to themselves
      IF _assignee_id::uuid != NEW.created_by THEN
        INSERT INTO notificacoes (usuario_destino, tipo, referencia_id, titulo, descricao)
        VALUES (
          _assignee_id::uuid,
          'tarefa_criada',
          NEW.id::text,
          '📋 Nova tarefa atribuída',
          _creator_name || ' atribuiu: ' || NEW.title
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_task_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _completer_name text;
  _completer_id uuid;
BEGIN
  -- Only when status changes to 'feito'
  IF NEW.status = 'feito' AND OLD.status != 'feito' THEN
    -- Find who completed it (first assignee or use a fallback)
    IF NEW.assignee_ids IS NOT NULL AND array_length(NEW.assignee_ids, 1) > 0 THEN
      _completer_id := NEW.assignee_ids[1]::uuid;
    END IF;

    SELECT COALESCE(p.full_name, 'Responsável') INTO _completer_name
    FROM profiles p WHERE p.id = _completer_id;

    -- Notify the creator (if different from completer)
    IF NEW.created_by IS NOT NULL AND NEW.created_by != _completer_id THEN
      INSERT INTO notificacoes (usuario_destino, tipo, referencia_id, titulo, descricao)
      VALUES (
        NEW.created_by,
        'tarefa_concluida',
        NEW.id::text,
        '✅ Tarefa concluída',
        _completer_name || ' finalizou: ' || NEW.title ||
        CASE WHEN NEW.resolution_note IS NOT NULL AND NEW.resolution_note != ''
          THEN ' — ' || LEFT(NEW.resolution_note, 200)
          ELSE ''
        END
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_task_created
AFTER INSERT ON tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_assigned();

CREATE TRIGGER on_task_completed
AFTER UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_completed();
