import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock } from "lucide-react";

interface InactivityWarningModalProps {
  open: boolean;
  minutesLeft: number;
  onDismiss: () => void;
}

export const InactivityWarningModal = ({ open, minutesLeft, onDismiss }: InactivityWarningModalProps) => {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Aviso de Inatividade
          </AlertDialogTitle>
          <AlertDialogDescription>
            Você será desconectado em <strong>{minutesLeft} minuto{minutesLeft !== 1 ? "s" : ""}</strong> por inatividade.
            Clique no botão abaixo para continuar conectado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onDismiss}>
            Continuar conectado
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
