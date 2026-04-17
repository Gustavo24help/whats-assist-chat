import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface ConfirmReenvioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** "link de pagamento" | "recibo" etc. */
  tipo: string;
  count: number;
  ultimoEnvioEm: string | null;
  ultimoEnvioOrigem: string | null; // 'automatico' | 'manual' | null
  ultimoEnvioPorNome?: string | null;
}

const formatDateTime = (iso: string | null) => {
  if (!iso) return "data desconhecida";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export const ConfirmReenvioDialog = ({
  open,
  onOpenChange,
  onConfirm,
  tipo,
  count,
  ultimoEnvioEm,
  ultimoEnvioOrigem,
  ultimoEnvioPorNome,
}: ConfirmReenvioDialogProps) => {
  const origemLabel =
    ultimoEnvioOrigem === "automatico"
      ? "envio automático"
      : ultimoEnvioOrigem === "manual"
        ? `manual${ultimoEnvioPorNome ? ` por ${ultimoEnvioPorNome}` : ""}`
        : "origem desconhecida";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Este {tipo} já foi enviado
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 pt-2 text-sm">
              <p>
                O {tipo} já foi enviado <strong>{count} vez{count > 1 ? "es" : ""}</strong> ao cliente.
              </p>
              <p className="text-muted-foreground">
                Último envio: <strong>{formatDateTime(ultimoEnvioEm)}</strong> ({origemLabel}).
              </p>
              <p className="pt-2">Tem certeza que deseja enviar novamente?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Reenviar mesmo assim</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
