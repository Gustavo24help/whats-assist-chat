

## Diagnóstico do número "82 agendados" no funil

O card **"Agendados / FS Criadas"** está mostrando a soma indevida:

```
servicosAgendados (exibido) = servicoAgendado (eventos do histórico) + finalizadoPago
```

Isso vem do `DashboardContent.tsx`:
```tsx
servicosAgendados={kpiData.servicoAgendadoTotal}  // = servicoAgendado + finalizadoPago
```

### Por que está errado

`servicoAgendadoTotal` é um **legado da lógica antiga** (quando a métrica usava `status` atual da ficha). Naquele modelo, fichas que já tinham passado para "Finalizado" sumiam de "Agendado", então somava-se `finalizadoPago` para "reconstituir" o total que passou pelo agendamento.

**Com a nova lógica baseada em `ficha_status_historico`, essa soma virou dupla contagem**: toda ficha finalizada já tem evento "Agendado" no histórico (status passa por Agendado antes de Finalizado), então ela já está dentro de `servicoAgendado`. Somar `finalizadoPago` em cima conta a mesma ficha 2x.

Validei no banco para período "30 dias":
- `servicoAgendado` (histórico+fallback) = **66**
- `finalizadoPago` = **48**
- soma exibida no card = **114**

Para o período/filtros atuais do seu dashboard (provavelmente um intervalo personalizado ou comparação ativa), essa soma resulta em **82**.

---

## Correção proposta

### Mudança única em `src/components/dashboard/DashboardContent.tsx`

Trocar:
```tsx
servicosAgendados={kpiData.servicoAgendadoTotal}
```
Por:
```tsx
servicosAgendados={kpiData.servicoAgendado}
```

### Efeito esperado

- **Agendados / FS Criadas**: passa a mostrar o número real de fichas que entraram em "Agendado" no período (sem somar finalizados pagos).
- **Finalizados / Agendados**: passa a usar a base correta (denominador menor), refletindo a taxa real de "do agendado fechou serviço".
- **Pagos / FS Criadas** e **Finalizados / FS Criadas**: não mudam (não dependem de `servicoAgendado`).

### O que NÃO muda

- `kpiData.servicoAgendado` continua sendo a contagem por evento do histórico (com fallback de `created_at` para fichas pré-fevereiro/2026).
- O card "Serviço Agendado" no bloco superior já usa `servicoAgendado` direto e está correto — só o funil estava aplicando a soma legada.
- Nenhuma mudança no hook, nas queries ou no banco.
- Nenhum outro consumidor de `servicoAgendadoTotal` é afetado (campo continua existindo no tipo, apenas deixa de ser usado aqui — pode ser removido em limpeza futura, mas mantenho por enquanto para não quebrar tipos).

### Arquivo alterado
- `src/components/dashboard/DashboardContent.tsx` (1 linha)

