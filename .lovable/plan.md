

# Plan: Fix Build Error + Add Missing Routes & Navigation for Fichas

## Problems Found

1. **Build error** in `RegistroPonto.tsx` (line 32): Query selects only `id, entrada_em, saida_em` but state type expects `created_at` and `user_id` too. Fix: select `*` or add missing columns.

2. **Missing routes** in `App.tsx`: `/fichas` and `/ficha/:fichaId` pages were created but never added to the router.

3. **Missing Home card**: No navigation card for the new Fichas page on the Home screen.

## Changes

### 1. Fix `src/pages/RegistroPonto.tsx` (line 32)
- Change `.select("id, entrada_em, saida_em")` to `.select("*")` to include all columns the state type expects.

### 2. Add routes to `src/App.tsx`
- Add two protected routes before the catch-all:
  - `/fichas` → `<Fichas />`
  - `/ficha/:fichaId` → `<FichaDetalhes />`

### 3. Add Fichas card to `src/pages/Home.tsx`
- Add a navigation card for "Fichas de Serviço" linking to `/fichas`, using the `FileText` icon, positioned logically among the existing cards.

