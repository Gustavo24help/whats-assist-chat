import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface IdBadgeProps {
  id: string;
  className?: string;
  prefix?: string;
}

export function IdBadge({ id, className, prefix }: IdBadgeProps) {
  if (!id) return <span className="text-xs text-muted-foreground">—</span>;
  const short = id.slice(0, 8);
  const display = prefix ? `${prefix}-${short}` : short;

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    toast.success("ID copiado");
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={copy}
            className={cn(
              "inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:bg-muted transition-colors",
              className
            )}
          >
            {display}
            <Copy className="h-3 w-3 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-mono text-xs">{id}</p>
          <p className="text-[10px] text-muted-foreground">Clique para copiar</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
