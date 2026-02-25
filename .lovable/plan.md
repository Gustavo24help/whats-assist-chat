

# Diagnostico e Correcao: Orcamento de Prestadores e Criacao de Fichas

## Analise Completa

### Problema 1: Operadores nao conseguem criar ficha

**Causa raiz identificada:** O componente `CriarFichaDialog.tsx` (linha 104) **bloqueia completamente** a criacao da ficha se o webhook URL nao estiver carregado:

```text
if (!webhookUrl) {
  toast.error("Configure o webhook de criacao de fichas nas configuracoes");
  return;   // <-- BLOQUEIA a criacao
}
```

O webhook URL e carregado de forma assincrona em `FichaPanel.tsx` via `fetchWebhookUrl()`. Se houver qualquer falha de rede, timeout, ou se o usuario abrir o dialogo antes do fetch completar, `webhookUrl` sera vazio e a criacao e bloqueada com a mensagem "Configure o webhook...".

**Causa secundaria:** A tabela `fichas_de_servico` tem uma foreign key `telefone_cliente -> clientes(telefone)`. Se por algum motivo o telefone do cliente nao corresponder exatamente ao formato armazenado na tabela `clientes`, a insercao falha com erro de constraint.

**O que o operador ve:** Toast de erro "Configure o webhook de criacao de fichas nas configuracoes" ou mensagem generica de erro.

### Problema 2: Prestadores nao conseguem enviar orcamento

**Causa provavel:** O formulario publico (`OrcamentoPublico.tsx`) funciona sem autenticacao. Banco de dados, RLS e grants estao configurados corretamente (confirmado via testes). As causas mais provaveis sao:

1. **Erros silenciosos na edge function**: A chamada `supabase.functions.invoke("submit-orcamento")` pode falhar em producao (timeout, CORS) e o erro e engolido silenciosamente
2. **Validacao de formulario bloqueando**: Campos obrigatorios como tempo estimado e categoria impedem o envio se nao preenchidos, mas a mensagem de erro pode nao ser clara no mobile
3. **Problemas de rede em mobile**: Prestadores acessam pelo celular, conexoes instáveis podem causar falha no INSERT

**O que o prestador ve:** "Erro ao enviar orcamento. Tente novamente." (mensagem generica sem detalhe da causa)

---

## Solucao

### 1. Corrigir `CriarFichaDialog.tsx` - Remover bloqueio do webhook

O webhook deve ser **opcional**, nao bloqueante. A ficha deve ser criada no banco independente do webhook.

**Antes:** Webhook obrigatorio, bloqueia criacao
**Depois:** Criar ficha primeiro, enviar webhook depois (sem bloquear)

Alteracoes:
- Remover o check `if (!webhookUrl)` que bloqueia a criacao (linha 104-107)
- Mover a prop `webhookUrl` para dentro do componente (buscar diretamente no submit)
- Adicionar log detalhado do erro no `catch` para facilitar diagnostico
- Melhorar mensagem de erro para mostrar o motivo real da falha

### 2. Corrigir `OrcamentoPublico.tsx` - Melhorar tratamento de erros

Alteracoes:
- Mostrar mensagem de erro detalhada (nao generica) quando o INSERT falha
- Adicionar console.log com o erro completo para debug
- Adicionar feedback visual de que o orcamento foi salvo mesmo que o webhook falhe
- Garantir que erros de rede sao tratados adequadamente

### 3. Atualizar `FichaPanel.tsx` - Tornar webhookUrl resiliente

Alteracoes:
- Remover a prop `webhookUrl` do `CriarFichaDialog` (sera buscado internamente)
- Simplificar o componente

---

## Detalhes tecnicos das alteracoes

### `CriarFichaDialog.tsx`

```text
ANTES (bloqueante):
  if (!webhookUrl) {
    toast.error("Configure o webhook...");
    return;   // BLOQUEIA
  }
  // inserir ficha
  // chamar webhook

DEPOIS (resiliente):
  // 1. Inserir ficha (SEMPRE)
  // 2. Buscar webhook URL internamente
  // 3. Se webhook URL existir, enviar (assincrono, nao bloqueia)
  // 4. Se falhar, logar erro mas NAO impedir criacao
```

- Remover prop `webhookUrl` da interface
- Buscar `webhook_criar_ficha` dentro do `handleSubmit` com try-catch
- Mensagem de erro detalhada: `toast.error(error.message || error.code || "Erro ao criar ficha")`

### `OrcamentoPublico.tsx`

- Na linha 356-359, melhorar o catch para mostrar detalhes:
```text
ANTES: toast.error("Erro", { description: "Erro ao enviar orcamento." })
DEPOIS: toast.error("Erro ao enviar", { description: error.message || error.code || "Erro de conexao" })
```

### `FichaPanel.tsx`

- Remover `fetchWebhookUrl` e estado `webhookUrl`
- Remover prop `webhookUrl` do `CriarFichaDialog`

---

## Resumo de impacto

| Arquivo | Alteracao | Impacto |
|---|---|---|
| `CriarFichaDialog.tsx` | Remover bloqueio do webhook, buscar URL internamente | Operadores sempre podem criar fichas |
| `OrcamentoPublico.tsx` | Melhorar mensagens de erro | Prestadores veem causa real da falha |
| `FichaPanel.tsx` | Remover logica de webhook desnecessaria | Simplificacao |

**Seguranca de dados:** Nenhum dado existente e modificado. As alteracoes afetam apenas o fluxo de criacao de novos registros.

