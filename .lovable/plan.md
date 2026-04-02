

## Plano: Melhorias no Sistema de Tarefas

### Resumo
Adicionar categoria de tarefa (App/Sistema vs Outros), upload de imagens, e sistema de devolutiva com notificação ao solicitante quando a tarefa é finalizada.

### 1. Migração de Banco de Dados

Adicionar 3 novas colunas na tabela `tasks`:

```sql
ALTER TABLE tasks ADD COLUMN category text DEFAULT 'outros';        -- 'app_sistema' ou 'outros'
ALTER TABLE tasks ADD COLUMN attachments text[] DEFAULT '{}';       -- URLs das imagens
ALTER TABLE tasks ADD COLUMN resolution_note text;                  -- Devolutiva escrita por quem finaliza
```

Criar bucket de storage `task-attachments` (público) para os uploads de imagens.

### 2. Atualizar Tipo `Task` (`src/types/tasks.ts`)

Adicionar os campos `category`, `attachments` e `resolution_note` à interface.

### 3. Modificar `TaskFormDialog` (`src/components/tasks/TaskFormDialog.tsx`)

- **Campo Categoria**: Select com opções "App/Sistema" e "Outros"
  - Ao selecionar "App/Sistema", auto-selecionar Gustavo (`ba755a07...`) como responsável. Daniel (`7a782c7e...`) fica disponível para inclusão manual.
- **Upload de imagens**: Botao de upload abaixo da descrição, usando o bucket `task-attachments` no storage. Mostrar previews das imagens anexadas.
- **Devolutiva (ao finalizar)**: Quando o status mudar para "feito", exibir campo obrigatório "Devolutiva" para que o responsável escreva a mensagem de retorno.
- No save, ao mudar status para "feito" com `resolution_note`, inserir uma notificação na tabela `notificacoes` direcionada ao `created_by` da tarefa.

### 4. Modificar `TaskCard` (`src/components/tasks/TaskCard.tsx`)

- Mostrar badge da categoria ("App/Sistema" ou outro)
- Indicador visual se tem imagens anexadas (icone de clip/imagem)
- Se a tarefa estiver "feito" e tiver `resolution_note`, mostrar a devolutiva no card

### 5. Atualizar `useVisibleTasks` e filtros em `Tarefas.tsx`

- Incluir os novos campos nas queries
- Adicionar filtro de categoria na página de tarefas

### 6. Sistema de Notificação (Devolutiva)

Quando alguém (Gustavo ou Daniel) marca uma tarefa como "feito":
1. O campo `resolution_note` é obrigatório
2. Uma notificação é inserida em `notificacoes` com:
   - `usuario_destino` = `created_by` da tarefa (quem solicitou)
   - `tipo` = `'tarefa_concluida'`
   - `titulo` = `'Tarefa concluída: [título]'`
   - `descricao` = a devolutiva escrita (ex: "Pode testar, corrigi o bug X")
   - `referencia_id` = ID da tarefa

Isso usa o sistema de notificações já existente no app.

### Arquivos modificados
- `src/types/tasks.ts` — novos campos
- `src/components/tasks/TaskFormDialog.tsx` — categoria, upload, devolutiva
- `src/components/tasks/TaskCard.tsx` — exibir categoria, anexos, devolutiva
- `src/pages/Tarefas.tsx` — filtro de categoria
- `src/hooks/useVisibleTasks.ts` — incluir novos campos
- Migration SQL — colunas + storage bucket

