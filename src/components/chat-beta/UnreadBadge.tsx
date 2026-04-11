import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";

export interface UnreadBadgeProps {
  count: number;
  operadorNome?: string | null;
  tempoHa?: string | null;
}

export function UnreadBadge({ count, operadorNome, tempoHa }: UnreadBadgeProps) {
  if (count === 0 && !operadorNome) return null;

  return (
    <div className="flex flex-col items-end gap-0.5">
      {count > 0 && (
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold">
            {count}
          </span>
          <span className="text-[10px] text-muted-foreground">não lido</span>
        </div>
      )}

      {operadorNome && tempoHa && (
        <div className="flex items-center gap-1 text-[10px] text-blue-600">
          <Eye className="h-3 w-3" />
          <span>
            Lida por {operadorNome} {tempoHa}
          </span>
        </div>
      )}
    </div>
  );
}
