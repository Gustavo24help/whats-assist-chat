

## Restaurar NPS para escala 1 a 10

O sistema de NPS foi incorretamente alterado para escala 1-5. Precisa voltar para **1 a 10** com a classificacao classica do NPS. A escala 1-5 e exclusiva da Avaliacao do Prestador.

**Dados existentes**: Nenhum dado sera perdido. Respostas ja registradas na escala 1-5 continuarao validas. Respostas legado (notas > 5, ate 10) voltarao a ser tratadas normalmente.

---

### Alteracoes no `NPSFlowPanel.tsx`

1. **Mensagem inicial** (linha 171): Trocar "1 a 5" por "0 a 10"
2. **Mensagem invalida** (linha 178): Trocar "1 a 5" por "0 a 10"
3. **Classificacao** (linha 129-133): Restaurar logica classica do NPS:
   - 9-10 = Promotor
   - 7-8 = Neutro
   - 0-6 = Detrator
4. **Validacao de nota** (linha 270): Trocar `nota > 5` por `nota > 10`
5. **Regex de validacao** (linha 396): Trocar `^[1-5]$` por `^(10|[0-9])$`
6. **Botoes de nota** (linha 521): Trocar `[1,2,3,4,5]` por `[0,1,2,3,4,5,6,7,8,9,10]`
7. **Legenda dos botoes** (linhas 541-545): Atualizar para "0-6 Detrator / 7-8 Neutro / 9-10 Promotor"
8. **Cores dos botoes** (linhas 530-532): Ajustar faixas de cor para a nova escala
9. **Texto do alerta** (linha 666): Trocar "(1-2)" por "(0-6)"

### Alteracoes no `NPSMetricsKPIs.tsx`

1. **Filtro de dados** (linha 110-111): Aceitar notas de 0 a 10 (nao apenas 1-5)
2. **Filtro legado** (linha 115-117): Remover (ja nao ha "legado" com escala 0-10)
3. **Classificacao das metricas** (linhas 138-140): Restaurar faixas do NPS classico:
   - Promotores: 9-10
   - Neutros: 7-8
   - Detratores: 0-6
4. **Calculo do indice** (linha 142): Dividir por 10 (nao por 5)
5. **Titulos e labels**: Trocar "Satisfacao (1-5)" por "NPS (0-10)", "Notas 4-5" por "Notas 9-10", "Notas 1-2" por "Notas 0-6"
6. **Badge de legado** (linha 258): Remover referencia a "respostas legado 0-10"

### Arquivos afetados

| Arquivo | Tipo |
|---------|------|
| `src/components/NPSFlowPanel.tsx` | Editar |
| `src/components/NPSMetricsKPIs.tsx` | Editar |

### Protecoes

- Nenhuma tabela do banco sera alterada (a estrutura ja suporta notas inteiras)
- Dados existentes com notas 1-5 continuam validos e serao classificados corretamente pela nova logica
- O componente de Avaliacao do Prestador (`AvaliacaoPrestadorFlowPanel`) permanece inalterado na escala 1-5

