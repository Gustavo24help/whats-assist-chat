
## Escopo atualizado

Identifiquei **30 fichas** com status `Agendado` registrado nos períodos:
- **14/04 a 18/04** (15 fichas)
- **22/04 a 24/04** (6 fichas)
- **27/04 a 30/04** (9 fichas)

Total estimado: ~600+ mensagens de atendente para classificar.

## Metodologia

Para cada ficha:

### 1. Operador responsável pelo agendamento
Última mensagem de `tipo_remetente='atendente'` **antes** do registro `Agendado` em `ficha_status_historico`. Uso `operador_nome` dessa mensagem.

### 2. Janela de horários vs Horário fixo
Análise textual nas mensagens do atendente entre criação da ficha e o agendamento:

- **JANELA**: regex como `entre \d+`, `das? \d+\s*(às|as|até|a)\s*\d+`, `\d+h\s*(às|as|até|-)\s*\d+h`, `período da (manhã|tarde)`, "manhã ou tarde", "qualquer horário".
- **FIXO**: apenas horário pontual ("às 14h", "14:00") sem intervalo.
- **Indefinido**: sem evidência clara — listado para auditoria.

### 3. Mensagem padrão "15. SERVIÇO AGENDADO"
Texto: *"Obrigada. Seu serviço foi agendado. Fico a disposição! 😊"*

Busco nas mensagens do atendente até 2h após o registro `Agendado`. Match por similaridade (tolera variação de emoji/pontuação).

### 4. Agregação por operador

```
Operador | Fichas agendadas | Janela | Fixo | Indefinido | Padrão enviada | Padrão NÃO enviada
```

Mais um detalhamento ficha-a-ficha para auditoria.

## Entrega
Relatório em chat com tabelas. Sem alteração de código/banco — análise read-only.

## Ressalva
A heurística texto-livre pode marcar casos ambíguos como **Indefinido** — vou listar essas fichas explicitamente para você revisar.

Aprovando, eu rodo a análise e devolvo o relatório.
