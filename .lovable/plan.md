

## Plano: Restaurar pagamento das fichas antigas

### O que será feito

Executar um UPDATE em `fichas_de_servico` para marcar `pagamento_realizado = true` em todas as fichas finalizadas antes do cutoff (13/03), **exceto** as 22 fichas listadas que continuam pendentes.

### SQL a executar (via insert tool)

```sql
UPDATE fichas_de_servico
SET pagamento_realizado = true
WHERE status = 'Finalizado'
  AND updated_at < '2026-03-13T23:00:00.000Z'
  AND pagamento_realizado = false
  AND valor_total > 0
  AND id NOT IN (
    'FGM3@20250922',
    'FGM10@20251027',
    'FS2-251103',
    'FS6-251110',
    'FS5-260209',
    'FS11-260211',
    'FS2-260211',
    'FS2-260212',
    'FS3-260220',
    'FS2-260220',
    'FS1-260225',
    'FS6-260220',
    'FS4-260209',
    'FS4-260306',
    'FS3-260223',
    'FS3-260310',
    'FGM1@260302',
    'FS5-260305',
    'FS6-260223',
    'FS2-260313'
  );
```

**Nota:** Alguns IDs aparecem duplicados na lista (FS3-260223 x2, FS6-260223 x3) — serão tratados como um único ID cada.

### Nenhum arquivo de código será alterado

Apenas dados no banco.

