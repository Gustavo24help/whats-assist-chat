-- Criar usuário admin Leonardo Karam
-- Nota: Este script deve ser executado APÓS criar o usuário via auth

-- Primeiro, vamos verificar se o usuário já existe e pegar seu ID
-- (Este comentário é apenas informativo - o usuário será criado via auth.admin API)

-- Inserir role de admin para Leonardo Karam
-- O user_id será o UUID do usuário criado via auth
-- Temporariamente vamos criar um placeholder que será atualizado

-- Como não podemos criar usuários auth via SQL, vamos usar a edge function
-- Mas vou preparar o ambiente para que funcione corretamente

-- Garantir que a função handle_new_user está funcionando
-- (já existe, apenas verificando)

-- Comentário: O usuário será criado via interface ou edge function
-- Email: leonardo@24help.com.br
-- Nome: Leonardo Karam
-- Senha: Leo@2025
-- Role: admin