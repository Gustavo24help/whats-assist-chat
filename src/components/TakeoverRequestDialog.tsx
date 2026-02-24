import React, { useState, useEffect, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UserCheck, X } from "lucide-react";

interface TakeoverRequestDialogProps {
  open: boolean;
  solicitanteNome: string;
  onApprove: () => void;
  onDeny: () => void;
}

const TIMEOUT_SECONDS = 15;

export const TakeoverRequestDialog = ({
  open,
  solicitanteNome,
  onApprove,
  onDeny,
}: TakeoverRequestDialogProps) => {
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
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open]);

  const progressPercent = (secondsLeft / TIMEOUT_SECONDS) * 100;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Solicitação de Takeover
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              <strong>{solicitanteNome}</strong> está solicitando assumir esta conversa.
            </p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Tempo para responder</span>
                <span className="font-mono font-semibold">{secondsLeft}s</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground">
              Se você não responder, a conversa será transferida automaticamente.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={onDeny}
            className="gap-1"
          >
            <X className="h-3.5 w-3.5" />
            Negar
          </Button>
          <Button
            size="sm"
            onClick={onApprove}
            className="gap-1"
          >
            <UserCheck className="h-3.5 w-3.5" />
            Permitir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
