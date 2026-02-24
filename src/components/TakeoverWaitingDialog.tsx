import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface TakeoverWaitingDialogProps {
  open: boolean;
  operadorNome: string;
  onTimeout: () => void;
  onClose: () => void;
}

const TIMEOUT_SECONDS = 15;

export const TakeoverWaitingDialog = ({
  open,
  operadorNome,
  onTimeout,
  onClose,
}: TakeoverWaitingDialogProps) => {
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SECONDS);

  useEffect(() => {
    if (!open) {
      setSecondsLeft(TIMEOUT_SECONDS);
      return;
    }

    setSecondsLeft(TIMEOUT_SECONDS);
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, onTimeout]);

  const progressPercent = (secondsLeft / TIMEOUT_SECONDS) * 100;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Aguardando resposta...
          </DialogTitle>
          <DialogDescription className="space-y-3">
            <p>
              Aguardando <strong>{operadorNome}</strong> responder à solicitação de takeover.
            </p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Tempo restante</span>
                <span className="font-mono font-semibold">{secondsLeft}s</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground">
              Se não houver resposta em {TIMEOUT_SECONDS} segundos, a conversa será transferida automaticamente.
            </p>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
