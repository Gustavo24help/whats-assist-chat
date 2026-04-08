import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
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

  if (!user) {
    const currentPath = location.pathname + location.search;
    const authUrl = currentPath && currentPath !== "/" ? `/auth?returnTo=${encodeURIComponent(currentPath)}` : "/auth";
    console.log('🚫 ProtectedRoute - Usuário não autenticado, redirecionando para:', authUrl);
    return <Navigate to={authUrl} replace />;
  }

  if (requireAdmin && !isAdmin) {
    console.log('🚫 ProtectedRoute - Acesso negado: usuário não é admin');
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
