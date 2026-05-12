import { Copy, FileText, DollarSign, ArrowDownToLine, ArrowUpFromLine, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type IdKind = "ficha" | "receber" | "pagar" | "transacao" | "pagar_manual" | "generic";

interface IdBadgeProps {
  id: string;
  className?: string;
  prefix?: string;
  /**
   * Visual kind. Pagamentos usam cor/ícone diferentes da ficha para evitar confusão.
   * - ficha: neutro (padrão antigo)
   * - receber/pagar/transacao/pagar_manual: estilizados como pagamento
   */
  kind?: IdKind;
  label?: string;
}

const KIND_CONFIG: Record<IdKind, { prefix: string; cls: string; icon: any; label: string }> = {
  ficha:        { prefix: "FIC", cls: "border-border bg-muted/40 text-foreground",                                        icon: FileText,         label: "Ficha" },
  receber:      { prefix: "REC", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",   icon: ArrowDownToLine,  label: "Conta a Receber" },
  pagar:        { prefix: "PAG", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",           icon: ArrowUpFromLine,  label: "Conta a Pagar" },
  transacao:    { prefix: "TRX", cls: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",               icon: DollarSign,       label: "Transação" },
  pagar_manual: { prefix: "MAN", cls: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",       icon: Wallet,           label: "Lançamento Manual" },
  generic:      { prefix: "",    cls: "border-border bg-muted/40 text-foreground",                                        icon: Copy,             label: "ID" },
};

export function IdBadge({ id, className, prefix, kind = "generic", label }: IdBadgeProps) {
  if (!id) return <span className="text-xs text-muted-foreground">—</span>;

  const cfg = KIND_CONFIG[kind] || KIND_CONFIG.generic;
  const Icon = cfg.icon;
  const short = id.slice(0, 8);
  const usedPrefix = prefix ?? cfg.prefix;
  const display = usedPrefix ? `${usedPrefix}-${short}` : short;
  const tipLabel = label || cfg.label;

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    toast.success(`${tipLabel} copiado`);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={copy}
            className={cn(
              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] hover:opacity-80 transition-opacity",
              cfg.cls,
              className
            )}
          >
            <Icon className="h-3 w-3 opacity-70" />
            {display}
            <Copy className="h-3 w-3 opacity-50" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-[11px] font-semibold">{tipLabel}</p>
          <p className="font-mono text-xs">{id}</p>
          <p className="text-[10px] text-muted-foreground">Clique para copiar</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
