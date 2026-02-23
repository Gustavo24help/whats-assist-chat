

# Correcao de Lentidao e Travamento do App

## Diagnostico

Foram identificados 3 problemas principais causando a lentidao e travamento:

### Problema 1: Falhas de rede sem tratamento adequado
Os console logs mostram dezenas de erros `TypeError: Failed to fetch` em cadeia. Quando uma requisicao falha (rede instavel, timeout), o app nao se recupera - fica preso no estado "Carregando..." indefinidamente.

**Locais afetados:**
- `AuthContext.tsx`: Se a busca de perfil/role falha, o `loading` pode nunca virar `false` em certos cenarios
- `ConversationList.tsx`: As 5 queries paralelas nao tem try/catch - se uma falha, a lista nao carrega
- `OrcamentosSemFichaNotification.tsx`: Falha silenciosa ja visivel nos logs

### Problema 2: Requisicoes excessivas ao backend
- `AuthContext.tsx` linha 189: Um `console.log` roda em **cada render** do provider (dezenas de vezes por segundo)
- `TOKEN_REFRESHED` dispara um reload completo do perfil (desnecessario se o perfil ja esta carregado)
- `fetchClientes()` faz 5 queries sequenciais + writes (update ficha_ativa_id) a cada 30 segundos via polling
- `fetchClientes()` busca TODAS as mensagens para calcular janela 24h (query pesada sem limite)

### Problema 3: Falta de timeout e retry
- Nenhuma requisicao tem timeout configurado
- Nao existe retry automatico para falhas transientes
- A tela de "Carregando..." nao tem timeout de seguranca

---

## Solucao

### 1. AuthContext.tsx - Resiliencia e reducao de chamadas

**Alteracoes:**
- Remover o `console.log` da linha 189 que roda a cada render (impacto de performance)
- Adicionar timeout de seguranca no `loading`: se nao carregar em 10 segundos, liberar a tela com fallback
- No `TOKEN_REFRESHED`, so recarregar perfil se ele ainda nao existir (evitar chamadas redundantes)
- Adicionar try/catch mais robusto no `initializeAuth`

### 2. ConversationList.tsx - Otimizacao de queries e tratamento de erros

**Alteracoes:**
- Envolver `fetchClientes()` em try/catch para nao travar em caso de falha de rede
- Envolver `fetchSemOrcamento()`, `fetchServicosParaFinalizar()`, `fetchTagsWithColors()`, `fetchAtendentes()` em try/catch
- Na query de mensagens (linha 676-681), adicionar `.limit(1000)` para nao buscar quantidade ilimitada
- Na query de fichas sem ficha ativa (linha 709-713), adicionar `.limit(500)`
- Remover ou limitar o `Promise.all` de updates de `ficha_ativa_id` (linhas 724-732) - nao fazer writes em polling, apenas na primeira carga
- Aumentar intervalo do polling de 30s para 60s (reduzir carga no backend)

### 3. App.tsx ou main.tsx - Handler global de rejeicoes nao tratadas

**Alteracao:**
- Adicionar `window.addEventListener('unhandledrejection', ...)` no `main.tsx` para capturar erros asincronos que escapam dos try/catch e evitar que o app trave silenciosamente

### 4. ChatWindow.tsx - Tratamento de falhas

**Alteracao:**
- Garantir que o `fetchClienteData` tem try/catch adequado para nao travar a tela de chat quando a rede falhar

---

## Detalhes tecnicos

### AuthContext.tsx

```typescript
// REMOVER linha 189 (console.log que roda a cada render)

// ADICIONAR timeout de seguranca no useEffect
useEffect(() => {
  // Timeout de seguranca: se nao carregar em 10s, liberar
  const safetyTimeout = setTimeout(() => {
    if (loading) {
      console.warn('AuthContext - Timeout de seguranca atingido');
      setLoading(false);
    }
  }, 10000);

  initializeAuth();

  return () => clearTimeout(safetyTimeout);
}, []);

// MODIFICAR TOKEN_REFRESHED handler
} else if (event === 'TOKEN_REFRESHED' && session?.user) {
  setUser(session.user);
  // So recarregar se perfil ainda nao existe
  if (!userProfile) {
    setTimeout(() => loadUserProfile(session.user.id), 0);
  }
}
```

### ConversationList.tsx

```typescript
// Envolver loadInitialData em try/catch
const loadInitialData = async () => {
  setIsLoading(true);
  try {
    await Promise.all([
      fetchClientes(),
      fetchTagsWithColors(),
      fetchServicosParaFinalizar(),
      fetchAtendentes(),
      fetchSemOrcamento()
    ]);
  } catch (err) {
    console.error('Erro ao carregar dados iniciais:', err);
  } finally {
    setIsLoading(false);
  }
};

// Cada fetch individual tambem com try/catch
const fetchClientes = async () => {
  try {
    // ... queries existentes ...
  } catch (err) {
    console.error('Erro ao buscar clientes:', err);
  }
};

// Aumentar polling para 60s
const pollingInterval = window.setInterval(() => {
  fetchClientes();
  fetchServicosParaFinalizar();
  fetchSemOrcamento();
}, 60000);

// Limitar query de mensagens
const { data: ultimasMensagens } = await supabase
  .from('mensagens')
  .select('cliente_id, data_hora')
  .in('cliente_id', telefones)
  .eq('remetente', 'cliente')
  .order('data_hora', { ascending: false })
  .limit(1000);

// Remover writes de ficha_ativa_id do polling (mover para flag)
// Apenas na primeira carga, nao no polling
```

### main.tsx

```typescript
// Adicionar handler global
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
  event.preventDefault();
});
```

---

## Resumo de alteracoes

| Arquivo | Alteracao | Impacto |
|---------|-----------|---------|
| `src/contexts/AuthContext.tsx` | Remover console.log de render, timeout de seguranca 10s, evitar reload redundante em TOKEN_REFRESHED | Elimina tela "Carregando..." infinita |
| `src/components/ConversationList.tsx` | Try/catch em todas as funcoes fetch, limitar queries, polling 60s, remover writes do polling | Chats e conversas carregam mesmo com rede instavel |
| `src/main.tsx` | Handler global de unhandledrejection | Previne travamentos silenciosos |
| `src/components/ChatWindow.tsx` | Try/catch robusto no fetchClienteData | Chat individual nao trava |

**Nota de seguranca de dados:** Nenhuma dessas alteracoes modifica dados existentes ou altera a estrutura do banco. Sao apenas melhorias de resiliencia e performance no lado do cliente.

