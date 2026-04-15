

# Filtrar calendário por status

## O que muda

Adicionar filtro na query do calendário para mostrar apenas fichas com status **"Retorno"**, **"Visita Técnica Agendada"** ou **"Agendado"**.

## Arquivo: `src/pages/Calendario.tsx`

Na query `fetchData`, adicionar `.in('status', ['Retorno', 'Visita Técnica Agendada', 'Agendado'])` para que apenas fichas nesses 3 status sejam retornadas do banco.

Isso filtra direto na query SQL, reduzindo dados trafegados e garantindo que o calendário só exiba o que os operadores precisam ver.

## Impacto

- Nenhuma alteração de dados existentes — é apenas um filtro de leitura.
- Os contadores de legenda (Serviço, Visita Técnica, Retorno) passarão a refletir apenas fichas nesses status.
- Fichas com status como "Finalizado", "Perdido", "Negociação" etc. deixarão de aparecer no calendário.

