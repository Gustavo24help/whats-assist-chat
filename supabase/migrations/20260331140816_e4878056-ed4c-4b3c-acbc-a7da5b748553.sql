
-- Tabela principal de tarefas
CREATE TABLE public.tasks (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title          text NOT NULL,
  description    text,
  project        text,
  created_by     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date     date,
  due_date       date NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  status         text NOT NULL DEFAULT 'pendente',
  progress       integer NOT NULL DEFAULT 0,
  priority       text NOT NULL DEFAULT 'media',
  last_comment   text
);

-- Responsáveis (múltiplos por tarefa)
CREATE TABLE public.task_assignees (
  task_id  uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id)
);

-- Visibilidade compartilhada entre membros
CREATE TABLE public.task_visibility (
  owner_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewer_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (owner_id, viewer_id)
);

-- Tabela auxiliar de membros do time
CREATE TABLE public.team_members (
  id   uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'member'
);

-- Validation trigger para status
CREATE OR REPLACE FUNCTION public.validate_task_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pendente', 'em_andamento', 'bloqueado', 'feito') THEN
    RAISE EXCEPTION 'status inválido: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_task_status_trigger
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_status();

-- Validation trigger para priority
CREATE OR REPLACE FUNCTION public.validate_task_priority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.priority NOT IN ('alta', 'media', 'baixa') THEN
    RAISE EXCEPTION 'prioridade inválida: %', NEW.priority;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_task_priority_trigger
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_priority();

-- Validation trigger para progress (0-100)
CREATE OR REPLACE FUNCTION public.validate_task_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.progress < 0 OR NEW.progress > 100 THEN
    RAISE EXCEPTION 'progress deve estar entre 0 e 100';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_task_progress_trigger
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_progress();

-- Validation trigger para role em team_members
CREATE OR REPLACE FUNCTION public.validate_team_member_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.role NOT IN ('manager', 'member') THEN
    RAISE EXCEPTION 'role inválido: %', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_team_member_role_trigger
  BEFORE INSERT OR UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.validate_team_member_role();

-- Trigger: updated_at e completed_at automáticos
CREATE OR REPLACE FUNCTION public.set_task_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
    RETURN NEW;
  END IF;
  NEW.updated_at = now();
  IF NEW.status = 'feito' AND OLD.status != 'feito' THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_task_updated_at();

-- RLS para tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated podem ver tasks" ON public.tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated podem inserir tasks" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated podem atualizar tasks" ON public.tasks
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated podem deletar tasks" ON public.tasks
  FOR DELETE TO authenticated USING (true);

-- RLS para task_assignees
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated podem ver assignees" ON public.task_assignees
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated podem inserir assignees" ON public.task_assignees
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated podem deletar assignees" ON public.task_assignees
  FOR DELETE TO authenticated USING (true);

-- RLS para task_visibility
ALTER TABLE public.task_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated podem ver visibility" ON public.task_visibility
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated podem inserir visibility" ON public.task_visibility
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated podem deletar visibility" ON public.task_visibility
  FOR DELETE TO authenticated USING (true);

-- RLS para team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated podem ver team_members" ON public.team_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated podem inserir team_members" ON public.team_members
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated podem atualizar team_members" ON public.team_members
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated podem deletar team_members" ON public.team_members
  FOR DELETE TO authenticated USING (true);
