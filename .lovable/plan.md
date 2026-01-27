
# Plano: Correção da Auditoria de Bot + Proteção contra Reativação Acidental

## Problema Identificado

A investigação revelou que o sistema está funcionando **corretamente**, mas o histórico de auditoria está incompleto:

1. **Bots ativos por padrão não são registrados**: Quando um cliente entra no sistema, `bot_habilitado = true` automaticamente, mas isso não gera registro no `bot_historico`
2. **Primeiro registro aparece invertido**: Quando o operador clica em "Assumir" pela primeira vez, o sistema pode registrar "ligado" antes de "desligado" se houver alguma condição de corrida na UI
3. **Reativação acidental é possível**: O botão "Reativar Bot" não tem proteção extra, permitindo cliques acidentais

## Solução em Duas Partes

### Parte 1: Proteção contra Reativação Acidental

Adicionar campo de confirmação por digitação no AlertDialog quando a ação for **reativar** o bot.

**Arquivo**: `src/components/ChatWindow.tsx`

**Mudanças**:

1. Adicionar novo estado:
```typescript
const [confirmacaoTexto, setConfirmacaoTexto] = useState("");
```

2. Modificar o AlertDialog (linhas 1591-1635):
```typescript
<AlertDialogDescription>
  {botDesabilitado ? (
    <div className="space-y-4">
      <p>Deseja reativar o bot automatico para este cliente?</p>
      <div className="space-y-2">
        <p className="text-sm font-medium text-destructive">
          Para confirmar, digite "LIGAR" abaixo:
        </p>
        <Input
          value={confirmacaoTexto}
          onChange={(e) => setConfirmacaoTexto(e.target.value.toUpperCase())}
          placeholder="Digite LIGAR"
          className="font-mono"
        />
      </div>
    </div>
  ) : (
    // ... manter conteudo atual para desabilitar
  )}
</AlertDialogDescription>
```

3. Desabilitar botao de confirmacao ate digitar "LIGAR":
```typescript
<AlertDialogAction 
  onClick={toggleBot}
  disabled={isTogglingBot || (botDesabilitado && confirmacaoTexto !== 'LIGAR')}
>
```

4. Limpar o texto ao fechar o dialog:
```typescript
<AlertDialog 
  open={assumirDialogOpen} 
  onOpenChange={(open) => {
    setAssumirDialogOpen(open);
    if (!open) setConfirmacaoTexto("");
  }}
>
```

### Parte 2: Auditoria Avancada no Backend

Adicionar campos extras na tabela `bot_historico` e capturar mais contexto.

**Migracao SQL**:
```sql
ALTER TABLE bot_historico ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE bot_historico ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE bot_historico ADD COLUMN IF NOT EXISTS request_id TEXT;
```

**Arquivo**: `supabase/functions/toggle-bot-status/index.ts`

Capturar e salvar headers de auditoria:
```typescript
const userAgent = req.headers.get('user-agent') || 'desconhecido';
const ipAddress = req.headers.get('x-forwarded-for') 
  || req.headers.get('cf-connecting-ip') 
  || req.headers.get('x-real-ip') 
  || 'desconhecido';
const requestId = crypto.randomUUID();

// Adicionar ao insert do historico:
await supabase.from('bot_historico').insert({
  // ... campos existentes
  user_agent: userAgent,
  ip_address: ipAddress,
  request_id: requestId
});
```

**Arquivo**: `supabase/functions/stop-twilio-flow/index.ts`

Aplicar as mesmas mudancas de captura de auditoria.

### Parte 3: Exibir Auditoria no Historico

**Arquivo**: `src/components/BotHistoricoDialog.tsx`

Atualizar para exibir os novos campos quando disponiveis:
- User Agent (navegador/dispositivo)
- IP de origem
- Request ID

---

## Resumo de Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/ChatWindow.tsx` | Adicionar estado `confirmacaoTexto`, campo Input no AlertDialog, validacao do botao |
| `supabase/functions/toggle-bot-status/index.ts` | Capturar User-Agent, IP, Request ID |
| `supabase/functions/stop-twilio-flow/index.ts` | Capturar User-Agent, IP, Request ID |
| `src/components/BotHistoricoDialog.tsx` | Exibir novos campos de auditoria |
| Migracao SQL | Adicionar colunas user_agent, ip_address, request_id |

---

## Resultado Esperado

Apos implementacao:

1. **Reativar bot exige digitar "LIGAR"** - elimina cliques acidentais
2. **Cada acao registra contexto completo** - User-Agent, IP, Request ID
3. **Historico mostra detalhes** - possivel identificar de qual dispositivo/navegador veio cada acao

Se ocorrer nova "ativacao fantasma", teremos dados para identificar:
- Se veio de navegador diferente (sessao duplicada)
- Se veio de IP diferente (outro local/dispositivo)
- Request ID para correlacionar com logs
