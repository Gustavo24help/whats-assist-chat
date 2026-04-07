import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogOut, Clock } from "lucide-react";

interface ExitReminderPopupProps {
  open: boolean;
  exitTime: string | null;
  onDismiss: () => void;
  onLogout: () => void;
}

export function ExitReminderPopup({ open, exitTime, onDismiss, onLogout }: ExitReminderPopupProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Lembrete de Saída
          </DialogTitle>
          <DialogDescription>
            Seu horário de saída previsto é às <strong>{exitTime || "—"}</strong>. Lembre-se de deslogar para redistribuir seus chats.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onDismiss}>Fechar</Button>
          <Button variant="destructive" onClick={onLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Deslogar agora
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
