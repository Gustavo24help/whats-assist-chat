-- Criar policy para permitir usuários verificarem suas próprias roles
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;

CREATE POLICY "Users can view their own role"
ON user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Permitir admins verem todas as roles
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;

CREATE POLICY "Admins can view all roles"
ON user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
  )
);