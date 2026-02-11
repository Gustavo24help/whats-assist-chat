

## Plano: Deploy, Execucao e Painel de Funcoes

### Passo 1 - Corrigir erro de build

O deploy esta bloqueado por um erro no `twilio-webhook/index.ts` linha 641. O `error.stack` pode ser `undefined`, mas o tipo espera `string | null`.

Correcao simples:

```typescript
// linha 641 - DE:
error_message: error instanceof Error ? error.stack : String(error),

// PARA:
error_message: error instanceof Error ? (error.stack ?? error.message) : String(error),
```

### Passo 2 - Registrar recover-message-sids no config.toml

Adicionar ao `supabase/config.toml`:

```toml
[functions.recover-message-sids]
verify_jwt = false
```

### Passo 3 - Deploy e execucao

1. Fazer deploy da funcao `recover-message-sids`
2. Executar via curl para testar
3. Rodar a query de validacao para verificar quantas mensagens ainda estao sem `message_sid`

### Passo 4 - Painel de funcoes na pagina de Configuracoes

Adicionar uma nova aba "Ferramentas" (ou "Manutencao") na pagina de Settings com botoes para executar funcoes backend sob demanda, sem precisar pedir no chat.

**Funcoes disponiveis no painel:**

| Botao | Funcao | Descricao |
|-------|--------|-----------|
| Recuperar MessageSIDs | `recover-message-sids` | Busca SIDs faltantes na Twilio |
| Sincronizar Mensagens | `sync-twilio-messages` | Sincroniza mensagens recentes |
| Reprocessar Fila Backup | `reprocess-backup-queue` | Reprocessa mensagens na fila |
| Monitor de Mensagens | `monitor-mensagens` | Verifica saude das mensagens |

**Comportamento de cada botao:**
- Ao clicar, mostra um spinner e chama a edge function via POST
- Ao terminar, mostra o resultado em um card abaixo do botao (sucesso/erro + numeros)
- Botao desabilitado enquanto esta executando
- Somente visivel para admins

**Arquivo novo:** `src/components/FerramentasManutencao.tsx`

**Arquivo editado:** `src/pages/Settings.tsx` - adicionar nova aba "Ferramentas" no TabsList

### Resumo de arquivos

- **Editar**: `supabase/functions/twilio-webhook/index.ts` (linha 641 - fix tipo)
- **Editar**: `supabase/config.toml` (adicionar recover-message-sids)
- **Criar**: `src/components/FerramentasManutencao.tsx` (painel de botoes)
- **Editar**: `src/pages/Settings.tsx` (adicionar aba Ferramentas)
- **Deploy**: `recover-message-sids`

### Riscos

- Nenhuma alteracao em dados existentes no banco
- Nenhuma alteracao de schema
- O painel apenas executa funcoes ja existentes via botao
- Somente admins terao acesso

