-- Remover política que causa recursão infinita
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;

-- Criar política correta usando a função has_role que é SECURITY DEFINER
-- Isso evita recursão porque a função bypassa as políticas RLS
CREATE POLICY "Admins can view all roles"
ON user_roles
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Garantir que a política para ver própria role está correta
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;

CREATE POLICY "Users can view their own role"
ON user_roles
FOR SELECT
USING (auth.uid() = user_id);