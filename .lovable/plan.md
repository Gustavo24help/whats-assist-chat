

## Plano: Redistribuição automática de chats ao deslogar + Cadeia de atribuição configurável + Lembrete de saída

### Resumo

Quando um operador deslogar (manualmente ou por inatividade), seus chats atribuídos serão redistribuídos automaticamente conforme uma cadeia de prioridade configurável. Cada operador poderá definir quem recebe seus chats, e receberá um lembrete antes do horário previsto de saída.

---

### 1. Nova tabela: `atribuicao_cadeia`

Cada operador define sua cadeia de redistribuição (ex: "se eu sair, manda pra João → Maria → qualquer disponível"):

```sql
CREATE TABLE atribuicao_cadeia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  destino_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = qualquer disponível
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, ordem)
);
```

### 2. Nova tabela: `horario_saida_previsto`

Cada operador define seu horário previsto de saída (usado para lembrete):

```sql
CREATE TABLE horario_saida_previsto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  hora_saida TIME NOT NULL DEFAULT '18:00',
  lembrete_minutos_antes INTEGER NOT NULL DEFAULT 15,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3. Lógica de redistribuição (no logout)

Ao deslogar (manual ou por inatividade), no hook `useInactivityLogout` e no botão de logout:

1. Buscar todos os clientes com `atendente_id = user.id`
2. Buscar a cadeia do operador em `atribuicao_cadeia` (ordenada por `ordem`)
3. Para cada destino na cadeia, verificar se está online (tem `registro_ponto` aberto, sem `saida_em`)
4. Atribuir ao primeiro disponível; se nenhum da cadeia estiver online, atribuir a qualquer operador com ponto aberto
5. Se destino_user_id for NULL na cadeia, significa "qualquer disponível"

Essa lógica será implementada como **função no cliente** chamada antes do `signOut()`.

### 4. Lembrete de saída (notificação)

- Um `setInterval` no App verifica a cada minuto se o horário atual está dentro do range de lembrete do operador
- Ex: se `hora_saida = 18:00` e `lembrete_minutos_antes = 15`, às 17:45 exibe popup: "Seu horário de saída é às 18:00. Lembre-se de deslogar."
- O popup tem botão "Deslogar agora" e "Fechar"

### 5. Tela de configuração

Na página de **Configurações** (ou Manutenção → Minha Conta), adicionar seção:

- **Cadeia de redistribuição**: lista sortable onde o operador adiciona usuários na ordem de prioridade, com opção "Qualquer disponível" como fallback
- **Horário de saída**: input de hora + minutos de antecedência do lembrete

### 6. Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| Migração SQL | 2 novas tabelas + RLS |
| `src/hooks/useInactivityLogout.tsx` | Chamar redistribuição antes do signOut |
| `src/components/PageLayout.tsx` ou `src/App.tsx` | Botão logout existente → chamar redistribuição |
| `src/hooks/useLogoutRedistribution.ts` | **Novo** — lógica de redistribuir chats |
| `src/hooks/useExitReminder.ts` | **Novo** — lembrete de horário de saída |
| `src/components/ExitReminderPopup.tsx` | **Novo** — popup de lembrete |
| `src/components/AtribuicaoCadeiaConfig.tsx` | **Novo** — config da cadeia na tela de configurações |
| `src/pages/Settings.tsx` ou `src/pages/Manutencao.tsx` | Adicionar seção de cadeia + horário |

### Detalhes técnicos

- A redistribuição roda **client-side antes do signOut** — é rápida (1 query para buscar chats, 1 query para buscar cadeia, 1 batch update)
- O lembrete usa `hora_saida` comparado com `new Date().toLocaleTimeString()` em intervalos de 1 minuto
- RLS: cada usuário só pode ler/editar sua própria cadeia e horário

