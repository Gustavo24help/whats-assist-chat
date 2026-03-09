# 2026-03-09 — Detalhes de usuários em Configurações

## Objetivo
Implementar no módulo **Configurações > Gerenciar Usuários** um acesso para uma página de detalhes internos do usuário (funcionário), com:

- Nome e dados básicos do usuário já existente no sistema.
- Data de ingresso na empresa.
- Função/cargo customizável (com catálogo de cargos e adição de novos).
- Permissões customizáveis.
- Histórico operacional para documentação (fichas, chats, serviços e observações).

## O que foi alterado

### 1) Navegação da lista para página de detalhes
- Foi adicionado um botão de ação na tabela de usuários (`ExternalLink`) para abrir a rota:
  - `/settings/users/:userId`

Arquivo:
- `src/components/UserManagement.tsx`

### 2) Nova rota protegida
- Foi adicionada uma rota protegida para detalhes de usuário:
  - `/settings/users/:userId`

Arquivo:
- `src/App.tsx`

### 3) Nova página de detalhes de usuário
Foi criada a página `UserDetails` com:

- **Cabeçalho** com voltar para `/settings`.
- **Card de dados internos**:
  - Data de ingresso (`admission_date`).
  - Cargo/função (`position_name`) via select.
  - Campo para criar novo cargo no catálogo.
  - Botão de salvar.
- **Card de permissões customizáveis**:
  - Adicionar permissão por texto.
  - Listar permissões do usuário.
  - Remover permissão.
- **Card de histórico**:
  - Tipos sugeridos (`ficha`, `chat_assumido`, `chat_fechado`, `servico_fechado`, `observacao`).
  - Referência opcional (ID simples).
  - Descrição obrigatória.
  - Tabela com histórico ordenado por data.

Arquivo:
- `src/pages/UserDetails.tsx`

### 4) Estrutura de banco (Supabase)
Foi criada migration com 4 tabelas para suportar os dados internos:

1. `user_internal_profiles`
   - `user_id` (PK/FK para `profiles.id`)
   - `admission_date`
   - `position_name`
   - `created_at`, `updated_at`

2. `user_position_options`
   - catálogo de cargos customizáveis
   - `id`, `name` (único), `created_at`

3. `user_custom_permissions`
   - permissões por usuário
   - `id`, `user_id`, `permission_name`, `created_at`
   - unique (`user_id`, `permission_name`)

4. `user_internal_history`
   - histórico operacional
   - `id`, `user_id`, `history_type`, `description`, `reference_id`, `created_by`, `created_at`

Também foram adicionadas:
- Policies RLS:
  - leitura para `authenticated`
  - escrita/administração somente para admin (`has_role(auth.uid(), 'admin'::app_role)`)
- Trigger para atualizar `updated_at` em `user_internal_profiles`.
- Seed inicial de cargos:
  - Atendente, Supervisor, Coordenador

Arquivo:
- `supabase/migrations/20260309172000_create_user_internal_management.sql`

### 5) Tipagem do client Supabase
Foram adicionados os novos tipos de tabela para manter compatibilidade TS:

- `user_internal_profiles`
- `user_position_options`
- `user_custom_permissions`
- `user_internal_history`

Arquivo:
- `src/integrations/supabase/types.ts`

## Fluxo funcional implementado
1. Admin abre **Configurações > Gerenciar Usuários**.
2. Clica no botão de detalhes de um usuário.
3. Página carrega dados base via `manage-users` (`list`) e dados internos via tabelas novas.
4. Admin pode:
   - salvar data de ingresso e cargo;
   - cadastrar novos cargos;
   - registrar/remover permissões;
   - registrar eventos de histórico.

## Testes e validações executadas
- Build da aplicação para validar compilação TS/rota/componentes.
- Lint geral foi executado e possui erros pré-existentes no projeto (não relacionados somente a esta entrega).

## Pontos de atenção para deploy
Como solicitado, foram considerados cenários em que funciona local e falha em deploy. Principais pontos a checar:

1. **Migration não aplicada em produção**
   - Sintoma: telas carregam sem dados, inserções falham.
   - Confirmar execução da migration:
     - `20260309172000_create_user_internal_management.sql`

2. **RLS bloqueando escrita**
   - Sintoma: leitura funciona, salvar/adicionar retorna erro de permissão.
   - Verificar se usuário de teste em produção realmente tem role `admin` em `user_roles`.

3. **Diferença de schema/tipagem entre ambientes**
   - Sintoma: front tenta acessar tabela nova, mas backend/deploy ainda sem tabela.
   - Confirmar ordem de deploy: migration antes do front.

4. **Erros no console do browser e logs do Supabase**
   - Front: checar Network > respostas 401/403/404/500.
   - Supabase: checar logs SQL/API para mensagens de policy, relação inexistente ou unique violation.

5. **Permissões duplicadas**
   - Há unique (`user_id`, `permission_name`), então tentativa de inserir igual retorna erro esperado.

## Como diagnosticar rapidamente se algo quebrar
1. Abrir rota `/settings/users/<id>` com admin autenticado.
2. Tentar:
   - salvar data de ingresso;
   - adicionar cargo;
   - adicionar permissão;
   - adicionar histórico.
3. Se falhar:
   - copiar erro exibido no toast + erro do console;
   - verificar se tabela existe no SQL editor;
   - validar role admin do usuário;
   - validar policies criadas na migration.

## Observações
- A tela de detalhes foi desenhada para usar **ID simples** de usuário na URL (`:userId`), conforme solicitado.
- O histórico foi implementado como documentação operacional interna, mantendo flexibilidade por tipo e descrição.
