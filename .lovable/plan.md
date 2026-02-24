
# Solicitacao de Assumir Conversa Ocupada (Takeover Request)

## Contexto atual

Hoje, quando um operador quer assumir uma conversa que ja esta atribuida a outro, ele depende do operador atual para liberar manualmente (transferir ou remover atribuicao). Isso gera dependencia operacional -- o operador precisa pedir ao colega ou ate usar o computador dele.

## Solucao proposta

Criar um fluxo de **solicitacao de takeover** com as seguintes regras:

1. Operador A clica em "Assumir para mim" em uma conversa atribuida ao Operador B
2. Um popup aparece para o Operador B pedindo permissao (15 segundos para responder)
3. Se o Operador B **aprovar**: conversa e transferida imediatamente
4. Se o Operador B **negar**: solicitacao e cancelada, Operador A recebe feedback
5. Se o Operador B **nao responder em 15 segundos** (PC desligado, app fechado, etc.): conversa e transferida automaticamente

## Arquitetura tecnica

### Comunicacao entre operadores: Supabase Realtime Broadcast

Usar o canal de **broadcast** do Supabase Realtime (ja utilizado no projeto para mensagens do bot). Nao precisa de tabela nova -- broadcast e peer-to-peer via canais.

```text
Operador A                    Canal Realtime                   Operador B
    |                              |                                |
    |-- broadcast: takeover_request --------------------------->    |
    |                              |                     [popup 15s]|
    |                              |                                |
    |   <-- broadcast: takeover_response (approved/denied) -----   |
    |                              |                                |
    [se timeout 15s sem resposta: assume automaticamente]
```

### Tabela de backup: `takeover_requests`

Para cobrir o cenario em que o Operador B esta offline, precisamos de uma tabela para persistir a solicitacao e verificar timeout no lado do solicitante.

```sql
CREATE TABLE public.takeover_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone_cliente text NOT NULL,
  solicitante_id uuid NOT NULL,
  solicitante_nome text NOT NULL,
  operador_atual_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending, approved, denied, expired
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

ALTER TABLE public.takeover_requests ENABLE ROW LEVEL SECURITY;

-- Politicas: autenticados podem ler/inserir/atualizar
CREATE POLICY "Atendentes podem ver solicitacoes"
  ON public.takeover_requests FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Atendentes podem inserir solicitacoes"
  ON public.takeover_requests FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Atendentes podem atualizar solicitacoes"
  ON public.takeover_requests FOR UPDATE TO authenticated
  USING (true);

-- Realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.takeover_requests;
```

### Fluxo detalhado

**Operador A (solicitante):**
1. Clica "Assumir para mim" em conversa ocupada
2. Sistema cria registro em `takeover_requests` com status `pending`
3. Envia broadcast no canal `takeover-{telefone_cliente}` com evento `takeover_request`
4. Exibe dialog "Aguardando resposta de {Operador B}..." com countdown de 15s
5. Escuta broadcast de resposta no mesmo canal
6. Se receber `approved` ou timeout de 15s: executa `atribuirOperador()` e marca status como `approved`/`expired`
7. Se receber `denied`: fecha dialog com feedback

**Operador B (operador atual):**
1. Ao abrir o ChatWindow, subscribe no canal `takeover-{telefone_cliente}`
2. Tambem subscribe em `postgres_changes` na tabela `takeover_requests` (para quando nao receber o broadcast)
3. Ao receber solicitacao: exibe AlertDialog com countdown visual de 15s
4. Se clicar "Permitir": envia broadcast `takeover_response: approved`, atualiza registro
5. Se clicar "Negar": envia broadcast `takeover_response: denied`, atualiza registro
6. Se nao responder: nada acontece do lado dele (o solicitante assume por timeout)

**Cenario offline do Operador B:**
- Broadcast nao sera recebido (esperado)
- Apos 15 segundos sem resposta, Operador A assume automaticamente
- O registro na tabela muda para `expired`
- Quando Operador B voltar, vera que a conversa foi reatribuida (via realtime existente de `clientes`)

## Alteracoes em arquivos

### 1. Migracao SQL
- Criar tabela `takeover_requests`
- Adicionar a tabela ao `supabase_realtime`

### 2. `src/components/ChatWindow.tsx`
- Modificar o botao "Assumir para mim" no popover (linhas ~1511-1529): se `atendenteAtual` existe e nao e o usuario atual, iniciar fluxo de takeover ao inves de atribuicao direta
- Adicionar canal de broadcast `takeover-{telefone_cliente}` no useEffect de realtime
- Adicionar estado para `takeoverRequest` (solicitacao recebida pendente)
- Adicionar dialog de "Solicitacao de takeover recebida" com countdown e botoes Permitir/Negar
- Adicionar dialog de "Aguardando resposta..." com countdown para o solicitante
- Manter a logica existente de supervisores/admins: estes continuam podendo assumir diretamente sem pedir permissao

### 3. `src/components/TakeoverRequestDialog.tsx` (novo)
- Componente para o popup do operador que recebe a solicitacao
- Countdown visual de 15 segundos
- Botoes "Permitir" e "Negar"
- Auto-fecha ao expirar

### 4. `src/components/TakeoverWaitingDialog.tsx` (novo)
- Componente para o popup do operador que esta aguardando resposta
- Countdown visual de 15 segundos
- Mensagem "Aguardando resposta de {nome}..."
- Auto-assume ao expirar

## Regras de permissao preservadas

- **Supervisores/Admins**: continuam podendo assumir diretamente, sem solicitar permissao (comportamento atual mantido)
- **Operadores comuns**: precisam solicitar takeover quando a conversa pertence a outro operador
- **Conversa sem dono**: qualquer operador pode assumir diretamente (comportamento atual mantido)

## Seguranca de dados

- Nenhum dado existente e modificado
- A tabela `takeover_requests` e apenas de controle/log
- As atribuicoes continuam usando o campo `atendente_id` da tabela `clientes` exatamente como hoje
