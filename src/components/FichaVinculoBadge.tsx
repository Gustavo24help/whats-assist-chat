import { Badge } from "@/components/ui/badge";
import { Link2 } from "lucide-react";
import { useOpenInNewTab } from "@/hooks/useOpenInNewTab";

interface FichaVinculoBadgeProps {
  isPrincipal: boolean;
  isVinculada: boolean;
  fichaPrincipalId?: string | null;
  outrosMembrosCount: number;
  compact?: boolean;
}

export const FichaVinculoBadge = ({
  isPrincipal,
  isVinculada,
  fichaPrincipalId,
  outrosMembrosCount,
  compact = false,
}: FichaVinculoBadgeProps) => {
  const { openRoute } = useOpenInNewTab();

  if (!isPrincipal && !isVinculada) return null;

  if (isPrincipal) {
    return (
      <Badge variant="outline" className="gap-1 text-xs border-blue-300 text-blue-700 bg-blue-50">
        <Link2 className="h-3 w-3" />
        {compact ? `+${outrosMembrosCount}` : `Principal · ${outrosMembrosCount} vinculada(s)`}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="gap-1 text-xs border-amber-300 text-amber-700 bg-amber-50 cursor-pointer hover:bg-amber-100"
      onClick={() => fichaPrincipalId && openRoute(`/fichas/${fichaPrincipalId}`)}
    >
      <Link2 className="h-3 w-3" />
      {compact ? "🔗" : `Vinculada → ${fichaPrincipalId}`}
    </Badge>
  );
};
