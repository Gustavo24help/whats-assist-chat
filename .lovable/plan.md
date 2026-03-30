

# Limpeza e verificação do fluxo de mensagens automáticas

## O que está desnecessário (remover)

### Fallback de template `link_pagamento` no `FichaServicoTab.tsx` (linhas 191-233)
O link de pagamento é enviado logo após criar a cobrança — o operador está em conversa ativa com o cliente, sempre dentro da janela 24h. O fallback para template `link_pagamento` **não tem utilidade real** e referencia um template que nem existe na Twilio. Deve ser removido, voltando ao comportamento original: se falhar por `FORA_JANELA_24H`, abre o dialog manual.

## O que já está correto e funcionando

### `send-recibo` (recibo pós-pagamento) ✅
- Gera PDF automaticamente → salva no storage → obtém URL pública
- **Dentro da janela 24h**: envia mensagem livre + PDF anexo
- **Fora da janela 24h**: envia template `recibo_confirmado` (`HX7cc2b987e2d793fb99d4d02cb1e5ebb7`) com variáveis `{{1}}=nome`, `{{2}}=ficha`, `{{3}}=valor` (sem prefixo R$)
- Fallback se PDF falhar: envia só texto
- Idempotência via `recibo_enviado`

### `send-nps` (pesquisa de satisfação) ✅
- **Dentro da janela 24h**: mensagem livre
- **Fora da janela 24h**: template `nps_avaliacao` (`HXc80ca7e035535fbbf35958ff55ca996d`) com `{{1}}=nome`, `{{2}}=ficha`
- Fallback: se mensagem livre falhar, tenta template automaticamente
- Idempotência via `nps_respostas`

## Alteração

**Arquivo:** `src/components/FichaServicoTab.tsx`
- Remover o bloco de fallback para template `link_pagamento` (linhas 191-233)
- Manter apenas: se `FORA_JANELA_24H`, retorna `{ success: false, reason: 'FORA_JANELA_24H' }` → abre dialog manual como antes

## Resultado final

| Fluxo | Dentro 24h | Fora 24h | Status |
|-------|-----------|----------|--------|
| Recibo | Msg livre + PDF | Template `recibo_confirmado` | ✅ Funcional |
| NPS | Msg livre | Template `nps_avaliacao` | ✅ Funcional |
| Link pagamento | Msg livre | Dialog manual | ✅ Suficiente |

