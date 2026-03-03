import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNotifications } from "@/contexts/NotificationContext";

interface OrcamentoNotificationProps {
  onSelectFicha: (fichaId: string) => void;
}

export function OrcamentoNotification({ onSelectFicha }: OrcamentoNotificationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, markAsRead, markAllAsRead } = useNotifications();

  const orcamentoNotifications = notifications.filter((item) => item.tipo === "orcamento");

  const handleNotificationClick = async (notificationId: string, fichaId: string | null) => {
    if (!fichaId) return;

    await markAsRead(notificationId);
    onSelectFicha(fichaId);
    setIsOpen(false);
  };

  const formatTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: ptBR,
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("relative", orcamentoNotifications.length > 0 && "animate-notification-glow")}
        >
          <Bell className={cn("h-4 w-4", orcamentoNotifications.length > 0 && "animate-notification-ring")} />
          {orcamentoNotifications.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-semibold animate-pulse">
              {orcamentoNotifications.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b bg-muted/50">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Novos Orçamentos
          </h3>
        </div>

        {orcamentoNotifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Nenhum orçamento novo</div>
        ) : (
          <>
            <div className="max-h-96 overflow-y-auto">
              {orcamentoNotifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification.id, notification.referencia_id)}
                  className="w-full p-3 border-b hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="flex items-start gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5 shrink-0 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{notification.titulo}</div>
                      <div className="text-sm text-muted-foreground truncate">{notification.descricao || ""}</div>
                      <div className="flex items-center justify-end mt-1">
                        <span className="text-xs text-muted-foreground">{formatTimeAgo(notification.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-2 border-t bg-muted/30">
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await markAllAsRead();
                  setIsOpen(false);
                }}
                className="w-full text-xs"
              >
                Marcar todas como vistas
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
