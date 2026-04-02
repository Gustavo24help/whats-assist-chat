INSERT INTO team_members (id, name, role)
SELECT ur.user_id, 
  COALESCE(p.full_name, 'Sem nome'),
  CASE 
    WHEN ur.role IN ('admin', 'chefe', 'admin_ti') THEN 'manager'
    ELSE 'member'
  END
FROM user_roles ur
LEFT JOIN profiles p ON p.id = ur.user_id
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
