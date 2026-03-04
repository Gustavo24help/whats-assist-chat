

## Diagnóstico: Por que os alertas de status NÃO aparecem nos chats

### Dados confirmados no banco
- Regra salva corretamente: `[{"status":"Ficha Criada","maxMinutes":2,"color":"#9900ff"}]`
- Existem 5+ fichas com status "Ficha Criada" em uso ativo, algumas há horas (ex: FS4-260304 desde 13:35)
- A maioria dessas fichas NÃO tem registro em `ficha_status_historico` com `data_fim IS NULL` (a trigger só dispara em UPDATE de status, não no INSERT inicial)

### Bug identificado: Stale Closure

O problema principal esta em `ConversationList.tsx`. A funcao `fetchClientes` e definida no corpo do componente e le `statusAlertRules` do state via closure. Porem:

1. **Carga inicial** (linha 126-128): Funciona corretamente -- `fetchStatusAlertRules()` retorna as regras e passa direto para `fetchClientes(rules)`.

2. **Realtime e Polling** (linhas 148 e 172): Chamam `fetchClientes()` SEM passar regras. Essas callbacks foram capturadas no `useEffect([], [])` inicial, quando `statusAlertRules` ainda era `[]`. Como `fetchClientes` nao usa `useCallback`, a versao capturada fecha sobre o estado vazio.

3. **Resultado**: Qualquer refresh via realtime ou polling (a cada 60s) sobrescreve os clientes com `statusAlertColor: null` porque `activeRules` e `[]`.

### Plano de correcao

**Arquivo: `src/components/ConversationList.tsx`**

1. Criar um `useRef` para as regras de alerta (`statusAlertRulesRef`), atualizado sempre que o state mudar
2. Em `fetchClientes`, ler de `rulesOverride ?? statusAlertRulesRef.current` em vez de `statusAlertRules` (state)
3. Isso garante que realtime, polling e qualquer chamada futura sempre use as regras mais recentes, independente de closure

Mudancas especificas:
- Adicionar `const statusAlertRulesRef = useRef<StatusAlertRule[]>([])` junto aos outros refs
- Adicionar `useEffect` para sincronizar: `statusAlertRulesRef.current = statusAlertRules`
- Alterar linha 663 de `rulesOverride ?? statusAlertRules` para `rulesOverride ?? statusAlertRulesRef.current`

Nenhuma outra alteracao necessaria -- o calculo de tempo ja faz fallback correto para `updated_at`/`created_at` quando nao ha historico.

