

# Fix: Widget Rotativo text overflow / scrollbar issue

## Problem
The list-based widgets (Alertas "Ficha Criada" and "Orçamento Enviado") use `overflow-auto`, which creates a scrollbar when the widget is small. The proportional font scaling doesn't account for the **number of items** in the list — so when there are many alerts, they overflow instead of fitting.

## Solution
Make the list-based widgets **adaptive to content count**:

1. **Remove `overflow-auto`** — replace with `overflow-hidden` so no scrollbar appears.
2. **Calculate per-item font size** based on available height divided by number of items, with a minimum cap.
3. **Limit visible items** — if items can't fit even at minimum font size, show only what fits plus a "+N more" indicator.

### Changes in `src/pages/DashboardTV.tsx`

**`renderOpenConversationsWidget` (~lines 538-596) and `renderOrcamentoEnviadoWidget` (~lines 599-657):**

- Change `overflow-auto` to `overflow-hidden`
- After getting `alertas`, compute:
  ```
  const headerHeight = dims.labelFontSize * 1.8
  const availableHeight = dims.height - headerHeight - dims.padding * 2
  const minItemFontSize = 8
  const itemHeight = minItemFontSize * 2.2
  const maxVisibleItems = Math.max(1, Math.floor(availableHeight / itemHeight))
  const visibleAlerts = alertas.slice(0, maxVisibleItems)
  const hiddenCount = alertas.length - visibleAlerts.length
  ```
- Dynamically compute item font size: `Math.max(minItemFontSize, Math.min(availableHeight / (alertas.length * 2.2), dims.subFontSize))`
- Render only `visibleAlerts`, and if `hiddenCount > 0`, show a small "+N mais" badge at the bottom

### Changes in `src/components/dashboard/tv/TVAutoSizeWidget.tsx`
No changes needed — the widget container itself is fine.

This ensures list widgets always fit their container without scrollbars, showing as many items as possible at a readable size and indicating overflow with a count.

