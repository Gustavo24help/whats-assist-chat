

# Correcao de 4 Problemas: Notificacao, Leitura, Fichas e Pagamento

## Problema 1: Notificacao ao prestador no reagendamento

**Diagnostico:** O sistema nao envia notificacoes diretamente a prestadores no codigo. O fluxo de notificacao funciona assim:
1. Quando a ficha e salva/atualizada, um webhook e enviado para Make.com (`webhook_ficha_atualizada`)
2. O Make.com processa o payload e decide quais notificacoes enviar (ao prestador, ao cliente, etc.)

**Conclusao:** O problema esta no fluxo do Make.com, nao no codigo da aplicacao. O webhook envia TODOS os dados da ficha (incluindo `evento: 'ficha_atualizada'`), e o Make.com decide o que fazer. Se ao reagendar esta indo notificacao ao prestador mas nao ao cliente, o cenario do Make.com precisa ser ajustado.

**Acao:** Nenhuma alteracao de codigo necessaria neste projeto. O ajuste precisa ser feito no cenario do Make.com. O webhook ja envia todos os campos necessarios (horario_agendamento, status, prestador_cpf, telefone_cliente).

---

## Problema 2: Status de leitura (lido) incorreto

**Diagnostico:** A funcao `update-message-status` recebe callbacks da Twilio com o status `read` e marca como `lido`. Porem, ha dois problemas:

1. **Mensagens do cliente chegam com status `recebido`** - Correto, pois sao mensagens recebidas pelo sistema.
2. **Mensagens do atendente** - O status deveria seguir: `enviado` -> `recebido` (delivered) -> `lido` (read). A Twilio envia status callbacks quando o destinatario le a mensagem.

**Problema real identificado:** A send-whatsapp NAO configura `StatusCallback` na chamada da Twilio. Sem esse parametro, a Twilio nao envia callbacks de status para a nossa edge function `update-message-status`. Portanto, o status fica preso em `enviado` para sempre, a menos que outro mecanismo atualize.

**Solucao:**
- Na `send-whatsapp`, adicionar o parametro `StatusCallback` apontando para a URL da edge function `update-message-status`
- Na `send-template`, fazer o mesmo
- Isso fara com que a Twilio chame nosso endpoint quando o status mudar para `sent`, `delivered`, `read`

### Alteracoes tecnicas:

**`supabase/functions/send-whatsapp/index.ts`:**
- Adicionar `body.append('StatusCallback', statusCallbackUrl)` antes do fetch para a Twilio
- A URL sera: `${supabaseUrl}/functions/v1/update-message-status`

**`supabase/functions/send-template/index.ts`:**
- Mesmo ajuste, adicionar `StatusCallback` no formData

---

## Problema 3: Ficha - apenas ultima aparece / filtro confuso com multiplas fichas

**Diagnostico:** O `FichaPanel.tsx` ja implementa um seletor de fichas (Select/dropdown) que lista todas as fichas do cliente, ordenadas por `created_at desc`. O problema esta em como a ficha inicial e selecionada:

1. `FichaPanel` busca `ficha_ativa_id` do cliente. Se nao existe, usa `data[0]` (a mais recente).
2. `ChatWindow.fetchClienteData()` tambem define `fichaId` - usa `ficha_ativa_id` do cliente, ou faz fallback para a ultima ficha criada.
3. Quando `fichaAtual` nao corresponde a nenhuma ficha existente (ex: foi deletada ou e de outro cliente), o Select fica vazio.

**Problema real:** O `ficha_ativa_id` no cliente pode estar desatualizado ou apontando para uma ficha errada. Alem disso, ao trocar entre fichas no dropdown, o `marcarFichaComoAtiva` atualiza `ficha_ativa_id`, mas se o usuario nao faz isso, a ficha padrao sempre sera a mesma.

**Solucao:**
- No `FichaPanel.fetchFichas()`, validar que `ficha_ativa_id` existe na lista de fichas retornada. Se nao existir, usar a mais recente e atualizar `ficha_ativa_id` no banco.
- Garantir que ao criar nova ficha, ela se torne a ficha ativa automaticamente.

### Alteracoes tecnicas:

**`src/components/FichaPanel.tsx`:**
```
const fetchFichas = async () => {
  const { data } = await supabase
    .from('fichas_de_servico')
    .select('id, nome_ficha')
    .eq('telefone_cliente', clienteTelefone)
    .order('created_at', { ascending: false });

  if (data && data.length > 0) {
    setFichas(data);
    
    const { data: clienteData } = await supabase
      .from('clientes')
      .select('ficha_ativa_id')
      .eq('telefone', clienteTelefone)
      .single();

    // Validar que ficha_ativa_id existe na lista
    const fichaAtivaValida = clienteData?.ficha_ativa_id 
      && data.some(f => f.id === clienteData.ficha_ativa_id);
    
    const fichaInicial = fichaAtivaValida 
      ? clienteData.ficha_ativa_id 
      : data[0].id;
    
    setFichaAtual(fichaInicial);
    
    // Corrigir ficha_ativa_id se estava invalida
    if (!fichaAtivaValida) {
      marcarFichaComoAtiva(data[0].id);
    }
  }
};
```

- Ao criar ficha (`criarFicha`), apos o insert, chamar `marcarFichaComoAtiva(novaFichaId)` e depois `fetchFichas()`.

---

## Problema 4: Link de pagamento nao esta sendo criado

**Diagnostico:** O campo `pagamento_gerar_link` e enviado no webhook como `"Sim"` ou `"Nao"`. O campo `pagamento_link` e um campo de texto que pode ser preenchido manualmente na ficha ou atualizado externamente via a edge function `update-pagamento`.

**Fluxo atual:**
1. Operador marca `pagamento_gerar_link = true` na ficha
2. Ao salvar, o webhook envia para o Make.com com `pagamento_gerar_link: "Sim"`
3. O Make.com deveria criar o link no Asaas e retornar via `update-pagamento`
4. A edge function `update-pagamento` atualiza `pagamento_link` na ficha

**Problemas identificados:**
- A criacao de ficha em `CriarFichaDialog.tsx` e em `FichaPanel.criarFicha()` define `pagamento_gerar_link: false` por padrao
- O webhook so e disparado ao salvar manualmente ou ao mudar status. Se o usuario marca a checkbox mas nao salva, o Make.com nunca recebe a informacao
- O campo `pagamento_gerar_link` nao dispara auto-save (somente mudanca de status faz auto-save)

**Solucao:**
- Quando `pagamento_gerar_link` mudar para `true`, disparar o auto-save automaticamente (similar ao que ja acontece com mudanca de status)
- Garantir que o valor padrao ao criar ficha seja `true` (como a maioria das fichas precisa de link)
- Verificar se o webhook esta chegando corretamente no Make.com (isso esta fora do escopo do codigo, mas o lado do app estara correto)

### Alteracoes tecnicas:

**`src/components/FichaServicoTab.tsx`:**
Na funcao `updateFicha`, alem de auto-save em mudanca de status, tambem auto-save quando `pagamento_gerar_link` mudar:

```
const updateFicha = (updates: Partial<Ficha>) => {
  // ... validacoes existentes ...
  const updatedFicha = { ...ficha, ...updates };
  setFicha(updatedFicha);
  
  // Auto-save em mudanca de STATUS
  if (updates.status && updates.status !== ficha.status) {
    autoSave(fichaId, updatedFicha, ...);
  }
  
  // Auto-save quando pagamento_gerar_link mudar
  if (updates.pagamento_gerar_link !== undefined 
      && updates.pagamento_gerar_link !== ficha.pagamento_gerar_link) {
    autoSave(fichaId, updatedFicha, ...);
  }
};
```

**`src/components/FichaPanel.tsx`:**
Mudar `pagamento_gerar_link: false` para `pagamento_gerar_link: true` no `criarFicha()`.

---

## Resumo das alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/send-whatsapp/index.ts` | Adicionar StatusCallback URL na chamada Twilio |
| `supabase/functions/send-template/index.ts` | Adicionar StatusCallback URL na chamada Twilio |
| `src/components/FichaPanel.tsx` | Validar ficha_ativa_id, auto-selecionar ficha ao criar, default pagamento_gerar_link=true |
| `src/components/FichaServicoTab.tsx` | Auto-save ao mudar pagamento_gerar_link |

**Nota sobre Problema 1 (Notificacao ao prestador):** O ajuste deve ser feito no cenario do Make.com, pois o codigo ja envia todos os dados necessarios no webhook. Nao ha logica de notificacao ao prestador no codigo da aplicacao.

