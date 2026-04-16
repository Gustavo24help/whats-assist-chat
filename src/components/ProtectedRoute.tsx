import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { savePendingRoute } from '@/lib/authRedirect';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();
  const [verifyingSession, setVerifyingSession] = useState(false);
  const [sessionConfirmedNull, setSessionConfirmedNull] = useState(false);

  // Quando loading termina e user é null, verificar com getSession antes de redirecionar
  useEffect(() => {
    if (!loading && !user && !sessionConfirmedNull && !verifyingSession) {
      setVerifyingSession(true);
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          setSessionConfirmedNull(true);
        }
        // Se session existe, o AuthContext vai atualizar o user via onAuthStateChange
        setVerifyingSession(false);
      });
    }
  }, [loading, user, sessionConfirmedNull, verifyingSession]);

  // Reset quando user volta
  useEffect(() => {
    if (user) {
      setSessionConfirmedNull(false);
    }
  }, [user]);

  if (loading || verifyingSession || (!user && !sessionConfirmedNull)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user && sessionConfirmedNull) {
    const currentPath = location.pathname + location.search;
    savePendingRoute(currentPath);
    const authUrl = currentPath && currentPath !== "/"
      ? `/auth?returnTo=${encodeURIComponent(currentPath)}`
      : "/auth";
    console.log('🚫 ProtectedRoute - Sessão confirmada como nula, redirecionando para:', authUrl);
    return <Navigate to={authUrl} replace />;
  }

  if (requireAdmin && !isAdmin) {
    console.log('🚫 ProtectedRoute - Acesso negado: usuário não é admin');
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
