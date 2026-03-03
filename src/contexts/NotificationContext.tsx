import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Notification {
  id: string;
  tipo: string;
  referencia_id: string | null;
  titulo: string;
  descricao: string | null;
  lida: boolean;
  created_at: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const initializedForUser = useRef<string | null>(null);

  const loadUnreadNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    const db = supabase as any;
    const { data, error } = await db
      .from("notificacoes")
      .select("id, tipo, referencia_id, titulo, descricao, lida, created_at")
      .eq("usuario_destino", user.id)
      .eq("lida", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar notificações:", error);
      return;
    }

    setNotifications((data ?? []) as Notification[]);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      initializedForUser.current = null;
      setNotifications([]);
      return;
    }

    if (initializedForUser.current !== user.id) {
      initializedForUser.current = user.id;
      loadUnreadNotifications();
    }

    const channel = supabase
      .channel(`notificacoes-realtime-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
        },
        (payload) => {
          const newNotification = payload.new as Notification & { usuario_destino?: string };

          if (newNotification.usuario_destino !== user.id || newNotification.lida) {
            return;
          }

          setNotifications((prev) => {
            if (prev.some((item) => item.id === newNotification.id)) {
              return prev;
            }

            return [newNotification, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notificacoes",
        },
        (payload) => {
          const updatedNotification = payload.new as Notification & { usuario_destino?: string };
          if (updatedNotification.usuario_destino !== user.id) {
            return;
          }

          setNotifications((prev) => prev.filter((item) => item.id !== updatedNotification.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadUnreadNotifications, user?.id]);

  const markAsRead = useCallback(async (id: string) => {
    const db = supabase as any;
    const { error } = await db
      .from("notificacoes")
      .update({ lida: true })
      .eq("id", id);

    if (error) {
      console.error("Erro ao marcar notificação como lida:", error);
      return;
    }

    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user?.id || notifications.length === 0) return;

    const ids = notifications.map((item) => item.id);

    const db = supabase as any;
    const { error } = await db
      .from("notificacoes")
      .update({ lida: true })
      .in("id", ids)
      .eq("usuario_destino", user.id);

    if (error) {
      console.error("Erro ao marcar todas as notificações como lidas:", error);
      return;
    }

    setNotifications([]);
  }, [notifications, user?.id]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: notifications.length,
      markAsRead,
      markAllAsRead,
    }),
    [markAsRead, markAllAsRead, notifications]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotifications deve ser usado dentro de NotificationProvider");
  }

  return context;
};
